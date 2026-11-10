/**
 * OBJECTIVE: Quest shell for "Estúdio Oito": trail, encrypted lock chain, benches, hints, glossary balloons,
 *            minigame interludes, progress code, certificate, tokens and the final Figma mission.
 * USAGE: Loaded by quest/index.html as an ES module. Benches live in ./bancadas/<tipo>.js and expose
 *        montar({ canvas, props, camadas, config, rascunho, salvar, anunciar }) -> { destruir(), resumo() }.
 *        Minigames live in ./minigames/<id>.js and expose iniciar(raiz, { aoTerminar }) -> { destruir() }.
 * NOTES: Lock N content is decrypted with the answer of lock N-1. Wrong answers are matched against salted
 *        hashes of predictable mistakes to show a targeted message; nothing in this file knows an answer.
 */

import { normalizar, decifrarBloco, sha256Hex } from "./crypto.js";
import { carregarEstado, salvarEstado, apagarEstado, estadoVazio, gerarCodigo, lerCodigo, abrirCofre } from "./progress.js";
import { el, icone, textoComTermos, ativarBaloes, aviso, copiar, baixar } from "./ui.js";
import { nomeArquivoSeguro } from "./util.js";
import { apagarRascunhoFigma, montarMissaoFigma } from "./figma-mission.js";

const TRILHA = [
  { tipo: "lock", i: 0 },
  { tipo: "lock", i: 1 },
  { tipo: "jogo", id: "olho-clinico", nome: "Olho Clínico", apos: 1, resumo: "Duas telas quase iguais: escolham a sem defeito." },
  { tipo: "lock", i: 2 },
  { tipo: "lock", i: 3 },
  { tipo: "jogo", id: "corrida-contraste", nome: "Corrida do Contraste", apos: 3, resumo: "60 segundos: passa ou não passa no AA?" },
  { tipo: "lock", i: 4 },
  { tipo: "lock", i: 5 },
  { tipo: "jogo", id: "kerning", nome: "Ajuste Fino", apos: 5, resumo: "Acertem o espaço entre letras traiçoeiras." },
  { tipo: "lock", i: 6 },
  { tipo: "lock", i: 7 },
  { tipo: "final" },
];
const TOTAL = 8;

const dom = {
  shell: document.getElementById("shell"),
  canvas: document.getElementById("canvas"),
  areaCanvas: document.getElementById("area-canvas"),
  props: document.getElementById("propriedades"),
  camadas: document.getElementById("camadas"),
  trilha: document.getElementById("trilha"),
  contagem: document.getElementById("trilha-contagem"),
  mochila: document.getElementById("mochila"),
  etapaChip: document.getElementById("design-etapa"),
  caixaPista: document.getElementById("caixa-pista"),
  formPista: document.getElementById("form-pista"),
  campoPista: document.getElementById("campo-pista"),
  formato: document.getElementById("pista-formato"),
  retorno: document.getElementById("pista-retorno"),
  btnAbrir: document.getElementById("btn-abrir"),
  caixaDicas: document.getElementById("caixa-dicas"),
  dicas: document.getElementById("dicas"),
  caixaConceitos: document.getElementById("caixa-conceitos"),
  conceitos: document.getElementById("conceitos"),
  tempo: document.getElementById("toolbar-tempo"),
  papeis: document.getElementById("toolbar-papeis"),
  btnSalvar: document.getElementById("btn-salvar"),
  btnSlides: document.getElementById("btn-slides"),
  gaveta: document.getElementById("gaveta-slides"),
  iframe: document.getElementById("iframe-slides"),
  dialogo: document.getElementById("dialogo-progresso"),
  codigo: document.getElementById("codigo-progresso"),
  avisoProgresso: document.getElementById("progresso-aviso"),
};

let etapasJson = null;
const conteudos = [];
let estado = null;
let vista = null;
let bancadaAtual = null;
let jogoAtual = null;
let confirmarRecomeco = false;

/* ---------------- Boot ---------------- */

async function iniciar() {
  try {
    const r = await fetch("etapas.json", { cache: "no-store" });
    etapasJson = await r.json();
  } catch {
    dom.canvas.replaceChildren(el("div", { class: "callout callout-bad" }, ["Não foi possível carregar as fechaduras. Abram a página por um servidor (iniciar.bat ou Live Server), não pelo arquivo direto."]));
    return;
  }
  conteudos[0] = await decifrarBloco(etapasJson.etapas[0], "", etapasJson.iteracoes);

  estado = carregarEstado();
  if (estado) await reproduzirCadeia();

  ligarEventos();
  setInterval(atualizarTempo, 1000);

  if (!estado) {
    mostrarBoasVindas();
  } else {
    mostrarShellAtivo();
    irPara(proximaVista());
  }
}

/** Replays saved answers against the encrypted chain; stops at the first one that no longer decrypts. */
async function reproduzirCadeia() {
  const validas = [];
  for (let i = 0; i < estado.respostas.length && i < TOTAL; i++) {
    const proximo = await decifrarBloco(etapasJson.etapas[i + 1], estado.respostas[i], etapasJson.iteracoes);
    if (!proximo) break;
    conteudos[i + 1] = proximo;
    validas.push(estado.respostas[i]);
  }
  if (validas.length !== estado.respostas.length) {
    estado.respostas = validas;
    salvarEstado(estado);
  }
}

function resolvidas() {
  return estado ? estado.respostas.length : 0;
}

function proximaVista() {
  const n = resolvidas();
  if (n >= TOTAL) return TRILHA.find((t) => t.tipo === "final");
  return TRILHA.find((t) => t.tipo === "lock" && t.i === n);
}

/* ---------------- Events ---------------- */

function ligarEventos() {
  dom.formPista.addEventListener("submit", (ev) => {
    ev.preventDefault();
    conferirPista();
  });
  dom.btnSlides.addEventListener("click", () => alternarSlides());
  document.getElementById("btn-fechar-slides").addEventListener("click", () => alternarSlides(false));
  dom.btnSalvar.addEventListener("click", abrirProgresso);
  document.getElementById("btn-copiar-codigo").addEventListener("click", async () => {
    dom.avisoProgresso.textContent = await copiar(dom.codigo.value, dom.codigo);
  });
  document.getElementById("btn-baixar-codigo").addEventListener("click", () => {
    const nome = `progresso-${nomeArquivoSeguro(estado.team[0])}-${nomeArquivoSeguro(estado.team[1])}.txt`;
    baixar(nome, `Estúdio Oito - progresso da dupla\r\nDupla: ${estado.team.join(" e ")}\r\nFechaduras: ${resolvidas()} de ${TOTAL}\r\n\r\n${dom.codigo.value}\r\n`);
  });
  document.getElementById("btn-recomecar").addEventListener("click", (ev) => {
    if (!confirmarRecomeco) {
      confirmarRecomeco = true;
      ev.currentTarget.textContent = "Clique de novo para apagar tudo";
      dom.avisoProgresso.textContent = "Isso apaga o progresso e o rascunho Figma desta dupla no navegador. Copiem o código e baixem a entrega antes.";
      return;
    }
    apagarRascunhoFigma(estado);
    apagarEstado();
    location.reload();
  });
  dom.dialogo.addEventListener("close", () => {
    confirmarRecomeco = false;
    document.getElementById("btn-recomecar").textContent = "Recomeçar a trilha";
  });

  document.querySelectorAll(".mobile-tabs button").forEach((b) => {
    b.addEventListener("click", () => mostrarPainel(b.dataset.painel));
  });

  document.addEventListener("keydown", (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "s") {
      ev.preventDefault();
      alternarSlides();
    }
    if (ev.key === "Escape" && !dom.gaveta.hidden) alternarSlides(false);
  });
  window.addEventListener("message", (ev) => {
    if (ev.origin !== location.origin || !ev.data || typeof ev.data !== "object") return;
    if (ev.data.type === "CLOSE_DRAWER" || ev.data.type === "TOGGLE_DRAWER") alternarSlides(false);
  });
}

function mostrarPainel(qual) {
  dom.shell.dataset.painel = qual;
  document.querySelectorAll(".mobile-tabs button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.painel === qual)));
}

/* ---------------- Slides drawer ---------------- */

let slidePendente = null;

function alternarSlides(abrir = dom.gaveta.hidden, slide = null) {
  dom.gaveta.hidden = !abrir;
  dom.btnSlides.setAttribute("aria-expanded", String(abrir));
  if (!abrir) {
    dom.btnSlides.focus();
    return;
  }
  const alvo = slide || vistaSlide() || 1;
  if (dom.iframe.getAttribute("src") === "about:blank") {
    slidePendente = null;
    dom.iframe.src = `../slides/index.html#${alvo}`;
  } else {
    slidePendente = alvo;
    dom.iframe.contentWindow?.postMessage({ type: "JUMP_TO_SLIDE", slideIndex: alvo }, location.origin);
  }
  dom.iframe.focus();
}

function vistaSlide() {
  if (vista?.tipo === "lock") return conteudos[vista.i]?.slide || null;
  return null;
}

function abrirSlide(n) {
  alternarSlides(true, n);
}

/* ---------------- Welcome ---------------- */

function mostrarBoasVindas() {
  dom.shell.classList.add("is-welcome");
  dom.etapaChip.textContent = "Início";
  limparPaineis();
  renderizarTrilha();
  const erro = el("p", { class: "form-error", role: "alert" });
  const erroRet = el("p", { class: "form-error", role: "alert" });

  const nome1 = el("input", { class: "field", id: "nome-1", maxlength: 24, autocomplete: "off", required: true });
  const nome2 = el("input", { class: "field", id: "nome-2", maxlength: 24, autocomplete: "off", required: true });
  const pin = el("input", { class: "field", id: "pin", maxlength: 32, autocomplete: "off", required: true, minlength: 4 });

  const formNovo = el("form", { class: "welcome-form", novalidate: true }, [
    el("div", { class: "field-pair" }, [
      el("div", {}, [el("label", { class: "ws-label", for: "nome-1", text: "Pessoa 1 (piloto na fechadura 0)" }), nome1]),
      el("div", {}, [el("label", { class: "ws-label", for: "nome-2", text: "Pessoa 2 (navegador na fechadura 0)" }), nome2]),
    ]),
    el("div", {}, [
      el("label", { class: "ws-label", for: "pin", text: "Senha da dupla (mínimo 4 caracteres)" }),
      pin,
      el("p", { class: "small muted", text: "Serve só para continuar em outro computador. Anotem." }),
    ]),
    erro,
    el("button", { type: "submit", class: "btn btn-primary btn-lg" }, [icone("play"), "Abrir o arquivo do cliente"]),
  ]);
  formNovo.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const a = nome1.value.trim();
    const b = nome2.value.trim();
    if (!a || !b) return void (erro.textContent = "Escrevam o nome das duas pessoas.");
    if (normalizar(a) === normalizar(b)) return void (erro.textContent = "Os dois nomes precisam ser diferentes.");
    if (pin.value.trim().length < 4) return void (erro.textContent = "A senha da dupla precisa de pelo menos 4 caracteres.");
    estado = { ...estadoVazio(), team: [a, b], pin: pin.value.trim(), startedAt: Date.now() };
    salvarEstado(estado);
    mostrarShellAtivo();
    irPara(proximaVista());
  });

  const codigo = el("textarea", { class: "field field-mono", id: "codigo-retomar", rows: 3, spellcheck: "false" });
  const pinRet = el("input", { class: "field", id: "pin-retomar", autocomplete: "off" });
  const formRet = el("form", { class: "welcome-form" }, [
    el("div", {}, [el("label", { class: "ws-label", for: "codigo-retomar", text: "Código de progresso" }), codigo]),
    el("div", {}, [el("label", { class: "ws-label", for: "pin-retomar", text: "Senha da dupla" }), pinRet]),
    erroRet,
    el("button", { type: "submit", class: "btn btn-secondary" }, ["Continuar daqui"]),
  ]);
  formRet.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    erroRet.textContent = "Conferindo...";
    const lido = await lerCodigo(codigo.value);
    if (!lido.ok) return void (erroRet.textContent = lido.erro);
    const cofre = await abrirCofre(lido.dados, pinRet.value.trim());
    if (!cofre) return void (erroRet.textContent = "Senha da dupla incorreta para este código.");
    estado = {
      ...estadoVazio(),
      team: lido.dados.t,
      pin: pinRet.value.trim(),
      startedAt: lido.dados.s,
      completedAt: lido.dados.c,
      respostas: cofre.respostas,
      abertas: lido.dados.a || [],
      erros: lido.dados.e || [],
      dicas: lido.dados.d || [],
      minigames: lido.dados.m || {},
      trabalho: cofre.trabalho,
    };
    await reproduzirCadeia();
    salvarEstado(estado);
    mostrarShellAtivo();
    irPara(proximaVista());
  });

  dom.canvas.replaceChildren(
    el("section", { class: "welcome anim-pop", "aria-labelledby": "bv-titulo" }, [
      el("div", { class: "frame-tag" }, [icone("frame", 16), "Boas-vindas"]),
      el("div", { class: "welcome-grid" }, [
        el("div", { class: "welcome-story" }, [
          el("p", { class: "eyebrow", text: "Estúdio Oito · primeiro dia" }),
          el("h1", { id: "bv-titulo", text: "O card do evento chegou quebrado." }),
          el("p", { class: "lead", text: "O Prof. Ramos precisa do card do Dia do Design no Agenda do Campus. Consertem o card em oito fechaduras, treinem o olhar nos intervalos e testem o protótipo no Figma." }),
          el("ul", { class: "welcome-steps" }, [
            el("li", {}, [icone("frame"), el("span", { text: "Cada fechadura conserta uma parte do mesmo card." })]),
            el("li", {}, [icone("sliders"), el("span", { text: "A pista sai do trabalho de vocês na bancada, não do texto." })]),
            el("li", {}, [icone("users"), el("span", { text: "Piloto mexe na bancada; navegador consulta os slides. Troquem a cada fechadura." })]),
          ]),
          el("div", { class: "welcome-broken", "aria-hidden": "true" }, [cartaoQuebrado()]),
        ]),
        el("div", { class: "welcome-forms" }, [
          el("h2", { class: "section-title", text: "Nova dupla" }),
          formNovo,
          el("details", { class: "welcome-restore" }, [el("summary", { text: "Continuar em outro computador" }), formRet]),
        ]),
      ]),
    ])
  );
  nome1.focus();
}

function cartaoQuebrado() {
  return el("div", { class: "broken-card" }, [
    el("span", { class: "redline-tag broken-tag", text: "tudo 15px" }),
    el("p", { text: "Dia do Design" }),
    el("p", { text: "16 de maio, Auditório B" }),
    el("p", { text: "Oficinas, revisão de portfólio e conversas com designers." }),
    el("span", { class: "broken-btn", text: "Inscrever-se" }),
  ]);
}

function mostrarShellAtivo() {
  dom.shell.classList.remove("is-welcome");
  dom.btnSalvar.hidden = false;
  atualizarTempo();
}

/* ---------------- Navigation ---------------- */

function liberado(item) {
  const n = resolvidas();
  if (item.tipo === "lock") return item.i <= n;
  if (item.tipo === "jogo") return n > item.apos;
  return n >= TOTAL;
}

function limparPaineis() {
  bancadaAtual?.destruir?.();
  bancadaAtual = null;
  jogoAtual?.destruir?.();
  jogoAtual = null;
  dom.props.replaceChildren();
  dom.camadas.replaceChildren(el("p", { class: "muted small pad-2", text: "Esta etapa não tem camadas." }));
  dom.caixaPista.hidden = true;
  dom.caixaDicas.hidden = true;
  dom.caixaConceitos.hidden = true;
  dom.retorno.replaceChildren();
}

function irPara(item) {
  if (!item || !liberado(item)) return;
  vista = item;
  limparPaineis();
  if (item.tipo === "lock") renderizarFechadura(item.i);
  else if (item.tipo === "jogo") renderizarIntervalo(item);
  else renderizarFinal();
  renderizarTrilha();
  renderizarMochila();
  atualizarPapeis();
  mostrarPainel("canvas");
  dom.areaCanvas.scrollTop = 0;
  requestAnimationFrame(() => dom.canvas.querySelector(".lock-title, #fm-title")?.focus({ preventScroll: true }));
}

function renderizarTrilha() {
  const n = resolvidas();
  dom.contagem.textContent = `${n}/${TOTAL}`;
  dom.trilha.replaceChildren(
    ...TRILHA.map((item) => {
      const ok = liberado(item);
      let rotulo;
      let estadoTxt;
      let ic;
      if (item.tipo === "lock") {
        rotulo = `${item.i}. ${etapasJson?.etapas[item.i]?.titulo.replace(/^Fechadura \d+: /, "") || ""}`;
        const feita = item.i < n;
        estadoTxt = feita ? "aberta" : ok ? "atual" : "trancada";
        ic = feita ? "check" : ok ? "unlock" : "lock";
      } else if (item.tipo === "jogo") {
        rotulo = `Intervalo: ${item.nome}`;
        const jogado = estado?.minigames?.[item.id] !== undefined;
        estadoTxt = jogado ? "jogado" : ok ? "disponível" : "trancado";
        ic = "gamepad";
      } else {
        rotulo = "Missão Figma";
        estadoTxt = ok ? "disponível" : "trancada";
        ic = "award";
      }
      const ativo = vista && item.tipo === vista.tipo && item.i === vista.i && item.id === vista.id;
      return el("li", { class: `trail-item trail-${item.tipo}` }, [
        el(
          "button",
          {
            type: "button",
            class: `trail-btn${ativo ? " is-current" : ""} is-${estadoTxt.replace(/[^a-z]/g, "")}`,
            disabled: !ok || !estado,
            "aria-current": ativo ? "page" : null,
            "aria-label": `${rotulo}, ${estadoTxt}`,
            onclick: () => irPara(item),
          },
          [icone(ic), el("span", { class: "trail-label", text: rotulo })]
        ),
      ]);
    })
  );
}

function renderizarMochila() {
  const n = resolvidas();
  if (!n) {
    dom.mochila.replaceChildren(el("li", { class: "muted small", text: "Nenhum valor ainda." }));
    return;
  }
  dom.mochila.replaceChildren(
    ...estado.respostas.map((r, i) =>
      el("li", { class: "backpack-item" }, [
        el("span", { class: "backpack-label", text: conteudos[i]?.mochila || `Fechadura ${i}` }),
        el("code", { text: r }),
      ])
    )
  );
}

function atualizarPapeis() {
  if (!estado || vista?.tipo !== "lock") {
    dom.papeis.hidden = true;
    return;
  }
  const i = vista.i;
  const piloto = estado.team[i % 2];
  const nav = estado.team[(i + 1) % 2];
  dom.papeis.hidden = false;
  dom.papeis.replaceChildren(
    el("span", { class: "role" }, [el("span", { class: "role-key", text: "Piloto" }), piloto]),
    el("span", { class: "role" }, [el("span", { class: "role-key", text: "Navegador" }), nav])
  );
}

function atualizarTempo() {
  if (!estado?.startedAt) return;
  const fim = estado.completedAt || Date.now();
  const s = Math.max(0, Math.floor((fim - estado.startedAt) / 1000));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  dom.tempo.textContent = h ? `${h}:${m}:${ss}` : `${m}:${ss}`;
}

/* ---------------- Lock view ---------------- */

async function renderizarFechadura(i) {
  const c = conteudos[i];
  if (!c) return;
  const feita = i < resolvidas();
  dom.etapaChip.textContent = `Fechadura ${i}`;

  const pontos = el("span", { class: "difficulty", "aria-label": `Dificuldade ${c.dificuldade} de 4` },
    [1, 2, 3, 4].map((k) => el("span", { class: k <= c.dificuldade ? "dot on" : "dot" })));

  const briefing = el("div", { class: "comment-text", html: textoComTermos(c.briefing, c.conceitos) });
  const comentario = el("article", { class: "comment", "aria-labelledby": `titulo-${i}` }, [
    el("div", { class: "comment-avatar", "aria-hidden": "true", text: "B" }),
    el("div", { class: "comment-body" }, [
      el("div", { class: "comment-meta" }, [el("strong", { text: "Bia" }), el("span", { class: "muted", text: " · designer líder" })]),
      briefing,
      el("ol", { class: "task-list" }, c.tarefa.map((t) => el("li", { text: t }))),
      el("div", { class: "comment-actions" }, [
        el("button", { type: "button", class: "btn btn-secondary btn-sm", onclick: () => abrirSlide(c.slide) }, [icone("slides"), `Abrir slide ${c.slide}`]),
      ]),
    ]),
  ]);

  const palco = el("div", { class: "bench-stage", id: "palco" });
  const aprovacao = el("div", { id: "aprovacao" });

  dom.canvas.replaceChildren(
    el("header", { class: "lock-head" }, [
      el("div", { class: "frame-tag" }, [icone("frame", 16), `Fechadura ${i} · ${c.pilar}`]),
      el("h1", { class: "lock-title", id: `titulo-${i}`, tabindex: "-1", text: c.titulo }),
      pontos,
    ]),
    comentario,
    palco,
    aprovacao
  );
  ativarBaloes(briefing, c.conceitos, abrirSlide);

  // Answer box
  dom.caixaPista.hidden = false;
  dom.formato.textContent = `Formato: ${c.formato}`;
  dom.campoPista.value = feita ? estado.respostas[i] : "";
  dom.campoPista.disabled = feita;
  dom.btnAbrir.disabled = feita;
  dom.campoPista.setAttribute("placeholder", "Digitem a pista");
  if (feita) mostrarAprovacao(i, false);

  renderizarDicas(i);
  renderizarConceitos(c);

  // Bench
  const props = el("div", { class: "bench-props" });
  dom.props.replaceChildren(props);
  try {
    const mod = await import(`./bancadas/${c.bancada.tipo}.js`);
    if (vista?.tipo !== "lock" || vista.i !== i) return;
    bancadaAtual = mod.montar({
      canvas: palco,
      props,
      camadas: dom.camadas,
      config: c.bancada,
      rascunho: estado.rascunhos?.[i] || null,
      salvar: (r) => {
        estado.rascunhos = { ...(estado.rascunhos || {}), [i]: r };
        salvarEstado(estado);
      },
      anunciar: (t, tipo) => aviso(t, tipo),
    });
  } catch (erro) {
    console.error(erro);
    palco.replaceChildren(el("div", { class: "callout callout-bad", text: "A bancada não carregou. Recarreguem a página." }));
  }
}

function renderizarDicas(i) {
  const c = conteudos[i];
  const usadas = estado.dicas[i] || 0;
  dom.caixaDicas.hidden = false;
  const itens = c.dicas.slice(0, usadas).map((d, k) =>
    el("div", { class: "hint anim-pop" }, [
      el("p", { class: "hint-label", text: `Dica ${k + 1}` }),
      el("p", { text: d.texto }),
      d.slide ? el("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: () => abrirSlide(d.slide) }, [icone("slides"), `Abrir slide ${d.slide}`]) : null,
    ])
  );
  const restantes = c.dicas.length - usadas;
  const botao = restantes > 0 && i >= resolvidas()
    ? el("button", {
        type: "button",
        class: "btn btn-secondary btn-sm",
        onclick: () => {
          estado.dicas[i] = usadas + 1;
          salvarEstado(estado);
          renderizarDicas(i);
        },
      }, [icone("bulb"), `Ver dica ${usadas + 1} de ${c.dicas.length}`])
    : null;
  dom.dicas.replaceChildren(
    ...[...itens, botao, restantes > 0 && botao ? el("p", { class: "small muted", text: "Cada dica custa pontos no placar." }) : null].filter(Boolean)
  );
  if (!itens.length && !botao) dom.dicas.append(el("p", { class: "small muted", text: "Sem dicas usadas nesta fechadura." }));
}

function renderizarConceitos(c) {
  dom.caixaConceitos.hidden = false;
  dom.conceitos.replaceChildren(
    ...c.conceitos.map((k) =>
      el("li", {}, [
        el("strong", { text: k.termo }),
        el("div", { class: "concept-actions" }, [
          k.slide ? el("button", { type: "button", class: "link-btn", onclick: () => abrirSlide(k.slide) }, [`Slide ${k.slide}`]) : null,
          k.link ? el("a", { href: k.link, target: "_blank", rel: "noopener" }, [k.rotulo || "Saiba mais", icone("external", 16)]) : null,
        ]),
      ])
    )
  );
}

async function conferirPista() {
  if (vista?.tipo !== "lock") return;
  const i = vista.i;
  const c = conteudos[i];
  const bruto = dom.campoPista.value.trim();
  const n = normalizar(bruto);
  if (!n) {
    dom.retorno.replaceChildren(el("p", { class: "callout callout-warn", text: "Digitem a pista antes de abrir." }));
    return;
  }
  dom.btnAbrir.disabled = true;
  dom.retorno.replaceChildren(el("p", { class: "small muted", text: "Conferindo a chave..." }));
  const proximo = await decifrarBloco(etapasJson.etapas[i + 1], bruto, etapasJson.iteracoes);
  dom.btnAbrir.disabled = false;

  if (proximo) {
    conteudos[i + 1] = proximo;
    estado.respostas[i] = bruto;
    estado.abertas[i] = Date.now() - estado.startedAt;
    estado.erros[i] = estado.erros[i] || 0;
    estado.dicas[i] = estado.dicas[i] || 0;
    try {
      const resumo = bancadaAtual?.resumo?.();
      if (resumo) estado.trabalho[i] = resumo;
    } catch {
      /* summary is optional */
    }
    if (i === TOTAL - 1) estado.completedAt = Date.now();
    salvarEstado(estado);
    dom.campoPista.disabled = true;
    dom.btnAbrir.disabled = true;
    dom.retorno.replaceChildren(el("p", { class: "callout callout-ok" }, [icone("unlock"), " Fechadura aberta."]));
    aviso(`Fechadura ${i} aberta.`, "ok");
    renderizarTrilha();
    renderizarMochila();
    renderizarDicas(i);
    mostrarAprovacao(i, true);
    return;
  }

  estado.erros[i] = (estado.erros[i] || 0) + 1;
  salvarEstado(estado);
  const h = await sha256Hex(`${c.sal}|${n}`);
  const armadilha = (c.armadilhas || []).find((a) => a.h === h);
  const msg = armadilha
    ? armadilha.msg
    : `Ainda não abriu. Confiram o formato pedido, ${c.formato}, e o trabalho na bancada. Errar faz parte: cada tentativa fica registrada.`;
  dom.retorno.replaceChildren(el("p", { class: `callout ${armadilha ? "callout-warn" : "callout-bad"} anim-shake` }, [msg]));
  dom.campoPista.select();
}

function mostrarAprovacao(i, recente) {
  const c = conteudos[i];
  const alvo = document.getElementById("aprovacao");
  if (!alvo) return;
  const seguinte = TRILHA[TRILHA.findIndex((t) => t.tipo === "lock" && t.i === i) + 1];
  const btn = el("button", { type: "button", class: "btn btn-primary", onclick: () => irPara(seguinte) }, [
    seguinte.tipo === "jogo" ? `Ir para o intervalo: ${seguinte.nome}` : seguinte.tipo === "final" ? "Abrir missão Figma" : "Próxima fechadura",
    icone("arrow-right"),
  ]);
  alvo.replaceChildren(
    el("article", { class: `comment comment-approved${recente ? " anim-pop" : ""}` }, [
      el("div", { class: "comment-avatar is-ok", "aria-hidden": "true" }, [icone("check")]),
      el("div", { class: "comment-body" }, [
        el("p", { class: "comment-text", text: c.aprovacao }),
        el("p", { class: "learned" }, [el("strong", { text: "Aprendizado: " }), c.aprendizado]),
        el("div", { class: "comment-actions" }, [btn]),
      ]),
    ])
  );
  if (recente) {
    alvo.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
    btn.focus();
  }
}

/* ---------------- Interlude (minigame) ---------------- */

function renderizarIntervalo(item) {
  dom.etapaChip.textContent = "Intervalo";
  const jogado = estado.minigames?.[item.id];
  const host = el("div", { class: "game-host" });
  dom.canvas.replaceChildren(
    el("header", { class: "lock-head" }, [
      el("div", { class: "frame-tag" }, [icone("gamepad", 16), "Intervalo"]),
      el("h1", { class: "lock-title", tabindex: "-1", text: item.nome }),
    ]),
    host
  );
  const seguinte = TRILHA[TRILHA.indexOf(item) + 1];
  dom.props.replaceChildren(
    el("section", { class: "ws-section" }, [
      el("h2", { class: "section-title", text: "Sobre o intervalo" }),
      el("p", { class: "small", text: item.resumo }),
      el("p", { class: "small muted", text: "Não tranca a trilha. A pontuação aparece no placar como bônus." }),
      jogado !== undefined ? el("p", { class: "chip chip-ok", text: `Melhor resultado: ${jogado} pontos` }) : null,
      el("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: () => irPara(seguinte) }, ["Pular para a próxima fechadura", icone("arrow-right")]),
    ])
  );
  import(`./minigames/${item.id}.js`)
    .then(async (mod) => {
      if (vista !== item) return;
      jogoAtual = await mod.iniciar(host, {
        aoTerminar: (r) => {
          const pontos = Math.max(0, Math.min(100, Math.round(Number(r?.pontos) || 0)));
          const antes = estado.minigames[item.id];
          if (!r?.pulado) {
            estado.minigames[item.id] = antes === undefined ? pontos : Math.max(antes, pontos);
            salvarEstado(estado);
          }
          renderizarTrilha();
          irPara(seguinte);
        },
      });
    })
    .catch((erro) => {
      console.error(erro);
      host.replaceChildren(el("div", { class: "callout callout-bad", text: "O intervalo não carregou. Sigam para a próxima fechadura." }));
    });
}

/* ---------------- Final delivery ---------------- */

function renderizarFinal() {
  const c = conteudos[TOTAL];
  dom.etapaChip.textContent = "Missão Figma";
  if (!c) return;
  const segundos = Math.round(((estado.completedAt || Date.now()) - estado.startedAt) / 1000);
  const totalErros = estado.erros.reduce((a, b) => a + (b || 0), 0);
  const totalDicas = estado.dicas.reduce((a, b) => a + (b || 0), 0);
  const jogos = Object.values(estado.minigames || {});
  const tempo = `${Math.floor(segundos / 60)} min ${segundos % 60} s`;

  const certificado = el("section", { class: "certificate anim-pop", id: "certificado", "aria-labelledby": "cert-titulo" }, [
    el("div", { class: "cert-head" }, [
      el("span", { class: "ws-brand-mark cert-mark", "aria-hidden": "true", text: "8" }),
      el("div", {}, [el("p", { class: "eyebrow", text: "Estúdio Oito · certificado da trilha" }), el("h2", { id: "cert-titulo", text: "Card pronto para o Figma" })]),
    ]),
    el("p", { class: "cert-names", text: estado.team.join(" e ") }),
    el("p", { class: "cert-quote", text: c.mensagem }),
    el("dl", { class: "cert-stats" }, [
      el("div", {}, [el("dt", { text: "Tempo" }), el("dd", { text: tempo })]),
      el("div", {}, [el("dt", { text: "Fechaduras" }), el("dd", { text: `${resolvidas()} de ${TOTAL}` })]),
      el("div", {}, [el("dt", { text: "Tentativas erradas" }), el("dd", { text: String(totalErros) })]),
      el("div", {}, [el("dt", { text: "Dicas" }), el("dd", { text: String(totalDicas) })]),
      el("div", {}, [el("dt", { text: "Intervalos" }), el("dd", { text: jogos.length ? `${jogos.length} jogados` : "nenhum" })]),
    ]),
    el("h3", { class: "section-title", text: "O que a dupla aprendeu" }),
    el("ol", { class: "cert-learned" }, conteudos.slice(0, TOTAL).map((k) => el("li", {}, [el("strong", { text: `${k.titulo}: ` }), k.aprendizado]))),
  ]);

  const missao = montarMissaoFigma({ team: estado.team, startedAt: estado.startedAt, abrirSlide });
  dom.canvas.replaceChildren(missao, certificado);
  dom.props.replaceChildren(
    el("section", { class: "ws-section" }, [
      el("h2", { class: "section-title", text: "Entregáveis" }),
      el("button", { type: "button", class: "btn btn-primary btn-block", onclick: abrirProgresso }, [icone("export"), "Código para o professor"]),
      el("button", {
        type: "button",
        class: "btn btn-secondary btn-block",
        onclick: () => baixar("tokens.json", JSON.stringify({ $descricao: `Tokens da dupla ${estado.team.join(" e ")} - Estúdio Oito`, ...c.tokens }, null, 2) + "\n", "application/json"),
      }, [icone("download"), "Baixar tokens.json"]),
      el("button", { type: "button", class: "btn btn-secondary btn-block", onclick: () => window.print() }, [icone("printer"), "Imprimir certificado"]),
      el("p", { class: "small muted", text: "Consultem o tokens.json para aplicar os valores do card no Figma. Se quiserem reutilizá-los, criem variáveis no arquivo." }),
    ])
  );
}

/* ---------------- Progress dialog ---------------- */

async function abrirProgresso() {
  if (!estado) return;
  dom.codigo.value = "Gerando...";
  dom.avisoProgresso.textContent = "";
  dom.dialogo.showModal();
  dom.codigo.value = await gerarCodigo(estado);
}

iniciar();
