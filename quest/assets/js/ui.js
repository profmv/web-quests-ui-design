/**
 * OBJECTIVE: Small UI helpers shared by the quest shell and the benches: element builder, icons,
 *            glossary balloons, toasts and copy-to-clipboard with a manual fallback.
 * USAGE: import { el, icone, textoComTermos, ativarBaloes, aviso, copiar } from './ui.js';
 */

import { escaparHtml } from "./util.js";

/** Creates an element: el('div', { class: 'x', text: 'y', onclick }, [children]). */
export function el(tag, attrs = {}, filhos = []) {
  const no = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") no.className = v;
    else if (k === "text") no.textContent = v;
    else if (k === "html") no.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") no.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") Object.assign(no.style, v);
    else no.setAttribute(k, v === true ? "" : String(v));
  }
  for (const f of [].concat(filhos)) {
    if (f === null || f === undefined || f === false) continue;
    no.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return no;
}

/** Returns an SVG icon from the page sprite. */
export function icone(id, tamanho = 16) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", `ic ic-${tamanho}`);
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(ns, "use");
  use.setAttribute("href", `#i-${id}`);
  svg.append(use);
  return svg;
}

/**
 * Converts text with {{key}} markers into HTML; each known key becomes a balloon trigger.
 * Unknown keys fall back to plain text. All other text is escaped.
 */
export function textoComTermos(texto, conceitos = []) {
  const mapa = Object.fromEntries(conceitos.map((c) => [c.chave, c]));
  return String(texto || "")
    .split(/(\{\{\w+\}\})/g)
    .map((parte) => {
      const m = parte.match(/^\{\{(\w+)\}\}$/);
      if (!m) return escaparHtml(parte);
      const c = mapa[m[1]];
      if (!c) return escaparHtml(m[1]);
      return `<button type="button" class="term" data-termo="${escaparHtml(c.chave)}" aria-haspopup="dialog">${escaparHtml(c.termo)}</button>`;
    })
    .join("");
}

let baloaAtual = null;

function fecharBalao() {
  if (!baloaAtual) return;
  baloaAtual.balao.remove();
  baloaAtual.gatilho.setAttribute("aria-expanded", "false");
  baloaAtual = null;
}

/**
 * Wires glossary balloons inside `raiz`. `aoAbrirSlide(n, gatilho)` opens the slides drawer.
 */
export function ativarBaloes(raiz, conceitos, aoAbrirSlide) {
  const mapa = Object.fromEntries(conceitos.map((c) => [c.chave, c]));
  raiz.querySelectorAll(".term").forEach((gatilho) => {
    gatilho.setAttribute("aria-expanded", "false");
    gatilho.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const aberto = baloaAtual && baloaAtual.gatilho === gatilho;
      fecharBalao();
      if (aberto) return;
      const c = mapa[gatilho.dataset.termo];
      if (!c) return;
      const id = `balao-${c.chave}`;
      const balao = el("div", { class: "balloon anim-pop", role: "dialog", id, "aria-label": c.termo }, [
        el("h4", { text: c.termo }),
        el("p", {}, [el("strong", { text: "O que é: " }), c.oQue]),
        el("p", {}, [el("strong", { text: "Para que serve: " }), c.praQue]),
        el("div", { class: "balloon-links" }, [
          c.slide ? el("button", { type: "button", class: "btn btn-secondary btn-sm", onclick: () => { fecharBalao(); aoAbrirSlide(c.slide, gatilho); } }, [icone("slides"), `Slide ${c.slide}`]) : null,
          c.link ? el("a", { href: c.link, target: "_blank", rel: "noopener" }, [c.rotulo || "Saiba mais", " ", icone("external", 16)]) : null,
        ]),
      ]);
      document.body.append(balao);
      const r = gatilho.getBoundingClientRect();
      const largura = balao.offsetWidth;
      const esquerda = Math.max(16, Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - largura - 16));
      balao.style.left = `${esquerda}px`;
      balao.style.top = `${window.scrollY + r.bottom + 8}px`;
      gatilho.setAttribute("aria-expanded", "true");
      gatilho.setAttribute("aria-controls", id);
      baloaAtual = { balao, gatilho };
      balao.setAttribute("tabindex", "-1");
      balao.focus({ preventScroll: true });
    });
  });
}

document.addEventListener("click", (ev) => {
  if (baloaAtual && !baloaAtual.balao.contains(ev.target)) fecharBalao();
});
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && baloaAtual) {
    const g = baloaAtual.gatilho;
    fecharBalao();
    g.focus();
  }
});
window.addEventListener("resize", fecharBalao);

/** Shows a short toast. tipo: ok | warn | bad | info */
export function aviso(texto, tipo = "info") {
  const regiao = document.getElementById("avisos");
  if (!regiao) return;
  const t = el("div", { class: `toast toast-${tipo} anim-pop` }, [texto]);
  while (regiao.children.length >= 2) regiao.firstElementChild.remove();
  regiao.append(t);
  setTimeout(() => t.remove(), 4200);
}

/** Copies text; when the clipboard API is blocked, selects the field and asks for Ctrl + C. */
export async function copiar(texto, campo) {
  try {
    await navigator.clipboard.writeText(texto);
    return "Copiado.";
  } catch {
    if (campo) {
      campo.focus();
      campo.select();
    }
    return "Selecionado: tecle Ctrl + C para copiar.";
  }
}

/** Downloads text as a file. */
export function baixar(nome, conteudo, tipo = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = el("a", { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Relative luminance contrast ratio (WCAG). */
export function razaoContraste(hexA, hexB) {
  const lum = (h) => {
    const s = h.replace("#", "");
    const c = [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [x, y] = [lum(hexA), lum(hexB)].sort((a, b) => b - a);
  return (x + 0.05) / (y + 0.05);
}

/** Formats a number with comma decimals (pt-BR). */
export function num(v, casas = 2) {
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });
}
