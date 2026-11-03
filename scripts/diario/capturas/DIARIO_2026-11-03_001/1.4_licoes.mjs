#!/usr/bin/env node
// CLI das lições. `licao hook` é o que os hooks do plugin chamam (JSON no stdin); o resto é o agente
// (ou um humano) registrando, consultando e mantendo as lições. Toda escrita de lição ou de estado
// passa pela trava (comEstado): dois agentes nunca pegam o mesmo Lnnn.
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PASTA_LICOES, PASTA_SCRIPTS, MARCADOR } from './lib/config.mjs';
import { resolver } from './lib/raiz.mjs';
import { comEstado, lerEstado, pendentes, registrarErro } from './lib/estado.mjs';
import { validarRegex } from './lib/assinatura.mjs';
import {
  listar, acharLicao, novaLicao, gravarLicao, historico, definirSecao, secao, regra, escapar, blocoErro, umaLinha,
  buscar, gerarIndice, verificar, criarPasta, reivindicar, vendorizar, REGEX, gatilho,
} from './lib/licoes.mjs';
import { lerEntrada, cerca, encurtar } from './lib/util.mjs';
import { tratarHook, descrever, comoResolver } from './lib/hooks.mjs';
import { ehEntradaAgy, ehPastaInternaGemini, converterParaEventosClaude, traduzirSaidaParaAgy } from './lib/agy.mjs';

const AJUDA = `licao — lições do projeto (${PASTA_LICOES}/)

Registrar:
  licao nova "<título>" --regra "<o que fazer>" [--de On] [--contexto "<por quê>"] [--categoria <c>]
             [--tags a,b] [--ferramenta <regex>] [--entrada <regex>] [--erro <regex>] [--bloquear]
  licao confirmar Lnnn --regra "<o que fazer>" [--de On] [campos de nova]   rascunho → ativa
  licao editar Lnnn [--regra …] [--titulo …] [--de On] [campos de nova]
  licao obsoleta Lnnn --porque "<motivo>"
  licao descartar Lnnn|On ... --porque "<motivo>"

Consultar:
  licao buscar "<termos>" [--todas]      ativas e rascunhos (--todas inclui obsoletas/descartadas)
  licao pendentes [--sessao <id>]        ocorrências à espera de decisão
  licao ver Lnnn|On
  licao status

Manter:
  licao verificar                        portão de formato (sai 1 se houver erro)
  licao indice                           regenera INDICE.md
  licao instalar [--agents-md] [--reivindicar]

--entrada casa o comando (Bash/PowerShell) ou o caminho relativo à raiz (Write/Edit), antes da
execução: a lição avisa, ou nega a ferramenta com --bloquear. --erro casa a mensagem de falha.
--de On liga a lição à ocorrência que a motivou e a tira da lista de pendentes.
--raiz <pasta>, antes ou depois do comando, fixa a raiz do projeto (o SessionStart já a injeta).
`;

// ---- Argumentos -----------------------------------------------------------------------------
// Só opções conhecidas são opção; qualquer outro `--x` é texto. `--` sozinho encerra as opções.
const OPC_VALOR = new Set(['regra', 'contexto', 'categoria', 'tags', 'ferramenta', 'entrada', 'erro', 'de', 'porque', 'titulo', 'sessao', 'raiz']);
const OPC_FLAG = new Set(['bloquear', 'todas', 'reivindicar', 'agents-md']);
function args(argv) {
  const pos = [], opc = {};
  for (let i = 0, fim = false; i < argv.length; i++) {
    const a = argv[i];
    if (!fim && a === '--') { fim = true; continue; }
    const eq = a.indexOf('=');
    const k = a.startsWith('--') && !fim ? a.slice(2, eq < 0 ? undefined : eq) : null;
    if (k && OPC_FLAG.has(k) && eq < 0) opc[k] = true;
    else if (k && OPC_VALOR.has(k)) {
      if (eq >= 0) opc[k] = a.slice(eq + 1);
      else if (i + 1 < argv.length) opc[k] = argv[++i];
      else opc[k] = true;
    } else pos.push(a);
  }
  return { pos, opc, texto: pos.join(' ').trim() };
}

const sair = (msg, codigo = 0) => { (codigo ? process.stderr : process.stdout).write(msg.endsWith('\n') ? msg : msg + '\n'); process.exit(codigo); };
// Dentro da trava use falhar, nunca sair: process.exit pularia o finally que solta a trava.
const falhar = (msg, codigo = 1) => { throw Object.assign(new Error(msg), { codigo }); };
const texto = (v) => (typeof v === 'string' && v.trim() ? v.trim() : '');
const idLicao = (x) => { const m = String(x).match(/^L(\d+)$/i); return m ? 'L' + m[1].padStart(3, '0') : null; };
const idOcorrencia = (x) => { const m = String(x).match(/^O(\d+)$/i); return m ? 'O' + +m[1] : null; };
const listaTags = (v) => String(v).split(',').map((t) => t.trim()).filter(Boolean);

// ---- Contexto -------------------------------------------------------------------------------
// --raiz vale como LICOES_RAIZ: o Bash do agente não recebe CLAUDE_PROJECT_DIR, e sem ela um
// `licao nova` rodado numa subpasta, antes de qualquer hook gravar, criava a pasta lá.
let RAIZ = null;
function contexto({ exigirProprio = true } = {}) {
  const ctx = resolver(process.cwd(), RAIZ ? { ...process.env, LICOES_RAIZ: RAIZ } : process.env);
  if (exigirProprio && ctx.modo === 'desligado') sair(`lições desligadas: ${ctx.motivo}. Nada gravado.`);
  return ctx;
}

// Escrita: cria a pasta se for a primeira vez e roda fn(estado) sob a trava; índice depois.
function escrever(ctx, fn) {
  if (ctx.situacao === 'nova') criarPasta(ctx);
  const r = comEstado(ctx.dir, ctx.config, fn);
  gerarIndice(ctx.dir);
  return r;
}

// Campos opcionais comuns a nova/confirmar/editar. Regex inválida sai 2 antes de gravar qualquer coisa.
function campos(opc) {
  const c = {};
  for (const k of REGEX) {
    if (opc[k] === undefined) continue;
    if (opc[k] === true) sair(`--${k} precisa de um valor`, 2);
    const e = validarRegex(opc[k]);
    if (e) sair(`--${k}: ${e}`, 2);
    c[k] = opc[k];
  }
  if (texto(opc.categoria)) c.categoria = umaLinha(opc.categoria);
  if (texto(opc.tags)) c.tags = listaTags(opc.tags);
  if (opc.bloquear) c.bloquear = true;
  return c;
}

function exigirOcorrencia(estado, opc) {
  if (opc.de === undefined) return null;
  const id = idOcorrencia(opc.de);
  const o = id && estado.ocorrencias[id];
  if (!o) falhar(`--de: ocorrência ${opc.de} não existe (veja \`licao pendentes\`)`);
  return o;
}

// Ocorrência resolvida: sai das pendentes e a assinatura dela passa a apontar para a lição (o mesmo
// erro depois é reincidência, não rascunho novo).
function resolverOcorrencia(estado, o, licaoId, como) {
  o.pendente = false;
  o.resolvida = como;
  if (licaoId) o.licao = licaoId;
  if (licaoId && o.assinatura) {
    const a = estado.assinaturas[o.assinatura] || (estado.assinaturas[o.assinatura] = { n: 0 });
    a.licao = licaoId;
  }
}

// Ligar depois (editar/confirmar --de) herda o que `nova --de` herdaria, sem sobrescrever o que já há.
function anexarOcorrencia(estado, lic, o, como) {
  if (o.assinatura && !lic.assinaturas.includes(o.assinatura)) lic.assinaturas.push(o.assinatura);
  if (o.erro && !secao(lic, 'Erro')) definirSecao(lic, 'Erro', blocoErro(o.comando, o.erro));
  if (o.correcao && !secao(lic, 'Correção')) definirSecao(lic, 'Correção', cerca(o.correcao, lingua(o)));
  if (!lic.origem) lic.origem = o.id;
  if (o.licao !== lic.id) lic.ocorrencias++; // ligada a esta lição, o hook já contou (rascunho, reincidência)
  resolverOcorrencia(estado, o, lic.id, como);
}

function acharOuSair(ctx, x) {
  const id = idLicao(x);
  if (!id) sair(`não é um id de lição: ${x || '(vazio)'}`, 2);
  const l = acharLicao(ctx.dir, id);
  if (!l) sair(`lição ${id} não existe`, 1);
  return l;
}

const lingua = (o) => (/powershell/i.test(o.ferramenta || '') ? 'powershell' : 'bash');
const resumo = (l) => `${l.id} [${l.estado}] ${umaLinha(l.titulo)} — ${encurtar(umaLinha(regra(l)) || '(sem regra)', 160)}`;

// ---- Bloco para AGENTS.md -------------------------------------------------------------------
const BLOCO_AGENTS = `
## Lições do projeto
${MARCADOR}

O que este projeto aprendeu com os próprios erros está em \`${PASTA_LICOES}/\` (índice em
\`${PASTA_LICOES}/INDICE.md\`). Antes de mexer em algo que já deu errado:
\`node ${PASTA_SCRIPTS}/licoes.mjs buscar "<termos>"\`. Errou e corrigiu, ou o usuário corrigiu você:
\`node ${PASTA_SCRIPTS}/licoes.mjs nova "<título>" --regra "<o que fazer>"\`. Não edite o INDICE.md à mão.
`;

// ---- Comandos -------------------------------------------------------------------------------
const COMANDOS = {
  hook({ pos }) {
    try {
      const entrada = lerEntrada();
      const argEv = pos && pos[0] ? pos[0] : '';
      if (ehEntradaAgy(entrada, argEv)) {
        const { evAgy, sid, cwd, eventos } = converterParaEventosClaude(entrada, argEv, 'gerador-licoes-projeto');
        if (!cwd || ehPastaInternaGemini(cwd)) {
          process.stdout.write(JSON.stringify(traduzirSaidaParaAgy(evAgy, [], sid, 'gerador-licoes-projeto')));
          process.exit(0);
        }
        const saidas = [];
        for (const ev of eventos) {
          const r = tratarHook(ev);
          if (r) saidas.push(r);
        }
        process.stdout.write(JSON.stringify(traduzirSaidaParaAgy(evAgy, saidas, sid, 'gerador-licoes-projeto')));
        process.exit(0);
      }
      const out = tratarHook(entrada);
      if (out) process.stdout.write(JSON.stringify(out));
    } catch (e) { try { registrarErro(resolver(process.cwd()).dir, e); } catch { /* silêncio */ } }
    process.exit(0); // hook nunca quebra a sessão
  },

  nova({ texto: titulo, opc }) {
    if (!titulo || !texto(opc.regra)) sair('uso: licao nova "<título>" --regra "<o que fazer>" [--de On] [...]', 2);
    const c = campos(opc);
    const ctx = contexto();
    const lic = escrever(ctx, (estado) => {
      const o = exigirOcorrencia(estado, opc);
      if (o && o.tipo === 'rascunho') falhar(`${o.id} já tem o rascunho ${o.licao}: \`licao confirmar ${o.licao} --regra "<...>" --de ${o.id}\``, 2);
      const de = {};
      if (o) {
        if (o.assinatura) de.assinaturas = [o.assinatura];
        if (o.erro) de.blocoErro = blocoErro(o.comando, o.erro);
        if (o.correcao) de.correcao = cerca(o.correcao, lingua(o));
        if (o.prompt && !texto(opc.contexto)) de.contexto = `Pedido do usuário (${o.id}): "${umaLinha(o.prompt)}"`;
        de.ocorrencias = 1;
        de.origem = o.id;
      }
      const nova = novaLicao(ctx.dir, {
        titulo, regra: opc.regra, contexto: texto(opc.contexto) || undefined, ...de, ...c,
        evento: o ? `criada a partir de ${o.id} (${o.tipo})` : 'criada',
      });
      if (o) resolverOcorrencia(estado, o, nova.id, 'nova');
      return nova;
    });
    sair(`${lic.id} criada: ${PASTA_LICOES}/${lic.arquivo}`);
  },

  confirmar({ pos, opc }) {
    if (pos.length !== 1 || !texto(opc.regra)) sair('uso: licao confirmar Lnnn --regra "<o que fazer>" [--de On] [...]', 2);
    const c = campos(opc);
    const ctx = contexto();
    acharOuSair(ctx, pos[0]);
    const lic = escrever(ctx, (estado) => {
      const l = acharLicao(ctx.dir, idLicao(pos[0]));
      if (l.estado !== 'rascunho') falhar(`${l.id} está ${l.estado}; só rascunho se confirma (use \`licao editar ${l.id}\`)`, 2);
      const o = exigirOcorrencia(estado, opc);
      Object.assign(l, c, { estado: 'ativa' });
      if (texto(opc.titulo)) l.titulo = umaLinha(opc.titulo);
      definirSecao(l, 'Regra', escapar(opc.regra));
      if (texto(opc.contexto)) definirSecao(l, 'Contexto', escapar(opc.contexto));
      if (o) anexarOcorrencia(estado, l, o, 'confirmar');
      // Confirmar o rascunho resolve as ocorrências que o anunciaram e as correções que o alimentaram.
      for (const x of pendentes(estado)) if (x.licao === l.id && (x.tipo === 'rascunho' || x.tipo === 'correcao')) resolverOcorrencia(estado, x, l.id, 'confirmar');
      historico(l, o ? `confirmada (${o.id})` : 'confirmada');
      return gravarLicao(ctx.dir, l);
    });
    sair(`${lic.id} ativa: ${PASTA_LICOES}/${lic.arquivo}`);
  },

  editar({ pos, opc }) {
    if (pos.length !== 1) sair('uso: licao editar Lnnn [--regra …] [--titulo …] [--de On] [...]', 2);
    const c = campos(opc);
    if (!Object.keys(c).length && !texto(opc.regra) && !texto(opc.titulo) && !texto(opc.contexto) && opc.de === undefined) sair('nada a mudar: passe --regra, --titulo, --contexto, --de ou um campo', 2);
    const ctx = contexto();
    acharOuSair(ctx, pos[0]);
    const lic = escrever(ctx, (estado) => {
      const l = acharLicao(ctx.dir, idLicao(pos[0]));
      const o = exigirOcorrencia(estado, opc);
      const mud = [...Object.keys(c)];
      Object.assign(l, c);
      if (texto(opc.titulo)) { l.titulo = umaLinha(opc.titulo); mud.push('titulo'); }
      if (texto(opc.regra)) { definirSecao(l, 'Regra', escapar(opc.regra)); mud.push('regra'); }
      if (texto(opc.contexto)) { definirSecao(l, 'Contexto', escapar(opc.contexto)); mud.push('contexto'); }
      if (o) anexarOcorrencia(estado, l, o, 'editar');
      historico(l, `editada${mud.length ? ': ' + mud.join(', ') : ''}${o ? ` (${o.id})` : ''}`);
      return gravarLicao(ctx.dir, l);
    });
    sair(`${lic.id} editada: ${PASTA_LICOES}/${lic.arquivo}`);
  },

  obsoleta({ pos, opc }) {
    if (pos.length !== 1 || !texto(opc.porque)) sair('uso: licao obsoleta Lnnn --porque "<motivo>"', 2);
    const ctx = contexto();
    acharOuSair(ctx, pos[0]);
    const lic = escrever(ctx, () => {
      const l = acharLicao(ctx.dir, idLicao(pos[0]));
      l.estado = 'obsoleta';
      historico(l, `obsoleta: ${opc.porque}`);
      return gravarLicao(ctx.dir, l);
    });
    sair(`${lic.id} obsoleta`);
  },

  descartar({ pos, opc }) {
    if (!pos.length || !texto(opc.porque)) sair('uso: licao descartar Lnnn|On ... --porque "<motivo>"', 2);
    const ids = pos.map((x) => idLicao(x) || idOcorrencia(x) || sair(`não é id de lição nem de ocorrência: ${x}`, 2));
    const ctx = contexto();
    if (ctx.situacao === 'nova') sair('nenhuma lição ainda', 1);
    const feitos = escrever(ctx, (estado) => {
      // Valida todos antes de mudar qualquer um: ou descarta tudo, ou nada.
      const lics = listar(ctx.dir);
      const alvos = ids.map((id) => (id.startsWith('O') ? estado.ocorrencias[id] : lics.find((l) => l.id === id))
        || falhar(`${id} não existe (nada descartado)`));
      const out = [];
      for (const [i, id] of ids.entries()) {
        if (id.startsWith('O')) {
          resolverOcorrencia(estado, alvos[i], null, `descartada: ${umaLinha(opc.porque)}`);
          out.push(id);
          continue;
        }
        const l = alvos[i];
        l.estado = 'descartada';
        historico(l, `descartada: ${opc.porque}`);
        gravarLicao(ctx.dir, l);
        // A assinatura continua apontando para ela: o mesmo erro não vira rascunho de novo.
        for (const o of pendentes(estado)) if (o.licao === l.id) resolverOcorrencia(estado, o, l.id, 'descartada com a lição');
        out.push(id);
      }
      return out;
    });
    sair(`descartado: ${feitos.join(', ')}`);
  },

  pendentes({ opc }) {
    const ctx = contexto({ exigirProprio: false });
    if (ctx.situacao === 'nova') sair('nenhuma lição ainda, nenhuma pendência');
    const estado = lerEstado(ctx.dir);
    const lista = pendentes(estado, texto(opc.sessao)).sort((a, b) => a.quando - b.quando);
    const rasc = listar(ctx.dir).filter((l) => l.estado === 'rascunho');
    const out = [];
    if (lista.length) out.push(`${lista.length} ocorrência(s) pendente(s):`, ...lista.map((o) => `- ${descrever(o)}\n  ${comoResolver(o)}`));
    if (rasc.length) out.push(`${rasc.length} rascunho(s):`, ...rasc.map((l) => `- ${l.id} ${umaLinha(l.titulo)} — \`licao confirmar ${l.id} --regra "<...>"\``));
    if (lista.length) out.push(`Não ensina nada: \`licao descartar ${lista.map((o) => o.id).join(' ')} --porque "<motivo>"\``);
    sair(out.length ? out.join('\n') : 'nenhuma pendência');
  },

  buscar({ texto: termos, opc }) {
    if (!termos) sair('uso: licao buscar "<termos>" [--todas]', 2);
    const ctx = contexto({ exigirProprio: false });
    const res = buscar(listar(ctx.dir), termos, { todas: !!opc.todas });
    if (!res.length) sair('nenhuma lição encontrada');
    sair(res.slice(0, 15).map(({ licao: l }) => `${resumo(l)}\n  ${gatilho(l)} · ${PASTA_LICOES}/${l.arquivo}`).join('\n'));
  },

  ver({ pos }) {
    if (pos.length !== 1) sair('uso: licao ver Lnnn|On', 2);
    const ctx = contexto({ exigirProprio: false });
    const o = idOcorrencia(pos[0]);
    if (o) {
      const x = lerEstado(ctx.dir).ocorrencias[o];
      if (!x) sair(`ocorrência ${o} não existe`, 1);
      const det = [descrever(x), `quando: ${new Date(x.quando).toLocaleString()}`, `sessão: ${x.sid}`, `pendente: ${x.pendente ? 'sim' : 'não'}${x.resolvida ? ` (${x.resolvida})` : ''}`];
      if (x.erro) det.push('erro:', cerca(x.erro, 'text'));
      if (x.correcao) det.push('correção:', cerca(x.correcao, lingua(x)));
      if (x.pendente) det.push('resolver: ' + comoResolver(x));
      sair(det.join('\n'));
    }
    const l = acharOuSair(ctx, pos[0]);
    sair(readFileSync(join(ctx.dir, l.arquivo), 'utf8'));
  },

  status() {
    const ctx = contexto({ exigirProprio: false });
    const linhas = [`raiz: ${ctx.raiz}`, `pasta: ${ctx.dir}`, `modo: ${ctx.modo}${ctx.motivo ? ' (' + ctx.motivo + ')' : ''}`, `situação: ${ctx.situacao}`];
    if (ctx.situacao !== 'nova') {
      const lics = listar(ctx.dir);
      const n = (e) => lics.filter((l) => l.estado === e).length;
      linhas.push(`lições: ${n('ativa')} ativas, ${n('rascunho')} rascunhos, ${n('obsoleta')} obsoletas, ${n('descartada')} descartadas`);
      linhas.push(`bloqueiam: ${lics.filter((l) => l.estado === 'ativa' && l.bloquear).map((l) => l.id).join(', ') || 'nenhuma'}`);
      linhas.push(`ocorrências pendentes: ${pendentes(lerEstado(ctx.dir)).length}`);
    }
    sair(linhas.join('\n'));
  },

  verificar() {
    const ctx = contexto({ exigirProprio: false });
    const { erros, avisos } = verificar(ctx.dir);
    const out = [...erros.map((e) => 'ERRO  ' + e), ...avisos.map((a) => 'aviso ' + a)];
    out.push(erros.length ? `${erros.length} erro(s).` : 'lições ok.');
    sair(out.join('\n'), erros.length ? 1 : 0);
  },

  indice() {
    const ctx = contexto();
    if (ctx.situacao === 'nova') sair('pasta de lições ainda não existe');
    sair(gerarIndice(ctx.dir) ? 'INDICE.md regenerado' : 'INDICE.md já estava em dia');
  },

  instalar({ opc }) {
    const ctx = contexto({ exigirProprio: false });
    const feito = [];
    if (opc.reivindicar) {
      feito.push(reivindicar(ctx) ? `marcação inserida em ${PASTA_LICOES}/README.md` : 'pasta já marcada');
    } else if (ctx.modo === 'desligado') {
      sair(`lições desligadas: ${ctx.motivo}.\nPara o plugin assumir a pasta: licao instalar --reivindicar`);
    } else {
      if (ctx.situacao === 'nova') criarPasta(ctx); else vendorizar(ctx.raiz);
      feito.push(`${PASTA_LICOES}/ pronto; CLI em ${PASTA_SCRIPTS}/licoes.mjs`);
    }
    if (opc['agents-md']) {
      const alvo = join(ctx.raiz, 'AGENTS.md');
      const atual = existsSync(alvo) ? readFileSync(alvo, 'utf8') : '';
      if (atual.includes(MARCADOR)) feito.push('AGENTS.md já tem o bloco');
      else { writeFileSync(alvo, atual.replace(/\n*$/, atual ? '\n' : '') + BLOCO_AGENTS); feito.push('bloco acrescentado ao AGENTS.md'); }
    }
    sair(feito.join('\n'));
  },
};

// ---- Principal ------------------------------------------------------------------------------
// --raiz pode vir antes do comando: é assim que o SessionStart injeta a linha.
const argv = process.argv.slice(2), antes = [];
while (/^--raiz(?:=|$)/.test(argv[0] ?? '')) { antes.push(argv.shift()); if (!antes.at(-1).includes('=') && argv.length) antes.push(argv.shift()); }
const [cmd, ...resto] = argv;
if (!cmd || cmd === 'ajuda' || cmd === '--help' || cmd === '-h') sair(AJUDA);
const f = COMANDOS[cmd];
if (!f) sair(`comando desconhecido: ${cmd}\n\n${AJUDA}`, 2);
const a = args([...antes, ...resto]);
if (a.opc.raiz !== undefined && cmd !== 'hook') {
  if (!texto(a.opc.raiz)) sair('--raiz precisa de um valor', 2);
  if (!existsSync(a.opc.raiz) || !statSync(a.opc.raiz).isDirectory()) sair(`--raiz: ${a.opc.raiz} não é uma pasta`, 2);
  RAIZ = a.opc.raiz;
}
try { f(a); } catch (e) { sair(e.codigo ? e.message : `licao ${cmd}: ${e.message}`, e.codigo || 1); }
