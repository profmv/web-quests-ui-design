/**
 * OBJECTIVE: Compile and encrypt the quest locks (quest/etapas.source.mjs -> quest/etapas.json), hash the
 *            predictable mistakes, write the teacher verification file and an encrypted backup of the source.
 * USAGE:
 *   node scripts/build/build_etapas.mjs --placar-senha "<teacher passphrase>"
 *   node scripts/build/build_etapas.mjs --restaurar --placar-senha "<teacher passphrase>"
 *   (the passphrase may also come from the PLACAR_SENHA environment variable)
 * PARAMETERS:
 *   --source <path>      Plain source (default quest/etapas.source.mjs, gitignored)
 *   --out <path>         Encrypted locks (default quest/etapas.json)
 *   --placar-senha <s>   Teacher passphrase: encrypts quest/placar/verificacao.json and
 *                        scripts/build/etapas.source.enc.json. Without it both files are left untouched.
 *   --restaurar          Decrypt scripts/build/etapas.source.enc.json back into the source path and exit.
 * OUTPUTS: quest/etapas.json, quest/placar/verificacao.json, scripts/build/etapas.source.enc.json.
 * NOTES: normalizar() must stay identical to quest/assets/js/crypto.js. Build fails (exit 1) when a briefing
 *        exceeds 120 words or a predictable mistake equals the real answer.
 */

import { webcrypto } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const crypto = webcrypto;
const ITERACOES_ETAPAS = 150000;
const ITERACOES_PLACAR = 600000;
const LIMITE_PALAVRAS = 120;
const BACKUP = "scripts/build/etapas.source.enc.json";
const VERIFICACAO = "quest/placar/verificacao.json";

// Must match quest/assets/js/crypto.js normalizar().
export function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/px/g, "")
    .replace(/[^a-z0-9]/g, "");
}

const b64 = (buf) => Buffer.from(buf).toString("base64");

async function sha256Hex(texto) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Buffer.from(h).toString("hex");
}

async function cifrar(texto, senha, iteracoes) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const base = await crypto.subtle.importKey("raw", enc.encode(senha), "PBKDF2", false, ["deriveKey"]);
  const chave = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: iteracoes, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const dados = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, chave, enc.encode(texto));
  return { salt: b64(salt), iv: b64(iv), dados: b64(dados) };
}

async function decifrar(bloco, senha, iteracoes) {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", enc.encode(senha), "PBKDF2", false, ["deriveKey"]);
  const chave = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: Buffer.from(bloco.salt, "base64"), iterations: iteracoes, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const claro = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(bloco.iv, "base64") }, chave, Buffer.from(bloco.dados, "base64"));
  return new TextDecoder().decode(claro);
}

function contarPalavras(conteudo) {
  const texto = [conteudo.briefing || "", ...(conteudo.tarefa || [])].join(" ").replace(/\{\{\w+\}\}/g, "x");
  return texto.split(/\s+/).filter(Boolean).length;
}

function resolverTermos(conteudo) {
  // Replace {{chave}} with {{chave|termo}} so the client can render balloons without the source glossary.
  const mapa = Object.fromEntries((conteudo.conceitos || []).map((c) => [c.chave, c]));
  conteudo.briefing = String(conteudo.briefing || "").replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!mapa[k]) throw new Error(`[FAIL] Lock ${conteudo.numero}: glossary key "${k}" missing from conceitos.`);
    return `{{${k}}}`;
  });
}

export async function compilarEtapas(sourcePath, outPath, senhaPlacar) {
  const fonte = path.resolve(sourcePath);
  try {
    await fs.access(fonte);
  } catch {
    throw new Error(
      `[FAIL] Source not found: ${fonte}\n` +
      "  It is not versioned. Restore it from the encrypted backup with:\n" +
      '  node scripts/build/build_etapas.mjs --restaurar --placar-senha "<teacher passphrase>"'
    );
  }

  const { etapas, configuracao } = await import(`${pathToFileURL(fonte).href}?t=${Date.now()}`);
  const saida = [];
  const respostas = [];
  let senhaAtual = "";

  for (let i = 0; i < etapas.length; i++) {
    const etapa = etapas[i];
    const conteudo = structuredClone(etapa.conteudo);

    if (conteudo.tipo !== "final") {
      const palavras = contarPalavras(conteudo);
      if (palavras > LIMITE_PALAVRAS) {
        throw new Error(`[FAIL] Lock ${i}: briefing + tasks have ${palavras} words (limit ${LIMITE_PALAVRAS}).`);
      }
      resolverTermos(conteudo);

      const correta = normalizar(etapa.resposta);
      const sal = b64(crypto.getRandomValues(new Uint8Array(12)));
      const vistos = new Set();
      const armadilhas = [];
      for (const a of conteudo.armadilhas || []) {
        for (const r of a.respostas) {
          const n = normalizar(r);
          if (n === correta) throw new Error(`[FAIL] Lock ${i}: predictable mistake "${r}" equals the answer.`);
          if (vistos.has(n)) continue;
          vistos.add(n);
          armadilhas.push({ h: await sha256Hex(`${sal}|${n}`), msg: a.msg });
        }
      }
      conteudo.sal = sal;
      conteudo.armadilhas = armadilhas;
      respostas.push(correta);
    }

    const bloco = await cifrar(JSON.stringify(conteudo), normalizar(senhaAtual), ITERACOES_ETAPAS);
    saida.push({ indice: i, id: etapa.id, titulo: etapa.titulo, conceito: etapa.conceito, ...bloco });
    senhaAtual = etapa.resposta ?? "";
  }

  const json = {
    versao: configuracao?.versao || 1,
    iteracoes: ITERACOES_ETAPAS,
    totalFechaduras: respostas.length,
    etapas: saida,
  };
  await fs.writeFile(path.resolve(outPath), JSON.stringify(json, null, 2) + "\n", "utf-8");
  console.log(`[OK] Encrypted ${saida.length} stages (${respostas.length} locks) into ${outPath}`);

  if (!senhaPlacar) {
    console.log("[PENDING] No teacher passphrase: verificacao.json and the encrypted source backup were not updated.");
    return;
  }

  const verificacao = {
    versao: json.versao,
    titulos: etapas.filter((e) => e.resposta !== null).map((e) => e.titulo),
    respostas,
  };
  await fs.writeFile(
    path.resolve(VERIFICACAO),
    JSON.stringify({ iteracoes: ITERACOES_PLACAR, ...(await cifrar(JSON.stringify(verificacao), senhaPlacar, ITERACOES_PLACAR)) }, null, 2) + "\n",
    "utf-8"
  );
  console.log(`[OK] Teacher verification file written: ${VERIFICACAO}`);

  const textoFonte = await fs.readFile(fonte, "utf-8");
  await fs.writeFile(
    path.resolve(BACKUP),
    JSON.stringify({ iteracoes: ITERACOES_PLACAR, ...(await cifrar(textoFonte, senhaPlacar, ITERACOES_PLACAR)) }, null, 2) + "\n",
    "utf-8"
  );
  console.log(`[OK] Encrypted source backup written: ${BACKUP}`);
}

async function restaurar(sourcePath, senha) {
  if (!senha) throw new Error("[FAIL] --restaurar needs --placar-senha (or PLACAR_SENHA).");
  const bloco = JSON.parse(await fs.readFile(path.resolve(BACKUP), "utf-8"));
  let texto;
  try {
    texto = await decifrar(bloco, senha, bloco.iteracoes);
  } catch {
    throw new Error("[FAIL] Wrong passphrase or damaged backup.");
  }
  await fs.writeFile(path.resolve(sourcePath), texto, "utf-8");
  console.log(`[OK] Source restored to ${sourcePath}`);
}

if (process.argv[1] && process.argv[1].endsWith("build_etapas.mjs")) {
  const args = process.argv.slice(2);
  let src = "quest/etapas.source.mjs";
  let dest = "quest/etapas.json";
  let senha = process.env.PLACAR_SENHA || "";
  let modoRestaurar = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--source" && args[i + 1]) src = args[++i];
    else if (args[i] === "--out" && args[i + 1]) dest = args[++i];
    else if (args[i] === "--placar-senha" && args[i + 1]) senha = args[++i];
    else if (args[i] === "--restaurar") modoRestaurar = true;
  }
  try {
    if (modoRestaurar) await restaurar(src, senha);
    else await compilarEtapas(src, dest, senha);
  } catch (erro) {
    console.error(erro.message);
    process.exitCode = 1;
  }
}
