/**
 * OBJECTIVE: Lock 2 bench - spacing rhythm. The pair sets padding, gaps and button height; the canvas
 *            draws redlines for every spacing and the inspector reports X, Y, W, H of the selected layer.
 */

import { el } from "../ui.js";
import { campoNumero, inspetor, listaCamadas, quadro, secao, selecao } from "./comum.js";

export function montar({ canvas, props, camadas, config, rascunho, salvar }) {
  const s = rascunho || { ...config.inicial };
  const W = config.largura;
  const A = config.alturas;
  let selecionado = "card";

  const frame = quadro("Card/Evento", W, "rhythm-frame");
  const area = el("div", { class: "rhythm-card" });
  frame.append(area);
  const compacto = el("div", { class: "canvas-inspector" });
  const medidaCompacta = el("div", { "aria-live": "polite" });
  compacto.append(el("button", { type: "button", class: "btn btn-secondary btn-sm", text: "Selecionar Card/Evento", onclick: () => { selecionado = "card"; desenhar(); } }), medidaCompacta);
  canvas.replaceChildren(frame, compacto, el("p", { class: "stage-note", text: "Linhas rosa: medidas. Selecionem uma camada para ver X, Y, L e A." }));
  const inspecao = el("div");

  function geometria() {
    const g = {};
    let y = s.pad;
    g.titulo = { x: s.pad, y, w: W - 2 * s.pad, h: A.titulo };
    y += A.titulo + s.g1;
    g.data = { x: s.pad, y, w: W - 2 * s.pad, h: A.data };
    y += A.data + s.g2;
    g.descricao = { x: s.pad, y, w: W - 2 * s.pad, h: A.descricao };
    y += A.descricao + s.g3;
    g.botao = { x: s.pad, y, w: W - 2 * s.pad, h: s.btn };
    y += s.btn + s.pad;
    g.card = { x: 0, y: 0, w: W, h: y };
    return g;
  }

  const nomes = { card: "Card/Evento", titulo: "titulo", data: "data", descricao: "descricao", botao: "botao-inscrever" };

  function medida(x, y1, y2, valor) {
    if (y2 <= y1) return null;
    return el("div", { class: `redline-v${valor % 8 ? " is-off" : ""}`, style: { left: `${x}px`, top: `${y1}px`, height: `${y2 - y1}px` } }, [
      el("span", { class: "redline-tag", text: String(valor) }),
    ]);
  }

  function desenhar() {
    const g = geometria();
    area.style.height = `${g.card.h}px`;
    const camada = (id, filho) => {
      const r = g[id];
      return el("button", {
        type: "button",
        "data-camada": id,
        class: `rhythm-layer layer-${id}${selecionado === id ? " is-selected" : ""}`,
        "aria-pressed": String(selecionado === id),
        style: { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` },
        onclick: (ev) => {
          ev.stopPropagation();
          selecionado = id;
          desenhar();
          area.querySelector(`[data-camada="${id}"]`)?.focus({ preventScroll: true });
        },
      }, [filho, selecionado === id ? selecao(r.w, r.h) : null]);
    };
    area.replaceChildren(...[
      camada("titulo", el("span", { class: "r-title", text: "Dia do Design" })),
      camada("data", el("span", { class: "r-date", text: "16 de maio, Auditório B" })),
      camada("descricao", el("span", { class: "r-desc", text: "Oficinas, revisão de portfólio e conversas com designers." })),
      camada("botao", el("span", { class: "r-btn", text: "Inscrever-se" })),
      medida(W - 20, 0, s.pad, s.pad),
      medida(W - 20, g.titulo.y + g.titulo.h, g.data.y, s.g1),
      medida(W - 20, g.data.y + g.data.h, g.descricao.y, s.g2),
      medida(W - 20, g.descricao.y + g.descricao.h, g.botao.y, s.g3),
      medida(W - 20, g.botao.y + g.botao.h, g.card.h, s.pad),
      selecionado === "card" ? selecao(g.card.w, g.card.h) : null
    ].filter(Boolean));
    area.onclick = () => { selecionado = "card"; desenhar(); };
    const r = g[selecionado];
    const medidas = [["X", String(r.x)], ["Y", String(r.y)], ["L (largura)", String(r.w)], ["A (altura)", String(r.h)]];
    inspecao.replaceChildren(
      el("p", { class: "small", style: { margin: "0 0 8px" } }, [el("strong", { text: nomes[selecionado] })]),
      inspetor(medidas)
    );
    medidaCompacta.replaceChildren(
      el("strong", { text: nomes[selecionado] }),
      inspetor(medidas),
      el("p", { class: "small", text: `Card/Evento: ${g.card.w} × ${g.card.h} px` })
    );
    listaCamadas(camadas, ["card", "titulo", "data", "descricao", "botao"].map((id) => ({ id, nome: nomes[id], icone: id === "card" ? "frame" : id === "botao" ? "rect" : "text", nivel: id === "card" ? 0 : 1 })), selecionado, (id) => { selecionado = id; desenhar(); });
    salvar(s);
  }

  props.replaceChildren(
    secao("Espaçamento", [
      el("div", { class: "prop-grid" }, config.controles.map((c) =>
        campoNumero({ rotulo: c.rotulo, valor: s[c.id], min: 0, max: 96, grade: 8, aoMudar: (v) => { s[c.id] = v; desenhar(); } })
      )),
    ], "sliders"),
    secao("Inspetor", [inspecao], "search")
  );
  desenhar();
  return { destruir() {}, resumo: () => ({ ...s }) };
}
