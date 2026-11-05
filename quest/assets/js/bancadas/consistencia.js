/**
 * OBJECTIVE: Lock 4 bench - pattern audit. Three app screens with markers A-L; the pair classifies each
 *            marker as OK, inconsistency or dark pattern. The export box builds a 12-digit report code.
 */

import { el, icone } from "../ui.js";
import { quadro, secao, caixaExport, segmentado } from "./comum.js";

export function montar({ canvas, props, camadas, config, rascunho, salvar }) {
  const s = rascunho || { classes: Object.fromEntries(config.marcadores.map((m) => [m.id, null])) };
  let selecionado = "A";

  const M = (id) => el("button", {
    type: "button",
    class: `audit-marker${selecionado === id ? " is-selected" : ""} cls-${s.classes[id] ?? "x"}`,
    "aria-label": `Marcador ${id}`,
    onclick: () => { selecionado = id; desenhar(); props.querySelector(`[data-marcador="${id}"]`)?.scrollIntoView({ block: "nearest" }); },
  }, [id]);

  function telaLista() {
    return el("div", { class: "phone" }, [
      el("div", { class: "ph-bar" }, [el("strong", { text: "Eventos" }), el("span", { class: "ph-icons" }, [el("span", { class: "ph-ic" }, [icone("search"), M("A")]), el("span", { class: "ph-ic" }, [icone("gear"), el("span", { class: "ph-mini", text: "Filtros" }), M("B")])])]),
      el("div", { class: "ph-urgent" }, [el("span", { text: "Só hoje! Restam 2 vagas · 09:59" }), M("D")]),
      ...["Dia do Design", "Oficina de ícones"].map((t, k) =>
        el("div", { class: "ph-item" }, [
          el("div", { class: "ph-thumb" }),
          el("div", { class: "ph-item-text" }, [el("strong", { text: t }), el("span", { text: k ? "22 de maio" : "16 de maio" })]),
          el("span", { class: "ph-ic" }, [icone("heart"), k === 0 ? M("C") : null]),
        ])
      ),
      el("div", { class: "ph-primary-blue", text: "Inscrever" }),
    ]);
  }

  function telaDetalhe() {
    return el("div", { class: "phone" }, [
      el("div", { class: "ph-bar" }, [el("span", { class: "ph-ic" }, [icone("back"), M("F")]), el("strong", { text: "Dia do Design" }), el("span")]),
      el("div", { class: "ph-hero" }),
      el("p", { class: "ph-text", text: "16 de maio, Auditório B. Oficinas, revisão de portfólio e conversas com designers." }),
      el("div", { class: "ph-save" }, [icone("floppy"), el("span", { text: "Salvar evento" }), M("H")]),
      el("div", { class: "ph-actions" }, [el("span", { class: "ph-primary-green", text: "Inscrever-se" }), M("G"), el("span", { class: "ph-secondary", text: "Compartilhar" }), M("E")]),
    ]);
  }

  function telaModal() {
    return el("div", { class: "phone phone-dim" }, [
      el("div", { class: "ph-modal" }, [
        el("div", { class: "ph-modal-head" }, [el("strong", { text: "Confirmar inscrição" }), el("span", { class: "ph-ic" }, [icone("x"), M("I")])]),
        el("p", { class: "ph-text", text: "Dia do Design · 16 de maio" }),
        el("p", { class: "ph-fee" }, [el("span", { text: "Taxa de serviço: R$ 4,90" }), M("L")]),
        el("label", { class: "ph-check" }, [el("span", { class: "ph-box", "aria-hidden": "true" }, [icone("check")]), el("span", { text: "Receber ofertas de parceiros" }), M("K")]),
        el("span", { class: "ph-primary-blue", text: "Confirmar" }),
        el("p", { class: "ph-decline" }, [el("span", { text: "Não, prefiro perder oportunidades" }), M("J")]),
      ]),
    ]);
  }

  const palco = el("div", { class: "audit-screens" });
  canvas.replaceChildren(palco, el("p", { class: "stage-note", text: "Lista, detalhe e confirmação do mesmo app. Cliquem nos marcadores." }));
  const lista = el("div", { class: "audit-list" });
  const exp = caixaExport("Relatório exportado");

  function desenhar() {
    const telas = [["1 · Lista", telaLista()], ["2 · Detalhe", telaDetalhe()], ["3 · Confirmação", telaModal()]];
    palco.replaceChildren(...telas.map(([n, t]) => { const f = quadro(n, 240, "phone-frame"); f.append(t); return f; }));
    lista.replaceChildren(
      ...config.marcadores.map((m) =>
        el("div", { class: `audit-row${selecionado === m.id ? " is-selected" : ""}`, "data-marcador": m.id }, [
          el("p", { class: "audit-label" }, [el("strong", { text: m.id }), ` ${m.rotulo}`]),
          segmentado({ rotulo: `Classe do marcador ${m.id}`, nome: `cls-${m.id}`, valor: s.classes[m.id], opcoes: config.classes.map((t, i) => ({ v: i, t })), aoMudar: (v) => { s.classes[m.id] = Number(v); selecionado = m.id; atualizar(); } }),
        ])
      )
    );
    atualizar();
  }

  function atualizar() {
    const faltam = config.marcadores.filter((m) => s.classes[m.id] === null).length;
    exp.definir(faltam ? `faltam ${faltam} marcadores` : config.marcadores.map((m) => s.classes[m.id]).join(""));
    palco.querySelectorAll(".audit-marker").forEach((b) => {
      const id = b.textContent;
      b.className = `audit-marker${selecionado === id ? " is-selected" : ""} cls-${s.classes[id] ?? "x"}`;
    });
    lista.querySelectorAll(".audit-row").forEach((r) => r.classList.toggle("is-selected", r.dataset.marcador === selecionado));
    camadas.replaceChildren(el("p", { class: "small muted pad-2", text: `${config.marcadores.length - faltam} de ${config.marcadores.length} classificados. Legenda: 0 = OK, 1 = Inconsistência, 2 = Dark pattern.` }));
    salvar(s);
  }

  props.replaceChildren(secao("Classificação", [lista], "search"), secao("Handoff", [exp.no], "export"));
  desenhar();
  return { destruir() {}, resumo: () => ({ ...s.classes }) };
}
