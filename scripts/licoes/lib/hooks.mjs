// Tradução de eventos de hook do Claude Code em ocorrências e lições. Cada hook é um processo node
// novo: resolve a raiz, lê as lições, e só pega a trava quando precisa gravar estado ou lição. Nunca
// lança: erro vai para docs/licoes/.estado/erros.log e o hook sai 0 (docs/ARQUITETURA.md).
//
// Ciclo: falha (PostToolUseFailure) abre um par; sucesso do mesmo programa logo depois (PostToolUse)
// fecha o par como correção pendente; o Stop pede ao agente, uma vez, que registre a lição ou
// descarte. Mesma assinatura de erro repetida vira rascunho; erro que casa lição ativa é reincidência.
// Lição com `entrada` avisa (ou bloqueia) no PreToolUse; tags citadas no prompt injetam a lição.
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PASTA_LICOES, PASTA_SCRIPTS } from './config.mjs';
import { resolver, mostrarCaminho, canon } from './raiz.mjs';
import { comEstado, lerEstado, sessao, novaOcorrencia, pendentes, registrarErro } from './estado.mjs';
import { assinatura, casa, chaveTexto } from './assinatura.mjs';
import {
  listar, novaLicao, gravarLicao, historico, definirSecao, secao, regra, porImportancia, gerarIndice,
  citaTag, criarPasta, blocoErro, umaLinha,
} from './licoes.mjs';
import { redigir, encurtar, cerca } from './util.mjs';

const CLI = fileURLToPath(new URL('../licoes.mjs', import.meta.url)).replace(/\\/g, '/');
const SHELL = new Set(['Bash', 'PowerShell']);
const ARQUIVO = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const MAX_DEPOIS = 10;
const cortar = (t, n) => encurtar(redigir(String(t ?? '')), n);
const sid8 = (sid) => String(sid).slice(0, 8);

// ---- O comando é só o CLI de lições? ---------------------------------------------------------
// Mesma regra do gerador-diario-projeto (lá está a justificativa): todo segmento tem de ser o CLI ou
// `cd`; substituição, redirecionamento, aspas tipográficas e separadores de linha Unicode desqualificam.
// Os caracteres vêm de fromCharCode porque as ferramentas de escrita convertem escapes em literais.
const TIPOGRAFICAS = String.fromCharCode(0x2018, 0x2019, 0x201A, 0x201B, 0x201C, 0x201D, 0x201E, 0x85);
const RE_EXECUTA_MAIS = new RegExp('\\$\\(|\\$\\[|\\$\\{|`|\\\\["\']|[<>\\r' + TIPOGRAFICAS + ']|\\p{Zl}|\\p{Zp}', 'u');
const RE_SEG_BIN = /^(?:"([^"\n;]*[/\\])?licao"|'([^'\n;]*[/\\])?licao'|((?:[^\s"';&|]*[/\\])?)licao)(?=\s|$)/;
const RE_SEG_NODE = /^node(?:\.exe)?\s+(?:"([^"]*)"|'([^']*)'|([^\s"'][^\n"']*?[/\\]licoes\.mjs|[^\s"']+))(?=\s|$)/;
const RE_SEG_CD = /^(?:cd|pushd|Set-Location)(?=\s|$)/i;
const chave = (p) => { const c = canon(p); return process.platform === 'win32' ? c.toLowerCase() : c; };

function segmentos(cmd) {
  const out = [];
  let atual = '', aspa = null;
  for (const c of cmd) {
    if (aspa) { if (c === aspa) aspa = null; atual += c; } else if (c === '"' || c === "'") { aspa = c; atual += c; } else if ('(){}#'.includes(c)) return null; else if (';&|\n'.includes(c)) { out.push(atual); atual = ''; } else atual += c;
  }
  out.push(atual);
  return out.map((x) => x.trim()).filter(Boolean);
}
export function chamaLicao(cmd, { cwd = process.cwd(), raiz = cwd } = {}) {
  if (RE_EXECUTA_MAIS.test(String(cmd || ''))) return false;
  const seg = segmentos(String(cmd || ''));
  if (!seg) return false;
  const permitidos = new Set([CLI, resolve(raiz, PASTA_SCRIPTS, 'licoes.mjs')].map(chave));
  const temCd = seg.some((x) => RE_SEG_CD.test(x));
  const ok = (p) => (!temCd || isAbsolute(p)) && permitidos.has(chave(resolve(cwd, p)));
  const naoHook = (resto) => !/^\s*(?:--raiz(?:=|\s+)(?:"[^"]*"|'[^']*'|\S+)\s+)*(["']?)hook\1(?=\s|$)/.test(resto);
  const ehCli = (x) => {
    let m = x.match(RE_SEG_NODE);
    if (m) { const p = m[1] ?? m[2] ?? m[3]; return /(?:^|[/\\])licoes\.mjs$/.test(p) && ok(p) && naoHook(x.slice(m[0].length)); }
    m = x.match(RE_SEG_BIN);
    if (!m) return false;
    const p = m[1] ?? m[2] ?? m[3] ?? '';
    return (!p || ok(p + 'licao')) && naoHook(x.slice(m[0].length));
  };
  return seg.some(ehCli) && seg.every((x) => ehCli(x) || RE_SEG_CD.test(x));
}

// ---- Ponto de entrada -----------------------------------------------------------------------
// Devolve o objeto a imprimir em stdout (JSON de controle do hook) ou null.
export function tratarHook(entrada, env = process.env) {
  let ctx = null;
  try {
    ctx = resolver(entrada.cwd || process.cwd(), env);
    if (ctx.modo === 'desligado') return null;
    const sid = entrada.session_id || env.CLAUDE_CODE_SESSION_ID;
    if (!sid) return null;
    const trat = TRATADORES[entrada.hook_event_name];
    return trat ? trat(ctx, entrada, String(sid)) : null;
  } catch (e) {
    if (ctx) registrarErro(ctx.dir, e);
    return null;
  }
}

const saida = (evento, texto) => (texto ? { hookSpecificOutput: { hookEventName: evento, additionalContext: texto } } : null);
const ativas = (ctx) => listar(ctx.dir).filter((l) => l.estado === 'ativa');
// Sem bin/ no plugin (o upload do app recusa bin/ na raiz): `licao` não está no PATH, em nenhum shell.
// --raiz leva a raiz que o hook resolveu: o Bash do agente não tem CLAUDE_PROJECT_DIR e segue o `cd`.
const comandoCli = (ctx) => ` \`licao\` não está no PATH: rode \`node "${CLI}" --raiz "${ctx.raiz.replace(/\\/g, '/')}"\` no lugar dele.`;
const linhaLicao = (l) => `- ${l.id}${l.bloquear ? ' [bloqueia]' : ''}${l.reincidencias ? ` [reincidiu ${l.reincidencias}x]` : ''} ${umaLinha(l.titulo)}: ${encurtar(umaLinha(regra(l)), 300)}`;

// Pasta criada só no primeiro evento que precisa gravar.
function garantir(ctx) {
  if (ctx.situacao === 'nova') criarPasta(ctx);
}

// ---- SessionStart ---------------------------------------------------------------------------
// Só lê: nenhuma trava, nenhuma pasta criada.
function sessionStart(ctx) {
  const cfg = ctx.config;
  if (!cfg.contextoInicial) return null;
  if (ctx.situacao === 'nova') {
    return saida('SessionStart',
      `Lições do projeto: nenhuma ainda (${PASTA_LICOES}/ é criada no primeiro erro). Quando errar e corrigir, ` +
      `ou quando o usuário corrigir você, registre: \`licao nova "<título>" --regra "<o que fazer>"\`.` + comandoCli(ctx));
  }
  const todas = listar(ctx.dir);
  const at = todas.filter((l) => l.estado === 'ativa').sort(porImportancia);
  const rasc = todas.filter((l) => l.estado === 'rascunho').length;
  const pend = pendentes(lerEstado(ctx.dir)).length;
  const linhas = [`Lições do projeto (${PASTA_LICOES}/, ${at.length} ativas; índice em ${PASTA_LICOES}/INDICE.md).`];
  if (at.length) linhas.push('Regras principais:', ...at.slice(0, cfg.contextoMaxLicoes).map(linhaLicao));
  if (at.length > cfg.contextoMaxLicoes) linhas.push(`(+${at.length - cfg.contextoMaxLicoes}: \`licao buscar "<termos>"\` antes de mexer em algo que já deu errado.)`);
  if (rasc || pend) linhas.push(`Aguardando decisão: ${pend} ocorrência(s), ${rasc} rascunho(s) — \`licao pendentes\`.`);
  linhas.push('Errou e corrigiu, ou o usuário corrigiu você: `licao nova "<título>" --regra "<o que fazer>"`.' + comandoCli(ctx));
  return saida('SessionStart', linhas.join('\n'));
}

// ---- UserPromptSubmit -----------------------------------------------------------------------
function userPromptSubmit(ctx, entrada, sid) {
  const cfg = ctx.config;
  const p = String(entrada.prompt ?? '');
  if (/^\s*<task-notification>/.test(p)) return null;
  const texto = chaveTexto(p);
  const tipo = cfg.padroesCorrecao.some((r) => casa(r, texto)) ? 'correcao-usuario'
    : cfg.padroesAprendizado.some((r) => casa(r, texto)) ? 'aprendizado' : null;

  const cand = ctx.situacao === 'nova' ? [] : ativas(ctx).filter((l) => l.tags.some((t) => citaTag(p, t))).sort(porImportancia);
  if (!tipo && !cand.length) return null;

  garantir(ctx);
  return comEstado(ctx.dir, cfg, (estado) => {
    const s = sessao(estado, sid);
    const partes = [];
    if (tipo) {
      const o = novaOcorrencia(estado, { tipo, sid, prompt: cortar(p, cfg.promptMaxChars), pendente: true });
      partes.push(tipo === 'aprendizado'
        ? `O usuário pediu para lembrar algo (${o.id}). Registre: \`licao nova "<título>" --regra "<o que fazer>" --de ${o.id}\`.`
        : `Isto parece uma correção do usuário (${o.id}). Depois de corrigir, registre a lição: \`licao nova "<título>" --regra "<o que fazer>" --de ${o.id}\` (ou \`licao descartar ${o.id} --porque "<motivo>"\`).`);
    }
    const novas = cand.filter((l) => !s.injetadas.includes(l.id)).slice(0, cfg.licoesPorPrompt);
    if (novas.length) {
      s.injetadas.push(...novas.map((l) => l.id));
      partes.push('Lições do projeto ligadas a este pedido:', ...novas.map(linhaLicao));
    }
    return saida('UserPromptSubmit', partes.join('\n'));
  });
}

// ---- PreToolUse -----------------------------------------------------------------------------
function alvoDe(ctx, entrada) {
  const ti = entrada.tool_input || {};
  if (typeof ti.command === 'string') return ti.command;
  const p = ti.file_path || ti.notebook_path || ti.path;
  if (typeof p !== 'string' || !p) return '';
  return mostrarCaminho(ctx.raiz, isAbsolute(p) ? p : resolve(entrada.cwd || ctx.raiz, p));
}

function preToolUse(ctx, entrada, sid) {
  if (ctx.situacao === 'nova') return null;
  const nome = entrada.tool_name || '';
  const ti = entrada.tool_input || {};
  if (typeof ti.command === 'string' && chamaLicao(ti.command, { cwd: entrada.cwd || ctx.raiz, raiz: ctx.raiz })) return null;
  const alvo = alvoDe(ctx, entrada);
  if (!alvo) return null;
  const casam = ativas(ctx).filter((l) => l.entrada && casa(l.ferramenta, nome, { inteira: true }) && casa(l.entrada, alvo)).sort(porImportancia);
  if (!casam.length) return null;

  const bloq = casam.find((l) => l.bloquear);
  if (bloq) {
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          `Bloqueado pela lição ${bloq.id} (${PASTA_LICOES}/${bloq.arquivo}): ${umaLinha(regra(bloq))} ` +
          'Faça de outro jeito. Só o usuário deve desbloquear (editando `bloquear` na lição).',
      },
    };
  }
  if (!ctx.config.avisarAntes) return null;
  const visto = lerEstado(ctx.dir).sessoes[sid];
  if (visto && casam.every((l) => (visto.avisadas || []).includes(l.id))) return null;
  return comEstado(ctx.dir, ctx.config, (estado) => {
    const s = sessao(estado, sid);
    const novas = casam.filter((l) => !s.avisadas.includes(l.id));
    if (!novas.length) return null;
    s.avisadas.push(...novas.map((l) => l.id));
    return saida('PreToolUse', ['Antes deste comando, lições do projeto que já valeram para algo assim:', ...novas.map(linhaLicao)].join('\n'));
  });
}

// ---- PostToolUseFailure ---------------------------------------------------------------------
const RE_RECUSA = /user doesn'?t want to proceed|tool use was rejected|user (denied|rejected)|rejected by (the )?user|usu[aá]rio (recusou|negou)/i;
const RE_NOSSO_BLOQUEIO = /Bloqueado pela li[cç][aã]o L\d+/;

function ignorada(cfg, nome, comando, erro) {
  return (cfg.ignorarFalhas || []).some((r) => r && typeof r === 'object'
    && (r.ferramenta || r.comando || r.erro)
    && casa(r.ferramenta, nome) && casa(r.comando, comando) && casa(r.erro, erro));
}

// Avança a janela dos pares abertos com mais um comando de shell; os que esgotam viram falha sem
// correção (não cobrada).
function avancar(s, comando) {
  for (const a of s.abertas) { a.restantes--; if (a.depois.length < MAX_DEPOIS) a.depois.push(comando); }
  s.abertas = s.abertas.filter((a) => a.restantes > 0);
}

function postToolUseFailure(ctx, entrada, sid) {
  const cfg = ctx.config;
  const nome = entrada.tool_name || '?';
  const ti = entrada.tool_input || {};
  if (entrada.is_interrupt || cfg.ignorarFerramentas.includes(nome)) return null;
  if (typeof ti.command === 'string' && chamaLicao(ti.command, { cwd: entrada.cwd || ctx.raiz, raiz: ctx.raiz })) return null;
  const erro = String(entrada.error ?? '');
  if (RE_NOSSO_BLOQUEIO.test(erro)) return null;
  const comando = alvoDe(ctx, entrada);
  if (ignorada(cfg, nome, comando, erro)) return null;
  const shell = SHELL.has(nome);
  const dados = { sid, ferramenta: nome, comando: cortar(comando, cfg.comandoMaxChars), erro: cortar(erro, cfg.erroMaxChars) };

  garantir(ctx);
  if (RE_RECUSA.test(erro)) {
    return comEstado(ctx.dir, cfg, (estado) => {
      if (shell) avancar(sessao(estado, sid), comando);
      const o = novaOcorrencia(estado, { tipo: 'recusa', ...dados, pendente: true });
      return saida('PostToolUseFailure', `O usuário recusou esta ação (${o.id}). Se houver uma regra por trás, registre: \`licao nova "<título>" --regra "<o que fazer>" --de ${o.id}\`.`);
    });
  }

  const asn = assinatura({ ferramenta: nome, comando, erro });
  const lics = listar(ctx.dir);
  // Reincidência: lição ativa com esta assinatura, ou cujo `erro` casa (e `ferramenta`/`entrada`, se houver).
  const rein = lics.filter((l) => l.estado === 'ativa' && (l.assinaturas.includes(asn.assinatura)
    || (l.erro && casa(l.erro, erro) && casa(l.ferramenta, nome, { inteira: true }) && casa(l.entrada, comando)))).sort(porImportancia)[0];
  const rasc = rein ? null : lics.find((l) => l.estado === 'rascunho' && l.assinaturas.includes(asn.assinatura));

  let mudou = false;
  const r = comEstado(ctx.dir, cfg, (estado) => {
    const s = sessao(estado, sid);
    if (shell) avancar(s, comando);
    const a = estado.assinaturas[asn.assinatura] || (estado.assinaturas[asn.assinatura] = { n: 0 });
    a.n++; a.ultima = Date.now();
    const base = { ...dados, programa: asn.programa, assinatura: asn.assinatura };

    if (rein) {
      rein.reincidencias++; rein.ocorrencias++;
      if (!rein.assinaturas.includes(asn.assinatura)) rein.assinaturas.push(asn.assinatura);
      const o = novaOcorrencia(estado, { tipo: 'reincidencia', ...base, licao: rein.id, pendente: true });
      historico(rein, `reincidência ${o.id} (sessão ${sid8(sid)}): ${encurtar(umaLinha(dados.comando), 120)} → ${encurtar(asn.linha, 120)}`);
      gravarLicao(ctx.dir, rein); mudou = true;
      a.licao = rein.id;
      return saida('PostToolUseFailure',
        `Reincidência da lição ${rein.id} — ${umaLinha(rein.titulo)}: ${umaLinha(regra(rein))}\n` +
        `Siga a regra. Se ela não bastou, melhore-a: \`licao editar ${rein.id} --regra "<...>" --de ${o.id}\`.`);
    }

    let licao = rasc ? rasc.id : null;
    let aviso = null;
    if (rasc) {
      rasc.ocorrencias++;
      historico(rasc, `ocorreu de novo (sessão ${sid8(sid)})`);
      gravarLicao(ctx.dir, rasc); mudou = true;
    } else if (a.n >= cfg.repeticoesParaRascunho && !a.licao) {
      const tit = `${nome}${asn.programa ? ' ' + asn.programa : ''}: ${encurtar(asn.linha || 'erro', 80)}`;
      const nova = novaLicao(ctx.dir, {
        titulo: tit, estado: 'rascunho', categoria: 'erro', assinaturas: [asn.assinatura], ocorrencias: a.n,
        blocoErro: blocoErro(dados.comando, dados.erro), evento: `rascunho: o mesmo erro ocorreu ${a.n}x`,
      });
      const o = novaOcorrencia(estado, { tipo: 'rascunho', ...base, licao: nova.id, pendente: true });
      nova.origem = o.id; gravarLicao(ctx.dir, nova); mudou = true;
      a.licao = licao = nova.id;
      aviso = `Este erro já ocorreu ${a.n}x neste projeto: rascunho ${nova.id} criado. Ao resolver, confirme: \`licao confirmar ${nova.id} --regra "<o que fazer>"\`.`;
    }
    const o = novaOcorrencia(estado, { tipo: 'falha', ...base, licao, pendente: false });
    a.o = o.id;
    if (shell) s.abertas.push({ o: o.id, programa: asn.programa, comando, restantes: cfg.janelaCorrecao, depois: [] });
    return saida('PostToolUseFailure', aviso);
  });
  if (mudou) gerarIndice(ctx.dir);
  return r;
}

// ---- PostToolUse (shell com sucesso) --------------------------------------------------------
const mesmoComando = (a, b) => String(a).replace(/\s+/g, ' ').trim() === String(b).replace(/\s+/g, ' ').trim();

function postToolUse(ctx, entrada, sid) {
  if (ctx.situacao === 'nova') return null;
  const ti = entrada.tool_input || {};
  if (typeof ti.command !== 'string') return null;
  if (chamaLicao(ti.command, { cwd: entrada.cwd || ctx.raiz, raiz: ctx.raiz })) return null;
  const visto = lerEstado(ctx.dir).sessoes[sid];
  if (!visto || !(visto.abertas || []).length) return null; // caminho comum: nada aberto, nenhuma trava
  const cfg = ctx.config;
  const comando = ti.command;
  const prog = assinatura({ ferramenta: entrada.tool_name || 'Bash', comando, erro: '' }).programa;

  let mudou = false, fechada = null;
  comEstado(ctx.dir, cfg, (estado) => {
    const s = sessao(estado, sid);
    const par = [...s.abertas].reverse().find((a) => (a.programa && a.programa === prog) || mesmoComando(a.comando, comando));
    if (!par) { avancar(s, comando); return; }
    // Comando idêntico ao que falhou: o que corrigiu foram os comandos entre os dois.
    const igual = mesmoComando(par.comando, comando);
    const passos = igual ? (par.depois.length ? par.depois : [comando]) : [comando];
    const correcao = cortar(passos.join('\n'), cfg.comandoMaxChars * 2);
    // O par fechado e os mais antigos do mesmo programa saem; os outros seguem na janela.
    s.abertas = s.abertas.filter((a) => a !== par && !(a.programa && a.programa === par.programa));
    avancar(s, comando);
    const o = estado.ocorrencias[par.o];
    if (!o) return;
    Object.assign(o, { tipo: 'correcao', correcao, pendente: true });
    fechada = { ...o };
    if (o.licao) {
      const l = listar(ctx.dir).find((x) => x.id === o.licao && x.estado === 'rascunho');
      if (l) {
        if (!secao(l, 'Correção')) definirSecao(l, 'Correção', cerca(correcao, /powershell/i.test(o.ferramenta) ? 'powershell' : 'bash'));
        historico(l, `corrigido na sessão ${sid8(sid)} (${o.id})`);
        gravarLicao(ctx.dir, l); mudou = true;
      }
    }
  });
  if (mudou) gerarIndice(ctx.dir);
  // O id vai ao agente agora: sem ele, `licao nova` sai sem --de e o Stop cobra a mesma pendência.
  if (!fechada) return null;
  return saida('PostToolUse', `Erro corrigido (${fechada.id}). Se ensina algo, registre: ${comoResolver(fechada)} ` +
    `(ou \`licao descartar ${fechada.id} --porque "<motivo>"\`).` + comandoCli(ctx));
}

// ---- Stop -----------------------------------------------------------------------------------
const ROTULO = {
  correcao: 'erro corrigido', 'correcao-usuario': 'correção do usuário', aprendizado: 'pedido para lembrar',
  recusa: 'ação recusada', reincidencia: 'reincidência', rascunho: 'rascunho novo',
};

export function descrever(o) {
  const det = [];
  if (o.comando) det.push(`\`${encurtar(umaLinha(o.comando), 100)}\``);
  if (o.erro) det.push(`→ ${encurtar(umaLinha(o.erro.replace(/^Exit code -?\d+\s*/i, '')), 120)}`);
  if (o.correcao) det.push(`corrigido com \`${encurtar(umaLinha(o.correcao), 100)}\``);
  if (o.prompt) det.push(`"${encurtar(umaLinha(o.prompt), 160)}"`);
  return `${o.id} (${ROTULO[o.tipo] || o.tipo}${o.licao ? ', ' + o.licao : ''}): ${det.join(' ')}`;
}

export function comoResolver(o) {
  // Correção com lição é sempre de um rascunho (a falha só leva `licao` quando caiu num rascunho).
  if (o.tipo === 'rascunho' || (o.tipo === 'correcao' && o.licao)) return `\`licao confirmar ${o.licao} --regra "<o que fazer>" --de ${o.id}\``;
  if (o.tipo === 'reincidencia') return `\`licao editar ${o.licao} --regra "<regra melhor>" --de ${o.id}\``;
  return `\`licao nova "<título>" --regra "<o que fazer>" --de ${o.id}\``;
}

function stop(ctx, entrada, sid) {
  const cfg = ctx.config;
  if (!cfg.bloquearStop || entrada.stop_hook_active || ctx.situacao === 'nova') return null;
  const visto = lerEstado(ctx.dir);
  const s0 = visto.sessoes[sid];
  if (!pendentes(visto, sid).some((o) => !(s0 && (s0.cobradas || []).includes(o.id)))) return null;
  return comEstado(ctx.dir, cfg, (estado) => {
    const s = sessao(estado, sid);
    const lista = pendentes(estado, sid).filter((o) => !s.cobradas.includes(o.id)).slice(0, cfg.pendentesPorBloqueio);
    if (!lista.length) return null;
    s.cobradas.push(...lista.map((o) => o.id));
    return {
      decision: 'block',
      reason: [
        'Antes de encerrar: esta sessão tem ocorrências que podem virar lição do projeto (pedido uma vez só).',
        ...lista.map((o) => `- ${descrever(o)}\n  registrar: ${comoResolver(o)}`),
        `Se não ensina nada: \`licao descartar ${lista.map((o) => o.id).join(' ')} --porque "<motivo>"\`.`,
        'Regra boa: diz o que FAZER, curta, verificável; use --entrada "<regex do comando>" para avisar antes da próxima vez.',
      ].join('\n') + comandoCli(ctx),
    };
  });
}

// ---- SessionEnd -----------------------------------------------------------------------------
function sessionEnd(ctx, entrada, sid) {
  if (ctx.situacao === 'nova' || !lerEstado(ctx.dir).sessoes[sid]) return null;
  comEstado(ctx.dir, ctx.config, (estado) => { delete estado.sessoes[sid]; });
  return null;
}

const TRATADORES = {
  SessionStart: sessionStart,
  UserPromptSubmit: userPromptSubmit,
  PreToolUse: preToolUse,
  PostToolUse: postToolUse,
  PostToolUseFailure: postToolUseFailure,
  Stop: stop,
  SessionEnd: sessionEnd,
};
