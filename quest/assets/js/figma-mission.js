/** Guided Figma mission. Drafts are local and independent from the WQ2 progress format. */
import { el, baixar } from './ui.js';

const briefs = [
  { text: 'O evento se chama "Mostra de projetos de tecnologia e criatividade do campus". Testem o título completo em até três linhas.', question: 'Como o card deve lidar com esse título?', correct: 'grow', options: [['cut', 'Cortar o título para preservar a altura'], ['grow', 'Permitir que o card cresça com o texto']], wrong: 'Cortar o título esconde informação. Permitam que o conteúdo cresça e testem novamente.' },
  { text: 'O evento está esgotado. A disponibilidade precisa ser compreendida sem depender apenas da cor.', question: 'Como comunicar a disponibilidade?', correct: 'label', options: [['color', 'Usar apenas uma cor diferente'], ['label', 'Mostrar o texto "Esgotado" junto ao estado visual']], wrong: 'A cor isolada pode não ser percebida. Acrescentem uma indicação textual e tentem novamente.' },
  { text: 'A tela do evento tem 320 px de largura. Data e ação devem ficar visíveis sem rolagem horizontal.', question: 'Como adaptar o card para essa tela?', correct: 'fit', options: [['fixed', 'Manter um card fixo mais largo que a tela'], ['fit', 'Ajustar a largura do card ao espaço disponível']], wrong: 'Uma largura fixa maior que a tela exige rolagem horizontal. Ajustem o card e tentem novamente.' }
];
const coaching = {
  texto: ['Observem a hierarquia e o espaço disponível para o título.', 'No Auto Layout, permitam que o conteúdo cresça e testem um título de três linhas. Confiram o resultado no slide 3.'],
  estado: ['A ação precisa comunicar o que acontece antes e depois do clique.', 'Criem estados identificáveis com texto e conectem uma ação a uma resposta visível. Revisem os slides 6 e 7.'],
  espaco: ['Procurem desalinhamentos e espaços inconsistentes no card.', 'Agrupem conteúdo com Auto Layout e usem múltiplos de 8 px; testem uma largura estreita. Revisem os slides 12 a 14.']
};
const resources = {
  frame: 'https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design',
  auto: 'https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma',
  variants: 'https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants',
  prototype: 'https://help.figma.com/hc/en-us/articles/360040314193-Guide-to-prototyping-in-Figma',
  share: 'https://help.figma.com/hc/en-us/articles/360040531773-Share-files-and-prototypes'
};

function isFigmaFile(value) {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' &&
      (url.hostname === 'figma.com' || url.hostname === 'www.figma.com') &&
      !url.username && !url.password &&
      /^\/(?:design|proto|file)\/[A-Za-z0-9]+(?:\/|$)/.test(url.pathname);
  } catch {
    return false;
  }
}

function draftKey(identity) {
  return `estudio-oito:figma:v1:${encodeURIComponent(identity)}`;
}

export function apagarRascunhoFigma({ team, startedAt }) {
  try {
    localStorage.removeItem(draftKey(JSON.stringify([team, startedAt])));
  } catch {
    /* Storage may be unavailable. */
  }
}

export function montarMissaoFigma({ team, startedAt, abrirSlide }) {
  const identity = JSON.stringify([team, startedAt]);
  let hash = 2166136261;
  for (const ch of identity) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  const brief = briefs[(hash >>> 0) % briefs.length];
  const key = draftKey(identity);
  const defaults = { choice: '', hints: 0, decision: '', link: '', fallback: '', reflection: '', checks: [] };
  let data = { ...defaults };
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && saved.v === 1 && saved.identity === identity) {
      const stored = saved.data && typeof saved.data === 'object' ? saved.data : {};
      data.choice = Object.hasOwn(coaching, stored.choice) ? stored.choice : '';
      data.hints = Number.isInteger(stored.hints) ? Math.max(0, Math.min(2, stored.hints)) : 0;
      data.decision = brief.options.some(([value]) => value === stored.decision) ? stored.decision : '';
      for (const name of ['link', 'fallback', 'reflection']) data[name] = typeof stored[name] === 'string' ? stored[name] : '';
      data.checks = Array.isArray(stored.checks) ? [...new Set(stored.checks.filter((n) => Number.isInteger(n) && n >= 0 && n < 5))] : [];
    }
  } catch { /* Start with a fresh draft when storage is unavailable or invalid. */ }
  const status = el('p', { class: 'fm-save', role: 'status', 'aria-live': 'polite' });
  function save() {
    try {
      localStorage.setItem(key, JSON.stringify({ v: 1, identity, data }));
      status.textContent = 'Rascunho salvo neste navegador.';
    } catch {
      status.textContent = 'Não foi possível salvar neste navegador. Baixem a entrega antes de sair.';
    }
  }
  const link = (label, url) => el('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, [label, ' (abre em outra aba)']);
  const slide = (n) => el('button', { type: 'button', class: 'fm-slide', onclick: () => abrirSlide(n) }, [`Consultar slide ${n}`]);
  const step = (number, title, body, links) => el('li', { class: 'fm-step' }, [
    el('span', { class: 'fm-number', text: number }), el('div', {}, [el('h3', { text: title }), el('p', { text: body }), el('p', { class: 'fm-links' }, links)])
  ]);
  const choice = el('select', { id: 'fm-choice' }, [el('option', { value: '', text: 'Escolham uma dificuldade' }),
    el('option', { value: 'texto', text: 'Título e hierarquia' }), el('option', { value: 'estado', text: 'Ação e estados' }), el('option', { value: 'espaco', text: 'Espaçamento e adaptação' })]);
  choice.value = data.choice;
  const feedback = el('div', { class: 'fm-feedback', 'aria-live': 'polite' });
  const hintButton = el('button', { type: 'button', class: 'btn btn-secondary btn-sm', text: 'Pedir próxima dica' });
  function updateFeedback() {
    feedback.replaceChildren();
    if (!data.choice) feedback.append(el('p', { text: 'Escolham a maior dificuldade para receber uma intervenção.' }));
    else {
      feedback.append(el('p', { text: `Foco da revisão: ${choice.selectedOptions[0].textContent}. Experimentem uma alteração e testem novamente.` }));
      coaching[data.choice].slice(0, data.hints).forEach((hint, i) => feedback.append(el('p', { text: `Dica ${i + 1}: ${hint}` })));
    }
    hintButton.disabled = !data.choice || data.hints >= 2;
  }
  choice.addEventListener('change', () => { data.choice = choice.value; data.hints = 0; updateFeedback(); save(); });
  hintButton.addEventListener('click', () => { data.hints = Math.min(2, data.hints + 1); updateFeedback(); save(); });
  updateFeedback();
  const labels = ['Frame e camadas nomeadas tornam a estrutura compreensível.', 'Auto Layout mantém conteúdo e espaçamento quando o card muda.', 'Componente ou instância apresenta estados identificáveis.', 'Protótipo conecta uma ação a uma resposta visível.', 'A restrição do cliente foi testada e revisada.'];
  const checklist = labels.map((label, i) => {
    const box = el('input', { type: 'checkbox', id: `fm-check-${i}` });
    box.checked = data.checks.includes(i);
    box.addEventListener('change', () => { data.checks = labels.map((_, n) => n).filter((n) => document.getElementById(`fm-check-${n}`)?.checked); updateExport(); save(); });
    return el('label', { class: 'fm-check', for: `fm-check-${i}` }, [box, label]);
  });
  function field(id, label, value, placeholder, multiline = false) {
    const input = el(multiline ? 'textarea' : 'input', { id, ...(multiline ? { rows: 3 } : { type: 'text' }), placeholder });
    input.value = typeof value === 'string' ? value : '';
    const property = id.slice(3);
    input.addEventListener('input', () => { data[property] = input.value; updateExport(); save(); });
    return el('div', { class: 'fm-field' }, [el('label', { for: id, text: label }), input]);
  }
  const decision = el('select', { id: 'fm-decision' }, [el('option', { value: '', text: 'Escolham uma decisão' }), ...brief.options.map(([value, text]) => el('option', { value, text }))]);
  decision.value = data.decision;
  const decisionFeedback = el('p', { id: 'fm-decision-feedback', role: 'status', 'aria-live': 'polite' });
  const exportStatus = el('p', { id: 'fm-export-status', role: 'status', 'aria-live': 'polite' });
  function ready() {
    return Boolean(
      (isFigmaFile(data.link) || data.fallback.trim()) &&
      data.reflection.trim() &&
      data.checks.length === labels.length &&
      data.decision === brief.correct
    );
  }
  function updateDecision() {
    const correct = data.decision === brief.correct;
    decisionFeedback.dataset.result = data.decision ? (correct ? 'correct' : 'retry') : '';
    decisionFeedback.textContent = !data.decision
      ? 'Escolham uma opção para receber feedback.'
      : correct
        ? 'Decisão adequada. Testem essa escolha no arquivo. O professor avaliará o resultado.'
        : brief.wrong;
  }
  decision.addEventListener('change', () => { data.decision = decision.value; updateDecision(); updateExport(); save(); });
  function updateExport() {
    exportStatus.textContent = ready()
      ? 'Pronta para revisão do professor. A dupla registrou a evidência, a revisão e a autoavaliação.'
      : 'Rascunho incompleto. Confiram a decisão, marquem os itens testados e registrem a revisão com um link do Figma ou uma evidência alternativa.';
  }
  updateDecision();
  updateExport();
  const download = el('button', { type: 'button', class: 'btn btn-primary', id: 'fm-download', text: 'Baixar entrega para o professor', onclick: () => {
    const lines = ['Estúdio Oito - entrega da missão Figma', `Situação: ${ready() ? 'PRONTA PARA REVISÃO' : 'RASCUNHO INCOMPLETO'}`,  `Dupla: ${team.join(' e ')}`, `Pedido do cliente: ${brief.text}`, `Decisão sobre o pedido: ${decision.selectedOptions[0].textContent}`, `Dificuldade escolhida: ${choice.selectedOptions[0].textContent}`, `Link: ${data.link || 'Não informado'}`, `Alternativa de evidência: ${data.fallback || 'Não informada'}`, `Decisão e revisão: ${data.reflection || 'Não informada'}`, '', 'Autoavaliação da dupla (não verificada pelo aplicativo):', ...labels.map((label, i) => `[${data.checks.includes(i) ? 'X' : ' '}] ${label}`), '', 'O professor deve abrir o arquivo ou examinar a evidência e avaliar o trabalho.'];
    baixar('entrega-figma.txt', lines.join('\r\n') + '\r\n');
  }});
  const root = el('section', { class: 'figma-mission', id: 'figma-mission', 'aria-labelledby': 'fm-title' }, [
    el('header', { class: 'fm-head' }, [el('p', { class: 'fm-kicker', text: 'Missão final / bancada de revisão' }), el('h1', { id: 'fm-title', tabindex: '-1', text: 'Do card ao protótipo' }), el('p', { text: 'Em dupla, construam Card/Evento no Figma. No plano Starter, trabalhem no mesmo arquivo: uma pessoa edita enquanto a outra observa; depois troquem os papéis.' })]),
    el('p', {}, [link('Abrir o Figma e criar um arquivo Design para a dupla', 'https://www.figma.com/')]),
    el('div', { class: 'fm-brief' }, [el('strong', { text: 'Pedido do cliente' }), el('p', { text: brief.text }), el('p', { text: 'Testem este pedido antes de entregar e contem o que mudaram.' })]),
    el('section', { class: 'fm-decision' }, [el('h2', { text: 'Decisão para o cliente' }), el('label', { for: 'fm-decision', text: brief.question }), decision, decisionFeedback]),
    el('h2', { text: 'Roteiro de construção' }),
    el('ol', { class: 'fm-steps' }, [
      step('01', 'Organizem a tela', 'Criem um frame para a tela e nomeiem as camadas do Card/Evento: título, data e ação.', [link('Frames no Figma', resources.frame), ' · ', slide(18)]),
      step('02', 'Construam um card flexível', 'Selecionem as camadas e apliquem Auto Layout com Shift + A. Usem os espaçamentos do tokens.json no painel Design. Testem o pedido do cliente.', [link('Guia de Auto Layout', resources.auto), ' · ', slide(19)]),
      step('03', 'Preparem estados', 'Criem um componente ou instância e representem ao menos dois estados de interação com nomes claros.', [link('Variantes', resources.variants), ' · ', slide(20)]),
      step('04', 'Conectem e testem', 'Façam uma pequena navegação: acionar o card e observar uma resposta. Revisem hierarquia, consistência e legibilidade.', [link('Guia de protótipos', resources.prototype), ' · ', slide(21)])
    ]),
    el('section', { class: 'fm-coach', 'aria-labelledby': 'fm-coach-title' }, [el('h2', { id: 'fm-coach-title', text: 'Ponto de revisão' }), el('p', { text: 'Ao testar o pedido, qual parte precisou de mais atenção? Troquem a escolha se encontrarem outra dificuldade.' }), el('label', { for: 'fm-choice', text: 'Nossa maior dificuldade' }), choice, feedback, hintButton]),
    el('section', { class: 'fm-evidence', 'aria-labelledby': 'fm-evidence-title' }, [el('h2', { id: 'fm-evidence-title', text: 'Entrega e autoavaliação' }), el('p', { text: 'Marquem o que a dupla conferiu. O aplicativo registra sua autoavaliação; o professor revisa o arquivo e decide a avaliação.' }), ...checklist,
      field('fm-link', 'Link do arquivo ou protótipo para visualização', data.link, 'Cole o link copiado do Figma'),
      el('p', { class: 'fm-note' }, [link('Como compartilhar no Figma', resources.share), '. Confiram o acesso de visualização para o professor.']),
      field('fm-fallback', 'Sem acesso ao Figma ou ao compartilhamento? Descrevam a evidência alternativa', data.fallback, 'Ex.: apresentar desenho anotado e explicar o fluxo ao professor', true),
      field('fm-reflection', 'O que vocês mudaram após o teste e por quê?', data.reflection, 'Descrevam a decisão e o resultado observado', true),
      el('p', { class: 'fm-note', text: 'Entreguem um link acessível ou combinem uma evidência alternativa com o professor. O arquivo baixado não inclui imagens; apresentem a evidência separadamente.' }), exportStatus, download, status])
  ]);
  save();
  return root;
}
