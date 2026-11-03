// Padrões do plugin. É o ÚNICO lugar onde eles valem: docs/CONFIGURACAO.md aponta para cá.
// O projeto sobrepõe só as chaves que quiser em scripts/licoes/config.json.
// Padrões de texto (padroesCorrecao, padroesAprendizado) casam o prompt em minúsculas e SEM acento.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const PASTA_LICOES = 'docs/licoes';
export const PASTA_SCRIPTS = 'scripts/licoes';
// Afirmação de posse no topo do README.md da pasta. Pasta com conteúdo e sem ela é do projeto: o
// plugin não grava nada (docs/DECISOES.md, D1).
export const MARCADOR = '[Gerido pelo plugin gerador-licoes-projeto]';
export const LINHAS_MARCADOR = 5;

export const PADROES = {
  modo: 'proprio',               // 'proprio' grava; 'desligado' não faz nada
  contextoInicial: true,         // SessionStart injeta as regras principais
  contextoMaxLicoes: 8,          // quantas regras vão no SessionStart
  licoesPorPrompt: 3,            // lições injetadas por prompt (por tag citada), sem repetir na sessão
  avisarAntes: true,             // PreToolUse avisa quando o comando/caminho casa o `entrada` de uma lição
  bloquearStop: true,            // fim de turno com pendências pede UMA vez que o agente registre ou descarte
  pendentesPorBloqueio: 5,
  repeticoesParaRascunho: 2,     // mesma assinatura de erro N vezes (qualquer sessão) vira rascunho de lição
  janelaCorrecao: 6,             // sucesso do mesmo programa até N comandos depois da falha conta como correção
  erroMaxChars: 1500,
  comandoMaxChars: 600,
  promptMaxChars: 500,
  padroesCorrecao: [
    String.raw`\bnao (era|e|foi) (isso|assim|o que (eu )?pedi)\b`,
    String.raw`\b(esta|ta|isso esta|isso ta|ficou) errad[oa]\b`,
    String.raw`\bvoce (esqueceu|errou|ignorou|quebrou|apagou|nao (leu|seguiu|fez))\b`,
    String.raw`\bja (te )?(falei|disse|pedi|avisei)\b`,
    String.raw`\b(nao|ainda nao) funcion(ou|a)\b`,
    String.raw`\b(continua|segue|ainda esta) (dando|com) (o mesmo )?(erro|problema|falha)\b`,
    String.raw`\b(de novo|outra vez) (o mesmo )?(erro|problema)\b`,
    String.raw`\bthat'?s (wrong|not (it|right|what i (asked|wanted)))\b`,
    String.raw`\byou (forgot|broke|missed|ignored|didn'?t (read|follow))\b`,
    String.raw`\b(still|again) (failing|broken|not working)\b`,
    String.raw`\bi (already|just) (told|said|asked)\b`,
    String.raw`\b(doesn'?t|didn'?t|does not|did not) work\b`,
  ],
  padroesAprendizado: [
    String.raw`\b(aprenda|lembre(-se)?|memorize|anote|guarde) (disso|isso|que|esta)\b`,
    String.raw`\bregistr[ea] (isso |isto )?(como|numa|uma|em) licao\b`,
    String.raw`\bnunca mais\b`,
    String.raw`\b(sempre|nunca) (faca|use|rode|esqueca|apague|mude|edite|commite)\b`,
    String.raw`\b(remember|learn|note) (this|that)\b`,
    String.raw`\bnever (do|use|run|edit|delete) (that|this|it) again\b`,
    String.raw`\b(always|never) (use|run|do|edit|delete|forget)\b`,
  ],
  // Falha que não ensina nada: casa todas as chaves presentes (regex, sem distinguir maiúsculas).
  ignorarFalhas: [
    { ferramenta: '^(Bash|PowerShell)$', comando: String.raw`^\s*(grep|egrep|fgrep|rg|findstr|select-string|diff|cmp|test|\[|which|where|where\.exe|command\s+-v|git\s+(diff|grep))\b`, erro: '^Exit code 1\\b' },
    { ferramenta: '^(Edit|MultiEdit|Write|NotebookEdit)$', erro: 'String to replace not found|has not been read|modified since (it was )?read|Found \\d+ matches' },
    { erro: 'requested permissions|haven\'t granted it yet' },
  ],
  ignorarFerramentas: ['Read', 'Grep', 'Glob', 'LS', 'NotebookRead', 'TodoWrite', 'ToolSearch', 'TaskList', 'TaskGet', 'TaskOutput', 'TaskStop', 'BashOutput', 'KillShell', 'WebFetch', 'WebSearch', 'Agent', 'Task', 'AskUserQuestion', 'ExitPlanMode'],
  travaEsperaMs: 5000,
  travaVelhaMs: 10000,
};

export function carregarConfig(raiz) {
  let proj = {};
  try { proj = JSON.parse(readFileSync(join(raiz, PASTA_SCRIPTS, 'config.json'), 'utf8').replace(/^\uFEFF/, '')); } catch { /* sem config: padrões */ }
  return { ...PADROES, ...(proj && typeof proj === 'object' && !Array.isArray(proj) ? proj : {}) };
}
