// Onde ficam as lições e de quem é a pasta.
//
// Raiz: LICOES_RAIZ > primeiro ancestral do cwd (até a raiz git, inclusive) com docs/licoes/ >
// primeiro ancestral com docs/diario/ (o projeto que já tem diário) > CLAUDE_PROJECT_DIR, se contém
// o cwd > o próprio cwd. Nunca a raiz git por padrão: em monorepo cada projeto aprende o seu. O cwd do
// hook segue o `cd` do shell; sem CLAUDE_PROJECT_DIR, `cd server/api` criava a pasta lá.
//
// Posse (docs/DECISOES.md, D1): a pasta é do plugin só se o README.md dela trouxer MARCADOR nas
// primeiras linhas. Pasta com conteúdo e sem a afirmação é do projeto: modo desligado.
import { existsSync, readdirSync, statSync, openSync, readSync, closeSync, realpathSync } from 'node:fs';
import { join, dirname, resolve, relative, isAbsolute, basename, sep } from 'node:path';
import { PASTA_LICOES, MARCADOR, LINHAS_MARCADOR, carregarConfig } from './config.mjs';

const ehPasta = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };
const conteudo = (p) => { try { return readdirSync(p).filter((n) => n !== '.estado'); } catch { return []; } };

export function temMarcador(arquivo) {
  let fd;
  try {
    fd = openSync(arquivo, 'r');
    const buf = Buffer.alloc(2048);
    const n = readSync(fd, buf, 0, buf.length, 0);
    return buf.toString('utf8', 0, n).split('\n').slice(0, LINHAS_MARCADOR).some((l) => l.includes(MARCADOR));
  } catch { return false; } finally { if (fd !== undefined) closeSync(fd); }
}

// 'nova' (não existe ou vazia), 'propria' ou 'projeto'.
export function situacaoPasta(dir) {
  if (!ehPasta(dir) || !conteudo(dir).length) return { situacao: 'nova' };
  if (!temMarcador(join(dir, 'README.md'))) {
    return { situacao: 'projeto', motivo: `${dir} já existe sem "${MARCADOR}" no README.md: lições governadas pelo projeto` };
  }
  return { situacao: 'propria' };
}

export function resolver(cwd = process.cwd(), env = process.env) {
  let raiz = null;
  if (env.LICOES_RAIZ) raiz = resolve(env.LICOES_RAIZ);
  else {
    let comDiario = null;
    for (let d = resolve(cwd); ; d = dirname(d)) {
      if (ehPasta(join(d, PASTA_LICOES))) { raiz = d; break; }
      if (!comDiario && ehPasta(join(d, 'docs', 'diario'))) comDiario = d;
      if (existsSync(join(d, '.git')) || dirname(d) === d) break;
    }
    const projeto = env.CLAUDE_PROJECT_DIR && dentro(env.CLAUDE_PROJECT_DIR, cwd) ? resolve(env.CLAUDE_PROJECT_DIR) : null;
    raiz = raiz || comDiario || projeto || resolve(cwd);
  }
  const dir = join(raiz, PASTA_LICOES);
  const config = carregarConfig(raiz);
  const s = situacaoPasta(dir);
  if (s.situacao === 'projeto') return { raiz, dir, config, modo: 'desligado', ...s };
  const modo = config.modo === 'desligado' ? 'desligado' : 'proprio';
  return { raiz, dir, config, modo, situacao: s.situacao, motivo: modo === 'desligado' ? 'config.json: modo "desligado"' : '' };
}

// ---- Caminhos -------------------------------------------------------------------------------
// Canônico: no Windows o cwd pode vir em nome curto 8.3 (C:\Users\MARCOS~1) e o file_path da
// ferramenta em nome longo; realpathSync.native expande. Caminho inexistente: canoniza o ancestral
// mais próximo que existe e reanexa o resto.
export function canon(p) {
  let resto = '';
  for (let a = String(p); ; ) {
    try { return join(realpathSync.native(a), resto); } catch { /* sobe um nível */ }
    const pai = dirname(a);
    if (pai === a) return p;
    resto = join(basename(a), resto); a = pai;
  }
}
const norm = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
export function dentro(raiz, p) {
  if (!p) return false;
  const r = relative(norm(canon(raiz)), norm(canon(p)));
  return r !== '..' && !r.startsWith('..' + sep) && !isAbsolute(r);
}
// Caminho como as lições o mostram e o `entrada` casa: relativo à raiz, com "/".
export const mostrarCaminho = (raiz, p) => (dentro(raiz, resolve(raiz, p)) ? relative(canon(raiz), canon(resolve(raiz, p))) : String(p)).split('\\').join('/');
