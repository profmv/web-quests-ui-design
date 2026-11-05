/**
 * OBJECTIVE: Local state persistence and the portable progress code of the pair.
 * USAGE: import { carregarEstado, salvarEstado, gerarCodigo, lerCodigo, hashResposta } from './progress.js';
 * FORMAT: "WQ2." + base64url(JSON). The JSON carries team, times, per-lock answer hashes bound to the team
 *         (sha256(team|startedAt|lock|answer)), errors, hints, minigame points, and a vault with the answers
 *         and bench work encrypted with the pair's password (only used to continue on another computer).
 * SECURITY: The code never carries readable answers. The seal only detects accidental edits; the scoreboard
 *           verifies the hashes with the teacher's verification file. Client-only: deliberate forgery by someone
 *           who already knows every answer cannot be prevented.
 */

import { normalizar, sha256Hex, paraBase64Url, deBase64Url, cifrarTexto, decifrarBloco } from "./crypto.js";

const CHAVE_LOCAL = "estudio-oito:v2";
const PREFIXO = "WQ2.";
const ITERACOES_PIN = 100000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function estadoVazio() {
  return {
    v: 2,
    team: ["", ""],
    pin: "",
    startedAt: 0,
    completedAt: null,
    respostas: [],
    abertas: [],
    erros: [],
    dicas: [],
    minigames: {},
    trabalho: {},
    rascunhos: {},
  };
}

export function carregarEstado() {
  try {
    const bruto = localStorage.getItem(CHAVE_LOCAL);
    if (!bruto) return null;
    const dados = JSON.parse(bruto);
    if (!dados || dados.v !== 2 || !Array.isArray(dados.team)) return null;
    return { ...estadoVazio(), ...dados };
  } catch {
    return null;
  }
}

export function salvarEstado(estado) {
  try {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(estado));
    return true;
  } catch {
    return false;
  }
}

export function apagarEstado() {
  try {
    localStorage.removeItem(CHAVE_LOCAL);
  } catch {
    /* storage unavailable: nothing to clear */
  }
}

/** Team-bound answer hash, shared with quest/placar. */
export async function hashResposta(team, startedAt, indice, resposta) {
  const t = team.map((n) => normalizar(n)).join("+");
  return sha256Hex(`${t}|${startedAt}|${indice}|${normalizar(resposta)}`);
}

export async function gerarCodigo(estado) {
  const hashes = [];
  for (let i = 0; i < estado.respostas.length; i++) {
    hashes.push(await hashResposta(estado.team, estado.startedAt, i, estado.respostas[i]));
  }
  const cofre = estado.pin
    ? await cifrarTexto(JSON.stringify({ r: estado.respostas, w: estado.trabalho }), normalizar(estado.pin), ITERACOES_PIN)
    : null;
  const corpo = {
    t: estado.team,
    s: estado.startedAt,
    c: estado.completedAt,
    h: hashes,
    a: estado.abertas,
    e: estado.erros,
    d: estado.dicas,
    m: estado.minigames,
    x: cofre,
  };
  const json = JSON.stringify(corpo);
  const selo = (await sha256Hex(`selo|${json}`)).slice(0, 16);
  return PREFIXO + paraBase64Url(encoder.encode(JSON.stringify({ ...corpo, z: selo })));
}

/**
 * Parses a progress code. Returns { ok, dados, erro }.
 */
export async function lerCodigo(texto) {
  const limpo = String(texto || "").replace(/\s+/g, "");
  if (!limpo.startsWith(PREFIXO)) {
    return { ok: false, erro: "Isso não parece um código de progresso (ele começa com WQ2.)." };
  }
  let dados;
  try {
    dados = JSON.parse(decoder.decode(deBase64Url(limpo.slice(PREFIXO.length))));
  } catch {
    return { ok: false, erro: "Código incompleto. Copiem de novo, inteiro." };
  }
  if (!dados || !Array.isArray(dados.t) || !Array.isArray(dados.h)) {
    return { ok: false, erro: "Código incompleto. Copiem de novo, inteiro." };
  }
  const { z, ...corpo } = dados;
  const selo = (await sha256Hex(`selo|${JSON.stringify(corpo)}`)).slice(0, 16);
  return { ok: true, dados: corpo, seloOk: selo === z, erro: selo === z ? null : "O código foi alterado depois de gerado." };
}

/** Decrypts the vault of a code with the pair's password; returns { respostas, trabalho } or null. */
export async function abrirCofre(dados, pin) {
  if (!dados?.x) return null;
  const cofre = await decifrarBloco(dados.x, pin, ITERACOES_PIN);
  if (!cofre || !Array.isArray(cofre.r)) return null;
  return { respostas: cofre.r, trabalho: cofre.w || {} };
}
