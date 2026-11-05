/**
 * OBJECTIVE: Shared helpers for the quest minigames (shell, intro/result screens,
 *            lifecycle cleanup, inline SVG icons, WCAG contrast math).
 * USAGE: import { montarCasca, criarCiclo, ... } from './comum.js';
 * OUTPUTS: DOM nodes inside the host element; no globals, no storage, no network.
 * RULES: zero emojis (Rule 5), SVG icons only, 8px spacing, keyboard and touch friendly.
 */

const ICONES = {
  olho: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  contraste: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor"/>',
  kerning: '<path d="m7 8-4 4 4 4"/><path d="m17 8 4 4-4 4"/><path d="M3 12h18"/>',
  pular: '<path d="m5 4 10 8-10 8V4Z"/><path d="M19 5v14"/>',
  seta: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  ok: '<path d="M20 6 9 17l-5-5"/>',
  erro: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  iniciar: '<path d="m7 4 13 8-13 8V4Z"/>',
  medalha: '<circle cx="12" cy="8" r="6"/><path d="M8.2 13.2 7 22l5-3 5 3-1.2-8.8"/>',
  espelhar: '<path d="M3 12h18"/><path d="m8 8 4-4 4 4"/><path d="m8 16 4 4 4-4"/>',
  desfazer: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  alvo: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'
};

let contadorIds = 0;

/** Returns an inline SVG icon string (decorative, aria-hidden). */
export function icone(nome, classe = 'mg-ic') {
  return `<svg class="${classe}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONES[nome] || ''}</svg>`;
}

/** Unique id prefix per mounted game. */
export function novoId(prefixo) {
  contadorIds += 1;
  return `${prefixo}-${contadorIds}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Tracks listeners and timers so destruir() can remove everything. */
export function criarCiclo() {
  const limpezas = new Set();
  return {
    ouvir(alvo, tipo, fn, op) {
      alvo.addEventListener(tipo, fn, op);
      const desfazer = () => alvo.removeEventListener(tipo, fn, op);
      limpezas.add(desfazer);
      return () => { desfazer(); limpezas.delete(desfazer); };
    },
    timeout(fn, ms) {
      let desfazer;
      const id = setTimeout(() => { limpezas.delete(desfazer); fn(); }, ms);
      desfazer = () => clearTimeout(id);
      limpezas.add(desfazer);
      return () => { desfazer(); limpezas.delete(desfazer); };
    },
    intervalo(fn, ms) {
      const id = setInterval(fn, ms);
      const desfazer = () => clearInterval(id);
      limpezas.add(desfazer);
      return () => { desfazer(); limpezas.delete(desfazer); };
    },
    destruir() {
      for (const f of limpezas) f();
      limpezas.clear();
    }
  };
}

export function reduzMovimento() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Restarts a CSS animation class (no-op visual under reduced motion thanks to tokens.css). */
export function animar(el, classe) {
  if (!el) return;
  el.classList.remove(classe);
  void el.offsetWidth;
  el.classList.add(classe);
}

export function embaralhar(lista) {
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function escapar(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Number with pt-BR decimal comma. */
export function num(valor, casas = 0) {
  return Number(valor).toFixed(casas).replace('.', ',');
}

/**
 * Global key handler guard: ignore modified keys, typing targets and
 * Enter/Space on native buttons (they already click), and keys while the game is hidden.
 */
export function teclaUtil(e, raiz) {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return false;
  if (!raiz.isConnected || raiz.getClientRects().length === 0) return false;
  const alvo = e.target;
  if (alvo && alvo.closest) {
    if (alvo.closest('input, textarea, select, [contenteditable="true"]')) return false;
    if ((e.key === 'Enter' || e.key === ' ') && alvo.closest('button, a, [role="slider"]')) return false;
    const dentroDeOutroDialogo = alvo.closest('dialog, [role="dialog"]');
    if (dentroDeOutroDialogo && !dentroDeOutroDialogo.contains(raiz)) return false;
  }
  return true;
}

/** Builds the common shell: workspace toolbar with title, status slot and skip button. */
export function montarCasca(raiz, { id, titulo, nomeIcone, aoPular }, ciclo) {
  const idTitulo = novoId('mg-titulo');
  raiz.replaceChildren();
  const secao = document.createElement('section');
  secao.className = 'mg ws-canvas-bg';
  secao.dataset.jogo = id;
  secao.setAttribute('aria-labelledby', idTitulo);
  secao.innerHTML = `
    <header class="mg-topo">
      <span class="mg-marca">
        <span class="mg-marca-ic">${icone(nomeIcone)}</span>
        <span class="mg-marca-txt">
          <span class="mg-sobre">Intervalo</span>
          <span class="mg-nome" id="${idTitulo}">${escapar(titulo)}</span>
        </span>
      </span>
      <span class="mg-status"></span>
      <button type="button" class="mg-pular" aria-label="Pular intervalo">${icone('pular', 'mg-ic mg-ic-16')}<span>Pular<span class="mg-pular-extra"> intervalo</span></span></button>
    </header>
    <div class="mg-corpo"></div>
    <div class="sr-only" aria-live="polite" aria-atomic="true"></div>`;
  raiz.appendChild(secao);
  const casca = {
    secao,
    corpo: secao.querySelector('.mg-corpo'),
    status: secao.querySelector('.mg-status'),
    vivo: secao.querySelector('[aria-live]'),
    botaoPular: secao.querySelector('.mg-pular'),
    anunciar(texto) {
      casca.vivo.textContent = '';
      ciclo.timeout(() => { casca.vivo.textContent = texto; }, 40);
    },
    focar(el) {
      if (el && typeof el.focus === 'function') el.focus({ preventScroll: false });
    }
  };
  ciclo.ouvir(casca.botaoPular, 'click', () => aoPular());
  return casca;
}

/** Intro screen: title, one-sentence goal, how-to list and Start button. */
export function telaIntro(casca, { titulo, objetivo, passos, duracao, nomeIcone, aoComecar }, ciclo) {
  const idH = novoId('mg-intro');
  casca.status.textContent = '';
  casca.corpo.innerHTML = `
    <div class="mg-painel mg-intro anim-pop" role="group" aria-labelledby="${idH}">
      <div class="mg-intro-cab">
        <span class="mg-intro-ic">${icone(nomeIcone, 'mg-ic mg-ic-32')}</span>
        <span class="chip chip-component">${icone('relogio', 'mg-ic mg-ic-16')}${escapar(duracao)}</span>
      </div>
      <h2 class="mg-h2" id="${idH}" tabindex="-1">${escapar(titulo)}</h2>
      <p class="mg-objetivo">${escapar(objetivo)}</p>
      <ul class="mg-passos">${passos.map((p) => `<li>${p}</li>`).join('')}</ul>
      <div class="mg-acoes">
        <button type="button" class="btn btn-primary btn-lg mg-comecar">${icone('iniciar', 'mg-ic mg-ic-16')}Começar</button>
      </div>
    </div>`;
  const botao = casca.corpo.querySelector('.mg-comecar');
  ciclo.ouvir(botao, 'click', aoComecar);
  casca.focar(botao);
  return botao;
}

/** Result screen with score, stats and learning recap; "Continuar a trilha" ends the game. */
export function telaResultado(casca, { pontos, estatisticas, recap, extraHtml = '', aoContinuar }, ciclo) {
  const idH = novoId('mg-res');
  const faixa = pontos >= 80 ? 'Olho de designer sênior' : pontos >= 50 ? 'Bom treino de olhar' : 'Vale rever os slides';
  casca.status.textContent = 'Resultado';
  casca.botaoPular.hidden = true;
  casca.corpo.innerHTML = `
    <div class="mg-painel mg-resultado anim-pop" role="group" aria-labelledby="${idH}">
      <div class="mg-res-topo">
        <div class="mg-placar">
          <span class="mg-placar-num">${pontos}</span>
          <span class="mg-placar-rot">pontos de 100</span>
        </div>
        <div class="mg-res-txt">
          <h2 class="mg-h2" id="${idH}" tabindex="-1">${escapar(faixa)}</h2>
          <div class="mg-res-chips">${estatisticas.map((s) => `<span class="chip">${s}</span>`).join('')}</div>
        </div>
      </div>
      <h3 class="mg-h3">O que cada rodada ensinou</h3>
      <ol class="mg-recap">${recap.map((r) => `
        <li class="mg-recap-item" data-ok="${r.ok ? 'sim' : 'nao'}">
          <span class="mg-recap-ic" aria-hidden="true">${icone(r.ok ? 'ok' : 'erro', 'mg-ic mg-ic-16')}</span>
          <span class="mg-recap-txt"><strong>${escapar(r.titulo)}</strong><span class="sr-only">${r.ok ? ' (acertou)' : ' (errou)'}</span><span>${r.texto}</span></span>
        </li>`).join('')}
      </ol>
      ${extraHtml}
      <div class="mg-acoes">
        <button type="button" class="btn btn-primary btn-lg mg-continuar">Continuar a trilha${icone('seta', 'mg-ic mg-ic-16')}</button>
      </div>
    </div>`;
  const botao = casca.corpo.querySelector('.mg-continuar');
  ciclo.ouvir(botao, 'click', aoContinuar);
  casca.corpo.querySelector('h2').focus({ preventScroll: true });
  casca.secao.scrollIntoView?.({ block: 'nearest' });
  return botao;
}

/** Wraps aoTerminar so it fires exactly once and freezes the game UI. */
export function criarFinalizador(jogo, opcoes, casca, ciclo, obterDados) {
  let terminado = false;
  return function finalizar(pontos, extra = {}) {
    if (terminado) return;
    terminado = true;
    const dados = obterDados();
    const resultado = {
      jogo,
      pontos: Math.max(0, Math.min(100, Math.round(pontos))),
      acertos: dados.acertos,
      total: dados.total,
      segundos: Math.max(0, Math.round(dados.segundos)),
      ...extra
    };
    casca.secao.setAttribute('inert', '');
    casca.secao.classList.add('is-encerrado');
    ciclo.destruir();
    if (opcoes && typeof opcoes.aoTerminar === 'function') opcoes.aoTerminar(resultado);
  };
}

/* ---------- WCAG 2.x contrast ---------- */

export function hexParaRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

export function rgbParaHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

export function luminancia(hex) {
  const [r, g, b] = hexParaRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function razaoContraste(a, b) {
  const la = luminancia(a);
  const lb = luminancia(b);
  const [claro, escuro] = la > lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (escuro + 0.05);
}

export function hslParaHex(h, s, l) {
  const sat = s / 100;
  const lum = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = sat * Math.min(lum, 1 - lum);
  const f = (n) => lum - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbParaHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}
