/**
 * OBJECTIVE: Lock 1 bench - reading order by visual weight. The pair inspects each element (size, weight,
 *            contrast computed live from its colours) and orders the list; the canvas draws the eye path.
 */

import { el, icone, razaoContraste, num } from "../ui.js";
import { inspetor, listaCamadas, quadro, secao, caixaExport } from "./comum.js";

export function montar({ canvas, props, camadas, config, rascunho, salvar }) {
  const porId = Object.fromEntries(config.elementos.map((e) => [e.id, e]));
  const s = rascunho || { ordem: config.elementos.map((e) => e.id).sort() };
  let selecionado = "B";

  const frame = quadro("Feed / Card do evento", 400);
  const card = el("div", { class: "read-card" });
  frame.append(card);
  const compacto = el("div", { class: "canvas-inspector", "aria-live": "polite" });
  canvas.replaceChildren(frame, compacto, el("p", { class: "stage-note", text: "Cliquem num elemento para inspecionar. Os números mostram a ordem que vocês montaram." }));

  const inspecao = el("div");
  const lista = el("ol", { class: "order-list", "aria-label": "Ordem de leitura" });
  const exp = caixaExport("Sequência");

  function contraste(e) {
    return razaoContraste(e.cor, e.fundo);
  }

  function mover(id, delta) {
    const i = s.ordem.indexOf(id);
    const j = i + delta;
    if (j < 0 || j >= s.ordem.length) return;
    [s.ordem[i], s.ordem[j]] = [s.ordem[j], s.ordem[i]];
    desenhar();
    lista.querySelector(`[data-id="${id}"] .${delta < 0 ? "up" : "down"}`)?.focus();
  }

  function elemento(e) {
    const pos = s.ordem.indexOf(e.id) + 1;
    return el("button", {
      type: "button",
      "data-elemento": e.id,
      class: `read-el area-${e.area}${e.id === selecionado ? " is-selected" : ""}`,
      style: { fontSize: `${e.tamanho}px`, fontWeight: e.peso, color: e.cor, background: e.area === "botao" || e.area === "tag" ? e.fundo : "transparent" },
      "aria-label": `${e.id}: ${e.rotulo}, posição ${pos} na ordem`,
      "aria-pressed": String(e.id === selecionado),
      onclick: () => {
        selecionado = e.id;
        desenhar();
        card.querySelector(`[data-elemento="${e.id}"]`)?.focus({ preventScroll: true });
      },
    }, [
      el("span", { class: "read-marker", "aria-hidden": "true", text: e.id }),
      el("span", { class: "read-order", "aria-hidden": "true", text: String(pos) }),
      e.texto,
    ]);
  }

  function desenhar() {
    const E = (id) => elemento(porId[id]);
    card.replaceChildren(
      el("div", { class: "read-row" }, [E("A"), E("G")]),
      E("B"),
      E("C"),
      E("D"),
      el("div", { class: "read-row read-actions" }, [E("E"), E("F")])
    );
    const e = porId[selecionado];
    const medidas = [
      ["Tamanho", `${e.tamanho}px`],
      ["Peso", String(e.peso)],
      ["Texto", e.cor],
      ["Fundo", e.fundo],
      ["Contraste", `${num(contraste(e), 1)}:1`],
    ];
    inspecao.replaceChildren(
      el("p", { class: "small", style: { margin: "0 0 8px" } }, [el("strong", { text: `${e.id} · ${e.rotulo}` })]),
      inspetor(medidas)
    );
    compacto.replaceChildren(el("strong", { text: `${e.id} · ${e.rotulo}` }), inspetor(medidas));
    lista.replaceChildren(
      ...s.ordem.map((id, i) =>
        el("li", { class: "order-item", "data-id": id }, [
          el("span", { class: "order-pos", text: String(i + 1) }),
          el("span", { class: "order-name" }, [el("strong", { text: id }), ` ${porId[id].rotulo}`]),
          el("button", { type: "button", class: "icon-btn up", "aria-label": `Subir ${id}`, disabled: i === 0, onclick: () => mover(id, -1) }, [icone("up")]),
          el("button", { type: "button", class: "icon-btn down", "aria-label": `Descer ${id}`, disabled: i === s.ordem.length - 1, onclick: () => mover(id, 1) }, [icone("down")]),
        ])
      )
    );
    exp.definir(s.ordem.join(""));
    listaCamadas(camadas, [{ id: "card", nome: "Card do evento", icone: "frame" }, ...config.elementos.map((k) => ({ id: k.id, nome: `${k.id} · ${k.rotulo}`, icone: k.area === "botao" ? "rect" : "text", nivel: 1 }))], selecionado, (id) => {
      if (id === "card") return;
      selecionado = id;
      desenhar();
    });
    salvar(s);
  }

  props.replaceChildren(
    secao("Inspetor", [inspecao], "search"),
    secao("Ordem de leitura (1 = primeiro)", [lista, exp.no], "layers")
  );
  desenhar();
  return { destruir() {}, resumo: () => ({ ordem: s.ordem.join("") }) };
}
