// Estado compartilhado entre processos de hook (cada hook é um processo node novo) e o CLI.
// Fica em docs/licoes/.estado/ (ignorado pelo git). Toda leitura-escrita passa pela trava, e as
// escritas de lição também (licoes.mjs), para dois agentes nunca pegarem o mesmo Lnnn.
// O estado guarda só o que não está nas lições: ocorrências, contagem de assinaturas, sessões.
import { mkdirSync, readFileSync, writeFileSync, renameSync, openSync, closeSync, writeSync, unlinkSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { dormir } from './util.mjs';

const dirEstado = (dir) => join(dir, '.estado');
const MAX_OCORRENCIAS = 200;     // fora as pendentes, que ficam até serem resolvidas
const MAX_ASSINATURAS = 2000;
const SESSAO_VELHA_MS = 7 * 24 * 3600 * 1000;

export function garantirPastas(dir) {
  const de = dirEstado(dir);
  mkdirSync(de, { recursive: true });
  const gi = join(de, '.gitignore');
  if (!existsSync(gi)) writeFileSync(gi, '*\n');
  return de;
}

// Trava copiada do gerador-diario-projeto (lá está a justificativa de cada passo): arquivo exclusivo
// com dono (pid + nonce); velha só acima de max(travaVelhaMs, 10 s); quebra por rename; solta só se é nossa.
const OCUPADA = new Set(['EEXIST', 'EPERM', 'EACCES', 'EBUSY']);

export function comTrava(dir, cfg, fn) {
  const trava = join(garantirPastas(dir), 'trava');
  const velha = Math.max(cfg.travaVelhaMs ?? 10000, 10000);
  const limite = Date.now() + (cfg.travaEsperaMs ?? 5000);
  const dono = `${process.pid}:${randomBytes(6).toString('hex')}`;
  for (let espera = 5; ; espera = Math.min(espera * 2, 100)) {
    try { const fd = openSync(trava, 'wx'); try { writeSync(fd, dono); } finally { closeSync(fd); } break; } catch (e) {
      if (!OCUPADA.has(e.code)) throw e;
      try {
        if (Date.now() - statSync(trava).mtimeMs > velha) {
          const lixo = `${trava}.${dono.replace(':', '_')}`;
          renameSync(trava, lixo);
          if (Date.now() - statSync(lixo).mtimeMs > velha) unlinkSync(lixo);
          else if (!existsSync(trava)) renameSync(lixo, trava);
          else unlinkSync(lixo);
          continue;
        }
      } catch { /* trava sumiu ou está sendo apagada: espera e tenta de novo */ }
      if (Date.now() > limite) throw new Error('trava das lições ocupada: ' + trava);
      dormir(espera);
    }
  }
  try { return fn(); } finally {
    for (let i = 0; ; i++) {
      try { if (readFileSync(trava, 'utf8') === dono) unlinkSync(trava); break; } catch (e) {
        if (e.code === 'ENOENT') break;
        if (i >= 20) { registrarErro(dir, new Error(`trava não solta (${e.code}): ${trava}`)); break; }
        dormir(10);
      }
    }
  }
}

export const estadoVazio = () => ({ versao: 1, ultimaO: 0, ocorrencias: {}, assinaturas: {}, sessoes: {} });

export function lerEstado(dir) {
  try {
    const e = JSON.parse(readFileSync(join(dirEstado(dir), 'estado.json'), 'utf8'));
    if (e && typeof e === 'object' && Number.isInteger(e.ultimaO) && e.ocorrencias && e.assinaturas && e.sessoes) return e;
  } catch { /* ausente ou corrompido: recomeça (as lições, que são o que importa, estão nos .md) */ }
  return estadoVazio();
}

export function gravarEstado(dir, estado) {
  podar(estado);
  const alvo = join(garantirPastas(dir), 'estado.json');
  const tmp = alvo + '.' + process.pid + '.tmp';
  writeFileSync(tmp, JSON.stringify(estado, null, 1));
  renomear(tmp, alvo);
}

// Windows: rename sobre arquivo aberto por antivírus/editor falha de passagem (EPERM/EBUSY).
export function renomear(de, para) {
  for (let i = 0; ; i++) {
    try { renameSync(de, para); return; } catch (e) {
      if (i >= 20 || !OCUPADA.has(e.code)) throw e;
      dormir(15);
    }
  }
}

export function comEstado(dir, cfg, fn) {
  return comTrava(dir, cfg, () => {
    const estado = lerEstado(dir);
    const r = fn(estado);
    gravarEstado(dir, estado);
    return r;
  });
}

export function sessao(estado, sid) {
  const s = estado.sessoes[sid] || (estado.sessoes[sid] = { abertas: [], avisadas: [], injetadas: [], cobradas: [], turno: 0, cobrouTurno: -1 });
  s.visto = Date.now();
  return s;
}

export function novaOcorrencia(estado, dados) {
  const id = 'O' + ++estado.ultimaO;
  estado.ocorrencias[id] = { id, quando: Date.now(), ...dados };
  return estado.ocorrencias[id];
}

export const pendentes = (estado, sid) => Object.values(estado.ocorrencias).filter((o) => o.pendente && (!sid || o.sid === sid));

function podar(estado) {
  const ocs = Object.values(estado.ocorrencias).sort((a, b) => b.quando - a.quando);
  let mantidas = 0;
  for (const o of ocs) {
    if (o.pendente) continue;
    if (++mantidas > MAX_OCORRENCIAS) delete estado.ocorrencias[o.id];
  }
  const ass = Object.entries(estado.assinaturas);
  if (ass.length > MAX_ASSINATURAS) {
    ass.sort((a, b) => (b[1].ultima || 0) - (a[1].ultima || 0));
    for (const [h] of ass.slice(MAX_ASSINATURAS)) delete estado.assinaturas[h];
  }
  const corte = Date.now() - SESSAO_VELHA_MS;
  for (const [sid, s] of Object.entries(estado.sessoes)) if ((s.visto || 0) < corte) delete estado.sessoes[sid];
}

export function registrarErro(dir, err) {
  try {
    const de = garantirPastas(dir);
    writeFileSync(join(de, 'erros.log'), `${new Date().toISOString()} ${err && err.stack ? err.stack : err}\n`, { flag: 'a' });
  } catch { /* último recurso: silêncio, hook nunca quebra a sessão */ }
}
