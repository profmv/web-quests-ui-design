/**
 * OBJECTIVE: Lock 5 bench - low-fidelity wireframe. A colourful home screen sits next to an empty low-fi
 *            frame; the pair stacks grey blocks from a library. The export box lists the stack codes.
 */

import { el, icone } from "../ui.js";
import { quadro, secao, caixaExport } from "./comum.js";

export function montar({ canvas, props, camadas, config, rascunho, salvar }) {
  const lib = Object.fromEntries(config.biblioteca.map((b) => [b.id, b]));
  const s = rascunho || { pilha: [] };
  let selecionado = -1;

  function hifi() {
    return el("div", { class: "hifi" }, [
      el("div", { class: "hf-appbar" }, [el("span", { class: "hf-logo", text: "Agenda" }), el("span", { class: "hf-actions" }, [icone("bell"), el("span", { class: "hf-avatar", text: "LR" })])]),
      el("div", { class: "hf-search" }, [icone("search"), el("span", { text: "Buscar eventos" })]),
      el("div", { class: "hf-chips" }, ["Todos", "Oficinas", "Palestras", "Festas"].map((t, i) => el("span", { class: `hf-chip${i === 0 ? " on" : ""}`, text: t }))),
      el("div", { class: "hf-banner" }, [el("span", { class: "hf-banner-tag", text: "Destaque" }), el("strong", { text: "Dia do Design" }), el("span", { text: "16 de maio, Auditório B" })]),
      el("div", { class: "hf-wave", "aria-hidden": "true", html: '<svg viewBox="0 0 280 28" preserveAspectRatio="none"><path d="M0 14 Q 35 0 70 14 T 140 14 T 210 14 T 280 14" fill="none" stroke="#b5c6f5" stroke-width="3"/><path d="M0 22 Q 35 8 70 22 T 140 22 T 210 22 T 280 22" fill="none" stroke="#e3c6f2" stroke-width="3"/></svg>' }),
      ...[["Oficina de ícones", "22 de maio"], ["Roda de portfólio", "29 de maio"]].map(([t, d]) =>
        el("div", { class: "hf-item" }, [el("span", { class: "hf-thumb" }), el("span", { class: "hf-item-text" }, [el("strong", { text: t }), el("span", { text: d })]), el("span", { class: "hf-chev", text: ">" })])
      ),
      el("div", { class: "hf-promo" }, [el("strong", { text: "Seja monitor do Dia do Design" }), el("span", { text: "Ganhe certificado de 8 horas." }), el("span", { class: "hf-promo-btn", text: "Quero ajudar" })]),
      el("span", { class: "hf-fab", "aria-hidden": "true" }, [icone("plus", 24)]),
      el("div", { class: "hf-tabs" }, [["home", "Início"], ["calendar", "Agenda"], ["heart", "Favoritos"], ["user", "Perfil"]].map(([ic, t], i) => el("span", { class: `hf-tab${i === 0 ? " on" : ""}` }, [icone(ic), t]))),
    ]);
  }

  const fHi = quadro("Tela atual (alta fidelidade)", 280, "hifi-frame");
  fHi.append(hifi());
  const fLo = quadro("Wireframe (baixa fidelidade)", 280, "lofi-frame");
  const lofi = el("div", { class: "lofi" });
  fLo.append(lofi);
  canvas.replaceChildren(el("div", { class: "wire-compare" }, [fHi, fLo]), el("p", { class: "stage-note", text: "Um bloco por região, de cima para baixo. Enfeite não vira bloco." }));

  const pilha = el("ol", { class: "order-list", "aria-label": "Pilha do wireframe" });
  const exp = caixaExport("Código da pilha");

  function mover(i, d) {
    const j = i + d;
    if (j < 0 || j >= s.pilha.length) return;
    [s.pilha[i], s.pilha[j]] = [s.pilha[j], s.pilha[i]];
    selecionado = j;
    desenhar();
  }

  function desenhar() {
    lofi.replaceChildren(
      ...(s.pilha.length
        ? s.pilha.map((id, i) =>
            el("button", { type: "button", class: `lofi-block lofi-${id}${i === selecionado ? " is-selected" : ""}`, style: { height: `${lib[id].alt}px` }, onclick: () => { selecionado = i; desenhar(); } }, [el("span", { text: `${lib[id].nome} · ${id}` })])
          )
        : [el("p", { class: "lofi-empty", text: "Adicionem blocos pela biblioteca no painel Design." })])
    );
    pilha.replaceChildren(
      ...s.pilha.map((id, i) =>
        el("li", { class: `order-item${i === selecionado ? " is-selected" : ""}` }, [
          el("span", { class: "order-pos", text: String(i + 1) }),
          el("span", { class: "order-name" }, [el("strong", { text: id }), ` ${lib[id].nome}`]),
          el("button", { type: "button", class: "icon-btn", "aria-label": `Subir ${lib[id].nome}`, disabled: i === 0, onclick: () => mover(i, -1) }, [icone("up")]),
          el("button", { type: "button", class: "icon-btn", "aria-label": `Descer ${lib[id].nome}`, disabled: i === s.pilha.length - 1, onclick: () => mover(i, 1) }, [icone("down")]),
          el("button", { type: "button", class: "icon-btn", "aria-label": `Remover ${lib[id].nome}`, onclick: () => { s.pilha.splice(i, 1); selecionado = -1; desenhar(); } }, [icone("trash")]),
        ])
      )
    );
    if (!s.pilha.length) pilha.append(el("li", { class: "small muted", text: "Pilha vazia." }));
    exp.definir(s.pilha.join("-"));
    camadas.replaceChildren(
      el("button", { type: "button", class: "layer-row" }, [icone("frame"), el("span", { text: "Wireframe" })]),
      ...s.pilha.map((id, i) => el("button", { type: "button", class: `layer-row${i === selecionado ? " is-selected" : ""}`, style: { paddingLeft: "24px" }, onclick: () => { selecionado = i; desenhar(); } }, [icone("rect"), el("span", { text: lib[id].nome })]))
    );
    salvar(s);
  }

  props.replaceChildren(
    secao("Biblioteca de blocos", [
      el("div", { class: "library" }, config.biblioteca.map((b) =>
        el("button", { type: "button", class: "library-item", onclick: () => { s.pilha.push(b.id); selecionado = s.pilha.length - 1; desenhar(); } }, [icone("plus"), el("span", { text: b.nome }), el("code", { text: b.id })])
      )),
    ], "component"),
    secao("Pilha (topo primeiro)", [pilha, exp.no], "layers")
  );
  desenhar();
  return { destruir() {}, resumo: () => ({ pilha: s.pilha.join("-") }) };
}
