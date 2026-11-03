// Usado pelo /gen-agentsmd: varre o projeto e lista sinais objetivos (manifestos, portões de CI,
// testes, governança já existente, censo de arquivos, fatos de git) para o agente decidir o
// tamanho (T1/T2/T3) e quais seções do AGENTS.md se aplicam. Só leitura, não decide nada sozinho.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { execSync } from 'node:child_process';
import { acharHandoffs, raizProjeto } from './lib.mjs';

const IGNORAR = new Set([
  'node_modules', '.git', '.venv', 'venv', 'env', '.env', 'dist', 'build', 'target', 'out',
  '__pycache__', '.next', '.nuxt', 'coverage', '.turbo', '.cache', 'vendor', '.pytest_cache',
  '.mypy_cache', '.tox', 'bin', 'obj',
]);

function git(cmd, cwd) {
  try { return execSync(`git ${cmd}`, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
}

function listar(dir) { try { return readdirSync(dir, { withFileTypes: true }); } catch { return []; } }

function presentes(base, nomes) { return nomes.filter((n) => existsSync(join(base, n))); }

function contarArquivosDentro(dir) {
  try { return readdirSync(dir).length; } catch { return 0; }
}

// Extensões que contam como linguagem de código (json/md/imagens não contam).
const CODIGO = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.rb', '.go', '.rs', '.java', '.kt', '.kts',
  '.scala', '.cs', '.fs', '.vb', '.c', '.h', '.cpp', '.hpp', '.cc', '.m', '.mm', '.swift', '.php', '.pl', '.lua', '.r',
  '.dart', '.ex', '.exs', '.erl', '.clj', '.hs', '.ml', '.sh', '.ps1', '.bat', '.cmd', '.sql', '.p', '.i', '.w', '.cls',
  '.html', '.vue', '.svelte', '.css', '.scss', '.sass', '.less', '.gd', '.zig', '.nim', '.jl']);

// Censo raso de arquivos por extensão, parando em ~6000 para não custar caro num repo gigante.
function censoArquivos(raiz) {
  const porExt = new Map();
  let total = 0;
  let truncado = false;
  const pilha = [raiz];
  while (pilha.length) {
    const dir = pilha.pop();
    for (const e of listar(dir)) {
      if (IGNORAR.has(e.name)) continue;
      if (e.name.startsWith('.') && !['.github', '.claude', '.agents'].includes(e.name)) continue;
      const caminho = join(dir, e.name);
      if (e.isDirectory()) { pilha.push(caminho); continue; }
      total++;
      const ext = extname(e.name).toLowerCase() || '(sem extensão)';
      porExt.set(ext, (porExt.get(ext) || 0) + 1);
      if (total >= 6000) { truncado = true; pilha.length = 0; break; }
    }
  }
  return { total, porExt, truncado };
}

function topExtensoes(porExt, n = 10) {
  return [...porExt.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
    .map(([ext, c]) => `${ext}: ${c}`).join(', ');
}

function scriptsDoPackageJson(caminho) {
  try {
    const pkg = JSON.parse(readFileSync(caminho, 'utf8'));
    const scripts = pkg.scripts && typeof pkg.scripts === 'object' ? Object.keys(pkg.scripts) : [];
    return { scripts, temWorkspaces: !!pkg.workspaces };
  } catch { return { scripts: [], temWorkspaces: false }; }
}

function principal() {
  const cwd = process.cwd();
  const raiz = raizProjeto(cwd); // sobe até o projeto, nunca até a raiz do git (num monorepo ela é de outro projeto)

  console.log(`--- RAIZ DO PROJETO ---\n${raiz}`);

  console.log('\n--- GOVERNANÇA JÁ EXISTENTE ---');
  const governanca = presentes(raiz, [
    'AGENTS.md', 'CLAUDE.md', '.cursorrules', '.github/copilot-instructions.md',
    'CONTRIBUTING.md', 'README.md', 'CHANGELOG.md', 'ROADMAP.md',
  ]);
  console.log(governanca.length ? governanca.join(', ') : '(nenhum arquivo de governança na raiz)');
  const agentsAninhados = [];
  for (const e of listar(raiz)) {
    if (e.isDirectory() && !IGNORAR.has(e.name) && !e.name.startsWith('.')) {
      if (existsSync(join(raiz, e.name, 'AGENTS.md'))) agentsAninhados.push(join(e.name, 'AGENTS.md'));
    }
  }
  if (agentsAninhados.length) console.log(`AGENTS.md aninhados (1 nível): ${agentsAninhados.join(', ')}`);

  console.log('\n--- MANIFESTOS DE DEPENDÊNCIA / BUILD ---');
  const manifestos = presentes(raiz, [
    'package.json', 'pyproject.toml', 'setup.py', 'setup.cfg', 'requirements.txt', 'tox.ini',
    'Cargo.toml', 'go.mod', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'Gemfile', 'composer.json',
    'Makefile', 'makefile', 'justfile', 'Taskfile.yml', 'docker-compose.yml', 'docker-compose.yaml',
    'Dockerfile', '.nvmrc', '.python-version', '.tool-versions', '.claude/launch.json',
  ]);
  console.log(manifestos.length ? manifestos.join(', ') : '(nenhum manifesto reconhecido)');

  let scriptsPkg = { scripts: [], temWorkspaces: false };
  if (manifestos.includes('package.json')) {
    scriptsPkg = scriptsDoPackageJson(join(raiz, 'package.json'));
    console.log(`package.json scripts: ${scriptsPkg.scripts.length ? scriptsPkg.scripts.join(', ') : '(nenhum)'}`);
    if (scriptsPkg.temWorkspaces) console.log('package.json declara "workspaces" (monorepo).');
  }
  const monorepo = scriptsPkg.temWorkspaces ||
    presentes(raiz, ['lerna.json', 'nx.json', 'pnpm-workspace.yaml', 'turbo.json']).length > 0;

  console.log('\n--- PORTÕES (CI / hooks / lint) ---');
  const ci = presentes(raiz, [
    '.github/workflows', '.gitlab-ci.yml', 'azure-pipelines.yml', '.pre-commit-config.yaml',
    '.husky',
  ]);
  const lint = presentes(raiz, [
    '.eslintrc', '.eslintrc.json', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.yml',
    '.editorconfig', '.prettierrc', '.prettierrc.json', 'biome.json', 'ruff.toml', '.flake8', 'mypy.ini',
    'tsconfig.json', 'rustfmt.toml', '.clippy.toml', '.vale.ini', '.markdownlint.json',
    '.markdownlint.yaml', 'cspell.json', '.cspell.json',
  ]);
  console.log(`CI/hooks: ${ci.length ? ci.join(', ') : '(nenhum)'}`);
  console.log(`Lint/format: ${lint.length ? lint.join(', ') : '(nenhum)'}`);

  console.log('\n--- TESTES ---');
  const pastasTeste = ['tests', 'test', 'spec', '__tests__'].filter((n) => existsSync(join(raiz, n)));
  if (pastasTeste.length) {
    for (const p of pastasTeste) console.log(`${p}/: ~${contarArquivosDentro(join(raiz, p))} entradas no topo`);
  } else {
    console.log('(nenhuma pasta de teste convencional na raiz)');
  }

  console.log('\n--- HANDOFF / MEMÓRIA DE SESSÃO JÁ EXISTENTE ---');
  const handoffs = acharHandoffs(raiz);
  console.log(handoffs.length ? `${handoffs.length} arquivo(s); mais recente: ${relative(raiz, handoffs[0].caminho)}` : '(nenhum handoff detectado)');

  console.log('\n--- CENSO DE ARQUIVOS (raso, ignora node_modules/.git/.venv/build/dist/...) ---');
  const censo = censoArquivos(raiz);
  console.log(`Total: ${censo.total}${censo.truncado ? ' (truncado em 6000)' : ''}`);
  console.log(`Top extensões: ${topExtensoes(censo.porExt)}`);

  console.log('\n--- FATOS DE GIT ---');
  const dentroDeGit = git('rev-parse --is-inside-work-tree', raiz);
  if (dentroDeGit !== 'true') {
    console.log('Não é um repositório git (ou git não está no PATH).');
  } else {
    const total = git('rev-list --count HEAD', raiz);
    const log = git('log --oneline -10', raiz);
    console.log(`Total de commits: ${total || '(sem commits ainda)'}`);
    console.log('Últimos 10 (git log --oneline -10):');
    console.log(log || '(nenhum commit)');
  }

  console.log('\n--- SINAIS PARA TAMANHO (heurística; a decisão final é sua) ---');
  const fortes = [];
  if (scriptsPkg.scripts.length >= 3) fortes.push('manifesto com >=3 scripts reais');
  if (pastasTeste.length) fortes.push('suíte de testes existente');
  if (ci.length) fortes.push('CI/hooks configurados');
  const linguagens = [...censo.porExt.entries()].filter(([e, c]) => CODIGO.has(e) && c >= 3);
  if (linguagens.length >= 2) fortes.push(`>=2 linguagens de código (${linguagens.map(([e]) => e).join(', ')})`);
  if (censo.total > 150) fortes.push(`>150 arquivos (${censo.total})`);
  if (monorepo) fortes.push('monorepo/workspaces');
  // README/CHANGELOG/ROADMAP quase todo projeto tem: não contam como governança para agentes.
  const govAgentes = governanca.filter((g) => !['README.md', 'CHANGELOG.md', 'ROADMAP.md'].includes(g));
  if (govAgentes.length || agentsAninhados.length) fortes.push('governança para agentes já presente');
  // .git/hooks sempre existe com os *.sample do git; só conta hook instalado de verdade.
  const hooksGit = listar(join(raiz, '.git', 'hooks')).filter((e) => e.isFile() && !e.name.endsWith('.sample'));
  if (ci.includes('.husky') || hooksGit.length) fortes.push('hooks de git');
  if (handoffs.length) fortes.push('convenção de handoff já em uso');

  const fracos = [];
  if (!manifestos.length) fracos.push('nenhum manifesto');
  if (censo.total > 0 && censo.total < 30) fracos.push(`<30 arquivos (${censo.total})`);
  const extDominante = [...censo.porExt.entries()].sort((a, b) => b[1] - a[1])[0];
  if (extDominante && extDominante[0] === '.md' && extDominante[1] > censo.total * 0.6) fracos.push('extensão dominante é .md (projeto de notas/documentação)');
  if (!ci.length) fracos.push('sem CI');
  if (!pastasTeste.length) fracos.push('sem pasta de teste');

  console.log(`Sinais fortes (${fortes.length}): ${fortes.join(' | ') || '(nenhum)'}`);
  console.log(`Sinais fracos (${fracos.length}): ${fracos.join(' | ') || '(nenhum)'}`);
  let sugestao = 'T1 (enxuto, 30-70 linhas)';
  if (fortes.length >= 4) sugestao = 'T3 (estendido, 150-250 linhas + satélites)';
  else if (fortes.length >= 2) sugestao = 'T2 (padrão, 70-150 linhas)';
  console.log(`SUGESTÃO: ${sugestao}`);
}

try { principal(); } catch (e) { console.log('ERRO ao varrer o projeto: ' + e.message); }
