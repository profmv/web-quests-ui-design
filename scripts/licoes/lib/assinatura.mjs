// Identidade de um erro e casamento por regex. Funções puras.
//
// Assinatura = sha12(ferramenta | programa | linha informativa normalizada). Duas falhas do "mesmo
// erro" em sessões diferentes têm a mesma assinatura mesmo com caminhos, números e hashes diferentes.
import { sha12 } from './util.mjs';

export const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
export const chaveTexto = (s) => semAcento(s).toLowerCase();

// ---- Programa ------------------------------------------------------------------------------
// Primeiro programa "de verdade" do comando: pula cd/env/variáveis, tira caminho e extensão. Para
// multiplexadores (git, npm…) junta o subcomando: `git push` e `git commit` são erros diferentes.
const PULAR = new Set(['cd', 'pushd', 'popd', 'set', 'export', 'env', 'sudo', 'time', 'nohup', 'exec', 'call', '&', 'set-location', 'sl', 'chdir']);
const MULTI = new Set(['git', 'npm', 'pnpm', 'yarn', 'npx', 'bun', 'deno', 'docker', 'kubectl', 'cargo', 'go', 'dotnet', 'pip', 'pip3', 'uv', 'poetry', 'node', 'python', 'python3', 'py', 'gh', 'make', 'mvn', 'gradle', 'composer', 'claude', 'winget', 'choco', 'brew', 'apt', 'apt-get']);

function palavras(seg) {
  const out = [];
  for (const m of seg.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}
const base = (p) => String(p).split(/[\\/]/).pop().toLowerCase().replace(/\.(exe|cmd|bat|ps1|sh|mjs|cjs|js|py)$/, '');

export function programa(comando) {
  const segs = String(comando || '').split(/&&|\|\||[;\n|]/);
  for (const seg of segs) {
    const p = palavras(seg.trim());
    let i = 0;
    while (i < p.length && (PULAR.has(p[i].toLowerCase()) || /^[A-Za-z_][\w]*=/.test(p[i]) || /^\$env:/i.test(p[i]))) {
      // cd <dir>: pula também o argumento
      if (/^(cd|pushd|set-location|sl|chdir)$/i.test(p[i])) i++;
      i++;
      while (i < p.length && p[i].startsWith('-')) i++;   // sudo -n, set -e, env -i
    }
    if (i >= p.length) continue;
    const prog = base(p[i]);
    if (!prog) continue;
    if (!MULTI.has(prog)) return prog;
    // python -m pytest → "python pytest"; node script.mjs → "node script"; git -C x push → "git push"
    for (let j = i + 1; j < p.length; j++) {
      if (p[j] === '-m' && p[j + 1]) return `${prog} ${base(p[j + 1])}`;
      if (/^-[Ccf]$|^--prefix$|^--file$/.test(p[j])) { j++; continue; }
      if (p[j].startsWith('-')) continue;
      return `${prog} ${base(p[j])}`;
    }
    return prog;
  }
  return '';
}

// ---- Linha informativa e normalização ------------------------------------------------------
const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g;
const INFORMATIVA = /error|erro|exception|fatal|fail|falh|not found|nao encontrad|não encontrad|denied|negad|cannot|can't|could not|unable|invalid|inv[aá]lid|missing|no such|not recognized|n[aã]o [eé] reconhecid|unknown|unexpected|refused|timed? ?out|permission|undefined|traceback|panic/i;

export function linhaInformativa(erro) {
  const linhas = String(erro || '').replace(ANSI, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    .filter((l) => !/^exit code -?\d+$/i.test(l) && !/^(at |em )\S/.test(l));
  return linhas.find((l) => INFORMATIVA.test(l)) || linhas[0] || '';
}

export function normalizar(linha) {
  return String(linha || '')
    .replace(ANSI, '')
    .replace(/[A-Za-z]:[\\/][^\s'"`)]*/g, '<caminho>')
    .replace(/(^|[\s'"`(=])(~|\.{1,2})?\/[^\s'"`)]+/g, '$1<caminho>')
    .replace(/\b[\w.-]+(?:[\\/][\w.-]+)+\b/g, '<caminho>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<id>')
    .replace(/\b(?=[0-9a-f]*\d)[0-9a-f]{7,}\b/gi, '<hex>')
    .replace(/\d+(?:[.,:]\d+)*/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, 200);
}

export function assinatura({ ferramenta, comando, erro }) {
  const prog = /^(Bash|PowerShell)$/.test(ferramenta) ? programa(comando) : '';
  const linha = normalizar(linhaInformativa(erro));
  return { assinatura: sha12(`${ferramenta}|${prog}|${linha}`), programa: prog, linha };
}

// ---- Regex das lições (ferramenta, entrada, erro) ------------------------------------------
// Escritas por agente ou humano: têm de compilar, ser curtas e não casar texto vazio (casaria tudo).
const MAX_RE = 300;
const MAX_ALVO = 4000;

export function validarRegex(fonte) {
  if (fonte === undefined || fonte === null || fonte === '') return null;
  const s = String(fonte);
  if (s.length > MAX_RE) return `regex com ${s.length} caracteres (máximo ${MAX_RE})`;
  let re;
  try { re = new RegExp(s, 'i'); } catch (e) { return `regex inválida: ${e.message}`; }
  if (re.test('')) return 'regex casa texto vazio (casaria qualquer coisa)';
  return null;
}

const cacheRe = new Map();
function compilar(fonte, inteira = false) {
  const k = (inteira ? '1:' : '0:') + fonte;
  if (!cacheRe.has(k)) {
    let re = null;
    if (!validarRegex(fonte)) { try { re = new RegExp(inteira ? `^(?:${fonte})$` : fonte, 'i'); } catch { re = null; } }
    cacheRe.set(k, re);
  }
  return cacheRe.get(k);
}
// Regex vazia não restringe (true); regex inválida nunca casa (false): lição quebrada não dispara.
export function casa(fonte, alvo, { inteira = false } = {}) {
  if (!fonte) return true;
  const re = compilar(String(fonte), inteira);
  return !!re && re.test(String(alvo ?? '').slice(0, MAX_ALVO));
}
