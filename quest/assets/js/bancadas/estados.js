/**
 * OBJECTIVE: Lock 3 bench - button states. The pair picks a palette tone for Default, Hover, Pressed and the
 *            focus ring, and a Disabled strategy. The inspector computes contrast live; thresholds are the
 *            pair's knowledge. The export box builds the handoff code from the choices.
 */

import { el, icone, razaoContraste, num } from "../ui.js";
import { campoSelect, inspetor, quadro, secao, caixaExport, segmentado } from "./comum.js";

// Same order as the export code (Default - Hover - Pressed - Foco - Disabled).
const ESTADOS = [
  { id: "default", nome: "Default" },
  { id: "hover", nome: "Hover" },
  { id: "pressed", nome: "Pressed" },
  { id: "focus", nome: "Focus" },
  { id: "disabled", nome: "Disabled" },
];

export function montar({ canvas, props, camadas, config, rascunho, salvar }) {
  const hex = Object.fromEntries(config.paleta.map((p) => [p.id, p.hex]));
  const s = rascunho || { default: "300", hover: "300", pressed: "300", focus: "100", disabled: "" };
  let selecionado = "default";

  const frame = quadro("Botao/Inscrever - 5 estados", 640, "states-frame");
  const linha = el("div", { class: "states-row" });
  frame.append(linha);
  const paleta = el("div", { class: "palette-strip", "aria-label": "Paleta azul do cliente" },
    config.paleta.map((p) => el("div", { class: "swatch" }, [el("span", { class: "swatch-color", style: { background: p.hex } }), el("span", { class: "swatch-id", text: p.id })])));
  canvas.replaceChildren(frame, paleta, el("p", { class: "stage-note", text: "Cliquem num estado para editar. O rótulo é branco, 16px, peso 600." }));

  const inspecao = el("div");
  const editor = el("div");
  const exp = caixaExport("Especificação exportada");

  function preview(e) {
    let estilo = { background: hex[s[e.id]] || hex[s.default], color: "#ffffff" };
    let rotulo = config.rotulo;
    let cursor = "pointer";
    const extras = [];
    if (e.id === "focus") {
      estilo = { background: hex[s.default], color: "#ffffff", boxShadow: `0 0 0 2px #ffffff, 0 0 0 4px ${hex[s.focus]}` };
    }
    if (e.id === "pressed") estilo.transform = "translateY(1px)";
    if (e.id === "default" || e.id === "hover") estilo.boxShadow = "0 2px 4px rgba(23,26,33,0.18)";
    if (e.id === "disabled") {
      cursor = "not-allowed";
      if (s.disabled === "A") estilo = { background: "#e1e4ea", color: "#ffffff" };
      else if (s.disabled === "B") { estilo = { background: "#e1e4ea", color: "#5c6474", boxShadow: "none" }; rotulo = "Inscrições encerradas"; }
      else if (s.disabled === "C") return el("div", { class: "state-cell" }, [el("span", { class: "state-name", text: e.nome }), el("span", { class: "state-hidden", text: "(oculto)" })]);
      else estilo = { background: "#ffffff", color: "#5c6474", border: "1px dashed #b9c0cc" };
    }
    extras.push(el("span", { class: "cursor-tag" }, [icone(cursor === "pointer" ? "pointer" : "x", 16), cursor]));
    return el("button", {
      type: "button",
      class: `state-cell${selecionado === e.id ? " is-selected" : ""}`,
      onclick: () => { selecionado = e.id; desenhar(); },
      "aria-pressed": String(selecionado === e.id),
    }, [el("span", { class: "state-name", text: e.nome }), el("span", { class: "state-btn", style: estilo, text: e.id === "disabled" && !s.disabled ? "escolham" : rotulo }), ...extras]);
  }

  let editorDe = null;

  function desenhar() {
    linha.replaceChildren(...ESTADOS.map(preview));
    const reconstruir = editorDe !== selecionado;
    editorDe = selecionado;
    const opcoesTom = config.paleta.map((p) => ({ v: p.id, t: `Azul ${p.id}  ${p.hex}` }));
    const e = ESTADOS.find((k) => k.id === selecionado);
    if (selecionado === "disabled") {
      if (reconstruir) editor.replaceChildren(
        el("p", { class: "ws-label", text: "Estratégia do Disabled" }),
        segmentado({ rotulo: "Estratégia", nome: "estrategia", valor: s.disabled, opcoes: config.estrategias.map((x) => ({ v: x.id, t: x.id })), aoMudar: (v) => { s.disabled = v; desenhar(); } }),
        el("ul", { class: "strategy-list" }, config.estrategias.map((x) => el("li", {}, [el("strong", { text: `${x.id}: ` }), x.texto])))
      );
      inspecao.replaceChildren(el("p", { class: "small muted", text: "Disabled é isento do contraste mínimo, mas não pode depender só de cor." }));
    } else {
      const chave = selecionado;
      if (reconstruir) editor.replaceChildren(
        campoSelect({ rotulo: chave === "focus" ? "Tom do anel de foco" : `Fundo no ${e.nome}`, valor: s[chave], largo: true, opcoes: opcoesTom, aoMudar: (v) => { s[chave] = v; desenhar(); } })
      );
      if (chave === "focus") {
        inspecao.replaceChildren(inspetor([["Anel", `${s.focus} ${hex[s.focus]}`], ["Contra o card branco", `${num(razaoContraste(hex[s.focus], "#ffffff"), 2)}:1`], ["Espessura", "2px"]]));
      } else {
        inspecao.replaceChildren(inspetor([["Fundo", `${s[chave]} ${hex[s[chave]]}`], ["Rótulo", "#ffffff 16px 600"], ["Contraste do rótulo", `${num(razaoContraste("#ffffff", hex[s[chave]]), 2)}:1`]]));
      }
    }
    const completo = s.disabled ? `${s.default}-${s.hover}-${s.pressed}-${s.focus}-${s.disabled}` : "";
    exp.definir(completo, "Escolham a estratégia do Disabled.");
    camadas.replaceChildren(
      ...ESTADOS.map((k) => el("button", { type: "button", class: `layer-row${k.id === selecionado ? " is-selected" : ""}`, onclick: () => { selecionado = k.id; desenhar(); } }, [icone("component"), el("span", { text: `Estado=${k.nome}` })]))
    );
    salvar(s);
  }

  props.replaceChildren(
    secao("Estado selecionado", [editor], "component"),
    secao("Inspetor", [inspecao], "search"),
    secao("Handoff", [el("p", { class: "small muted", text: "Default - Hover - Pressed - Foco - Disabled" }), exp.no], "export")
  );
  desenhar();
  return { destruir() {}, resumo: () => ({ ...s }) };
}
