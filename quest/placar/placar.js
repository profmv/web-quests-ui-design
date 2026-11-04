/**
 * OBJECTIVE: Teacher scoreboard. Decrypts verificacao.json with the teacher passphrase, checks each pair's
 *            progress code (team-bound answer hashes), ranks pairs with editable rules, flags anomalies,
 *            exports CSV and prints.
 * USAGE: Open quest/placar/index.html through a web server. The passphrase is set at build time:
 *        node scripts/build/build_etapas.mjs --placar-senha "<passphrase>"
 * NOTES: Only the unbroken run of verified locks from lock 0 counts. Client-only: alerts are hints, not proof.
 */

import { deBase64 } from "../assets/js/crypto.js";
import { lerCodigo, hashResposta } from "../assets/js/progress.js";
import { escaparHtml } from "../assets/js/util.js";

const CHAVE_SESSAO = "estudio-oito:placar-verificacao";
const CHAVE_CODIGOS = "estudio-oito:placar-codigos";
const CHAVE_REGRAS = "estudio-oito:placar-regras";
const TOTAL = 8;
const MINIMO_POR_FECHADURA = 30; // seconds: faster than this between locks is flagged

const REGRAS_PADRAO = { porFechadura: 100, dica: 15, erro: 5, piso: 40, bonusFinal: 100, intervalo: 10 };

const $ = (id) => document.getElementById(id);
let verificacao = null;
let regras = { ...REGRAS_PADRAO };
let codigos = [];

function ler(chave, padrao, area = localStorage) {
  try {
    const v = area.getItem(chave);
    return v ? JSON.parse(v) : padrao;
  } catch {
    return padrao;
  }
}

function gravar(chave, valor, area = localStorage) {
  try {
    area.setItem(chave, JSON.stringify(valor));
  } catch {
    /* storage unavailable: the board still works for this session */
  }
}

async function decifrarVerificacao(bloco, senha) {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", enc.encode(senha), "PBKDF2", false, ["deriveKey"]);
  const chave = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: deBase64(bloco.salt), iterations: bloco.iteracoes, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const claro = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deBase64(bloco.iv) }, chave, deBase64(bloco.dados));
  return JSON.parse(new TextDecoder().decode(claro));
}

/* ---------- Unlock ---------- */

$("form-senha").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const msg = $("senha-msg");
  msg.textContent = "Conferindo...";
  let bloco;
  try {
    const r = await fetch("verificacao.json", { cache: "no-store" });
    if (!r.ok) throw new Error();
    bloco = await r.json();
  } catch {
    msg.textContent = "Arquivo verificacao.json não encontrado. Gerem com o build e a frase-senha.";
    return;
  }
  try {
    verificacao = await decifrarVerificacao(bloco, $("campo-senha").value);
  } catch {
    msg.textContent = "Frase-senha incorreta. Confiram maiúsculas, acentos e hífens.";
    return;
  }
  gravar(CHAVE_SESSAO, verificacao, sessionStorage);
  abrirPlacar();
});

$("btn-bloquear").addEventListener("click", () => {
  try {
    sessionStorage.removeItem(CHAVE_SESSAO);
  } catch {
    /* nothing stored */
  }
  location.reload();
});

function abrirPlacar() {
  $("tela-senha").hidden = true;
  $("tela-placar").hidden = false;
  $("btn-bloquear").hidden = false;
  regras = { ...REGRAS_PADRAO, ...ler(CHAVE_REGRAS, {}) };
  codigos = ler(CHAVE_CODIGOS, []);
  desenharRegras();
  recalcular();
}

/* ---------- Rules ---------- */

const ROTULOS = {
  porFechadura: "Pontos por fechadura",
  dica: "Desconto por dica",
  erro: "Desconto por erro",
  piso: "Mínimo por fechadura",
  bonusFinal: "Bônus por concluir",
  intervalo: "Bônus por 10 pts de intervalo",
};

function desenharRegras() {
  const host = $("regras");
  host.replaceChildren();
  for (const [k, rotulo] of Object.entries(ROTULOS)) {
    const id = `regra-${k}`;
    const wrap = document.createElement("div");
    wrap.innerHTML = `<label class="ws-label" for="${id}">${escaparHtml(rotulo)}</label><input class="field field-mono" id="${id}" type="number" min="0" max="1000" value="${Number(regras[k])}">`;
    wrap.querySelector("input").addEventListener("input", (e) => {
      regras[k] = Math.max(0, Number(e.target.value) || 0);
      gravar(CHAVE_REGRAS, regras);
      recalcular();
    });
    host.append(wrap);
  }
  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "btn btn-ghost btn-sm";
  reset.textContent = "Restaurar padrão";
  reset.addEventListener("click", () => {
    regras = { ...REGRAS_PADRAO };
    gravar(CHAVE_REGRAS, regras);
    desenharRegras();
    recalcular();
  });
  host.append(reset);
}

/* ---------- Codes ---------- */

$("btn-adicionar").addEventListener("click", async () => {
  const bruto = $("campo-codigos").value.replace(/\s+/g, "");
  const partes = bruto.split("WQ2.").filter(Boolean).map((p) => `WQ2.${p}`);
  const msg = $("codigos-msg");
  if (!partes.length) {
    msg.textContent = "Nenhum código encontrado no texto colado.";
    return;
  }
  let novos = 0;
  let ruins = 0;
  for (const c of partes) {
    const lido = await lerCodigo(c);
    if (!lido.dados) {
      ruins += 1;
      continue;
    }
    codigos.push(c);
    novos += 1;
  }
  codigos = [...new Set(codigos)];
  gravar(CHAVE_CODIGOS, codigos);
  $("campo-codigos").value = "";
  msg.textContent = `${novos} código(s) adicionados${ruins ? `, ${ruins} ilegível(is)` : ""}.`;
  recalcular();
});

let confirmarLimpeza = false;
$("btn-limpar").addEventListener("click", (ev) => {
  if (!confirmarLimpeza) {
    confirmarLimpeza = true;
    ev.currentTarget.lastChild.textContent = "Clique de novo para apagar";
    setTimeout(() => {
      confirmarLimpeza = false;
      ev.target.closest("button").lastChild.textContent = "Limpar placar";
    }, 4000);
    return;
  }
  codigos = [];
  gravar(CHAVE_CODIGOS, codigos);
  recalcular();
});

$("btn-imprimir").addEventListener("click", () => window.print());

/* ---------- Evaluation ---------- */

async function avaliar(codigo) {
  const lido = await lerCodigo(codigo);
  const d = lido.dados;
  const alertas = [];
  if (!lido.seloOk) alertas.push({ tipo: "bad", texto: "Selo violado: o código foi editado" });

  let conferidas = 0;
  const marcas = [];
  for (let i = 0; i < TOTAL; i++) {
    const h = d.h?.[i];
    if (!h) {
      marcas.push("vazia");
      continue;
    }
    const esperado = await hashResposta(d.t, d.s, i, verificacao.respostas[i]);
    if (h === esperado && conferidas === i) {
      conferidas += 1;
      marcas.push("ok");
    } else {
      marcas.push("falsa");
    }
  }
  if (marcas.includes("falsa")) alertas.push({ tipo: "bad", texto: "Resposta que não confere" });

  const abertas = (d.a || []).slice(0, conferidas);
  for (let i = 0; i < abertas.length; i++) {
    const anterior = i ? abertas[i - 1] : 0;
    if (typeof abertas[i] !== "number" || abertas[i] < anterior) {
      alertas.push({ tipo: "warn", texto: "Horários fora de ordem" });
      break;
    }
    if (abertas[i] - anterior < MINIMO_POR_FECHADURA * 1000) {
      alertas.push({ tipo: "warn", texto: `Fechadura ${i} aberta rápido demais` });
      break;
    }
  }
  const concluida = conferidas === TOTAL;
  if (concluida && !d.c) alertas.push({ tipo: "warn", texto: "Todas abertas, sem horário de conclusão" });

  const erros = (d.e || []).slice(0, conferidas).reduce((a, b) => a + (b || 0), 0);
  const dicas = (d.d || []).slice(0, conferidas).reduce((a, b) => a + (b || 0), 0);
  let pontos = 0;
  for (let i = 0; i < conferidas; i++) {
    const p = regras.porFechadura - regras.dica * (d.d?.[i] || 0) - regras.erro * (d.e?.[i] || 0);
    pontos += Math.max(regras.piso, p);
  }
  const jogos = Object.values(d.m || {}).map((v) => Math.max(0, Math.min(100, Number(v) || 0)));
  const bonusJogos = jogos.reduce((a, v) => a + Math.floor(v / 10) * (regras.intervalo / 10), 0);
  if (concluida) pontos += regras.bonusFinal;
  pontos += bonusJogos;

  const fim = d.c || (abertas.length ? d.s + abertas[abertas.length - 1] : d.s);
  return {
    codigo,
    team: d.t,
    inicio: d.s,
    conferidas,
    marcas,
    pontos: Math.round(pontos),
    segundos: Math.max(0, Math.round((fim - d.s) / 1000)),
    erros,
    dicas,
    jogos: jogos.length,
    alertas,
    concluida,
  };
}

let ultimos = [];

async function recalcular() {
  const avaliados = [];
  for (const c of codigos) {
    try {
      avaliados.push(await avaliar(c));
    } catch {
      /* unreadable code: skipped */
    }
  }
  // Same pair (names + start): keep the most advanced code.
  const porDupla = new Map();
  for (const a of avaliados) {
    const chave = `${a.team.join("|").toLowerCase()}|${a.inicio}`;
    const atual = porDupla.get(chave);
    if (!atual || a.conferidas > atual.conferidas || (a.conferidas === atual.conferidas && a.segundos > atual.segundos)) porDupla.set(chave, a);
  }
  const lista = [...porDupla.values()];
  // Same start time under different names: likely a copied code.
  const porInicio = new Map();
  for (const a of lista) porInicio.set(a.inicio, [...(porInicio.get(a.inicio) || []), a]);
  for (const grupo of porInicio.values()) {
    if (grupo.length > 1) grupo.forEach((a) => a.alertas.push({ tipo: "bad", texto: "Mesmo início que outra dupla: código copiado?" }));
  }
  lista.sort((a, b) => b.pontos - a.pontos || b.conferidas - a.conferidas || a.segundos - b.segundos);
  ultimos = lista;
  desenharRanking(lista);
}

function tempo(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function desenharRanking(lista) {
  const corpo = $("ranking-corpo");
  if (!lista.length) {
    corpo.innerHTML = '<tr><td colspan="9" class="muted">Nenhum código ainda.</td></tr>';
    return;
  }
  corpo.innerHTML = lista
    .map((a, i) => {
      const trilha = a.marcas
        .map((m, k) => `<span class="dot dot-${m}" title="Fechadura ${k}: ${m === "ok" ? "conferida" : m === "falsa" ? "não confere" : "não aberta"}"></span>`)
        .join("");
      const ruim = a.alertas.some((x) => x.tipo === "bad");
      const situacao = a.alertas.length
        ? a.alertas.map((x) => `<span class="chip chip-${x.tipo}">${x.tipo === "bad" ? "[FAIL]" : "[ALERTA]"} ${escaparHtml(x.texto)}</span>`).join(" ")
        : `<span class="chip chip-ok">[OK] ${a.concluida ? "Concluída" : "Em andamento"}</span>`;
      return `<tr class="${ruim ? "row-bad" : ""}">
        <td class="rank">${i + 1}</td>
        <td><strong>${escaparHtml(a.team.join(" e "))}</strong></td>
        <td><span class="trail-dots" aria-label="${a.conferidas} de ${TOTAL} conferidas">${trilha}</span> <span class="small">${a.conferidas}/${TOTAL}</span></td>
        <td class="num">${a.pontos}</td>
        <td class="num">${tempo(a.segundos)}</td>
        <td class="num">${a.erros}</td>
        <td class="num">${a.dicas}</td>
        <td class="num">${a.jogos}/3</td>
        <td>${situacao}</td>
      </tr>`;
    })
    .join("");
}

$("btn-csv").addEventListener("click", () => {
  const linhas = [["posicao", "dupla", "conferidas", "pontos", "tempo_s", "erros", "dicas", "intervalos", "alertas"]];
  ultimos.forEach((a, i) => linhas.push([i + 1, a.team.join(" e "), a.conferidas, a.pontos, a.segundos, a.erros, a.dicas, a.jogos, a.alertas.map((x) => x.texto).join("; ")]));
  // UTF-8 with BOM: required by Excel to read accents in CSV (runtime encoding exception).
  const csv = "﻿" + linhas.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "placar-estudio-oito.csv";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

/* ---------- Boot ---------- */

verificacao = ler(CHAVE_SESSAO, null, sessionStorage);
if (verificacao?.respostas) abrirPlacar();
else $("campo-senha").focus();
