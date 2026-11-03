/**
 * OBJECTIVE: Progress code serializer, deserializer, and WebCrypto HMAC state management.
 * USAGE: import { gerarCodigoProgresso, decodificarCodigoProgresso, salvarEstadoLocal } from './progress.js';
 * SECURITY: Tamper detection via SHA-256 HMAC with secret pepper.
 */

import { calcularHmac, verificarHmac, paraBase64Url, deBase64Url } from "./crypto.js";

export const PEPPER_KEY = "web-quests-ui-design-2026-auth-token";
export const STORAGE_KEY = "web-quests-ui-design:state:v1";
export const CODE_PREFIX = "WQ-UI26-";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function criarEstadoInicial(nome1, nome2) {
  const agora = Date.now();
  return {
    v: 1,
    team: [String(nome1 || "").trim(), String(nome2 || "").trim()],
    startedAt: agora,
    currentLock: 0,
    unlockedLocks: [0],
    hintsUsed: 0,
    errorCount: 0,
    completedAt: null,
    answers: [],
    lockTimes: [agora],
    attemptsPerLock: [0, 0, 0, 0, 0, 0, 0, 0],
    hintsPerLock: [0, 0, 0, 0, 0, 0, 0, 0],
  };
}

export function salvarEstadoLocal(estado) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  } catch (e) {
    console.warn("[WARN] Could not persist state to localStorage", e);
  }
}

export function carregarEstadoLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function limparEstadoLocal() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    // ignore
  }
}

function montarDadosParaAssinatura(estado) {
  return JSON.stringify({
    v: estado.v || 1,
    team: estado.team || ["", ""],
    startedAt: estado.startedAt || 0,
    currentLock: estado.currentLock || 0,
    unlockedLocks: estado.unlockedLocks || [],
    hintsUsed: estado.hintsUsed || 0,
    errorCount: estado.errorCount || 0,
    completedAt: estado.completedAt || null,
    answers: estado.answers || [],
  });
}

export async function gerarCodigoProgresso(estado) {
  const dadosBase = montarDadosParaAssinatura(estado);
  const hmac = await calcularHmac(dadosBase, PEPPER_KEY);

  const payloadCompleto = {
    ...estado,
    hmac,
  };

  const jsonStr = JSON.stringify(payloadCompleto);
  const bytes = encoder.encode(jsonStr);
  const b64 = paraBase64Url(bytes);
  return `${CODE_PREFIX}${b64}`;
}

export async function decodificarCodigoProgresso(codigoTexto) {
  const limpo = String(codigoTexto || "").trim().replace(/\s+/g, "");

  if (!limpo.startsWith(CODE_PREFIX)) {
    return {
      valido: false,
      dados: null,
      erro: "Prefixo do código inválido. Certifique-se de copiar o código completo.",
    };
  }

  const b64 = limpo.slice(CODE_PREFIX.length);
  let payload;
  try {
    const bytes = deBase64Url(b64);
    const jsonStr = decoder.decode(bytes);
    payload = JSON.parse(jsonStr);
  } catch (e) {
    return {
      valido: false,
      dados: null,
      erro: "Código corrompido ou formato ilegível.",
    };
  }

  if (!payload || !payload.team || !payload.hmac) {
    return {
      valido: false,
      dados: payload,
      erro: "Estrutura do código incompleta.",
    };
  }

  // Verify HMAC authenticity
  const dadosBase = montarDadosParaAssinatura(payload);
  const hmacValido = await verificarHmac(dadosBase, payload.hmac, PEPPER_KEY);

  return {
    valido: hmacValido,
    dados: payload,
    erro: hmacValido ? null : "Selo de autenticidade violado ou código alterado manualmente.",
  };
}

export async function baixarArquivoProgresso(estado) {
  const codigo = await gerarCodigoProgresso(estado);
  const t1 = (estado.team[0] || "aluno1").replace(/[^a-zA-Z0-9]/g, "_");
  const t2 = (estado.team[1] || "aluno2").replace(/[^a-zA-Z0-9]/g, "_");
  const nomeArquivo = `progresso-equipe-${t1}-${t2}.txt`;

  const conteudo = [
    "============================================================",
    "  WEB QUESTS: UI DESIGN & FIGMA READY - PROGRESSO DA EQUIPE",
    "============================================================",
    `Equipe: ${estado.team.join(" & ")}`,
    `Início: ${new Date(estado.startedAt).toLocaleString("pt-BR")}`,
    `Etapa Atual: Fechadura ${estado.currentLock} de 8`,
    `Etapas Concluídas: ${estado.unlockedLocks.length - 1} / 8`,
    `Dicas Utilizadas: ${estado.hintsUsed}`,
    `Tentativas Incorretas: ${estado.errorCount}`,
    estado.completedAt ? `Concluído em: ${new Date(estado.completedAt).toLocaleString("pt-BR")}` : "Status: Em andamento",
    "------------------------------------------------------------",
    "CÓDIGO DE PROGRESSO OFICIAL (Cole no placar ou para restaurar):",
    codigo,
    "============================================================",
  ].join("\r\n");

  const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
