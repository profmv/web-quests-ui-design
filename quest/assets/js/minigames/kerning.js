/**
 * OBJECTIVE: Minigame "Ajuste Fino" - adjust the horizontal position of 1-3 letters in
 *            4 uppercase Portuguese words until the spacing looks even (kerning, R9).
 * USAGE: import { iniciar } from './minigames/kerning.js';
 *        const jogo = await iniciar(elemento, { aoTerminar(resultado) {} }); jogo.destruir();
 * OUTPUTS: aoTerminar({ jogo: 'kerning', pontos, acertos, total, segundos }) exactly once.
 * SCORING: glyph metrics are used only for layout. Each movable letter starts at a known
 *          error (6-14px) from its target; score = absolute deviation from that target.
 * RULES: drag, or Tab + arrow keys (1px, Shift = 4px); zero emojis; SVG only.
 */

import {
  icone, criarCiclo, montarCasca, telaIntro, telaResultado, criarFinalizador,
  teclaUtil, num, escapar
} from './comum.js';

const JOGO = 'kerning';
const NS = 'http://www.w3.org/2000/svg';
const FS = 80;
const MARGEM_X = 56;
const ALT = 190;
const BASE = 122;
const ALTURA_CAIXA = 60;
const TRACKING = 0.02;
const LIMITE = 40;
const FONTE = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/* Fallback advance widths (em, bold sans) used only if the browser cannot measure glyphs. */
const AVANCO_RESERVA = { A: 0.72, V: 0.67, I: 0.28, 'Ã': 0.72, O: 0.78, T: 0.61, L: 0.61, D: 0.72, U: 0.72, P: 0.67, R: 0.72 };

/*
 * kern: designer adjustment (em) between letter i and i+1, applied to the target layout.
 * moveis: index -> starting error in px (positive = starts too far right).
 */
const PALAVRAS = [
  {
    letras: ['A', 'V', 'I', 'Ã', 'O'],
    kern: [-0.075, 0, 0, -0.01],
    moveis: { 1: 10, 3: -8 },
    licao: 'AV é um par diagonal: o vão em triângulo engana, então o V entra mais perto do A. O Ã não pode encostar no I: o espaço precisa parecer igual em todos os pares.'
  },
  {
    letras: ['T', 'O', 'L', 'D', 'O'],
    kern: [-0.06, 0, 0, -0.01],
    moveis: { 1: 12, 3: -7 },
    licao: 'O telhado do T deixa ar embaixo: o O pode chegar mais perto. Entre a haste reta do L e a curva do D o espaço não pode sumir.'
  },
  {
    letras: ['L', 'U', 'V', 'A'],
    kern: [-0.01, -0.02, -0.075],
    moveis: { 1: -7, 3: 11 },
    licao: 'VA pede aproximação, como AV. Já o par LU quase não tem ajuste: aproximar demais também é erro.'
  },
  {
    letras: ['V', 'A', 'P', 'O', 'R'],
    kern: [-0.075, -0.01, -0.015, -0.005],
    moveis: { 1: 12, 3: -8, 4: 7 },
    licao: 'VA aproxima; P, O e R seguem o ritmo com ajustes pequenos. Kerning é óptico: vale a área clara entre as letras, não a distância entre as caixas.'
  }
];

const TOTAL_LETRAS = PALAVRAS.reduce((s, p) => s + Object.keys(p.moveis).length, 0);

function notaLetra(desvio) {
  if (desvio <= 2) return 1;
  return Math.max(0, 1 - (desvio - 2) / 10);
}

function criarSvg(tag, attrs = {}, pai) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  if (pai) pai.appendChild(el);
  return el;
}

export async function iniciar(raiz, opcoes = {}) {
  const ciclo = criarCiclo();
  let inicio = 0;
  let estado = 'intro';
  let indice = 0;
  let acertos = 0;
  let somaNotas = 0;
  const historico = [];
  let palavraAtual = null;
  let espelhado = false;

  const casca = montarCasca(raiz, {
    id: JOGO,
    titulo: 'Ajuste Fino',
    nomeIcone: 'kerning',
    aoPular: () => finalizar(0, { pulado: true })
  }, ciclo);

  const finalizar = criarFinalizador(JOGO, opcoes, casca, ciclo, () => ({
    acertos,
    total: TOTAL_LETRAS,
    segundos: inicio ? (performance.now() - inicio) / 1000 : 0
  }));

  function comecar() {
    inicio = performance.now();
    indice = 0;
    mostrarPalavra();
  }

  function medirAvancos(svg, letras) {
    return letras.map((l) => {
      const t = criarSvg('text', { x: 0, y: BASE, class: 'mg-kf-letra' }, svg);
      t.textContent = l;
      let w = 0;
      try { w = t.getComputedTextLength(); } catch (e) { w = 0; }
      t.remove();
      return w > 4 ? w : (AVANCO_RESERVA[l] || 0.65) * FS;
    });
  }

  function mostrarPalavra() {
    const p = PALAVRAS[indice];
    estado = 'ajuste';
    espelhado = false;
    casca.status.textContent = `Palavra ${indice + 1} de ${PALAVRAS.length}`;
    const nome = p.letras.join('');
    casca.corpo.innerHTML = `
      <div class="mg-kf">
        <p class="mg-kf-instr"><strong>Deixe os espaços entre as letras visualmente iguais.</strong> Arraste as letras com alça azul<span class="mg-dica-teclas">, ou use <kbd>Tab</kbd> e as setas (<kbd>Shift</kbd> + seta = 4px)</span>.</p>
        <div class="mg-kf-quadro">
          <span class="mg-kf-rotulo">Palavra ${indice + 1}/${PALAVRAS.length}</span>
          <svg class="mg-kf-svg" role="group" aria-label="Palavra ${escapar(nome)}"></svg>
        </div>
        <div class="mg-kf-acoes">
          <button type="button" class="btn btn-secondary mg-kf-espelhar" aria-pressed="false">${icone('espelhar', 'mg-ic mg-ic-16')}Ver de cabeça para baixo</button>
          <button type="button" class="btn btn-secondary mg-kf-reset">${icone('desfazer', 'mg-ic mg-ic-16')}Recomeçar palavra</button>
          <button type="button" class="btn btn-primary mg-kf-conferir">${icone('alvo', 'mg-ic mg-ic-16')}Conferir</button>
        </div>
        <div class="mg-kf-retorno" hidden></div>
      </div>`;
    const svg = casca.corpo.querySelector('.mg-kf-svg');
    svg.style.fontFamily = FONTE;
    const avancos = medirAvancos(svg, p.letras);
    const track = TRACKING * FS;

    /* Target layout: advances + tracking + designer kerning. */
    const alvoX = [];
    let x = 0;
    p.letras.forEach((l, i) => {
      alvoX.push(x);
      x += avancos[i] + track + (i < p.kern.length ? p.kern[i] * FS : 0);
    });
    const larguraTotal = alvoX[alvoX.length - 1] + avancos[avancos.length - 1];
    const LARG = Math.round(larguraTotal + 2 * MARGEM_X);
    const desloc = MARGEM_X;
    svg.setAttribute('viewBox', `0 0 ${LARG} ${ALT}`);
    svg.style.maxWidth = `${Math.round(LARG * 1.3)}px`;
    for (let i = 0; i < alvoX.length; i++) alvoX[i] = Math.round(alvoX[i] + desloc);

    criarSvg('line', { x1: 8, x2: LARG - 8, y1: BASE, y2: BASE, class: 'mg-kf-base' }, svg);
    criarSvg('line', { x1: 8, x2: LARG - 8, y1: BASE - ALTURA_CAIXA + 2, y2: BASE - ALTURA_CAIXA + 2, class: 'mg-kf-base mg-kf-base-alta' }, svg);
    const grupo = criarSvg('g', { class: 'mg-kf-palavra' }, svg);
    const camadaAlvos = criarSvg('g', { class: 'mg-kf-alvos' }, svg);

    const moveis = [];
    p.letras.forEach((l, i) => {
      const erro = p.moveis[i];
      if (erro === undefined) {
        const t = criarSvg('text', { x: alvoX[i], y: BASE, class: 'mg-kf-letra' }, grupo);
        t.textContent = l;
        return;
      }
      const inicioX = alvoX[i] + erro;
      const w = avancos[i];
      const g = criarSvg('g', {
        class: 'mg-kf-movel',
        tabindex: 0,
        role: 'slider',
        'aria-label': `Letra ${l}, posição ${i + 1} de ${p.letras.length}`,
        'aria-valuemin': -LIMITE,
        'aria-valuemax': LIMITE,
        'aria-valuenow': 0,
        'aria-valuetext': 'na posição inicial',
        'aria-orientation': 'horizontal',
        transform: `translate(${inicioX} 0)`
      }, grupo);
      const larguraAlvo = Math.max(56, w + 16);
      criarSvg('rect', { x: (w - larguraAlvo) / 2, y: BASE - ALTURA_CAIXA - 12, width: larguraAlvo, height: ALTURA_CAIXA + 48, class: 'mg-kf-hit' }, g);
      criarSvg('rect', { x: -2, y: BASE - ALTURA_CAIXA - 4, width: w + 4, height: ALTURA_CAIXA + 8, class: 'mg-kf-sel' }, g);
      [[-2, BASE - ALTURA_CAIXA - 4], [w + 2, BASE - ALTURA_CAIXA - 4], [-2, BASE + 4], [w + 2, BASE + 4]].forEach(([hx, hy]) => {
        criarSvg('rect', { x: hx - 3, y: hy - 3, width: 6, height: 6, class: 'mg-kf-sel mg-kf-pega' }, g);
      });
      const t = criarSvg('text', { x: 0, y: BASE, class: 'mg-kf-letra' }, g);
      t.textContent = l;
      const alca = criarSvg('g', { class: 'mg-kf-alca', transform: `translate(${w / 2} ${BASE + 22})` }, g);
      criarSvg('rect', { x: -18, y: -8, width: 36, height: 16, rx: 8 }, alca);
      criarSvg('path', { d: 'M-9 0h18M-5 -4l-4 4 4 4M5 -4l4 4-4 4', class: 'mg-kf-alca-seta' }, alca);
      const m = { g, letra: l, indice: i, inicioX, alvo: alvoX[i], pos: inicioX, largura: w };
      moveis.push(m);
      ligarMovel(m, svg);
    });

    palavraAtual = { p, svg, grupo, camadaAlvos, moveis, alvoX, avancos };

    const btnEsp = casca.corpo.querySelector('.mg-kf-espelhar');
    ciclo.ouvir(btnEsp, 'click', () => {
      espelhado = !espelhado;
      btnEsp.setAttribute('aria-pressed', String(espelhado));
      aplicarEspelho();
    });
    ciclo.ouvir(casca.corpo.querySelector('.mg-kf-reset'), 'click', () => {
      if (estado !== 'ajuste') return;
      moveis.forEach((m) => posicionar(m, m.inicioX));
      casca.anunciar('Letras de volta à posição inicial.');
    });
    ciclo.ouvir(casca.corpo.querySelector('.mg-kf-conferir'), 'click', conferir);
    casca.anunciar(`Palavra ${indice + 1} de ${PALAVRAS.length}: ${nome}. ${moveis.length} ${moveis.length === 1 ? 'letra ajustável' : 'letras ajustáveis'}.`);
    moveis[0].g.focus({ preventScroll: true });
  }

  function aplicarEspelho() {
    if (!palavraAtual) return;
    const cy = BASE - ALTURA_CAIXA / 2;
    const tr = espelhado ? `translate(0 ${2 * cy}) scale(1 -1)` : '';
    palavraAtual.grupo.setAttribute('transform', tr);
    palavraAtual.camadaAlvos.setAttribute('transform', tr);
    palavraAtual.svg.classList.toggle('is-espelhado', espelhado);
  }

  function posicionar(m, x) {
    const dx = Math.max(-LIMITE, Math.min(LIMITE, Math.round(x - m.inicioX)));
    m.pos = m.inicioX + dx;
    m.g.setAttribute('transform', `translate(${m.pos} 0)`);
    m.g.setAttribute('aria-valuenow', String(dx));
    m.g.setAttribute('aria-valuetext', dx === 0 ? 'na posição inicial' : `${Math.abs(dx)} pixels à ${dx < 0 ? 'esquerda' : 'direita'} do início`);
  }

  function ligarMovel(m, svg) {
    let arrastando = null;
    ciclo.ouvir(m.g, 'keydown', (e) => {
      if (estado !== 'ajuste') return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const passo = (e.shiftKey ? 4 : 1) * (e.key === 'ArrowLeft' ? -1 : 1);
        posicionar(m, m.pos + passo);
      }
    });
    ciclo.ouvir(m.g, 'pointerdown', (e) => {
      if (estado !== 'ajuste' || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      m.g.focus({ preventScroll: true });
      const ctm = svg.getScreenCTM();
      arrastando = { x0: e.clientX, pos0: m.pos, escala: ctm ? ctm.a : 1, id: e.pointerId };
      try { m.g.setPointerCapture(e.pointerId); } catch (err) { /* capture unsupported */ }
      m.g.classList.add('is-arrastando');
    });
    ciclo.ouvir(m.g, 'pointermove', (e) => {
      if (!arrastando || e.pointerId !== arrastando.id) return;
      posicionar(m, arrastando.pos0 + (e.clientX - arrastando.x0) / arrastando.escala);
    });
    const soltar = (e) => {
      if (!arrastando || e.pointerId !== arrastando.id) return;
      arrastando = null;
      m.g.classList.remove('is-arrastando');
    };
    ciclo.ouvir(m.g, 'pointerup', soltar);
    ciclo.ouvir(m.g, 'pointercancel', soltar);
  }

  function conferir() {
    if (estado !== 'ajuste' || !palavraAtual) return;
    estado = 'conferido';
    const { p, moveis, camadaAlvos } = palavraAtual;
    let soma = 0;
    let certos = 0;
    const detalhes = moveis.map((m) => {
      const desvio = Math.abs(m.pos - m.alvo);
      const desvioInicial = Math.abs(m.inicioX - m.alvo);
      const nota = notaLetra(desvio);
      soma += nota;
      if (desvio <= 3) certos += 1;
      m.g.setAttribute('tabindex', '-1');
      m.g.setAttribute('aria-disabled', 'true');
      m.g.classList.add('is-travado');
      return { letra: m.letra, desvio, desvioInicial, m };
    });
    acertos += certos;
    somaNotas += soma;
    const media = detalhes.reduce((s, d) => s + d.desvio, 0) / detalhes.length;
    historico.push({ palavra: p.letras.join(''), licao: p.licao, media, ok: certos === moveis.length });

    /* Overlay the targets: outlined ghost letters + redline deviation measure. */
    detalhes.forEach((d, n) => {
      const m = d.m;
      const ghost = criarSvg('text', { x: m.alvo, y: BASE, class: 'mg-kf-fantasma' }, camadaAlvos);
      ghost.textContent = m.letra;
      const y = BASE + 44 + (n % 2) * 0;
      const xa = Math.min(m.pos, m.alvo) + m.largura / 2;
      const xb = Math.max(m.pos, m.alvo) + m.largura / 2;
      const ruim = d.desvio > 3;
      const cls = ruim ? 'mg-kf-medida is-ruim' : 'mg-kf-medida';
      if (d.desvio > 0) {
        criarSvg('line', { x1: xa, x2: xb, y1: y, y2: y, class: cls }, camadaAlvos);
        criarSvg('line', { x1: xa, x2: xa, y1: y - 4, y2: y + 4, class: cls }, camadaAlvos);
        criarSvg('line', { x1: xb, x2: xb, y1: y - 4, y2: y + 4, class: cls }, camadaAlvos);
      }
      const rotulo = d.desvio === 0 ? 'exato' : `${d.desvio}px`;
      const lw = rotulo.length * 7.4 + 8;
      const cx = (xa + xb) / 2;
      const gt = criarSvg('g', { class: `mg-kf-tag${ruim ? ' is-ruim' : ''}`, transform: `translate(${cx - lw / 2} ${y + 6})` }, camadaAlvos);
      criarSvg('rect', { width: lw, height: 18, rx: 2 }, gt);
      const tt = criarSvg('text', { x: lw / 2, y: 13 }, gt);
      tt.textContent = rotulo;
    });
    casca.corpo.querySelector('.mg-kf-svg').classList.add('is-conferido');
    casca.corpo.querySelectorAll('.mg-kf-reset, .mg-kf-conferir').forEach((b) => { b.disabled = true; });

    const ok = certos === moveis.length;
    const ultima = indice === PALAVRAS.length - 1;
    const resumo = detalhes.map((d) => `${escapar(d.letra)}: de ${d.desvioInicial}px para ${d.desvio}px`).join('; ');
    const ret = casca.corpo.querySelector('.mg-kf-retorno');
    ret.hidden = false;
    ret.innerHTML = `
      <div class="callout ${ok ? 'callout-ok' : media <= 6 ? 'callout-warn' : 'callout-bad'} anim-pop">
        <span class="mg-callout-ic">${icone(ok ? 'ok' : 'info')}</span>
        <span><strong>Contorno azul = posição-alvo.</strong> Desvio: ${resumo}. ${escapar(p.licao)}</span>
      </div>
      <button type="button" class="btn btn-primary mg-kf-proxima">${ultima ? 'Ver resultado' : 'Próxima palavra'}${icone('seta', 'mg-ic mg-ic-16')}</button>`;
    const prox = ret.querySelector('.mg-kf-proxima');
    ciclo.ouvir(prox, 'click', avancar);
    prox.focus({ preventScroll: true });
    ret.scrollIntoView?.({ block: 'nearest' });
    casca.anunciar(`Conferido. ${resumo.replace(/px/g, ' pixels')}. ${p.licao}`);
  }

  function avancar() {
    if (estado !== 'conferido') return;
    indice += 1;
    if (indice < PALAVRAS.length) mostrarPalavra();
    else mostrarResultado();
  }

  function mostrarResultado() {
    estado = 'fim';
    palavraAtual = null;
    const pontos = Math.round((100 * somaNotas) / TOTAL_LETRAS);
    const segundos = Math.round((performance.now() - inicio) / 1000);
    telaResultado(casca, {
      pontos,
      estatisticas: [`${acertos} de ${TOTAL_LETRAS} letras a até 3px do alvo`, `tempo: ${segundos}s`],
      recap: historico.map((h) => ({
        ok: h.ok,
        titulo: `${h.palavra}: desvio médio ${num(h.media, 1)}px`,
        texto: ` ${escapar(h.licao)}`
      })),
      aoContinuar: () => finalizar(pontos)
    }, ciclo);
  }

  ciclo.ouvir(document, 'keydown', (e) => {
    if (!teclaUtil(e, raiz)) return;
    if (estado === 'conferido' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      avancar();
    }
  });

  telaIntro(casca, {
    titulo: 'Ajuste Fino',
    objetivo: 'Em 4 palavras, mova as letras marcadas até que os espaços entre todas as letras pareçam iguais.',
    duracao: 'cerca de 3 min',
    nomeIcone: 'kerning',
    passos: [
      'As letras com alça azul começaram fora do lugar. Arraste para os lados ou selecione com <kbd>Tab</kbd> e use as setas.',
      'Compare a área clara entre as letras, não a distância entre as caixas. Ver a palavra de cabeça para baixo ajuda.',
      'Em <strong>Conferir</strong>, o contorno azul mostra a posição-alvo e a régua vermelha mede o seu desvio.'
    ],
    aoComecar: comecar
  }, ciclo);

  return {
    destruir() {
      ciclo.destruir();
      raiz.replaceChildren();
    }
  };
}
