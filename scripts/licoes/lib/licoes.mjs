// Arquivos de lição (docs/licoes/Lnnn-<slug>.md), índice, busca e verificação.
// Formato em docs/FORMATO.md. Regra de escrita: texto vindo do agente ou de saída de comando nunca
// cria estrutura — `#`/cerca na coluna 0 ganha `\`, erro e correção vão em cerca — para o parser
// (ciente de cercas) nunca confundir conteúdo com seção.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARCADOR, PASTA_LICOES, PASTA_SCRIPTS } from './config.mjs';
import { garantirPastas, renomear, comTrava } from './estado.mjs';
import { temMarcador } from './raiz.mjs';
import { validarRegex, chaveTexto, semAcento } from './assinatura.mjs';
import { redigir, encurtar, cerca, agora, dataISO, hora } from './util.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));

export const RE_NOME = /^(L\d{3,})(?:[-_ ].*)?\.md$/i;
export const ESTADOS = ['ativa', 'rascunho', 'obsoleta', 'descartada'];
const CAMPOS = ['id', 'titulo', 'estado', 'categoria', 'tags', 'ferramenta', 'entrada', 'erro', 'bloquear', 'assinaturas', 'ocorrencias', 'reincidencias', 'criada', 'ultima', 'origem'];
const LISTAS = new Set(['tags', 'assinaturas']);
const NUMEROS = new Set(['ocorrencias', 'reincidencias']);
export const REGEX = ['ferramenta', 'entrada', 'erro'];
export const SECOES = ['Regra', 'Contexto', 'Erro', 'Correção', 'Histórico'];
const MAX_HISTORICO = 30;

export const carimboAgora = () => { const d = agora(); return `${dataISO(d)} ${hora(d)}`; };
const limpo = (t) => redigir(String(t ?? '')).replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/[\u00A0\u2028\u2029]/g, ' ');
export const umaLinha = (t) => limpo(t).replace(/\s*\n+\s*/g, ' ').trim();
// Prosa do agente: nada na coluna 0 vira título ou cerca.
export const escapar = (t) => limpo(t).trim().split('\n').map((l) => l.replace(/^( {0,3})(#|`{3,}|~{3,})/, '$1\\$2')).join('\n');
export const blocoErro = (comando, erro) => cerca([comando ? '$ ' + limpo(comando) : '', limpo(erro)].filter(Boolean).join('\n'), 'text');

export function slug(t) {
  return chaveTexto(t).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50).replace(/-+$/, '') || 'licao';
}

// ---- Leitura --------------------------------------------------------------------------------
function valor(bruto, chave) {
  const s = bruto.trim();
  let v;
  if (s === '') v = '';
  else { try { v = JSON.parse(s); } catch { v = undefined; } }
  if (v === undefined) {
    if (/^\[.*\]$/.test(s)) v = s.slice(1, -1).split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    else if (/^(true|false)$/i.test(s)) v = /^true$/i.test(s);
    else v = s.replace(/^'(.*)'$/, '$1');
  }
  if (LISTAS.has(chave)) v = Array.isArray(v) ? v.map(String) : String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (NUMEROS.has(chave)) v = Number.isFinite(+v) ? Math.max(0, Math.trunc(+v)) : 0;
  if (chave === 'bloquear') v = v === true || /^(true|sim|yes)$/i.test(String(v));
  return v;
}

export function analisar(texto, arquivo = '') {
  const problemas = [];
  const linhas = String(texto).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('\n');
  const meta = {}, extras = {};
  let i = 0;
  if (linhas[0] === '---') {
    const fim = linhas.indexOf('---', 1);
    if (fim < 0) problemas.push('frontmatter sem a linha "---" de fechamento');
    else {
      for (const l of linhas.slice(1, fim)) {
        if (!l.trim() || l.trim().startsWith('#')) continue;
        const m = l.match(/^([A-Za-zÀ-ÿ_][\wÀ-ÿ-]*)\s*:(.*)$/);
        if (!m) { problemas.push(`linha do frontmatter não é "chave: valor": ${encurtar(l, 60)}`); continue; }
        if (CAMPOS.includes(m[1])) meta[m[1]] = valor(m[2], m[1]);
        else extras[m[1]] = m[2].trim();
      }
      i = fim + 1;
    }
  } else problemas.push('sem frontmatter (só título e seções): ok para lição escrita à mão, mas sem gatilhos');

  let titulo = '', aberta = null;
  const secoes = [];
  let atual = { nome: null, linhas: [] };
  for (; i < linhas.length; i++) {
    const l = linhas[i];
    if (aberta) {
      const f = l.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
      if (f && f[1][0] === aberta[0] && f[1].length >= aberta.length) aberta = null;
      atual.linhas.push(l); continue;
    }
    const a = l.match(/^ {0,3}(`{3,}|~{3,})/);
    if (a) { aberta = a[1]; atual.linhas.push(l); continue; }
    if (!titulo && atual.nome === null && /^# \S/.test(l)) { titulo = l.slice(2).trim(); continue; }
    const s = l.match(/^## (.+?)\s*$/);
    if (s) { secoes.push(atual); atual = { nome: s[1], linhas: [] }; continue; }
    atual.linhas.push(l);
  }
  secoes.push(atual);
  // Tira só linhas em branco das pontas (o recuo da primeira linha é conteúdo).
  const corpo = (x) => { const l = [...x.linhas]; while (l.length && !l[0].trim()) l.shift(); while (l.length && !l.at(-1).trim()) l.pop(); return l.join('\n'); };
  const pre = secoes.shift();

  const doNome = (String(arquivo).match(RE_NOME) || [])[1];
  const id = String(meta.id || doNome || '').toUpperCase();
  const tituloLimpo = titulo.replace(/^L\d+\s*[—–:-]\s*/i, '').trim();
  const lic = {
    arquivo, id,
    titulo: String(meta.titulo || tituloLimpo || ''),
    estado: String(meta.estado || 'ativa'),
    categoria: String(meta.categoria || 'geral'),
    tags: meta.tags || [],
    ferramenta: String(meta.ferramenta ?? ''),
    entrada: String(meta.entrada ?? ''),
    erro: String(meta.erro ?? ''),
    bloquear: !!meta.bloquear,
    assinaturas: meta.assinaturas || [],
    ocorrencias: meta.ocorrencias || 0,
    reincidencias: meta.reincidencias || 0,
    criada: String(meta.criada || ''),
    ultima: String(meta.ultima || ''),
    origem: String(meta.origem || ''),
    extras,
    preambulo: corpo(pre),
    secoes: secoes.map((x) => ({ nome: x.nome, texto: corpo(x) })),
    problemas,
  };
  if (aberta) problemas.push('cerca de código aberta e nunca fechada');
  return lic;
}

export const secao = (lic, nome) => (lic.secoes.find((s) => s.nome === nome) || {}).texto || '';
export function definirSecao(lic, nome, texto) {
  const s = lic.secoes.find((x) => x.nome === nome);
  if (s) { s.texto = texto; return; }
  const ordem = SECOES.indexOf(nome);
  const pos = lic.secoes.findIndex((x) => SECOES.indexOf(x.nome) > ordem);
  lic.secoes.splice(pos < 0 ? lic.secoes.length : pos, 0, { nome, texto });
}
export const regra = (lic) => (secao(lic, 'Regra').split('\n').find((l) => l.trim()) || '').trim();

export function historico(lic, evento) {
  const linhas = secao(lic, 'Histórico').split('\n').filter((l) => l.trim());
  linhas.push(`- ${carimboAgora()} · ${umaLinha(evento)}`);
  definirSecao(lic, 'Histórico', linhas.slice(-MAX_HISTORICO).join('\n'));
  lic.ultima = carimboAgora();
}

// ---- Escrita --------------------------------------------------------------------------------
export function serializar(lic) {
  const fm = ['---'];
  for (const k of CAMPOS) {
    let v = lic[k];
    if (k === 'titulo') v = umaLinha(v);
    fm.push(`${k}: ${JSON.stringify(v ?? '')}`);
  }
  for (const [k, v] of Object.entries(lic.extras || {})) fm.push(`${k}: ${v}`);
  fm.push('---');
  const partes = [fm.join('\n'), `# ${lic.id} — ${umaLinha(lic.titulo)}`];
  if (lic.preambulo) partes.push(lic.preambulo);
  for (const s of lic.secoes) {
    if (!s.nome) continue;
    if (!s.texto && s.nome !== 'Regra') continue;
    partes.push(`## ${s.nome}` + (s.texto ? '\n\n' + s.texto : ''));
  }
  return partes.join('\n\n') + '\n';
}

export function gravarLicao(dir, lic) {
  if (!lic.arquivo) lic.arquivo = `${lic.id}-${slug(lic.titulo)}.md`;
  const alvo = join(dir, lic.arquivo);
  const tmp = alvo + '.' + process.pid + '.tmp';
  writeFileSync(tmp, serializar(lic));
  renomear(tmp, alvo);
  return lic;
}

export function novaLicao(dir, campos) {
  const id = proximoId(dir);
  const agoraTxt = carimboAgora();
  const lic = {
    arquivo: '', id, titulo: umaLinha(campos.titulo || id), estado: campos.estado || 'ativa',
    categoria: campos.categoria || 'geral', tags: campos.tags || [],
    ferramenta: campos.ferramenta || '', entrada: campos.entrada || '', erro: campos.erro || '',
    bloquear: !!campos.bloquear, assinaturas: campos.assinaturas || [],
    ocorrencias: campos.ocorrencias || 0, reincidencias: 0,
    criada: agoraTxt, ultima: agoraTxt, origem: campos.origem || '', extras: {}, preambulo: '', secoes: [], problemas: [],
  };
  definirSecao(lic, 'Regra', campos.regra ? escapar(campos.regra) : '');
  if (campos.contexto) definirSecao(lic, 'Contexto', escapar(campos.contexto));
  if (campos.blocoErro) definirSecao(lic, 'Erro', campos.blocoErro);
  if (campos.correcao) definirSecao(lic, 'Correção', campos.correcao);
  historico(lic, campos.evento || 'criada');
  lic.ultima = agoraTxt;
  return gravarLicao(dir, lic);
}

// ---- Listagem -------------------------------------------------------------------------------
export function listar(dir) {
  let nomes = [];
  try { nomes = readdirSync(dir).filter((n) => RE_NOME.test(n)); } catch { return []; }
  const lics = [];
  for (const n of nomes) {
    try { lics.push(analisar(readFileSync(join(dir, n), 'utf8'), n)); } catch { /* sumiu entre o readdir e o read */ }
  }
  return lics.sort((a, b) => numero(a.id) - numero(b.id) || a.arquivo.localeCompare(b.arquivo));
}
const numero = (id) => +(String(id).match(/\d+/) || [0])[0];

export function proximoId(dir) {
  let max = 0;
  try { for (const n of readdirSync(dir)) { const m = n.match(RE_NOME); if (m) max = Math.max(max, numero(m[1])); } } catch { /* pasta nova */ }
  return 'L' + String(max + 1).padStart(3, '0');
}

export const acharLicao = (dir, id) => listar(dir).find((l) => l.id === String(id).toUpperCase()) || null;

// Ordem de importância: bloqueia, reincidiu, ocorreu; empate pelo id.
export const porImportancia = (a, b) => (b.bloquear - a.bloquear) || (b.reincidencias - a.reincidencias) || (b.ocorrencias - a.ocorrencias) || numero(a.id) - numero(b.id);

// ---- Índice ---------------------------------------------------------------------------------
const celula = (t) => String(t).replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();
const codigo = (t) => '`' + celula(String(t).replace(/`/g, "'")) + '`';
const link = (l) => `[${l.id}](${encodeURI(l.arquivo)})`;

export function gatilho(l) {
  const g = [];
  if (l.ferramenta) g.push(codigo(l.ferramenta));
  if (l.entrada) g.push('antes: ' + codigo(l.entrada));
  if (l.erro) g.push('erro: ' + codigo(l.erro));
  if (l.assinaturas.length) g.push(`assinatura ×${l.assinaturas.length}`);
  if (l.bloquear) g.push('**bloqueia**');
  return g.join(' · ') || '—';
}

export function textoIndice(lics) {
  const por = (e) => lics.filter((l) => l.estado === e);
  const ativas = por('ativa'), rasc = por('rascunho'), arq = lics.filter((l) => l.estado === 'obsoleta' || l.estado === 'descartada');
  const out = [
    '# Índice de lições', '',
    'Gerado pelo plugin gerador-licoes-projeto (`licao indice`); não edite. Cada lição é um arquivo',
    '`Lnnn-*.md` desta pasta. Buscar: `licao buscar "<termos>"`.', '',
    `**${ativas.length} ativas** · ${rasc.length} rascunhos · ${por('obsoleta').length} obsoletas · ${por('descartada').length} descartadas`, '',
    '## Ativas', '',
  ];
  if (!ativas.length) out.push('_Nenhuma ainda._', '');
  const cats = [...new Set(ativas.map((l) => l.categoria))].sort((a, b) => a.localeCompare(b));
  for (const c of cats) {
    out.push(`### ${celula(c)}`, '', '| Lição | Regra | Gatilho | Ocorr. | Reinc. | Última |', '|---|---|---|---:|---:|---|');
    for (const l of ativas.filter((x) => x.categoria === c)) {
      out.push(`| ${link(l)} ${celula(l.titulo)} | ${celula(encurtar(regra(l), 140))} | ${gatilho(l)} | ${l.ocorrencias} | ${l.reincidencias} | ${celula(l.ultima.slice(0, 10))} |`);
    }
    out.push('');
  }
  const rein = ativas.filter((l) => l.reincidencias > 0).sort(porImportancia).slice(0, 10);
  if (rein.length) {
    out.push('## Mais reincidentes', '');
    rein.forEach((l, i) => out.push(`${i + 1}. ${link(l)} — ${l.reincidencias} reincidência(s) — ${celula(l.titulo)}`));
    out.push('');
  }
  const tags = new Map();
  for (const l of [...ativas, ...rasc]) for (const t of l.tags) { const k = String(t).toLowerCase(); tags.set(k, [...(tags.get(k) || []), l]); }
  if (tags.size) {
    out.push('## Por tag', '');
    for (const t of [...tags.keys()].sort((a, b) => a.localeCompare(b))) out.push(`- **${celula(t)}**: ${tags.get(t).map(link).join(', ')}`);
    out.push('');
  }
  if (rasc.length) {
    out.push('## Rascunhos a confirmar', '');
    for (const l of rasc) out.push(`- ${link(l)} ${celula(l.titulo)} — \`licao confirmar ${l.id} --regra "<o que fazer>"\` ou \`licao descartar ${l.id} --porque "<motivo>"\``);
    out.push('');
  }
  if (arq.length) {
    out.push('## Obsoletas e descartadas', '');
    for (const l of arq) out.push(`- ${link(l)} ~~${celula(l.titulo)}~~ (${l.estado})`);
    out.push('');
  }
  return out.join('\n');
}

// Só grava se mudou (o índice não tem data: regenerar sem mudança não suja o git).
export function gerarIndice(dir) {
  const alvo = join(dir, 'INDICE.md');
  const novo = textoIndice(listar(dir));
  let atual = null;
  try { atual = readFileSync(alvo, 'utf8'); } catch { /* primeira vez */ }
  if (atual === novo) return false;
  const tmp = alvo + '.' + process.pid + '.tmp';
  writeFileSync(tmp, novo);
  renomear(tmp, alvo);
  return true;
}

// ---- Busca ----------------------------------------------------------------------------------
export function buscar(lics, termos, { todas = false } = {}) {
  const toks = chaveTexto(termos).split(/[^a-z0-9_.+#-]+/).filter((t) => t.length >= 2);
  if (!toks.length) return [];
  const res = [];
  for (const l of lics) {
    if (!todas && l.estado !== 'ativa' && l.estado !== 'rascunho') continue;
    const tit = chaveTexto(l.titulo), tg = l.tags.map(chaveTexto), rg = chaveTexto(secao(l, 'Regra')), cat = chaveTexto(l.categoria);
    const resto = chaveTexto([secao(l, 'Contexto'), secao(l, 'Erro'), secao(l, 'Correção'), l.entrada, l.erro].join(' '));
    let pts = 0;
    for (const t of toks) {
      if (t === l.id.toLowerCase()) pts += 100;
      if (tit.includes(t)) pts += 5;
      if (tg.some((x) => x === t || x.includes(t))) pts += 4;
      if (rg.includes(t)) pts += 3;
      if (cat.includes(t)) pts += 2;
      if (resto.includes(t)) pts += 1;
    }
    if (pts) res.push({ licao: l, pontos: pts });
  }
  return res.sort((a, b) => b.pontos - a.pontos || porImportancia(a.licao, b.licao));
}

// Tags citadas num texto (prompt): palavra inteira, sem acento, sem diferenciar maiúsculas.
export function citaTag(texto, tag) {
  const t = chaveTexto(tag).trim();
  if (t.length < 2) return false;
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(chaveTexto(texto));
}

// ---- Verificação ----------------------------------------------------------------------------
export function verificar(dir) {
  const erros = [], avisos = [];
  if (!existsSync(dir)) return { erros, avisos: ['pasta de lições ainda não existe'] };
  if (!temMarcador(join(dir, 'README.md'))) erros.push(`README.md sem "${MARCADOR}"`);
  const vistos = new Map();
  for (const l of listar(dir)) {
    const onde = l.arquivo;
    for (const p of l.problemas) (p.startsWith('sem frontmatter') ? avisos : erros).push(`${onde}: ${p}`);
    const doNome = (onde.match(RE_NOME) || [])[1].toUpperCase();
    if (l.id !== doNome) erros.push(`${onde}: id "${l.id}" diferente do nome do arquivo (${doNome})`);
    if (vistos.has(l.id)) erros.push(`${onde}: id ${l.id} repetido (também em ${vistos.get(l.id)})`);
    vistos.set(l.id, onde);
    if (!ESTADOS.includes(l.estado)) erros.push(`${onde}: estado "${l.estado}" (use ${ESTADOS.join('|')})`);
    if (!l.titulo.trim()) erros.push(`${onde}: sem título`);
    if (l.estado === 'ativa' && !regra(l)) erros.push(`${onde}: lição ativa sem texto em "## Regra"`);
    for (const k of REGEX) { const e = validarRegex(l[k]); if (e) erros.push(`${onde}: ${k}: ${e}`); }
    if (l.bloquear && !l.entrada) avisos.push(`${onde}: bloquear sem "entrada" não bloqueia nada`);
  }
  for (const n of readdirSync(dir)) {
    if (n.endsWith('.md') && !RE_NOME.test(n) && n !== 'README.md' && n !== 'INDICE.md') avisos.push(`${n}: .md que não é lição (nome fora de Lnnn-*.md)`);
  }
  let indice = null;
  try { indice = readFileSync(join(dir, 'INDICE.md'), 'utf8'); } catch { /* sem índice */ }
  if (indice !== textoIndice(listar(dir))) avisos.push('INDICE.md desatualizado (rode `licao indice`)');
  return { erros, avisos };
}

// ---- Pasta ----------------------------------------------------------------------------------
const README = `# Lições do projeto
${MARCADOR}

O que este projeto aprendeu com os próprios erros, para o agente não os repetir. Uma lição por
arquivo \`Lnnn-<assunto>.md\`; índice em \`INDICE.md\` (gerado, não edite). Os hooks do plugin
percebem falhas, correções e pedidos do tipo "lembre disso" e pedem ao agente que registre a lição;
lições com \`entrada\` avisam (ou bloqueiam) antes do comando que já deu errado.

Comandos: \`licao buscar "<termos>"\`, \`licao nova "<título>" --regra "<o que fazer>"\`,
\`licao pendentes\`, \`licao verificar\`. Sem o plugin: \`node ${PASTA_SCRIPTS}/licoes.mjs <comando>\`.
Pode editar uma lição à mão; depois rode \`licao verificar\` e \`licao indice\`.

Para devolver esta pasta ao projeto, apague a linha de marcação acima: o plugin para de gravar.
`;

// Sob a trava: processos simultâneos na pasta nova copiavam o CLI ao mesmo tempo (EBUSY no Windows).
// README atômico, com o temporário em .estado/ (ignorada por situacaoPasta): lido pela metade, ou
// ao lado do README, faria outro processo ver a pasta como do projeto e se desligar calado.
export function criarPasta(ctx) {
  comTrava(ctx.dir, ctx.config, () => {
    const rd = join(ctx.dir, 'README.md');
    if (!existsSync(rd)) {
      const tmp = join(garantirPastas(ctx.dir), `README.${process.pid}.tmp`);
      writeFileSync(tmp, README);
      renomear(tmp, rd);
    }
    vendorizar(ctx.raiz);
    gerarIndice(ctx.dir);
  });
  ctx.situacao = 'propria';
}

export function reivindicar(ctx) {
  mkdirSync(ctx.dir, { recursive: true });
  const rd = join(ctx.dir, 'README.md');
  let feito = false;
  if (!existsSync(rd)) { writeFileSync(rd, README); feito = true; }
  else if (!temMarcador(rd)) {
    writeFileSync(rd, MARCADOR + '\n\n' + readFileSync(rd, 'utf8'));
    if (!temMarcador(rd)) throw new Error(`marcação inserida mas não reconhecida em ${rd}`);
    feito = true;
  }
  garantirPastas(ctx.dir);
  vendorizar(ctx.raiz);
  gerarIndice(ctx.dir);
  return feito;
}

// Copia o CLI para scripts/licoes/ do projeto (agentes sem o plugin usam essa cópia). Só se a versão mudou.
export function vendorizar(raiz) {
  const origem = dirname(AQUI);                         // <plugin>/scripts
  const destino = join(raiz, PASTA_SCRIPTS);
  const norm = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
  if (norm(origem) === norm(destino)) return;           // já é a cópia vendorizada
  let versao;
  try { versao = JSON.parse(readFileSync(join(dirname(origem), '.claude-plugin', 'plugin.json'), 'utf8')).version; } catch { return; }
  const marca = join(destino, 'VERSAO');
  try { if (readFileSync(marca, 'utf8').trim() === versao) return; } catch { /* primeira vez */ }
  mkdirSync(join(destino, 'lib'), { recursive: true });
  copyFileSync(join(origem, 'licoes.mjs'), join(destino, 'licoes.mjs'));
  for (const n of readdirSync(AQUI)) if (n.endsWith('.mjs')) copyFileSync(join(AQUI, n), join(destino, 'lib', n));
  writeFileSync(marca, versao + '\n');
}

export { PASTA_LICOES, semAcento };
