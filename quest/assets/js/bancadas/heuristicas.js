/**
 * OBJECTIVE: Lock 6 bench - heuristic review. An everyday academic portal shows problems P1-P7; the pair
 *            assigns one of Nielsen's 10 heuristics to each. The export box builds the review code.
 */

import { el, icone } from "../ui.js";
import { campoSelect, quadro, secao, caixaExport } from "./comum.js";

export function montar({ canvas, props, camadas, config, rascunho, salvar }) {
  const s = rascunho || { notas: Object.fromEntries(config.problemas.map((p) => [p.id, ""])) };
  let selecionado = "P1";
  const P = (id) => el("button", { type: "button", class: `audit-marker heur-marker${selecionado === id ? " is-selected" : ""}`, "aria-label": `Problema ${id}`, onclick: () => selecionar(id) }, [id]);

  const portal = el("div", { class: "portal" }, [
    el("div", { class: "pt-top" }, [el("strong", { text: "Portal Acadêmico" }), el("span", { class: "pt-menu" }, [el("span", { text: "Submeter requerimento de vínculo discente" }), P("P7")])]),
    el("div", { class: "pt-grid" }, [
      el("div", { class: "pt-col" }, [
        el("p", { class: "pt-error" }, [icone("x"), el("span", { text: "Erro 0x80041: operação inválida" }), P("P3")]),
        el("label", { class: "pt-label", text: "Disciplina (código)" }),
        el("div", { class: "pt-field" }, [el("span", { class: "pt-ph", text: "ex.: ADS-204" }), P("P4")]),
        el("label", { class: "pt-label", text: "Data de início" }),
        el("div", { class: "pt-field" }, [el("span", { text: "31/02/2026" }), P("P2")]),
        el("ul", { class: "pt-list" }, [
          el("li", {}, [el("span", { text: "ADS-204 Interfaces" }), el("span", { class: "pt-remove" }, ["Remover", P("P6")])]),
          el("li", {}, [el("span", { text: "ADS-118 Banco de dados" }), el("span", { class: "pt-remove", text: "Remover" })]),
        ]),
      ]),
      el("div", { class: "pt-col" }, [
        el("div", { class: "pt-mini" }, [el("span", { class: "pt-mini-tag", text: "Tela 1" }), el("span", { class: "pt-btn-blue", text: "Salvar" })]),
        el("div", { class: "pt-mini" }, [el("span", { class: "pt-mini-tag", text: "Tela 2" }), el("span", { class: "pt-btn-green", text: "Gravar" }), P("P5")]),
        el("div", { class: "pt-wait" }, [el("span", { class: "pt-mini-tag", text: "Após \"Enviar matrícula\"" }), el("div", { class: "pt-blank" }, [el("span", { text: "0 s ... 20 s" })]), P("P1")]),
      ]),
    ]),
  ]);
  const f = quadro("Portal Acadêmico (navegador)", 640, "portal-frame");
  f.append(portal);
  canvas.replaceChildren(f, el("p", { class: "stage-note", text: "Cliquem em P1 a P7 para ler cada problema." }));

  const leitura = el("div", { class: "heur-detail", "aria-live": "polite" });
  const lista = el("div", { class: "audit-list" });
  const exp = caixaExport("Parecer exportado");
  const opcoes = [{ v: "", t: "escolham..." }, ...config.nomes.slice(1).map((n, i) => ({ v: String(i + 1), t: `${i + 1}. ${n}` }))];

  lista.append(
    ...config.problemas.map((k) =>
      el("div", { class: "audit-row", "data-problema": k.id }, [
        campoSelect({ rotulo: k.id, valor: s.notas[k.id], largo: true, opcoes, aoMudar: (v) => { s.notas[k.id] = v; selecionado = k.id; desenhar(); } }),
        el("p", { class: "heur-escolha", "data-escolha": k.id }),
      ])
    )
  );

  function selecionar(id) {
    selecionado = id;
    desenhar();
  }

  function desenhar() {
    portal.querySelectorAll(".heur-marker").forEach((b) => b.classList.toggle("is-selected", b.textContent === selecionado));
    const p = config.problemas.find((k) => k.id === selecionado);
    leitura.replaceChildren(el("p", { class: "callout callout-info" }, [el("span", {}, [el("strong", { text: `${p.id}:` }), ` ${p.texto}`])]));
    lista.querySelectorAll(".audit-row").forEach((r) => r.classList.toggle("is-selected", r.dataset.problema === selecionado));
    // Full heuristic name under each select: long names are cut inside a narrow panel.
    lista.querySelectorAll(".heur-escolha").forEach((n) => {
      const v = s.notas[n.dataset.escolha];
      n.textContent = v ? `${v}. ${config.nomes[Number(v)]}` : "";
      n.hidden = !v;
    });
    const faltam = config.problemas.filter((k) => !s.notas[k.id]).length;
    exp.definir(faltam ? `faltam ${faltam} problemas` : config.problemas.map((k) => s.notas[k.id]).join("-"));
    camadas.replaceChildren(...config.problemas.map((k) => el("button", { type: "button", class: `layer-row${k.id === selecionado ? " is-selected" : ""}`, onclick: () => selecionar(k.id) }, [icone("message"), el("span", { text: `${k.id}${s.notas[k.id] ? ` · heurística ${s.notas[k.id]}` : ""}` })])));
    salvar(s);
  }

  props.replaceChildren(secao("Problema selecionado", [leitura], "message"), secao("Heurística de cada problema", [lista], "search"), secao("Handoff", [exp.no], "export"));
  desenhar();
  return { destruir() {}, resumo: () => ({ ...s.notas }) };
}
