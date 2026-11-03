/**
 * OBJECTIVE: WebCrypto cryptographic engine for Quest (AES-256-GCM + PBKDF2 + HMAC-SHA-256).
 * USAGE: import { normalizar, decifrarBloco, calcularHmac, verificarHmac } from './crypto.js';
 * SECURITY: Matches scripts/build/build_etapas.mjs with 150,000 PBKDF2 iterations.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ITERATIONS_DEFAULT = 150000;

export function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function deBase64(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function paraBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binaryString = "";
  for (let i = 0; i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }
  return btoa(binaryString);
}

export function paraBase64Url(buffer) {
  return paraBase64(buffer)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function deBase64Url(base64Url) {
  let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return deBase64(base64);
}

export async function decifrarBloco(bloco, senha, iteracoes = ITERATIONS_DEFAULT) {
  if (!bloco || !bloco.salt || !bloco.iv || !bloco.dados) {
    return null;
  }

  const senhaLimpa = normalizar(senha);

  try {
    const baseKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(senhaLimpa),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    const aesKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: deBase64(bloco.salt),
        iterations: iteracoes,
        hash: "SHA-256",
      },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    const claro = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: deBase64(bloco.iv) },
      aesKey,
      deBase64(bloco.dados)
    );

    return JSON.parse(decoder.decode(claro));
  } catch (erro) {
    // Return null when key does not decrypt payload
    return null;
  }
}

export async function sha256Hex(texto) {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(texto));
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function calcularHmac(texto, segredo) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(texto));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verificarHmac(texto, hmacHex, segredo) {
  const esperado = await calcularHmac(texto, segredo);
  return esperado === hmacHex;
}
