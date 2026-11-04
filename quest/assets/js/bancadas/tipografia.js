/**
 * OBJECTIVE: Lock 0 bench - modular type scale. The pair sets base, ratio and the step of each text layer;
 *            the canvas renders the raw (unrounded) sizes and the inspector shows them with decimals.
 *            Rounding to the studio grid is the pair's job.
 */

import { el } from "../ui.js";
import { campoNumero, campoSelect, inspetor, listaCamadas, quadro, secao } from "./comum.js";

const fmt = (v) => `${Number(v.toFixed(2)).toLocaleString("pt-BR")}px`;

export function montar({ canvas, props, camadas, config, rascunho, salvar }) {
  const s = rascunho || {
    base: config.baseInicial,
    razao: config.razaoInicial,
    passos: Object.fromEntries(config.camadas.map((c) => [c.id, 0])),
  };
  let selecionada = config.camadas[0].id;

  const razaoValor = () => config.razoes.find((r) => r.id === s.razao)?.valor || 1;
  const tamanho = (passo) => s.base * razaoValor() ** passo;

  const frame = quadro("Card/Evento", 360);
  const corpo = el("div", { class: "type-card" });
  frame.append(corpo);
  const escala = el("div", { class: "scale-ruler", "aria-label": "Escala gerada" });
  canvas.replaceChildren(frame, escala, el("p", { class: "stage-note", text: "Valores brutos, sem arredondar. Arredondar é com vocês." }));

  const inspecao = el("div");

  function desenhar() {
    corpo.replaceChildren(
      ...config.camadas.map((c) => {
        const t = tamanho(s.passos[c.id]);
        return el("div", { class: `type-layer${c.id === selecionada ? " is-selected" : ""}`, onclick: () => selecionar(c.id) }, [
          el("span", { class: "type-sample", style: { fontSize: `${t}px`, fontWeight: c.peso, color: c.cor }, text: c.texto }),
          el("span", { class: "redline-tag", text: fmt(t) }),
        ]);
      }),
      el("span", { class: "type-button", text: "Inscrever-se" })
    );
    escala.replaceChildren(
      el("p", { class: "ws-label", text: "Escala gerada (passo: tamanho bruto)" }),
      el("div", { class: "scale-steps" }, [-1, 0, 1, 2, 3, 4, 5].map((p) =>
        el("div", { class: "scale-step" }, [
          el("span", { class: "scale-glyph", style: { fontSize: `${Math.min(tamanho(p), 64)}px` }, text: "Aa" }),
          el("span", { class: "scale-meta", text: `${p >= 0 ? "+" : ""}${p}: ${fmt(tamanho(p))}` }),
        ])
      )),
    );
    const c = config.camadas.find((k) => k.id === selecionada);
    const t = tamanho(s.passos[c.id]);
    inspecao.replaceChildren(
      inspetor([
        ["Camada", c.nome],
        ["Passo", String(s.passos[c.id])],
        ["Tamanho", fmt(t)],
        ["Peso", String(c.peso)],
        ["Altura de linha", "auto"],
      ])
    );
    listaCamadas(camadas, [{ id: "card", nome: "Card/Evento", icone: "frame" }, ...config.camadas.map((k) => ({ id: k.id, nome: k.nome, icone: "text", nivel: 1 }))], selecionada, (id) => id !== "card" && selecionar(id));
    salvar(s);
  }

  function selecionar(id) {
    selecionada = id;
    desenhar();
  }

  props.replaceChildren(
    secao("Escala", [
      el("div", { class: "prop-grid" }, [
        campoNumero({ rotulo: "Base (passo 0)", valor: s.base, min: 8, max: 32, aoMudar: (v) => { s.base = v; desenhar(); } }),
        campoSelect({ rotulo: "Razão", largo: true, valor: s.razao, opcoes: config.razoes.map((r) => ({ v: r.id, t: r.nome })), aoMudar: (v) => { s.razao = v; desenhar(); } }),
      ]),
    ], "text"),
    secao("Passo de cada camada", [
      el("div", { class: "prop-grid" }, config.camadas.map((c) =>
        campoSelect({
          rotulo: c.nome,
          valor: s.passos[c.id],
          opcoes: [-1, 0, 1, 2, 3, 4, 5].map((p) => ({ v: p, t: `passo ${p}` })),
          aoMudar: (v) => { s.passos[c.id] = Number(v); selecionada = c.id; desenhar(); },
        })
      )),
    ], "layers"),
    secao("Inspetor", [inspecao], "search")
  );

  desenhar();
  return {
    destruir() {},
    resumo: () => ({ base: s.base, razao: s.razao, passos: { ...s.passos } }),
  };
}
