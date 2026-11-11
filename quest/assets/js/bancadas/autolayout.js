/**
 * OBJECTIVE: Lock 7 bench - auto layout simulator (generic design-tool behaviour, no product UI copied).
 *            Layers can be renamed, wrapped into frames (Shift+A), unwrapped and reordered. Frames get
 *            direction, gap, padding and Fixed/Hug/Fill sizing; the layout engine is deterministic (text
 *            heights come from a line model, not from browser fonts) so every machine measures the same.
 */

import { el, icone } from "../ui.js";
import { campoNumero, campoSelect, inspetor, quadro, secao, segmentado, selecao, caixaExport } from "./comum.js";

const GENERICO = /^(frame|group|grupo|rectangle|retangulo|text|texto|layer|camada)\s*\d*$/i;
const LINHA = 24;

function estadoInicial(config) {
  const nos = {
    root: { id: "root", tipo: "frame", nome: "Frame 12", filhos: [], al: { ativo: false, dir: "V", gap: 0, pad: 0 }, larg: { modo: "fixed", valor: 340 }, alt: { modo: "fixed", valor: 400 }, componente: false },
  };
  const bagunca = { titulo: [28, 22], data: [12, 70], chip1: [40, 112], chip2: [150, 104], descricao: [18, 156], botao: [64, 262] };
  for (const c of config.camadas) {
    nos[c.id] = { id: c.id, tipo: c.tipo, nome: c.nomeInicial, larg: { modo: "hug", valor: c.largHug }, pos: bagunca[c.id] || [16, 16] };
    nos.root.filhos.push(c.id);
  }
  return { nos, proximo: 13 };
}

export function montar({ canvas, props, camadas, config, rascunho, salvar, anunciar }) {
  const dados = Object.fromEntries(config.camadas.map((c) => [c.id, c]));
  const s = rascunho?.nos ? rascunho : estadoInicial(config);
  let sel = ["root"];
  let mostrarGrid = true;
  let multipla = false;

  const pai = (id) => Object.values(s.nos).find((n) => n.filhos && n.filhos.includes(id)) || null;

  /* ---------- Layout engine ---------- */
  function medir(id, disponivel) {
    const n = s.nos[id];
    if (n.tipo !== "frame") {
      const d = dados[id];
      let w = d.largHug;
      if (n.larg.modo === "fill" && disponivel != null) w = disponivel;
      else if (n.larg.modo === "fixed") w = n.larg.valor;
      let h = d.alt;
      if (d.quebra) h = Math.max(1, Math.ceil(d.largHug / Math.max(1, w))) * LINHA;
      return { id, w, h, filhos: [] };
    }
    if (!n.al.ativo) {
      const filhos = n.filhos.map((f) => ({ ...medir(f, null), x: s.nos[f].pos?.[0] ?? 0, y: s.nos[f].pos?.[1] ?? 0 }));
      return { id, w: n.larg.valor, h: n.alt.valor, filhos };
    }
    const { dir, gap, pad } = n.al;
    const hug = n.filhos.map((f) => medir(f, null));
    const hugW = dir === "V"
      ? Math.max(0, ...hug.map((m) => m.w)) + 2 * pad
      : hug.reduce((a, m) => a + m.w, 0) + gap * Math.max(0, hug.length - 1) + 2 * pad;
    let w = hugW;
    if (n.larg.modo === "fixed") w = n.larg.valor;
    else if (n.larg.modo === "fill" && disponivel != null) w = disponivel;
    const interno = w - 2 * pad;
    const repassa = n.larg.modo !== "hug";
    const filhos = n.filhos.map((f) => medir(f, dir === "V" && repassa ? interno : null));
    let x = pad;
    let y = pad;
    for (const m of filhos) {
      m.x = x;
      m.y = y;
      if (dir === "V") y += m.h + gap;
      else x += m.w + gap;
    }
    const hugH = dir === "V"
      ? filhos.reduce((a, m) => a + m.h, 0) + gap * Math.max(0, filhos.length - 1) + 2 * pad
      : Math.max(0, ...filhos.map((m) => m.h)) + 2 * pad;
    const h = n.alt.modo === "fixed" ? n.alt.valor : hugH;
    return { id, w, h, filhos };
  }

  /* ---------- Canvas ---------- */
  const tela = quadro("Tela 360 · layout grid 4 colunas", 360, "al-screen");
  const area = el("div", { class: "al-area" });
  tela.append(area);
  const btnGrid = el("button", { type: "button", class: "btn btn-ghost btn-sm", "aria-pressed": "true", onclick: () => { mostrarGrid = !mostrarGrid; btnGrid.setAttribute("aria-pressed", String(mostrarGrid)); desenharCanvas(); } }, [icone("grid"), "Layout grid"]);
  const btnMulti = el("button", { type: "button", class: "btn btn-ghost btn-sm", "aria-pressed": "false", onclick: () => { multipla = !multipla; btnMulti.setAttribute("aria-pressed", String(multipla)); } }, [icone("layers"), "Seleção múltipla"]);
  canvas.replaceChildren(el("div", { class: "al-tools" }, [btnGrid, btnMulti, el("span", { class: "small muted", text: "Shift+A: envolver a seleção em frame com auto layout" })]), tela);

  function renderNo(m, nivel) {
    const n = s.nos[m.id];
    const d = dados[m.id];
    const classes = [`al-node al-${n.tipo}`];
    if (n.tipo === "frame" && n.al.ativo && m.id !== "root") classes.push("is-al");
    if (m.id === "root") classes.push("al-root");
    const no = el("div", {
      class: classes.join(" "),
      style: { left: `${m.x}px`, top: `${m.y}px`, width: `${m.w}px`, height: `${m.h}px` },
      onclick: (ev) => { ev.stopPropagation(); selecionar(m.id, ev.shiftKey || ev.ctrlKey || ev.metaKey); },
    });
    if (n.tipo === "texto") {
      no.append(el("span", { class: "al-text", style: { fontSize: `${d.tam}px`, fontWeight: d.peso, lineHeight: d.quebra ? `${LINHA}px` : `${d.alt}px`, whiteSpace: d.quebra && m.w < d.largHug ? "normal" : "nowrap" }, text: d.texto }));
    } else if (n.tipo === "chip") {
      no.append(el("span", { class: "al-chip", text: d.texto }));
    } else if (n.tipo === "botao") {
      no.append(el("span", { class: "al-btn", text: d.texto }));
    }
    for (const f of m.filhos) no.append(renderNo(f, nivel + 1));
    if (sel.includes(m.id)) no.append(selecao(m.w, m.h));
    return no;
  }

  let medidaRaiz = null;

  function desenharCanvas() {
    medidaRaiz = { ...medir("root", 360), x: 16, y: 16 };
    const altura = Math.max(480, medidaRaiz.h + 64);
    area.style.height = `${altura}px`;
    area.replaceChildren(...[
      mostrarGrid ? el("div", { class: "al-grid", "aria-hidden": "true" }, [0, 1, 2, 3].map(() => el("span"))) : null,
      renderNo(medidaRaiz, 0),
    ].filter(Boolean));
    area.onclick = () => { sel = ["root"]; atualizar(); };
  }

  function acharMedida(m, id) {
    if (m.id === id) return m;
    for (const f of m.filhos) {
      const r = acharMedida(f, id);
      if (r) return r;
    }
    return null;
  }

  /* ---------- Layers panel ---------- */
  function desenharCamadas() {
    const linhas = [];
    const visitar = (id, nivel) => {
      const n = s.nos[id];
      const ic = n.componente ? "component" : n.tipo === "frame" ? "frame" : n.tipo === "texto" ? "text" : "rect";
      linhas.push(el("button", {
        type: "button",
        class: `layer-row${sel.includes(id) ? " is-selected" : ""}${GENERICO.test(n.nome) ? " is-generic" : ""}`,
        style: { paddingLeft: `${8 + nivel * 16}px` },
        "aria-pressed": String(sel.includes(id)),
        title: "Clique seleciona; Shift ou Ctrl + clique seleciona várias; duplo clique renomeia",
        onclick: (ev) => selecionar(id, ev.shiftKey || ev.ctrlKey || ev.metaKey),
        ondblclick: () => focarNome(),
      }, [icone(ic), el("span", { text: n.nome.trim() || "Camada sem nome" })]));
      (n.filhos || []).forEach((f) => visitar(f, nivel + 1));
    };
    visitar("root", 0);
    camadas.replaceChildren(...linhas, el("p", { class: "small muted pad-2", text: "Shift ou Ctrl + clique (ou o botão Seleção múltipla) seleciona várias camadas do mesmo frame." }));
  }

  /* ---------- Operations ---------- */
  function selecionar(id, somar) {
    somar = somar || multipla;
    if (somar && id !== "root" && sel[0] !== "root" && pai(sel[0]) === pai(id)) {
      sel = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
      if (!sel.length) sel = [id];
    } else {
      sel = [id];
    }
    atualizar();
  }

  function envolver() {
    if (sel.includes("root")) return anunciar("O frame raiz já é um frame. Selecionem camadas dentro dele.", "warn");
    const p = pai(sel[0]);
    if (!p || sel.some((id) => pai(id) !== p)) return anunciar("Selecionem camadas do mesmo frame.", "warn");
    const ordenadas = p.filhos.filter((f) => sel.includes(f));
    const pos = p.filhos.indexOf(ordenadas[0]);
    const id = `f${s.proximo}`;
    s.nos[id] = { id, tipo: "frame", nome: `Frame ${s.proximo}`, filhos: ordenadas, al: { ativo: true, dir: "V", gap: 0, pad: 0 }, larg: { modo: "hug", valor: 0 }, alt: { modo: "hug", valor: 0 }, pos: [16, 16] };
    s.proximo += 1;
    p.filhos = p.filhos.filter((f) => !sel.includes(f));
    p.filhos.splice(pos, 0, id);
    sel = [id];
    atualizar();
    anunciar("Frame com auto layout criado. Deem um nome a ele.", "ok");
  }

  function desfazer(id) {
    const n = s.nos[id];
    const p = pai(id);
    if (!p || n.tipo !== "frame") return;
    const pos = p.filhos.indexOf(id);
    p.filhos.splice(pos, 1, ...n.filhos);
    delete s.nos[id];
    sel = [...n.filhos];
    atualizar();
  }

  function mover(id, d) {
    const p = pai(id);
    if (!p) return;
    const i = p.filhos.indexOf(id);
    const j = i + d;
    if (j < 0 || j >= p.filhos.length) return;
    [p.filhos[i], p.filhos[j]] = [p.filhos[j], p.filhos[i]];
    atualizar();
  }

  /* ---------- Properties panel ---------- */
  const corpoProps = el("div");
  const checklist = el("ul", { class: "checklist" });
  const exp = caixaExport("Componente exportado (L x A - nomes válidos)");
  props.replaceChildren(corpoProps, secao("Checklist do arquivo", [checklist], "check"), secao("Handoff", [
    el("p", { class: "small muted", text: "N conta camadas e frames com nome válido, mais 1 se o Card/Evento for componente." }),
    exp.no,
  ], "export"));

  function focarNome() {
    corpoProps.querySelector("#al-nome")?.focus();
  }

  function nomeValido(id) {
    const n = s.nos[id];
    const nome = n.nome.trim().toLowerCase();
    if (id === "root") return n.nome.trim() === "Card/Evento";
    if (n.tipo === "frame") return nome.length > 1 && !GENERICO.test(nome);
    return (config.nomesValidos[id] || []).includes(nome);
  }

  function desenharProps() {
    if (sel.length > 1) {
      corpoProps.replaceChildren(secao(`${sel.length} camadas selecionadas`, [
        el("button", { type: "button", class: "btn btn-primary btn-block", onclick: envolver }, [icone("frame"), "Envolver em frame (Shift+A)"]),
      ], "layers"));
      return;
    }
    const id = sel[0];
    const n = s.nos[id];
    const m = acharMedida(medidaRaiz, id) || { x: 0, y: 0, w: 0, h: 0 };
    const nome = el("input", { class: "field", id: "al-nome", value: n.nome, spellcheck: "false", autocomplete: "off" });
    const avisoNome = el("p", { class: "small", "aria-live": "polite" });
    const atualizarAviso = () => {
      const valido = nomeValido(id);
      const mensagem = valido ? "Nome válido. Alterações salvas automaticamente." : "Nome inválido ou genérico. Descrevam a função da camada.";
      if (avisoNome.textContent !== mensagem) avisoNome.textContent = mensagem;
      avisoNome.style.color = valido ? "var(--tx-1)" : "var(--ac-redline)";
    };
    nome.addEventListener("input", () => {
      n.nome = nome.value;
      atualizarAviso();
      atualizar(false);
    });
    nome.addEventListener("keydown", (ev) => { if (ev.key === "Enter") ev.preventDefault(); });
    atualizarAviso();

    const blocos = [
      secao("Camada", [
        el("label", { class: "ws-label", for: "al-nome", text: "Nome" }),
        nome,
        avisoNome,
        el("div", { class: "al-actions" }, [
          id !== "root" ? el("button", { type: "button", class: "btn btn-secondary btn-sm", onclick: envolver }, [icone("frame"), "Envolver (Shift+A)"]) : null,
          id !== "root" && n.tipo === "frame" ? el("button", { type: "button", class: "btn btn-secondary btn-sm", onclick: () => desfazer(id) }, ["Desfazer frame"]) : null,
          id !== "root" ? el("button", { type: "button", class: "icon-btn", "aria-label": "Mover para cima", onclick: () => mover(id, -1) }, [icone("up")]) : null,
          id !== "root" ? el("button", { type: "button", class: "icon-btn", "aria-label": "Mover para baixo", onclick: () => mover(id, 1) }, [icone("down")]) : null,
          id === "root" ? el("button", { type: "button", class: "btn btn-secondary btn-sm", "aria-pressed": String(n.componente), onclick: () => { n.componente = !n.componente; atualizar(); } }, [icone("component"), n.componente ? "Componente criado" : "Criar componente"]) : null,
        ]),
      ], "layers"),
    ];

    if (n.tipo === "frame") {
      const alBox = el("div", { class: "prop-grid" });
      if (n.al.ativo) {
        alBox.append(
          el("div", { class: "prop prop-wide" }, [el("span", { class: "ws-label", text: "Direção" }), segmentado({ rotulo: "Direção", nome: `dir-${id}`, valor: n.al.dir, opcoes: [{ v: "V", t: "Vertical" }, { v: "H", t: "Horizontal" }], aoMudar: (v) => { n.al.dir = v; atualizar(); } })]),
          campoNumero({ rotulo: "Gap (entre itens)", valor: n.al.gap, max: 96, grade: 8, aoMudar: (v) => { n.al.gap = v; atualizar(false); } }),
          campoNumero({ rotulo: "Padding", valor: n.al.pad, max: 96, grade: 8, aoMudar: (v) => { n.al.pad = v; atualizar(false); } })
        );
      }
      blocos.push(secao("Auto layout", [
        el("label", { class: "toggle" }, [
          el("input", { type: "checkbox", checked: n.al.ativo, onchange: (ev) => { n.al.ativo = ev.target.checked; atualizar(); } }),
          el("span", { text: n.al.ativo ? "Ativo" : "Desligado (posições soltas)" }),
        ]),
        alBox,
      ], "sliders"));
    }

    const modos = n.tipo === "frame"
      ? [{ v: "fixed", t: "Fixed" }, { v: "hug", t: "Hug contents" }, { v: "fill", t: "Fill container" }]
      : [{ v: "hug", t: "Hug contents" }, { v: "fill", t: "Fill container" }];
    const tamanho = [
      campoSelect({ rotulo: "Largura", largo: true, valor: n.larg.modo, opcoes: modos, aoMudar: (v) => { n.larg.modo = v; if (v === "fixed" && !n.larg.valor) n.larg.valor = Math.round(m.w); atualizar(); } }),
    ];
    if (n.tipo === "frame" && n.larg.modo === "fixed") tamanho.push(campoNumero({ rotulo: "L fixa", valor: n.larg.valor, max: 720, aoMudar: (v) => { n.larg.valor = v; atualizar(false); } }));
    if (n.tipo === "frame") {
      tamanho.push(campoSelect({ rotulo: "Altura", largo: true, valor: n.alt.modo, opcoes: [{ v: "fixed", t: "Fixed" }, { v: "hug", t: "Hug contents" }], aoMudar: (v) => { n.alt.modo = v; if (v === "fixed" && !n.alt.valor) n.alt.valor = Math.round(m.h); atualizar(); } }));
      if (n.alt.modo === "fixed") tamanho.push(campoNumero({ rotulo: "A fixa", valor: n.alt.valor, max: 900, aoMudar: (v) => { n.alt.valor = v; atualizar(false); } }));
    }
    blocos.push(secao("Redimensionamento", [el("div", { class: "prop-grid" }, tamanho)], "frame"));
    blocos.push(secao("Inspetor", [inspetor([["X", String(Math.round(m.x))], ["Y", String(Math.round(m.y))], ["L", String(Math.round(m.w))], ["A", String(Math.round(m.h))]])], "search"));
    corpoProps.replaceChildren(...blocos);
  }

  function desenharChecklist() {
    const folhas = config.camadas.map((c) => c.id);
    const frames = Object.values(s.nos).filter((n) => n.tipo === "frame" && n.id !== "root");
    const raiz = s.nos.root;
    const chips = pai("chip1");
    const cabecalho = pai("titulo");
    const conteudo = pai("descricao");
    const chipsJuntos = chips && chips !== raiz && chips === pai("chip2");
    const aninhado = chipsJuntos && cabecalho && conteudo &&
      cabecalho === pai("data") && cabecalho === pai(chips.id) &&
      conteudo === pai(cabecalho.id) && raiz === pai(conteudo.id) && raiz === pai("botao");
    const layout = (frame, dir, gap, pad = 0) => frame.al.ativo && frame.al.dir === dir && frame.al.gap === gap && frame.al.pad === pad;
    const itens = [
      ["Camadas de conteúdo com nomes semânticos (titulo, data, chip-..., descricao, botao-...)", folhas.every(nomeValido)],
      ["Frames internos sem nome genérico", frames.length > 0 && frames.every((f) => nomeValido(f.id))],
      ["Frame raiz chamado Card/Evento", nomeValido("root")],
      ["Chips, cabeçalho e conteúdo aninhados conforme o roteiro", aninhado],
      ["Chips na horizontal e demais frames na vertical, com o ritmo do estúdio", aninhado &&
        layout(chips, "H", 8) && layout(cabecalho, "V", 8) && layout(conteudo, "V", 16) && layout(raiz, "V", 24, 24)],
      ["Card/Evento com largura fixa dentro das margens e altura Hug", raiz.larg.modo === "fixed" && medidaRaiz.w === 360 - 2 * 16 && raiz.alt.modo === "hug"],
      ["Conteúdo, descrição e botão ocupam a largura disponível", aninhado &&
        [conteudo, s.nos.descricao, s.nos.botao].every((n) => n.larg.modo === "fill")],
      ["Card/Evento transformado em componente", raiz.componente],
    ];
    checklist.replaceChildren(...itens.map(([t, ok]) => el("li", { class: ok ? "is-ok" : "" }, [
      icone(ok ? "check" : "x"),
      el("span", { class: "sr-only", text: ok ? "Conferido. " : "A conferir. " }),
      el("span", { text: t }),
    ])));
    const validos = Object.keys(s.nos).filter((id) => nomeValido(id)).length + (s.nos.root.componente ? 1 : 0);
    exp.definir(`${Math.round(medidaRaiz.w)}x${Math.round(medidaRaiz.h)}-N${validos}`);
  }

  function atualizar(refazerProps = true) {
    desenharCanvas();
    desenharCamadas();
    if (refazerProps) desenharProps();
    else {
      const m = acharMedida(medidaRaiz, sel[0]);
      const dd = corpoProps.querySelectorAll(".inspect dd");
      if (m && dd.length === 4) [m.x, m.y, m.w, m.h].forEach((v, k) => (dd[k].textContent = String(Math.round(v))));
    }
    desenharChecklist();
    salvar(s);
  }

  function atalho(ev) {
    const alvo = ev.target;
    if (alvo && (alvo.tagName === "INPUT" || alvo.tagName === "SELECT" || alvo.tagName === "TEXTAREA")) return;
    if (ev.shiftKey && ev.key.toLowerCase() === "a") {
      ev.preventDefault();
      envolver();
    }
  }
  document.addEventListener("keydown", atalho);

  atualizar();
  return {
    destruir() { document.removeEventListener("keydown", atalho); },
    resumo: () => {
      const r = medir("root", 360);
      const arvore = (id) => {
        const n = s.nos[id];
        return n.filhos ? `${n.nome}[${n.al.ativo ? `${n.al.dir} g${n.al.gap} p${n.al.pad}` : "solto"}](${n.filhos.map(arvore).join(",")})` : n.nome;
      };
      return { medida: `${r.w}x${r.h}`, arvore: arvore("root").slice(0, 600) };
    },
  };
}
