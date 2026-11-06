/* ==========================================================
   VACINAÇÃO NO BRASIL — lógica da página
   ==========================================================
   1. Base de dados das vacinas (e do "mapa de cidades")
   2. Normalização de texto e busca fuzzy (reconhece termos
      parecidos, incluindo erros de digitação)
   3. Renderização dos resultados como hiperlinks
   4. Espaço reservado para a API do Power BI
   5. Previsão Inteligente de cobertura (API local em Python)
   ========================================================== */

/* ---------- 1. Base de dados ---------- */

// Capitais e algumas grandes cidades, usadas como palavras-chave
// para a busca por localização. Adicione ou troque livremente.
const LISTA_CIDADES = [
  "sao paulo", "rio de janeiro", "belo horizonte", "brasilia",
  "salvador", "fortaleza", "curitiba", "recife", "porto alegre",
  "manaus", "belem", "goiania", "campinas", "sao luis", "maceio",
  "natal", "joao pessoa", "teresina", "aracaju", "cuiaba",
  "campo grande", "florianopolis", "vitoria", "palmas", "macapa",
  "boa vista", "rio branco", "porto velho"
];

const VACINAS = [
  {
    id: "mapa-amigo",
    nome: "Mapa de Postos de Vacinação",
    descricao: "Encontre unidades de saúde por cidade ou bairro.",
    url: "https://vacina-mapa-amigo.pages.dev/",
    palavrasChave: [
      "mapa", "cidade", "cidades", "municipio", "posto de saude",
      "postos de vacinacao", "unidade de saude", "onde vacinar",
      "endereco", "localizacao", "perto de mim", "ubs",
      ...LISTA_CIDADES
    ]
  },
  {
    id: "meningo",
    nome: "Vacina Meningocócica",
    descricao: "Proteção contra a meningite meningocócica.",
    url: "https://vacina-meningo.pages.dev/",
    palavrasChave: [
      "meningo", "meningite", "meningococica", "meningococo",
      "acwy", "men c", "meningites"
    ]
  },
  {
    id: "pneumo",
    nome: "Vacina Pneumocócica",
    descricao: "Proteção contra doenças pneumocócicas, como a pneumonia.",
    url: "https://vacina-pneumo.pages.dev/",
    palavrasChave: [
      "pneumo", "pneumonia", "pneumococica", "pneumococo",
      "pneumo23", "polissacaridica"
    ]
  },
  {
    id: "febre-amarela",
    nome: "Vacina Febre Amarela",
    descricao: "Proteção contra a febre amarela.",
    url: "https://vacina-febre-amarela.pages.dev/",
    palavrasChave: [
      "febre amarela", "amarela", "febre", "yellow fever"
    ]
  },
  {
    id: "poliomielite",
    nome: "Vacina Poliomielite",
    descricao: "Proteção contra a poliomielite (paralisia infantil).",
    url: "https://vacina-poliomielite.pages.dev/",
    palavrasChave: [
      "polio", "poliomielite", "paralisia infantil", "vip", "vop",
      "gotinha", "sabin"
    ]
  },
  {
    id: "pneumo-conjugada",
    nome: "Vacina Pneumocócica Conjugada",
    descricao: "Proteção conjugada contra doenças pneumocócicas (pneumo 10 e 13).",
    url: "https://bde080d0.pneumoconjugada.pages.dev/",
    palavrasChave: [
      "pneumo conjugada", "pneumococica conjugada", "conjugada",
      "pneumo10", "pneumo13", "pcv10", "pcv13", "pneumonia", "pneumo"
    ]
  },
  {
    id: "penta",
    nome: "Vacina Pentavalente",
    descricao: "Protege contra difteria, tétano, coqueluche, hepatite B e Hib.",
    url: "https://1f361547.penta-l1n.pages.dev/",
    palavrasChave: [
      "penta", "pentavalente", "dtp", "difteria", "tetano",
      "coqueluche", "hepatite b", "hib", "haemophilus"
    ]
  },
  {
    id: "rotavirus",
    nome: "Vacina Rotavírus",
    descricao: "Proteção contra diarreia grave causada pelo rotavírus.",
    url: "https://c7670464.rotavirus.pages.dev/",
    palavrasChave: [
      "rotavirus", "rota", "diarreia", "gastroenterite"
    ]
  },
  {
    id: "bcg",
    nome: "Vacina BCG",
    descricao: "Proteção contra as formas graves da tuberculose.",
    url: "https://bcg-71y.pages.dev/",
    palavrasChave: [
      "bcg", "tuberculose", "bacilo de calmette"
    ]
  },
  {
    id: "varicela",
    nome: "Vacina Varicela",
    descricao: "Proteção contra a varicela (catapora).",
    url: "https://varicela.pages.dev/",
    palavrasChave: [
      "varicela", "catapora", "tetraviral", "varicella"
    ]
  }
];

const LIMIAR_SIMILARIDADE = 0.68;

// Palavras genéricas demais para ajudar a diferenciar um item do
// outro (aparecem em quase todos os nomes ou são apenas conectivos).
const PALAVRAS_IGNORADAS = new Set([
  "vacina", "vacinas", "contra", "da", "de", "do", "das", "dos",
  "a", "o", "as", "os", "em", "no", "na", "para", "e"
]);

/* ---------- 2. Normalização e busca fuzzy ---------- */

function normalizar(texto) {
  return texto
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .trim();
}

// Distância de Levenshtein: quantas edições (inserir, remover,
// trocar um caractere) separam duas palavras.
function distanciaLevenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const linhaAnterior = new Array(n + 1);
  const linhaAtual = new Array(n + 1);

  for (let j = 0; j <= n; j++) linhaAnterior[j] = j;

  for (let i = 1; i <= m; i++) {
    linhaAtual[0] = i;
    for (let j = 1; j <= n; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      linhaAtual[j] = Math.min(
        linhaAnterior[j] + 1,      // remoção
        linhaAtual[j - 1] + 1,     // inserção
        linhaAnterior[j - 1] + custo // substituição
      );
    }
    for (let j = 0; j <= n; j++) linhaAnterior[j] = linhaAtual[j];
  }
  return linhaAnterior[n];
}

// Similaridade entre 0 (nada a ver) e 1 (idêntico). Combina
// correspondência por trecho (substring) com a distância de edição,
// para reconhecer tanto buscas parciais quanto erros de digitação.
function similaridade(a, b) {
  if (!a.length || !b.length) return 0;
  if (a === b) return 1;
  if (b.includes(a) || a.includes(b)) {
    const maior = Math.max(a.length, b.length);
    const menor = Math.min(a.length, b.length);
    return 0.75 + 0.25 * (menor / maior);
  }
  const distancia = distanciaLevenshtein(a, b);
  const maiorTamanho = Math.max(a.length, b.length);
  return 1 - distancia / maiorTamanho;
}

function pontuarItem(consultaNormalizada, item) {
  const termos = [item.nome, ...item.palavrasChave].map(normalizar);
  let melhorPontuacao = 0;

  termos.forEach((termo) => {
    melhorPontuacao = Math.max(melhorPontuacao, similaridade(consultaNormalizada, termo));
  });

  // Para consultas com mais de uma palavra, compara também
  // palavra por palavra (ex.: "vacina polio" ainda encontra "polio").
  const palavrasConsulta = consultaNormalizada
    .split(/\s+/)
    .filter((palavra) => palavra && !PALAVRAS_IGNORADAS.has(palavra));
  if (palavrasConsulta.length > 1 || (palavrasConsulta.length === 1 && palavrasConsulta[0] !== consultaNormalizada)) {
    palavrasConsulta.forEach((palavra) => {
      termos.forEach((termo) => {
        melhorPontuacao = Math.max(melhorPontuacao, similaridade(palavra, termo) * 0.9);
      });
    });
  }

  return melhorPontuacao;
}

function buscar(consulta) {
  const consultaNormalizada = normalizar(consulta);
  if (!consultaNormalizada) return [];

  return VACINAS
    .map((item) => ({ item, pontuacao: pontuarItem(consultaNormalizada, item) }))
    .filter((resultado) => resultado.pontuacao >= LIMIAR_SIMILARIDADE)
    .sort((a, b) => b.pontuacao - a.pontuacao)
    .map((resultado) => resultado.item);
}

/* ---------- 3. Renderização dos resultados ---------- */

function escapeHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

function renderizarResultados(lista, consultaOriginal) {
  const container = document.getElementById("resultados");
  container.innerHTML = "";

  if (!consultaOriginal.trim()) {
    container.innerHTML =
      '<p class="resultados__vazio">Digite o nome de uma vacina ou de uma cidade para começar.</p>';
    atualizarPainel(null);
    return;
  }

  if (lista.length === 0) {
    container.innerHTML =
      '<p class="resultados__vazio">Nenhum resultado parecido com "' +
      escapeHtml(consultaOriginal) +
      '". Tente outro termo, como "poliomielite" ou o nome da sua cidade.</p>';
    atualizarPainel(null);
    return;
  }

  const listaEl = document.createElement("ul");
  listaEl.className = "resultados__lista";

  lista.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML =
      '<a class="resultado-cartao__link" href="' + item.url +
      '" target="_blank" rel="noopener noreferrer" data-id="' + item.id + '">' +
      '<span class="resultado-cartao__nome">' + escapeHtml(item.nome) + "</span>" +
      '<span class="resultado-cartao__descricao">' + escapeHtml(item.descricao) + "</span>" +
      '<span class="resultado-cartao__acao">Abrir página</span>' +
      "</a>";
    listaEl.appendChild(li);
  });

  container.appendChild(listaEl);
  atualizarPainel(lista[0]);
}

/* ---------- 4. Espaço reservado para a API do Power BI ----------
   Passo a passo para ligar o painel de verdade:

   1) Inclua o SDK oficial no index.html, antes de script.js:
        <script src="https://cdn.jsdelivr.net/npm/powerbi-client@2/dist/powerbi.min.js"></script>

   2) No Power BI Service, gere a embedUrl e um token de acesso
      (embedToken) para o relatório que deseja exibir.

   3) Preencha CONFIGURACAO_POWERBI abaixo com esses valores.

   4) A função iniciarPowerBi() já chama powerbi.embed(...) sozinha
      assim que o SDK estiver disponível — não precisa mexer em mais
      nada além dos dados de configuração.

   5) A cada resultado clicado, configurarFiltroPowerBi(item) tenta
      aplicar um filtro no relatório (troque "Vacinas"/"Nome" pelos
      nomes reais da tabela e da coluna do seu modelo de dados).
------------------------------------------------------------------- */

const CONFIGURACAO_POWERBI = {
  type: "report",
  id: "COLOQUE_AQUI_O_ID_DO_RELATORIO",
  embedUrl: "COLOQUE_AQUI_A_EMBED_URL",
  accessToken: "COLOQUE_AQUI_O_TOKEN_DE_ACESSO",
  settings: {
    panes: { filters: { visible: false } }
  }
};

let relatorioPowerBi = null;

function iniciarPowerBi() {
  const container = document.getElementById("powerbi-container");
  // "powerbi" só existe depois que o SDK oficial é incluído no HTML.
  if (!container || typeof powerbi === "undefined") return;

  container.innerHTML = "";
  relatorioPowerBi = powerbi.embed(container, CONFIGURACAO_POWERBI);
}

function configurarFiltroPowerBi(item) {
  if (!relatorioPowerBi) return; // relatório ainda não configurado

  const filtro = {
    $schema: "http://powerbi.com/product/schema#basic",
    target: { table: "Vacinas", column: "Nome" },
    operator: "In",
    values: [item.nome]
  };

  relatorioPowerBi.setFilters([filtro]).catch(function (erro) {
    console.error("Não foi possível aplicar o filtro no Power BI:", erro);
  });
}

function atualizarPainel(item) {
  const filtroEl = document.getElementById("painel-filtro");
  if (!item) {
    filtroEl.textContent = "Nenhum termo pesquisado ainda.";
    return;
  }
  filtroEl.textContent = "Filtro atual: " + item.nome;
  configurarFiltroPowerBi(item);
}

/* ---------- 5. Previsão Inteligente (API local em Python) ----------
   Consome o endpoint POST /predict (FastAPI + Random Forest):
     envia   { lag_cobertura, mes_numero, imunobiologico }
     recebe  { imunobiologico, mes, cobertura_prevista }
------------------------------------------------------------------- */

const API_PREVISAO_URL = "http://127.0.0.1:8000/predict";
const TEMPO_LIMITE_API_MS = 15000;

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

class ErroApi extends Error {}

function classificarCobertura(valor) {
  if (valor >= 90) return { nivel: "alta", rotulo: "Meta atingida (90% ou mais)" };
  if (valor >= 70) return { nivel: "media", rotulo: "Atenção (entre 70% e 89%)" };
  return { nivel: "baixa", rotulo: "Risco de baixa cobertura (abaixo de 70%)" };
}

function formatarNumero(valor) {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

async function solicitarPrevisao(payload) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TEMPO_LIMITE_API_MS);

  try {
    const resposta = await fetch(API_PREVISAO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controlador.signal
    });

    if (!resposta.ok) {
      let detalhe = "";
      try {
        const corpo = await resposta.json();
        if (typeof corpo.detail === "string") detalhe = " " + corpo.detail;
      } catch (_) { /* corpo sem JSON */ }
      throw new ErroApi(
        "A API respondeu com erro (código " + resposta.status + ")." + detalhe
      );
    }

    const dados = await resposta.json();
    if (typeof dados.cobertura_prevista !== "number") {
      throw new ErroApi("A API retornou uma resposta em formato inesperado.");
    }
    return dados;
  } finally {
    clearTimeout(temporizador);
  }
}

function iniciarPrevisaoIA() {
  const formulario = document.getElementById("form-previsao");
  if (!formulario) return;

  const campoVacina = document.getElementById("previsao-vacina");
  const campoMes = document.getElementById("previsao-mes");
  const campoLag = document.getElementById("previsao-lag");
  const erroCampo = document.getElementById("previsao-erro-campo");
  const botao = document.getElementById("botao-previsao");
  const textoBotao = botao.querySelector(".previsao__botao-texto");

  const areaResultado = document.getElementById("previsao-resultado");
  const saida = document.getElementById("previsao-saida");
  const contexto = document.getElementById("previsao-contexto");
  const valorEl = document.getElementById("previsao-valor");
  const selo = document.getElementById("previsao-selo");
  const barra = document.getElementById("previsao-barra");
  const delta = document.getElementById("previsao-delta");
  const erroTexto = document.getElementById("previsao-erro-texto");

  function definirEstado(estado) {
    areaResultado.dataset.estado = estado;
  }

  function definirCarregando(carregando) {
    botao.disabled = carregando;
    botao.setAttribute("aria-busy", carregando ? "true" : "false");
    textoBotao.textContent = carregando ? "Calculando..." : "Simular previsão";
  }

  function mostrarResultado(dados, dadosEnviados, rotuloVacina) {
    const previsto = dados.cobertura_prevista;
    const classificacao = classificarCobertura(previsto);
    const diferenca = previsto - dadosEnviados.lag_cobertura;
    const sinal = diferenca > 0 ? "+" : diferenca < 0 ? "−" : "";

    contexto.textContent =
      rotuloVacina + " · " + MESES[dadosEnviados.mes_numero - 1];
    valorEl.textContent = formatarNumero(previsto) + "%";
    selo.textContent = classificacao.rotulo;
    saida.dataset.nivel = classificacao.nivel;
    delta.textContent =
      sinal + formatarNumero(Math.abs(diferenca)) +
      " p.p. em relação ao mês anterior (" +
      formatarNumero(dadosEnviados.lag_cobertura) + "%).";

    barra.style.width = "0%";
    definirEstado("resultado");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        barra.style.width = Math.max(0, Math.min(100, previsto)) + "%";
      });
    });
  }

  function mostrarErro(erro) {
    let mensagem;
    if (erro instanceof ErroApi) {
      mensagem = erro.message;
    } else if (erro && erro.name === "AbortError") {
      mensagem =
        "A API demorou demais para responder. Verifique se o servidor local está funcionando e tente novamente.";
    } else {
      mensagem =
        "Não foi possível conectar à API de previsão. Verifique se o servidor local (" +
        API_PREVISAO_URL.replace("/predict", "") +
        ") está ligado e tente novamente.";
    }
    erroTexto.textContent = mensagem;
    definirEstado("erro");
  }

  function validarCampos() {
    const lag = campoLag.valueAsNumber;
    if (!campoVacina.value) return "Selecione a vacina.";
    if (!campoMes.value) return "Selecione o mês da previsão.";
    if (Number.isNaN(lag)) return "Informe a cobertura do mês anterior.";
    if (lag < 0 || lag > 100) return "A cobertura deve estar entre 0 e 100.";
    return "";
  }

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const problema = validarCampos();
    erroCampo.textContent = problema;
    if (problema) return;

    const dadosEnviados = {
      lag_cobertura: campoLag.valueAsNumber,
      mes_numero: parseInt(campoMes.value, 10),
      imunobiologico: campoVacina.value
    };
    const rotuloVacina = campoVacina.options[campoVacina.selectedIndex].text;

    definirCarregando(true);
    definirEstado("carregando");

    try {
      const dados = await solicitarPrevisao(dadosEnviados);
      mostrarResultado(dados, dadosEnviados, rotuloVacina);
    } catch (erro) {
      mostrarErro(erro);
    } finally {
      definirCarregando(false);
    }
  });
}

/* ---------- Eventos ---------- */

document.addEventListener("DOMContentLoaded", () => {
  const campoBusca = document.getElementById("campo-busca");
  const botaoBuscar = document.getElementById("botao-buscar");
  const containerResultados = document.getElementById("resultados");
  let idDebounce = null;

  function executarBusca() {
    const consulta = campoBusca.value;
    renderizarResultados(buscar(consulta), consulta);
  }

  campoBusca.addEventListener("input", () => {
    clearTimeout(idDebounce);
    idDebounce = setTimeout(executarBusca, 200);
  });

  campoBusca.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter") executarBusca();
  });

  botaoBuscar.addEventListener("click", executarBusca);

  // Atualiza o painel de filtro sempre que um resultado é aberto.
  containerResultados.addEventListener("click", (evento) => {
    const link = evento.target.closest(".resultado-cartao__link");
    if (!link) return;
    const item = VACINAS.find((v) => v.id === link.dataset.id);
    if (item) atualizarPainel(item);
  });

  iniciarPowerBi();
  iniciarPrevisaoIA();
});
