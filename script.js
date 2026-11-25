const jogo = new Chess();

const tabuleiro = document.getElementById("board");
const status = document.getElementById("game-status");
const mensagem = document.getElementById("message");
const historico = document.getElementById("history");

let selecionada = null;
let movimentosPossiveis = [];
let tabuleiroInvertido = false;
let ultimaJogada = null;

// Camada onde as peças ficam animadas
const camadaPecas = document.createElement("div");

camadaPecas.className = "piece-layer";

// Guardar cada peça para reutilizá-la
const pecasDOM = new Map();

const simbolos = {
  w: {
    k: "♔",
    q: "♕",
    r: "♖",
    b: "♗",
    n: "♘",
    p: "♙"
  },
  b: {
    k: "♚",
    q: "♛",
    r: "♜",
    b: "♝",
    n: "♞",
    p: "♟"
  }
};

// Criar as 64 casas
function criarTabuleiro() {
  tabuleiro.innerHTML = "";

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

// Colocar a camada de peças sobre as casas
tabuleiro.appendChild(camadaPecas);

  function desenharPecas() {
  const casasOcupadas = new Set();

  for (let linha = 0; linha < 8; linha++) {
    for (let coluna = 0; coluna < 8; coluna++) {
      const letra = "abcdefgh"[coluna];
      const numero = 8 - linha;
      const nome = letra + numero;

      const peca = jogo.get(nome);

      if (!peca) continue;

      casasOcupadas.add(nome);

      let elemento = pecasDOM.get(nome);

      // Criar a peça apenas se ela ainda não existir
      if (!elemento) {
        elemento = document.createElement("span");

        elemento.className = "piece";
        elemento.draggable = true;

        elemento.addEventListener("dragstart", event => {
          const casaAtual = elemento.dataset.square;

          event.dataTransfer.setData("text", casaAtual);

          selecionada = casaAtual;

          mostrarMovimentos(casaAtual);
        });

        camadaPecas.appendChild(elemento);

        pecasDOM.set(nome, elemento);
      }

      elemento.dataset.square = nome;

      elemento.textContent =
        simbolos[peca.color][peca.type];

      elemento.classList.toggle(
        "white-piece",
        peca.color === "w"
      );

      elemento.classList.toggle(
        "black-piece",
        peca.color === "b"
      );

      // Calcular a posição da peça no tabuleiro
      const x = coluna * 100;
      const y = linha * 100;

      elemento.style.transform =
        `translate(${x}%, ${y}%)`;
    }
  }

  // Remover peças que foram capturadas
  for (const [casa, elemento] of pecasDOM) {
    if (!casasOcupadas.has(casa)) {
      elemento.remove();
      pecasDOM.delete(casa);
    }
  }
}

desenharTabuleiro();
}

// Desenhar as peças

function desenharPecas() {
  const casasOcupadas = new Set();

  for (let linha = 0; linha < 8; linha++) {
    for (let coluna = 0; coluna < 8; coluna++) {
      const letra = "abcdefgh"[coluna];
      const numero = 8 - linha;
      const nome = letra + numero;

      const peca = jogo.get(nome);

      if (!peca) continue;

      casasOcupadas.add(nome);

      let elemento = pecasDOM.get(nome);

      if (!elemento) {
        elemento = document.createElement("span");
        elemento.className = "piece";
        elemento.draggable = true;

        elemento.addEventListener("dragstart", event => {
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

function desenharTabuleiro() {
  const casas = document.querySelectorAll(".square");

  casas.forEach(casa => {
    const nome = casa.dataset.square;
    const peca = jogo.get(nome);

    casa.innerHTML = "";

    casa.classList.remove(
      "selected",
      "last-move"
    );

    // Coordenadas
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

    // Última jogada
    if (
      ultimaJogada &&
      (nome === ultimaJogada.from ||
       nome === ultimaJogada.to)
    ) {
      casa.classList.add("last-move");
    }

    // Casa selecionada
    if (nome === selecionada) {
      casa.classList.add("selected");
    }

    // Mostrar peça
  

    // Destinos possíveis
    const movimento = movimentosPossiveis.find(
      m => m.to === nome
    );

    if (movimento) {
      const marcador = document.createElement("div");

      if (peca) {
        marcador.className = "capture-dot";
      } else {
        marcador.className = "move-dot";
      }

      casa.appendChild(marcador);
    }
  });

  desenharPecas();

atualizarInformacoes();
}

// Selecionar peça
function clicarCasa(casa) {
  if (jogo.turn() === "b") return;
  const peca = jogo.get(casa);

  if (selecionada === casa) {
    selecionada = null;
    movimentosPossiveis = [];

    desenharTabuleiro();

    return;
  }

  // Selecionar uma peça da própria cor
  if (peca && peca.color === jogo.turn()) {
    mostrarMovimentos(casa);
    return;
  }

  // Tentar mover para a casa clicada
  if (selecionada) {
    moverPeca(selecionada, casa);
  }
}

// Mostrar movimentos legais
function mostrarMovimentos(casa) {
  selecionada = casa;

  movimentosPossiveis = jogo.moves({
    square: casa,
    verbose: true
  });

  desenharTabuleiro();
}

// Movimentar peça
function jogadaBot() {
  // O bot joga somente com as peças pretas
  if (jogo.turn() !== "b") return;

  // Buscar todos os movimentos legais
  const movimentos = jogo.moves({ verbose: true });

  if (movimentos.length === 0) return;

  // Escolher um movimento aleatório
  const escolhido =
    movimentos[Math.floor(Math.random() * movimentos.length)];

  // Fazer o movimento do bot
  moverPeca(escolhido.from, escolhido.to);
}

function moverPeca(origem, destino) {
  try {
    const movimento = jogo.move({
      from: origem,
      to: destino,
      promotion: "q"
    });

    if (!movimento) {
      mensagem.textContent = "Movimento inválido. Escolha uma casa destacada.";
      return;
    }

    const elemento = pecasDOM.get(origem);
    pecasDOM.delete(origem);

    // Remover peça capturada
    const capturada = pecasDOM.get(destino);

    if (capturada) {
      capturada.remove();
      pecasDOM.delete(destino);
    }

    // Captura en passant
    if (movimento.flags.includes("e")) {
      const casaCapturada = destino[0] + origem[1];
      const peao = pecasDOM.get(casaCapturada);

      if (peao) {
        peao.remove();
        pecasDOM.delete(casaCapturada);
      }
    }

    // Roque: movimentar a torre
    if (
      movimento.flags.includes("k") ||
      movimento.flags.includes("q")
    ) {
      const linha = movimento.color === "w" ? "1" : "8";

      const torreOrigem = movimento.flags.includes("k")
        ? "h" + linha
        : "a" + linha;

      const torreDestino = movimento.flags.includes("k")
        ? "f" + linha
        : "d" + linha;

      const torre = pecasDOM.get(torreOrigem);

      if (torre) {
        pecasDOM.delete(torreOrigem);
        torre.dataset.square = torreDestino;
        pecasDOM.set(torreDestino, torre);
      }
    }

    // Atualizar posição da peça movimentada
    if (elemento) {
      elemento.dataset.square = destino;
      pecasDOM.set(destino, elemento);
    }

    ultimaJogada = movimento;
    selecionada = null;
    movimentosPossiveis = [];

    desenharTabuleiro();

    // Se for a vez das pretas, o bot joga
if (jogo.turn() === "b") {
  setTimeout(jogadaBot, 500);
}

  } catch (erro) {
    mensagem.textContent = "Esse movimento não é permitido.";
  }
}

// Atualizar status e histórico
function atualizarInformacoes() {
  const vez = jogo.turn() === "w"
    ? "Brancas"
    : "Pretas";

  status.textContent = vez + " jogam";

  document.getElementById("white-status").textContent =
    jogo.turn() === "w"
      ? "Sua vez!"
      : "Aguardando...";

  document.getElementById("black-status").textContent =
    jogo.turn() === "b"
      ? "Sua vez!"
      : "Aguardando...";

  if (jogo.in_checkmate()) {
    status.textContent = "Xeque-mate!";
    mensagem.textContent =
      "Fim de jogo! " +
      (jogo.turn() === "w" ? "Pretas" : "Brancas") +
      " venceram.";
  } else if (jogo.in_draw()) {
    status.textContent = "Empate!";
    mensagem.textContent =
      "A partida terminou empatada.";
  } else if (jogo.in_check()) {
    mensagem.textContent =
      "Xeque! O rei está ameaçado.";
  } else {
    mensagem.textContent =
      "Selecione uma peça e escolha seu destino.";
  }

  atualizarHistorico();
}

// Histórico
function atualizarHistorico() {
  historico.innerHTML = "";

  const jogadas = jogo.history();

  for (let i = 0; i < jogadas.length; i += 2) {
    const numero = document.createElement("span");

    numero.className = "move-number";
    numero.textContent = (i / 2 + 1) + ".";

    const branca = document.createElement("span");

    branca.className = "move";
    branca.textContent = jogadas[i];

    const preta = document.createElement("span");

    preta.className = "move";
    preta.textContent = jogadas[i + 1] || "";

    historico.appendChild(numero);
    historico.appendChild(branca);
    historico.appendChild(preta);
  }
}

// Reiniciar partida
document.getElementById("restart").addEventListener("click", () => {
  jogo.reset();

  selecionada = null;
  movimentosPossiveis = [];
  ultimaJogada = null;

  desenharTabuleiro();
});

// Desfazer jogada
document.getElementById("undo").addEventListener("click", () => {
  const movimento = jogo.undo();

  if (movimento) {
    ultimaJogada = jogo.history({ verbose: true }).pop() || null;

    selecionada = null;
    movimentosPossiveis = [];

    desenharTabuleiro();
  }
});

// Virar tabuleiro
document.getElementById("flip").addEventListener("click", () => {
  tabuleiroInvertido = !tabuleiroInvertido;

  const casas = [...document.querySelectorAll(".square")];

  casas.reverse().forEach(casa => {
    tabuleiro.appendChild(casa);
  });
});

// Iniciar
criarTabuleiro();