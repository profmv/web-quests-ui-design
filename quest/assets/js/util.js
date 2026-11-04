/**
 * OBJECTIVE: Small shared helpers for safe text output in the Quest UI.
 * USAGE: import { escaparHtml, nomeArquivoSeguro } from './util.js';
 * OUTPUTS: Escaped strings safe for HTML/XML text and attribute contexts; ASCII-safe file name fragments.
 */

const MAPA_ESCAPE = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/**
 * Escapes user-provided text for HTML and XML (SVG) contexts.
 */
export function escaparHtml(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => MAPA_ESCAPE[c]);
}

/**
 * Converts text into a file-name fragment: strips accents, keeps [A-Za-z0-9], collapses the rest to "_".
 */
export function nomeArquivoSeguro(texto, padrao = "equipe") {
  const limpo = String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return limpo || padrao;
}
