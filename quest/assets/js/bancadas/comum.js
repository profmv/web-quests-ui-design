/**
 * OBJECTIVE: Building blocks shared by the benches: property fields, inspector, layer list, stage frame,
 *            export box. Benches never know the answer; they only compute values from the pair's input.
 * USAGE: import { campoNumero, campoSelect, inspetor, listaCamadas, quadro, caixaExport, secao } from './comum.js';
 */

import { el, icone } from "../ui.js";

let contador = 0;
const novoId = (p) => `${p}-${++contador}`;

export function secao(titulo, filhos, iconeId = null) {
  return el("section", { class: "ws-section" }, [
    el("h2", { class: "section-title" }, [iconeId ? icone(iconeId) : null, titulo]),
    ...[].concat(filhos),
  ]);
}

/** Numeric property with unit and optional 8px grid warning. */
export function campoNumero({ rotulo, valor, unidade = "px", min = 0, max = 999, passo = 1, grade = 0, largo = false, aoMudar }) {
  const id = novoId("campo");
  const input = el("input", { id, type: "number", inputmode: "numeric", min, max, step: passo, value: valor });
  const caixa = el("div", { class: "prop-input" }, [input, unidade ? el("span", { class: "unit", text: unidade }) : null]);
  const alerta = el("span", { class: "small", style: { color: "var(--ac-redline)", fontWeight: "600" } });
  const marcar = (v) => {
    const fora = grade && v % grade !== 0;
    caixa.classList.toggle("is-offgrid", Boolean(fora));
    alerta.textContent = fora ? `${v} não é múltiplo de ${grade}` : "";
  };
  marcar(Number(valor));
  input.addEventListener("input", () => {
    const v = Math.max(min, Math.min(max, Math.round(Number(input.value) || 0)));
    marcar(v);
    aoMudar(v);
  });
  return el("div", { class: `prop${largo ? " prop-wide" : ""}` }, [el("label", { class: "ws-label", for: id, text: rotulo }), caixa, alerta]);
}

/** Select property. opcoes: [{ v, t }] */
export function campoSelect({ rotulo, opcoes, valor, largo = false, aoMudar }) {
  const id = novoId("sel");
  const sel = el("select", { id }, opcoes.map((o) => el("option", { value: o.v, text: o.t, selected: String(o.v) === String(valor) })));
  sel.addEventListener("change", () => aoMudar(sel.value));
  return el("div", { class: `prop${largo ? " prop-wide" : ""}` }, [el("label", { class: "ws-label", for: id, text: rotulo }), el("div", { class: "prop-input" }, [sel])]);
}

/** Segmented radio group. opcoes: [{ v, t }] */
export function segmentado({ rotulo, nome, opcoes, valor, aoMudar }) {
  const grupo = el("div", { class: "segmented", role: "radiogroup", "aria-label": rotulo });
  opcoes.forEach((o) => {
    const id = novoId("seg");
    const radio = el("input", { type: "radio", id, name: nome, value: o.v, checked: String(o.v) === String(valor) });
    radio.addEventListener("change", () => aoMudar(o.v));
    grupo.append(radio, el("label", { for: id, text: o.t }));
  });
  return grupo;
}

/** Inspector definition list. pares: [[rotulo, valor]] */
export function inspetor(pares) {
  return el("dl", { class: "inspect" }, pares.flatMap(([k, v]) => [el("dt", { text: k }), el("dd", { text: v })]));
}

/** Layer list in the left panel. itens: [{ id, nome, icone, nivel }] */
export function listaCamadas(host, itens, selecionado, aoSelecionar) {
  host.replaceChildren(
    ...itens.map((it) =>
      el("button", {
        type: "button",
        class: `layer-row${it.id === selecionado ? " is-selected" : ""}`,
        style: { paddingLeft: `${8 + (it.nivel || 0) * 16}px` },
        "aria-pressed": String(it.id === selecionado),
        onclick: () => aoSelecionar(it.id),
      }, [icone(it.icone || "rect"), el("span", { text: it.nome })])
    )
  );
}

/** Design-tool frame on the canvas with its name label. */
export function quadro(rotulo, largura, extraClasse = "") {
  return el("div", { class: `stage-frame ${extraClasse}`, style: { width: `${largura}px` } }, [el("span", { class: "frame-label", text: rotulo })]);
}

/** Export box (handoff code). Returns { no, definir(codigo) }. */
export function caixaExport(rotulo) {
  const code = el("code", { text: "-" });
  const no = el("div", { class: "export-box", "aria-live": "polite" }, [el("span", { class: "ws-label", text: rotulo }), code]);
  return { no, definir: (c) => (code.textContent = c || "-") };
}

/** Selection outline with handles and size badge. */
export function selecao(w, h) {
  return el("div", { class: "sel-overlay", "aria-hidden": "true" }, [
    el("span", { class: "sel-h tl" }), el("span", { class: "sel-h tr" }), el("span", { class: "sel-h bl" }), el("span", { class: "sel-h br" }),
    el("span", { class: "sel-size", text: `${Math.round(w)} × ${Math.round(h)}` }),
  ]);
}
