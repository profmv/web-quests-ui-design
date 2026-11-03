// Adaptador Antigravity (Gemini Flash 3.8, Pro, Argon) <-> Claude Code para hooks e transcritos.
// Preserva 100% de compatibilidade com payloads nativos do Claude Code e traduz eventos/payloads
// do Antigravity (PreInvocation, PreToolUse, PostToolUse, PostInvocation, Stop).
import { existsSync, mkdirSync, openSync, readSync, closeSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const PASTA_ESTADO_AGY = join(tmpdir(), 'agy-claude-hooks-state');

export function ehEntradaAgy(e, argEv = '') {
  if (!e || typeof e !== 'object') return false;
  if (e.hook_event_name) return false;
  if (['PreInvocation', 'PostInvocation', 'PreToolUse', 'PostToolUse', 'Stop'].includes(argEv)) return true;
  return (
    e.conversationId !== undefined ||
    e.transcriptPath !== undefined ||
    e.workspacePaths !== undefined ||
    e.toolCall !== undefined ||
    e.invocationNum !== undefined ||
    e.executionNum !== undefined ||
    e.terminationReason !== undefined
  );
}

export function uriParaCaminho(u) {
  if (!u || typeof u !== 'string') return '';
  if (!u.startsWith('file://')) return u;
  try { return fileURLToPath(u); } catch {
    return decodeURIComponent(u.replace(/^file:\/\/\/?/, '')).replace(/\//g, process.platform === 'win32' ? '\\' : '/');
  }
}

export function ehPastaInternaGemini(p) {
  if (!p || typeof p !== 'string') return true;
  const norm = p.replace(/\\/g, '/').toLowerCase();
  return (
    norm.includes('/.gemini/config/plugins') ||
    norm.includes('/.gemini/antigravity/plugins') ||
    norm.includes('/.gemini/antigravity/brain') ||
    norm.includes('/.gemini/antigravity-ide/brain')
  );
}

function caminhoEstadoSessao(sid) {
  const seguro = String(sid || 'default').replace(/[^\w.-]/g, '_');
  mkdirSync(PASTA_ESTADO_AGY, { recursive: true });
  return join(PASTA_ESTADO_AGY, `${seguro}.json`);
}

export function lerEstadoAgy(sid) {
  const arq = caminhoEstadoSessao(sid);
  try {
    if (existsSync(arq)) return JSON.parse(readFileSync(arq, 'utf8'));
  } catch { /* estado corrompido ou concorrente */ }
  return {
    sessionStarted: {},
    ultimoUserStep: {},
    cwd: '',
    steps: {},
    ultimoStep: null,
    filaContexto: {},
  };
}

export function salvarEstadoAgy(sid, st) {
  const arq = caminhoEstadoSessao(sid);
  try {
    writeFileSync(arq, JSON.stringify(st), 'utf8');
  } catch { /* silêncio */ }
}

export function enfileirarContextoAgy(sid, plugin, msg) {
  if (!msg || !sid) return;
  const st = lerEstadoAgy(sid);
  if (!Array.isArray(st.filaContexto[plugin])) st.filaContexto[plugin] = [];
  if (!st.filaContexto[plugin].includes(msg)) st.filaContexto[plugin].push(msg);
  salvarEstadoAgy(sid, st);
}

export function descarregarContextoAgy(sid, plugin) {
  if (!sid) return [];
  const st = lerEstadoAgy(sid);
  const msgs = Array.isArray(st.filaContexto[plugin]) ? st.filaContexto[plugin] : [];
  if (msgs.length) {
    st.filaContexto[plugin] = [];
    salvarEstadoAgy(sid, st);
  }
  return msgs;
}

export function normalizarModeloAgy(modelName) {
  const m = String(modelName || '').trim();
  if (!m || m === 'auto') return 'Gemini (Antigravity)';
  const b = m.toLowerCase();
  if (b.includes('argon')) return `Gemini Argon (${m})`;
  if (b.includes('3.8') || b.includes('flash')) return `Gemini Flash 3.8 (${m})`;
  if (b.includes('pro')) return `Gemini Pro (${m})`;
  return m;
}

export function resolverCwdAgy(e, st) {
  const candidatos = [];
  if (Array.isArray(e.workspacePaths)) {
    for (const w of e.workspacePaths) {
      const c = uriParaCaminho(w);
      if (c && !ehPastaInternaGemini(c)) candidatos.push(c);
    }
  }
  const args = e.toolCall?.args || {};
  for (const c of [args.Cwd, args.cwd, args.DirectoryPath, args.SearchPath, args.SearchDirectory]) {
    if (c && typeof c === 'string' && !ehPastaInternaGemini(c)) candidatos.push(c);
  }
  for (const f of [args.TargetFile, args.AbsolutePath, args.file_path]) {
    if (f && typeof f === 'string') {
      const d = dirname(f);
      if (d && !ehPastaInternaGemini(d)) candidatos.push(d);
    }
  }
  if (st && st.cwd && !ehPastaInternaGemini(st.cwd)) candidatos.push(st.cwd);
  if (e.cwd && !ehPastaInternaGemini(e.cwd)) candidatos.push(e.cwd);
  const escolhido = candidatos.find((c) => {
    try { return existsSync(c); } catch { return false; }
  }) || candidatos[0] || '';
  if (escolhido && st && st.cwd !== escolhido) {
    st.cwd = escolhido;
  }
  return escolhido;
}

export function mapearFerramentaAgy(toolCall, cwdPadrao = '') {
  if (!toolCall || typeof toolCall !== 'object') return { tool_name: '', tool_input: {}, cwd: cwdPadrao };
  const nome = String(toolCall.name || '');
  const args = toolCall.args && typeof toolCall.args === 'object' ? toolCall.args : {};
  if (nome === 'run_command') {
    const cmd = String(args.CommandLine ?? args.command ?? '');
    const cwd = String(args.Cwd || args.cwd || cwdPadrao || '');
    const ehBash = /^\s*(?:bash|sh|zsh)\b/i.test(cmd);
    return {
      tool_name: process.platform === 'win32' && !ehBash ? 'PowerShell' : 'Bash',
      raw_name: nome,
      tool_input: {
        command: cmd,
        description: String(args.toolSummary || args.toolAction || args.description || ''),
      },
      cwd,
    };
  }
  if (nome === 'write_to_file') {
    return {
      tool_name: 'Write',
      raw_name: nome,
      tool_input: {
        file_path: String(args.TargetFile || args.file_path || ''),
        content: String(args.CodeContent ?? args.content ?? ''),
      },
      cwd: cwdPadrao,
    };
  }
  if (nome === 'replace_file_content') {
    return {
      tool_name: 'Edit',
      raw_name: nome,
      tool_input: {
        file_path: String(args.TargetFile || args.file_path || ''),
        old_string: String(args.TargetContent ?? args.old_string ?? ''),
        new_string: String(args.ReplacementContent ?? args.new_string ?? ''),
      },
      cwd: cwdPadrao,
    };
  }
  if (nome === 'multi_replace_file_content') {
    const chunks = Array.isArray(args.ReplacementChunks) ? args.ReplacementChunks : [];
    return {
      tool_name: 'MultiEdit',
      raw_name: nome,
      tool_input: {
        file_path: String(args.TargetFile || args.file_path || ''),
        edits: chunks.map((c) => ({
          old_string: String(c.TargetContent ?? c.old_string ?? ''),
          new_string: String(c.ReplacementContent ?? c.new_string ?? ''),
        })),
      },
      cwd: cwdPadrao,
    };
  }
  if (nome === 'invoke_subagent') {
    const sub = Array.isArray(args.Subagents) && args.Subagents[0] ? args.Subagents[0] : {};
    return {
      tool_name: 'Agent',
      raw_name: nome,
      tool_input: {
        subagent_type: String(sub.TypeName || args.subagent_type || 'subagent'),
        model: String(sub.Model || args.model || ''),
        description: String(sub.Role || args.toolSummary || args.description || ''),
        prompt: String(sub.Prompt || args.prompt || ''),
      },
      cwd: cwdPadrao,
    };
  }
  if (nome === 'view_file') {
    return { tool_name: 'Read', raw_name: nome, tool_input: { file_path: String(args.AbsolutePath || args.file_path || '') }, cwd: cwdPadrao };
  }
  if (nome === 'list_dir') {
    return { tool_name: 'LS', raw_name: nome, tool_input: { path: String(args.DirectoryPath || args.path || '') }, cwd: cwdPadrao };
  }
  if (nome === 'grep_search') {
    return { tool_name: 'Grep', raw_name: nome, tool_input: { pattern: String(args.Query || args.pattern || ''), path: String(args.SearchPath || args.path || '') }, cwd: cwdPadrao };
  }
  if (nome === 'find_by_name') {
    return { tool_name: 'Glob', raw_name: nome, tool_input: { pattern: String(args.Pattern || args.pattern || ''), path: String(args.SearchDirectory || args.path || '') }, cwd: cwdPadrao };
  }
  if (nome === 'call_mcp_tool') {
    const srv = String(args.ServerName || 'mcp');
    const tl = String(args.ToolName || 'tool');
    const mcpArgs = args.Arguments && typeof args.Arguments === 'object' ? args.Arguments : {};
    if (srv === 'context-mode' && tl === 'ctx_execute' && (!mcpArgs.language || mcpArgs.language === 'shell')) {
      return {
        tool_name: 'Bash',
        raw_name: nome,
        tool_input: {
          command: String(mcpArgs.code || ''),
          description: String(args.toolSummary || 'ctx_execute shell'),
        },
        cwd: cwdPadrao,
      };
    }
    return {
      tool_name: `mcp__${srv}__${tl}`,
      raw_name: nome,
      tool_input: mcpArgs,
      cwd: cwdPadrao,
    };
  }
  return {
    tool_name: nome,
    raw_name: nome,
    tool_input: args,
    cwd: cwdPadrao,
  };
}

function lerCaudaJsonl(caminho, maxBytes = 512 * 1024) {
  if (!caminho || !existsSync(caminho)) return [];
  let fd;
  try {
    const tam = statSync(caminho).size;
    if (!tam) return [];
    const ini = Math.max(0, tam - maxBytes);
    const len = tam - ini;
    fd = openSync(caminho, 'r');
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, ini);
    let txt = buf.toString('utf8');
    if (ini > 0) {
      const nl = txt.indexOf('\n');
      if (nl >= 0) txt = txt.slice(nl + 1);
    }
    const objs = [];
    for (const l of txt.split('\n')) {
      if (!l.trim()) continue;
      try { objs.push(JSON.parse(l)); } catch { /* linha truncada */ }
    }
    return objs;
  } catch { return []; } finally { if (fd !== undefined) closeSync(fd); }
}

export function extrairUltimoPedidoUsuario(transcriptPath) {
  const objs = lerCaudaJsonl(transcriptPath);
  for (let i = objs.length - 1; i >= 0; i--) {
    const j = objs[i];
    if (j.type === 'USER_INPUT' && typeof j.content === 'string') {
      const m = j.content.match(/<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/i);
      const texto = (m ? m[1] : j.content).trim();
      if (texto) return { stepIdx: j.step_index ?? i, prompt: texto };
    }
  }
  return null;
}

export function extrairUltimaRespostaAssistente(transcriptPath) {
  const objs = lerCaudaJsonl(transcriptPath);
  for (let i = objs.length - 1; i >= 0; i--) {
    const j = objs[i];
    if (j.type === 'PLANNER_RESPONSE' && typeof j.content === 'string' && j.content.trim()) {
      return j.content.trim();
    }
  }
  return '';
}

export function extrairSaidaPasso(transcriptPath, stepIdx, erroHook = '') {
  const fullPath = transcriptPath ? transcriptPath.replace(/transcript\.jsonl$/i, 'transcript_full.jsonl') : '';
  const fonte = existsSync(fullPath) ? fullPath : transcriptPath;
  const objs = lerCaudaJsonl(fonte, 1024 * 1024);
  let alvo = null;
  if (stepIdx !== undefined && stepIdx !== null) {
    for (let i = objs.length - 1; i >= 0; i--) {
      if (objs[i].step_index === stepIdx && objs[i].type !== 'PLANNER_RESPONSE' && objs[i].type !== 'USER_INPUT') {
        alvo = objs[i];
        break;
      }
    }
  }
  if (!alvo) {
    for (let i = objs.length - 1; i >= 0; i--) {
      if (objs[i].type !== 'PLANNER_RESPONSE' && objs[i].type !== 'USER_INPUT') {
        alvo = objs[i];
        break;
      }
    }
  }
  let bruto = typeof alvo?.content === 'string' ? alvo.content : '';
  // Se a saída foi salva em arquivo externo (.system_generated/steps/.../output.txt), lê de lá.
  const mArq = bruto.match(/saved to:\s*(file:\/\/\/[^\s\r\n]+)/i);
  if (mArq) {
    const pArq = uriParaCaminho(mArq[1]);
    try {
      if (pArq && existsSync(pArq)) {
        const fd = openSync(pArq, 'r');
        const b = Buffer.alloc(Math.min(statSync(pArq).size, 256 * 1024));
        readSync(fd, b, 0, b.length, 0);
        closeSync(fd);
        bruto = b.toString('utf8');
      }
    } catch { /* mantém bruto */ }
  }
  let exitCode = 0;
  let stdout = bruto;
  const mCmd = bruto.match(/The command exited with code (-?\d+)\.\r?\nOutput:\r?\n([\s\S]*)/i);
  if (mCmd) {
    exitCode = Number(mCmd[1]);
    stdout = mCmd[2];
  } else {
    stdout = bruto.replace(/^Created At:[^\n]*\n(?:Completed At:[^\n]*\n)?\s*/i, '');
  }
  const falhou = Boolean(erroHook) || alvo?.status === 'ERROR' || exitCode !== 0;
  const msgErro = erroHook || (falhou ? (stdout || bruto || `Exit code ${exitCode}`) : '');
  return {
    falhou,
    exitCode: falhou && exitCode === 0 ? 1 : exitCode,
    stdout,
    stderr: falhou ? msgErro : '',
    error: msgErro,
  };
}

export function inferirEventoAgy(e, argEv = '') {
  if (['PreInvocation', 'PostInvocation', 'PreToolUse', 'PostToolUse', 'Stop'].includes(argEv)) return argEv;
  if (e.toolCall) return 'PreToolUse';
  if (e.stepIdx !== undefined && !e.toolCall) return 'PostToolUse';
  if (e.terminationReason !== undefined || e.executionNum !== undefined || e.fullyIdle !== undefined) return 'Stop';
  if (e.invocationNum !== undefined) return 'PreInvocation';
  return 'PostInvocation';
}

// Converte um evento Antigravity em uma lista de eventos no formato Claude Code para `tratarHook`.
export function converterParaEventosClaude(e, argEv = '', pluginName = 'plugin') {
  const evAgy = inferirEventoAgy(e, argEv);
  const sid = String(e.conversationId || e.session_id || 'agy-session');
  const st = lerEstadoAgy(sid);
  const cwd = resolverCwdAgy(e, st);
  const transcript_path = String(e.transcriptPath || e.transcript_path || '');
  const model = normalizarModeloAgy(e.modelName || e.model);
  const base = { session_id: sid, transcript_path, cwd, model };
  const eventos = [];

  if (evAgy === 'PreInvocation') {
    if (e.invocationNum === 1 || (transcript_path && st.transcriptPath && st.transcriptPath !== transcript_path)) {
      st.sessionStarted[pluginName] = false;
      delete st.ultimoUserStep[pluginName];
    }
    if (transcript_path) st.transcriptPath = transcript_path;
    if (!st.sessionStarted[pluginName]) {
      st.sessionStarted[pluginName] = true;
      eventos.push({
        ...base,
        hook_event_name: 'SessionStart',
        source: 'startup',
      });
    }
    const u = extrairUltimoPedidoUsuario(transcript_path);
    if (u && st.ultimoUserStep[pluginName] !== u.stepIdx) {
      st.ultimoUserStep[pluginName] = u.stepIdx;
      eventos.push({
        ...base,
        hook_event_name: 'UserPromptSubmit',
        prompt: u.prompt,
      });
    }
    salvarEstadoAgy(sid, st);
    return { evAgy, sid, cwd, eventos };
  }

  if (evAgy === 'PreToolUse') {
    const map = mapearFerramentaAgy(e.toolCall, cwd);
    const stepKey = String(e.stepIdx ?? 'ultimo');
    const info = {
      tool_name: map.tool_name,
      raw_name: map.raw_name,
      tool_input: map.tool_input,
      cwd: map.cwd || cwd,
      stepIdx: e.stepIdx,
      t: Date.now(),
    };
    st.steps[stepKey] = info;
    st.ultimoStep = info;
    if (info.cwd && !ehPastaInternaGemini(info.cwd)) st.cwd = info.cwd;
    salvarEstadoAgy(sid, st);
    eventos.push({
      ...base,
      cwd: info.cwd || cwd,
      hook_event_name: 'PreToolUse',
      tool_name: info.tool_name,
      tool_input: info.tool_input,
      tool_use_id: `agy-${sid}-${stepKey}`,
    });
    return { evAgy, sid, cwd: info.cwd || cwd, eventos };
  }

  if (evAgy === 'PostToolUse') {
    const stepKey = String(e.stepIdx ?? 'ultimo');
    const info = st.steps[stepKey] || st.ultimoStep || { tool_name: 'PowerShell', tool_input: {}, cwd };
    delete st.steps[stepKey];
    salvarEstadoAgy(sid, st);
    const res = extrairSaidaPasso(transcript_path, e.stepIdx, e.error || '');
    if (res.falhou) {
      eventos.push({
        ...base,
        cwd: info.cwd || cwd,
        hook_event_name: 'PostToolUseFailure',
        tool_name: info.tool_name,
        tool_input: info.tool_input,
        tool_use_id: `agy-${sid}-${stepKey}`,
        error: res.error,
        tool_response: { stdout: res.stdout, stderr: res.stderr, exit_code: res.exitCode },
      });
    } else {
      eventos.push({
        ...base,
        cwd: info.cwd || cwd,
        hook_event_name: 'PostToolUse',
        tool_name: info.tool_name,
        tool_input: info.tool_input,
        tool_use_id: `agy-${sid}-${stepKey}`,
        tool_response: { stdout: res.stdout, stderr: '', exit_code: 0 },
      });
    }
    return { evAgy, sid, cwd: info.cwd || cwd, eventos };
  }

  if (evAgy === 'PostInvocation') {
    eventos.push({
      ...base,
      hook_event_name: 'PostToolBatch',
    });
    return { evAgy, sid, cwd, eventos };
  }

  if (evAgy === 'Stop') {
    const lastMsg = e.last_assistant_message || extrairUltimaRespostaAssistente(transcript_path);
    eventos.push({
      ...base,
      hook_event_name: 'Stop',
      stop_hook_active: false,
      last_assistant_message: lastMsg,
      reason: e.terminationReason || 'model_stop',
    });
    return { evAgy, sid, cwd, eventos };
  }

  return { evAgy, sid, cwd, eventos };
}

export function traduzirSaidaParaAgy(evAgy, saidasClaude, sid, pluginName = 'plugin') {
  const validas = (saidasClaude || []).filter(Boolean);
  if (evAgy === 'PreToolUse') {
    for (const s of validas) {
      const h = s.hookSpecificOutput || {};
      if (h.permissionDecision === 'deny') {
        return { decision: 'deny', reason: h.permissionDecisionReason || 'Bloqueado pelo plugin.' };
      }
      if (h.permissionDecision === 'ask') {
        return { decision: 'ask', reason: h.permissionDecisionReason || '' };
      }
      if (h.additionalContext) {
        enfileirarContextoAgy(sid, pluginName, h.additionalContext);
        return { decision: 'allow', reason: h.additionalContext };
      }
    }
    return { decision: 'allow' };
  }

  if (evAgy === 'PostToolUse') {
    for (const s of validas) {
      const h = s.hookSpecificOutput || {};
      if (h.additionalContext) enfileirarContextoAgy(sid, pluginName, h.additionalContext);
    }
    return {};
  }

  if (evAgy === 'PreInvocation' || evAgy === 'PostInvocation') {
    const msgs = [...descarregarContextoAgy(sid, pluginName)];
    for (const s of validas) {
      const h = s.hookSpecificOutput || {};
      if (h.additionalContext && !msgs.includes(h.additionalContext)) msgs.push(h.additionalContext);
    }
    if (msgs.length) {
      return { injectSteps: [{ ephemeralMessage: msgs.join('\n\n') }] };
    }
    return {};
  }

  if (evAgy === 'Stop') {
    for (const s of validas) {
      if (s.decision === 'block') {
        return { decision: 'continue', reason: s.reason || 'Ação pendente antes de encerrar.' };
      }
    }
    return { decision: 'allow' };
  }

  return {};
}
