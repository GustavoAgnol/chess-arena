const jogo = new Chess();

const tabuleiro = document.getElementById("board");
const status = document.getElementById("game-status");
const mensagem = document.getElementById("message");
const historico = document.getElementById("history");

let selecionada = null;
let movimentosPossiveis = [];
let tabuleiroInvertido = false;
let ultimaJogada = null;
let pensandoBot = false;

const camadaPecas = document.createElement("div");
camadaPecas.className = "piece-layer";

const pecasDOM = new Map();

const classificacoesJogadas = new Map();

// =====================================
// LIVRO DE ABERTURAS
// =====================================

const livroAberturas = [
  "e4 e5 Nf3 Nc6 Bc4 Bc5",
  "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6",
  "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6",
  "e4 e6 d4 d5 Nc3 Bb4",
  "e4 c6 d4 d5 Nc3 dxe4 Nxe4",
  "e4 e5 Nf3 Nc6 d4 exd4 Nxd4",
  "e4 e5 Nf3 Nf6",
  "e4 d5 exd5 Qxd5 Nc3 Qa5",
  "d4 d5 c4 e6 Nc3 Nf6",
  "d4 d5 c4 c6 Nf3 Nf6 Nc3",
  "d4 d5 Bf4 Nf6 e3 e6 Nf3",
  "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6",
  "c4 e5 Nc3 Nf6",
  "Nf3 d5 c4",
  "e4 d6 d4 Nf6 Nc3 g6",
  "e4 e5 Nc3 Nf6"
];

function ehLanceDeLivro(numeroJogada) {
  const historico = jogo.history().slice(0, numeroJogada);

  return livroAberturas.some(linha => {
    const lances = linha.split(" ");

    return historico.length <= lances.length &&
      historico.every((lance, i) => lance === lances[i]);
  });
}


const simbolos = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" }
};

// =====================================
// CONEXÃO COM STOCKFISH
// =====================================

let motor;
let motorPronto = false;
let filaMotor = Promise.resolve();

try {
  motor = new Worker("./engine/stockfish-19-lite-single.js");

  motor.onmessage = event => {
    const linha = event.data;

    if (linha === "uciok") {
      motor.postMessage("isready");
    }

    if (linha === "readyok") {
      motorPronto = true;
      console.log("Chess Arena: Stockfish pronto!");
    }
  };

  motor.onerror = erro => {
    console.error("Erro ao carregar Stockfish:", erro);
    mensagem.textContent = "Não foi possível carregar o motor de xadrez.";
  };

  motor.postMessage("uci");

} catch (erro) {
  console.error("Erro ao iniciar Stockfish:", erro);
}

// Pedir uma análise ao Stockfish


function buscarNoMotor(fen, profundidade = 14) {
  const tarefa = () => new Promise(resolve => {
    if (!motorPronto) {
      resolve(null);
      return;
    }

    let melhorPontuacao = 0;

    const receberMensagem = event => {
      const linha = event.data;

      if (linha.startsWith("info ") && linha.includes(" score ")) {
        const resultado = linha.match(
          /score (cp|mate) (-?\d+)/
        );

        if (resultado) {
          const tipo = resultado[1];
          const valor = Number(resultado[2]);

          melhorPontuacao = tipo === "mate"
            ? (valor > 0 ? 100000 : -100000)
            : valor;
        }
      }

      if (linha.startsWith("bestmove")) {
        motor.removeEventListener("message", receberMensagem);

        resolve({
          pontuacao: melhorPontuacao,
          melhorJogada: linha.split(" ")[1]
        });
      }
    };

    motor.addEventListener("message", receberMensagem);

    motor.postMessage("position fen " + fen);
    motor.postMessage("go depth " + profundidade);
  });

  filaMotor = filaMotor.then(tarefa, tarefa);
  return filaMotor;
}



// Converter avaliação para a perspectiva das brancas
function pontuacaoBrancas(resultado, fen) {
  if (!resultado) return 0;

  const pontuacao = resultado.pontuacao;
  const vez = fen.split(" ")[1];

  return vez === "w" ? pontuacao : -pontuacao;
}

// =====================================
// AVALIAÇÃO DAS JOGADAS
// =====================================

async function avaliarJogada(fenAntes, fenDepois, corJogador, numeroJogada) {
  // Primeiro, verificar se o lance é de abertura
  if (ehLanceDeLivro(numeroJogada)) {
    classificacoesJogadas.set(numeroJogada, "Livro");
    atualizarHistorico();
    return;
  }

  // Verificar se o lance terminou a partida em xeque-mate
  const jogoDepois = new Chess(fenDepois);

  if (jogoDepois.in_checkmate()) {
    classificacoesJogadas.set(numeroJogada, "Xeque-mate");
    atualizarHistorico();
    return;
  }

  if (!motorPronto) return;

  // Analisar a posição antes e depois do lance
  const antes = await buscarNoMotor(fenAntes, 14);
  const depois = await buscarNoMotor(fenDepois, 14);

  if (!antes || !depois) return;

  // Converter as avaliações para a perspectiva das brancas
  const avaliacaoAntes = pontuacaoBrancas(antes, fenAntes);
  const avaliacaoDepois = pontuacaoBrancas(depois, fenDepois);

  // Calcular quanto o jogador perdeu com seu lance
  const perda = corJogador === "w"
    ? avaliacaoAntes - avaliacaoDepois
    : avaliacaoDepois - avaliacaoAntes;

  const perdaCentipeoes = Math.max(0, perda);

  let classificacao;

  if (perdaCentipeoes <= 10) {
    classificacao = "Excelente";
  } else if (perdaCentipeoes <= 30) {
    classificacao = "Boa";
  } else if (perdaCentipeoes <= 70) {
    classificacao = "Imprecisão";
  } else if (perdaCentipeoes <= 130) {
    classificacao = "Erro";
  } else {
    classificacao = "Capivarada";
  }

  classificacoesJogadas.set(numeroJogada, classificacao);
  atualizarHistorico();
}
// =====================================
// CRIAÇÃO DO TABULEIRO
// =====================================

function criarTabuleiro() {
  tabuleiro.innerHTML = "";
  pecasDOM.clear();

  for (let linha = 0; linha < 8; linha++) {
    for (let coluna = 0; coluna < 8; coluna++) {
      const casa = document.createElement("div");

      casa.classList.add("square");

      const letra = "abcdefgh"[coluna];
      const numero = 8 - linha;
      const nomeCasa = letra + numero;

      casa.dataset.square = nomeCasa;

      if ((linha + coluna) % 2 === 0) {
        casa.classList.add("light");
      } else {
        casa.classList.add("dark");
      }

      casa.addEventListener("click", () => {
        clicarCasa(nomeCasa);
      });

      casa.addEventListener("dragover", event => {
        event.preventDefault();
      });

      casa.addEventListener("drop", event => {
        event.preventDefault();

        const origem = event.dataTransfer.getData("text");

        if (origem) {
          moverPeca(origem, nomeCasa);
        }
      });

      tabuleiro.appendChild(casa);
    }
  }

  tabuleiro.appendChild(camadaPecas);
}

// =====================================
// DESENHAR PEÇAS
// =====================================

function desenharPecas() {
  const casasOcupadas = new Set();

  for (let linha = 0; linha < 8; linha++) {
    for (let coluna = 0; coluna < 8; coluna++) {
      const nome = "abcdefgh"[coluna] + (8 - linha);
      const peca = jogo.get(nome);

      if (!peca) continue;

      casasOcupadas.add(nome);

      let elemento = pecasDOM.get(nome);

      if (!elemento) {
        elemento = document.createElement("span");
        elemento.className = "piece";
        elemento.draggable = true;

        elemento.addEventListener("dragstart", event => {
          if (jogo.turn() === "b" || pensandoBot) {
            event.preventDefault();
            return;
          }

          const casaAtual = elemento.dataset.square;

          event.dataTransfer.setData("text", casaAtual);
          selecionada = casaAtual;

          mostrarMovimentos(casaAtual);
        });

        elemento.addEventListener("click", event => {
          event.stopPropagation();
          clicarCasa(elemento.dataset.square);
        });

        camadaPecas.appendChild(elemento);
        pecasDOM.set(nome, elemento);
      }

      elemento.dataset.square = nome;
      elemento.textContent = simbolos[peca.color][peca.type];

      elemento.classList.toggle("white-piece", peca.color === "w");
      elemento.classList.toggle("black-piece", peca.color === "b");

      elemento.style.transform =
        `translate(${coluna * 100}%, ${linha * 100}%)`;
    }
  }

  for (const [casa, elemento] of pecasDOM) {
    if (!casasOcupadas.has(casa)) {
      elemento.remove();
      pecasDOM.delete(casa);
    }
  }
}

// =====================================
// DESENHAR TABULEIRO
// =====================================

function desenharTabuleiro() {
  const casas = document.querySelectorAll(".square");

  casas.forEach(casa => {
    const nome = casa.dataset.square;
    const peca = jogo.get(nome);

    casa.innerHTML = "";

    casa.classList.remove("selected", "last-move");

    if (nome[0] === "a") {
      const coordenada = document.createElement("span");
      coordenada.className = "coordinates";
      coordenada.textContent = nome[1];
      casa.appendChild(coordenada);
    }

    if (nome[1] === "1") {
      const coordenada = document.createElement("span");
      coordenada.className = "coordinates";
      coordenada.textContent = nome[0];
      casa.appendChild(coordenada);
    }

    if (
      ultimaJogada &&
      (nome === ultimaJogada.from || nome === ultimaJogada.to)
    ) {
      casa.classList.add("last-move");
    }

    if (nome === selecionada) {
      casa.classList.add("selected");
    }

    const movimento = movimentosPossiveis.find(m => m.to === nome);

    if (movimento) {
      const marcador = document.createElement("div");

      marcador.className = peca
        ? "capture-dot"
        : "move-dot";

      casa.appendChild(marcador);
    }
  });

  desenharPecas();
  atualizarInformacoes();
}

// =====================================
// SELEÇÃO DE PEÇAS
// =====================================

function clicarCasa(casa) {
  if (jogo.turn() === "b" || pensandoBot) return;

  const peca = jogo.get(casa);

  if (selecionada === casa) {
    selecionada = null;
    movimentosPossiveis = [];
    desenharTabuleiro();
    return;
  }

  if (peca && peca.color === jogo.turn()) {
    mostrarMovimentos(casa);
    return;
  }

  if (selecionada) {
    moverPeca(selecionada, casa);
  }
}

function mostrarMovimentos(casa) {
  selecionada = casa;

  movimentosPossiveis = jogo.moves({
    square: casa,
    verbose: true
  });

  desenharTabuleiro();
}

// =====================================
// MOVIMENTAR PEÇAS
// =====================================

async function moverPeca(origem, destino, movimentoDoBot = false) {
  if (pensandoBot && !movimentoDoBot) return;

  const fenAntes = jogo.fen();
  const corJogador = jogo.turn();

  let movimento;

  try {
    movimento = jogo.move({
      from: origem,
      to: destino,
      promotion: "q"
    });

    if (!movimento) {
      mensagem.textContent = "Movimento inválido. Escolha uma casa destacada.";
      return;
    }
  } catch (erro) {
    mensagem.textContent = "Esse movimento não é permitido.";
    return;
  }

  const fenDepois = jogo.fen();
  const numeroJogada = jogo.history().length;

classificacoesJogadas.set(numeroJogada, "Analisando...");

  // Atualizar última jogada
  ultimaJogada = movimento;
  selecionada = null;
  movimentosPossiveis = [];

  desenharTabuleiro();

  // Criar espaço para a classificação
 avaliarJogada(fenAntes, fenDepois, corJogador, numeroJogada);

  // Se for a vez das pretas, chamar o bot
  if (jogo.turn() === "b" && !jogo.game_over()) {
    setTimeout(jogadaBot, 300);
  }
}

// =====================================
// BOT COM STOCKFISH
// =====================================

async function jogadaBot() {
  if (jogo.turn() !== "b" || jogo.game_over() || pensandoBot) return;

  if (!motorPronto) {
    mensagem.textContent = "Aguardando o Stockfish carregar...";
    setTimeout(jogadaBot, 1000);
    return;
  }

  pensandoBot = true;
  mensagem.textContent = "O Stockfish está pensando...";

  const resultado = await buscarNoMotor(jogo.fen(), 12);

  pensandoBot = false;

  if (!resultado || !resultado.melhorJogada || jogo.turn() !== "b") {
    return;
  }

  const jogada = resultado.melhorJogada;

  const origem = jogada.substring(0, 2);
  const destino = jogada.substring(2, 4);

  await moverPeca(origem, destino, true);
}

// =====================================
// INFORMAÇÕES DA PARTIDA
// =====================================

function atualizarInformacoes() {
  const vez = jogo.turn() === "w" ? "Brancas" : "Pretas";

  status.textContent = vez + " jogam";

  document.getElementById("white-status").textContent =
    jogo.turn() === "w" ? "Sua vez!" : "Aguardando...";

  document.getElementById("black-status").textContent =
    jogo.turn() === "b" ? "Pensando..." : "Aguardando...";

  if (jogo.in_checkmate()) {
    status.textContent = "Xeque-mate!";
    mensagem.textContent =
      "Fim de jogo! " +
      (jogo.turn() === "w" ? "Pretas" : "Brancas") +
      " venceram.";
  } else if (jogo.in_draw()) {
    status.textContent = "Empate!";
    mensagem.textContent = "A partida terminou empatada.";
  } else if (jogo.in_check()) {
    mensagem.textContent = "Xeque! O rei está ameaçado.";
  } else if (!pensandoBot) {
    mensagem.textContent = "Selecione uma peça e escolha seu destino.";
  }

  atualizarHistorico();
}

// =====================================
// HISTÓRICO
// =====================================


function atualizarHistorico() {
  historico.innerHTML = "";

  const jogadas = jogo.history();

  for (let i = 0; i < jogadas.length; i += 2) {
    const numero = document.createElement("span");
    numero.className = "move-number";
    numero.textContent = (i / 2 + 1) + ".";

    const branca = document.createElement("span");
    branca.className = "move";
    const classificacaoBranca = classificacoesJogadas.get(i + 1);
    branca.textContent = jogadas[i] +
      (classificacaoBranca ? " • " + classificacaoBranca : "");

    const preta = document.createElement("span");
    preta.className = "move";

    if (jogadas[i + 1]) {
      const classificacaoPreta = classificacoesJogadas.get(i + 2);
      preta.textContent = jogadas[i + 1] +
        (classificacaoPreta ? " • " + classificacaoPreta : "");
    } else {
      preta.textContent = "";
    }

    historico.appendChild(numero);
    historico.appendChild(branca);
    historico.appendChild(preta);
  }
}
// =====================================
// BOTÕES
// =====================================

document.getElementById("restart").addEventListener("click", () => {
  jogo.reset();

  pensandoBot = false;
  selecionada = null;
  movimentosPossiveis = [];
  ultimaJogada = null;

  desenharTabuleiro();
});

document.getElementById("undo").addEventListener("click", () => {
  if (pensandoBot) return;

  // Desfazer a jogada do bot e a do jogador
  if (jogo.history().length >= 2) {
    jogo.undo();
    jogo.undo();
  } else {
    jogo.undo();
  }

  const historicoCompleto = jogo.history({ verbose: true });
  ultimaJogada = historicoCompleto.length
    ? historicoCompleto[historicoCompleto.length - 1]
    : null;

  selecionada = null;
  movimentosPossiveis = [];

  desenharTabuleiro();
});

document.getElementById("flip").addEventListener("click", () => {
  tabuleiroInvertido = !tabuleiroInvertido;

  const casas = [...document.querySelectorAll(".square")];

  casas.reverse().forEach(casa => {
    tabuleiro.appendChild(casa);
  });

  // Recolocar a camada de peças por cima
  tabuleiro.appendChild(camadaPecas);
});

// =====================================
// INICIAR
// =====================================

criarTabuleiro();
desenharTabuleiro();
