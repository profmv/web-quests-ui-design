/**
 * OBJECTIVE: Compiles and encrypts Quest stage files (etapas.mjs -> etapas.json) using AES-256-GCM + PBKDF2.
 * USAGE: node scripts/build/build_etapas.mjs [--source quest/etapas.source.mjs] [--out quest/etapas.json]
 * PARAMETERS:
 *   --source: Path to raw stage definitions (default: quest/etapas.source.mjs)
 *   --out: Path to encrypted output JSON (default: quest/etapas.json)
 * OUTPUTS: Encrypted etapas.json file and hash verification table.
 */

import { webcrypto } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const crypto = webcrypto;
const ITERATIONS = 150000;

function normalizar(texto) {
  return String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

function paraBase64(buffer) {
  return Buffer.from(buffer).toString("base64");
}

async function cifrarTexto(texto, senha) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(senha),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const dadosCifrados = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encoder.encode(texto)
  );

  return {
    salt: paraBase64(salt),
    iv: paraBase64(iv),
    dados: paraBase64(dadosCifrados),
  };
}

export async function compilarEtapas(sourcePath, outPath) {
  const absoluteSource = path.resolve(sourcePath);
  const absoluteOut = path.resolve(outPath);

  try {
    await fs.access(absoluteSource);
  } catch {
    // The answer source is gitignored (public repository) and lives only on the teacher's machine.
    throw new Error(
      `[FAIL] Source not found: ${absoluteSource}\n` +
      "  It is not versioned. Restore the last committed copy with (bash or PowerShell, keeps UTF-8):\n" +
      '  git restore --source="$(git log --diff-filter=D -1 --format=%h -- quest/etapas.source.mjs)~1" --worktree -- quest/etapas.source.mjs'
    );
  }

  const moduleUrl = new URL(`file:///${absoluteSource.replace(/\\/g, "/")}`).href;
  const { etapas, configuracao } = await import(moduleUrl);

  const etapasCifradas = [];
  let senhaAtual = ""; // Lock 0 uses empty password

  for (let i = 0; i < etapas.length; i++) {
    const etapa = etapas[i];
    const payload = JSON.stringify(etapa.conteudo);
    const blocoCifrado = await cifrarTexto(payload, normalizar(senhaAtual));

    etapasCifradas.push({
      indice: i,
      id: etapa.id,
      titulo: etapa.titulo,
      conceito: etapa.conceito,
      ...blocoCifrado,
    });

    // Next lock's password is this lock's answer
    senhaAtual = etapa.resposta;
  }

  const outputData = {
    versao: configuracao?.versao || 1,
    iteracoes: ITERATIONS,
    totalFechaduras: etapas.length,
    etapas: etapasCifradas,
  };

  await fs.mkdir(path.dirname(absoluteOut), { recursive: true });
  await fs.writeFile(absoluteOut, JSON.stringify(outputData, null, 2), "utf-8");
  console.log(`[OK] Encrypted ${etapas.length} stages into: ${absoluteOut}`);
}

// CLI execution check
if (process.argv[1] && process.argv[1].endsWith("build_etapas.mjs")) {
  const args = process.argv.slice(2);
  let src = "quest/etapas.source.mjs";
  let dest = "quest/etapas.json";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--source" && args[i + 1]) src = args[i + 1];
    if (args[i] === "--out" && args[i + 1]) dest = args[i + 1];
  }

  try {
    await compilarEtapas(src, dest);
  } catch (erro) {
    console.error(erro.message);
    process.exitCode = 1;
  }
}
