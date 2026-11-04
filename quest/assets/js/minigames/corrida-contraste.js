/**
 * OBJECTIVE: Minigame "Corrida do Contraste" - 60-second run judging whether text on a
 *            background passes WCAG 2.2 AA (1.4.3): 4.5:1 normal, 3:1 large text (R4).
 * USAGE: import { iniciar } from './minigames/corrida-contraste.js';
 *        const jogo = await iniciar(elemento, { aoTerminar(resultado) {} }); jogo.destruir();
 * OUTPUTS: aoTerminar({ jogo: 'corrida-contraste', pontos, acertos, total, segundos }) exactly once.
 * RULES: real relative-luminance formula; keys A (passa) / N (nao passa); zero emojis.
 */

import {
  icone, criarCiclo, montarCasca, telaIntro, telaResultado, criarFinalizador,
  embaralhar, teclaUtil, animar, num, escapar, razaoContraste, hslParaHex
} from './comum.js';

const JOGO = 'corrida-contraste';
const DURACAO = 60;
const MAX_CARTOES = 20;
const PAUSA_RETORNO = 1500;
const MARGEM = 0.12;

const FRASES = [
  'Inscrições abertas', 'Sala 204, 14h', 'Ver programação', 'Últimas vagas',
  'Certificado disponível', 'Semana de Design', 'Confirmar presença', 'Mapa do campus',
  'Oficina de Figma', 'Palestra cancelada'
];

/* Text styles. grande = WCAG large text (>= 24px regular or >= 18.66px bold). */
const ESTILOS = {
  normal: [
    { px: 14, peso: 400 }, { px: 16, peso: 400 }, { px: 16, peso: 600 }
  ],
  armadilha: [
    { px: 18, peso: 700 }, { px: 20, peso: 400 }, { px: 22, peso: 400 }
  ],
  grande: [
    { px: 24, peso: 400 }, { px: 28, peso: 400 }, { px: 19, peso: 700 }, { px: 20, peso: 700 }, { px: 32, peso: 700 }
  ]
};

/* Card plan: category, style group, target ratio range. Shuffled each run. */
const PLANO = [
  ...Array(5).fill({ cat: 'normal', grupo: 'normal', faixa: [4.75, 6.2] }),
  ...Array(5).fill({ cat: 'normal', grupo: 'normal', faixa: [3.3, 4.3] }),
  ...Array(5).fill({ cat: 'grande', grupo: 'grande', faixa: [3.2, 4.3] }),
  ...Array(3).fill({ cat: 'grande', grupo: 'grande', faixa: [2.25, 2.85] }),
  ...Array(2).fill({ cat: 'armadilha', grupo: 'armadilha', faixa: [3.3, 4.2] })
];

function ehGrande(estilo) {
  return estilo.px >= 24 || (estilo.peso >= 700 && estilo.px >= 18.66);
}

function sortear(min, max) {
  return min + Math.random() * (max - min);
}

function nomePeso(peso) {
  return peso >= 700 ? 'negrito' : peso >= 600 ? 'seminegrito' : 'regular';
}

/* Finds the lightness of a colour (fixed hue/sat) that reaches the target ratio against a fixed colour. */
function buscarLuz(h, s, fixo, alvo, maisClaro, limiteMin, limiteMax) {
  let lo = limiteMin;
  let hi = limiteMax;
  for (let i = 0; i < 24; i++) {
    const meio = (lo + hi) / 2;
    const r = razaoContraste(hslParaHex(h, s, meio), fixo);
    /* Lighter text on dark: ratio grows with lightness. Darker text/bg vs light: ratio shrinks. */
    const precisaClarear = maisClaro ? r < alvo : r > alvo;
    if (precisaClarear) lo = meio; else hi = meio;
  }
  return maisClaro ? hi : lo;
}

function gerarPar(alvo) {
  for (let tentativa = 0; tentativa < 60; tentativa++) {
    const modo = ['claro', 'escuro', 'cor'][Math.floor(Math.random() * 3)];
    const h = Math.floor(Math.random() * 360);
    let fundo;
    let texto;
    if (modo === 'claro') {
      fundo = hslParaHex(h, sortear(25, 70), sortear(88, 97));
      const ht = (h + Math.floor(sortear(-30, 30)) + 360) % 360;
      const st = sortear(10, 45);
      texto = hslParaHex(ht, st, buscarLuz(ht, st, fundo, alvo, false, 0, 80));
    } else if (modo === 'escuro') {
      fundo = hslParaHex(h, sortear(20, 45), sortear(10, 20));
      const ht = (h + Math.floor(sortear(-30, 30)) + 360) % 360;
      const st = sortear(15, 60);
      texto = hslParaHex(ht, st, buscarLuz(ht, st, fundo, alvo, true, 25, 100));
    } else {
      texto = '#ffffff';
      const s = sortear(45, 80);
      fundo = hslParaHex(h, s, buscarLuz(h, s, texto, alvo, false, 15, 95));
    }
    const razao = razaoContraste(texto, fundo);
    if (Math.abs(razao - alvo) < 0.25) return { fundo, texto, razao };
  }
  return { fundo: '#ffffff', texto: '#595959', razao: razaoContraste('#595959', '#ffffff') };
}

function gerarCartao(plano) {
  for (let i = 0; i < 40; i++) {
    const estilo = ESTILOS[plano.grupo][Math.floor(Math.random() * ESTILOS[plano.grupo].length)];
    const grande = ehGrande(estilo);
    const minimo = grande ? 3 : 4.5;
    const par = gerarPar(sortear(plano.faixa[0], plano.faixa[1]));
    if (Math.abs(par.razao - minimo) < MARGEM) continue;
    if (Math.abs(par.razao - (grande ? 4.5 : 3)) < 0.05) continue;
    return {
      ...par,
      estilo,
      grande,
      minimo,
      passa: par.razao >= minimo,
      cat: plano.cat,
      frase: FRASES[Math.floor(Math.random() * FRASES.length)]
    };
  }
  const estilo = { px: 16, peso: 400 };
  return { fundo: '#ffffff', texto: '#767676', razao: razaoContraste('#767676', '#ffffff'), estilo, grande: false, minimo: 4.5, passa: true, cat: 'normal', frase: FRASES[0] };
}

export async function iniciar(raiz, opcoes = {}) {
  const ciclo = criarCiclo();
  let inicio = 0;
  let estado = 'intro';
  let cartoes = [];
  let indice = 0;
  let acertos = 0;
  let respondidos = 0;
  let sequencia = 0;
  let restante = DURACAO;
  let ultimoTique = 0;
  const respostas = [];
  let pararTique = null;

  const casca = montarCasca(raiz, {
    id: JOGO,
    titulo: 'Corrida do Contraste',
    nomeIcone: 'contraste',
    aoPular: () => finalizar(0, { pulado: true })
  }, ciclo);

  const finalizar = criarFinalizador(JOGO, opcoes, casca, ciclo, () => ({
    acertos,
    total: respondidos,
    segundos: inicio ? (performance.now() - inicio) / 1000 : 0
  }));

  function comecar() {
    inicio = performance.now();
    cartoes = embaralhar(PLANO).map(gerarCartao);
    indice = 0;
    restante = DURACAO;
    casca.corpo.innerHTML = `
      <div class="mg-cc">
        <div class="mg-cc-cab">
          <div class="mg-tempo mg-cc-tempo">
            ${icone('relogio', 'mg-ic mg-ic-16')}
            <span class="mg-barra" aria-hidden="true"><span class="mg-barra-fill"></span></span>
            <span class="mg-tempo-num" role="timer" aria-label="Tempo restante">${DURACAO}s</span>
          </div>
          <span class="chip chip-select mg-cc-placar">0 acertos</span>
        </div>
        <div class="mg-cc-mesa">
          <figure class="mg-cc-cartao">
            <div class="mg-cc-amostra"><span class="mg-cc-frase"></span></div>
            <figcaption class="mg-cc-legenda">
              <span class="chip mg-cc-tam"></span>
              <span class="mg-cc-cores"></span>
            </figcaption>
          </figure>
          <div class="mg-cc-lado">
            <div class="mg-cc-regra">
              <span class="mg-cc-regra-lin"><strong>Texto normal</strong> mínimo 4,5:1</span>
              <span class="mg-cc-regra-lin"><strong>Texto grande</strong> mínimo 3:1<small>24px ou mais; ou 18,66px ou mais em negrito</small></span>
            </div>
            <div class="mg-cc-botoes">
              <button type="button" class="btn btn-lg mg-cc-resp mg-cc-sim" data-resp="sim">${icone('ok', 'mg-ic')}Passa AA<kbd>A</kbd></button>
              <button type="button" class="btn btn-lg mg-cc-resp mg-cc-nao" data-resp="nao">${icone('erro', 'mg-ic')}Não passa<kbd>N</kbd></button>
            </div>
            <div class="mg-cc-retorno" aria-hidden="true"></div>
          </div>
        </div>
      </div>`;
    casca.corpo.querySelectorAll('.mg-cc-resp').forEach((b) => {
      ciclo.ouvir(b, 'click', () => responder(b.dataset.resp === 'sim'));
    });
    mostrarCartao();
    casca.corpo.querySelector('.mg-cc-sim').focus({ preventScroll: true });
    ultimoTique = performance.now();
    pararTique = ciclo.intervalo(tique, 100);
  }

  function tique() {
    const agora = performance.now();
    const dt = (agora - ultimoTique) / 1000;
    ultimoTique = agora;
    if (estado !== 'pergunta') return;
    restante = Math.max(0, restante - dt);
    const fill = casca.corpo.querySelector('.mg-barra-fill');
    const numEl = casca.corpo.querySelector('.mg-tempo-num');
    fill.style.transform = `scaleX(${restante / DURACAO})`;
    numEl.textContent = `${Math.ceil(restante)}s`;
    casca.corpo.querySelector('.mg-cc-tempo').classList.toggle('is-alerta', restante <= 10);
    if (restante <= 0) encerrar();
  }

  function mostrarCartao() {
    const c = cartoes[indice];
    estado = 'pergunta';
    casca.status.textContent = `Cartão ${indice + 1} de ${MAX_CARTOES}`;
    const amostra = casca.corpo.querySelector('.mg-cc-amostra');
    const frase = casca.corpo.querySelector('.mg-cc-frase');
    amostra.style.background = c.fundo;
    frase.style.color = c.texto;
    frase.style.fontSize = `${c.estilo.px}px`;
    frase.style.fontWeight = String(c.estilo.peso);
    frase.textContent = c.frase;
    casca.corpo.querySelector('.mg-cc-tam').textContent = `${c.estilo.px}px, ${nomePeso(c.estilo.peso)}`;
    casca.corpo.querySelector('.mg-cc-cores').innerHTML = `
      <span class="mg-cc-cor"><span class="mg-cc-amostra-cor" style="background:${c.texto}"></span>texto ${c.texto.toUpperCase()}</span>
      <span class="mg-cc-cor"><span class="mg-cc-amostra-cor" style="background:${c.fundo}"></span>fundo ${c.fundo.toUpperCase()}</span>`;
    const ret = casca.corpo.querySelector('.mg-cc-retorno');
    ret.className = 'mg-cc-retorno';
    ret.innerHTML = '<span class="mg-cc-espera">Decida: o texto acima passa no AA?</span>';
    casca.corpo.querySelectorAll('.mg-cc-resp').forEach((b) => { b.disabled = false; });
    animar(casca.corpo.querySelector('.mg-cc-cartao'), 'anim-pop');
    casca.anunciar(`Cartão ${indice + 1}. "${c.frase}", ${c.estilo.px} pixels, ${nomePeso(c.estilo.peso)}. Texto ${c.texto}, fundo ${c.fundo}. Passa AA? Tecla A para sim, N para não.`);
  }

  function responder(disse) {
    if (estado !== 'pergunta') return;
    estado = 'retorno';
    const c = cartoes[indice];
    const ok = disse === c.passa;
    respondidos += 1;
    if (ok) { acertos += 1; sequencia += 1; } else sequencia = 0;
    respostas.push({ ...c, ok, disse });
    casca.corpo.querySelectorAll('.mg-cc-resp').forEach((b) => { b.disabled = true; });
    const placar = casca.corpo.querySelector('.mg-cc-placar');
    placar.textContent = `${acertos} ${acertos === 1 ? 'acerto' : 'acertos'}${sequencia >= 3 ? `, sequência ${sequencia}` : ''}`;
    const ret = casca.corpo.querySelector('.mg-cc-retorno');
    ret.className = `mg-cc-retorno callout ${ok ? 'callout-ok' : 'callout-bad'}`;
    const tipo = c.grande ? 'texto grande, mínimo 3:1' : 'texto normal, mínimo 4,5:1';
    ret.innerHTML = `
      <span class="mg-callout-ic">${icone(ok ? 'ok' : 'erro')}</span>
      <span><strong>${ok ? 'Certo' : 'Errado'}:</strong> <span class="mg-cc-razao">${num(c.razao, 2)}:1</span> ${tipo}. ${c.passa ? 'Passa.' : 'Não passa.'}</span>`;
    if (!ok) animar(casca.corpo.querySelector('.mg-cc-cartao'), 'anim-shake');
    casca.anunciar(`${ok ? 'Certo' : 'Errado'}. Contraste ${num(c.razao, 2)} para 1, ${tipo}. ${c.passa ? 'Passa.' : 'Não passa.'}`);
    ciclo.timeout(() => {
      if (estado !== 'retorno') return;
      indice += 1;
      if (indice >= MAX_CARTOES || indice >= cartoes.length) encerrar();
      else mostrarCartao();
    }, PAUSA_RETORNO);
  }

  function pontuacao() {
    if (!respondidos) return 0;
    return Math.round(70 * (acertos / respondidos) + 30 * Math.min(1, respondidos / MAX_CARTOES) * (acertos / respondidos));
  }

  function encerrar() {
    if (estado === 'fim') return;
    estado = 'fim';
    if (pararTique) pararTique();
    const pontos = pontuacao();
    const segundos = Math.round((performance.now() - inicio) / 1000);
    const grupo = (f) => respostas.filter(f);
    const normais = grupo((r) => r.cat === 'normal');
    const grandes = grupo((r) => r.cat === 'grande');
    const armadilhas = grupo((r) => r.cat === 'armadilha');
    const conta = (lista) => `${lista.filter((r) => r.ok).length} de ${lista.length}`;
    const recap = [];
    if (normais.length) recap.push({
      ok: normais.every((r) => r.ok),
      titulo: `Texto normal (${conta(normais)})`,
      texto: ' Abaixo de 24px regular, o mínimo é 4,5:1. Entre 4 e 4,4 o texto parece legível, mas reprova.'
    });
    if (grandes.length) recap.push({
      ok: grandes.every((r) => r.ok),
      titulo: `Texto grande (${conta(grandes)})`,
      texto: ' Com 24px ou mais (ou 18,66px em negrito), 3:1 basta: um 3,5:1 passa em título, mas reprovaria em texto corrido.'
    });
    if (armadilhas.length) recap.push({
      ok: armadilhas.every((r) => r.ok),
      titulo: `Armadilhas de tamanho (${conta(armadilhas)})`,
      texto: ' 18px em negrito e 20px ou 22px regulares ainda são texto normal: continuam exigindo 4,5:1.'
    });
    if (!respostas.length) recap.push({ ok: false, titulo: 'Nenhum cartão respondido', texto: ' Contraste = (L1 + 0,05) / (L2 + 0,05), com L a luminância relativa das duas cores.' });
    const erros = respostas.filter((r) => !r.ok).slice(0, 4);
    const extraHtml = erros.length ? `
      <h3 class="mg-h3">Cartões para rever</h3>
      <ul class="mg-cc-erros">${erros.map((r) => `
        <li class="mg-cc-erro">
          <span class="mg-cc-mini" style="background:${r.fundo};color:${r.texto};font-weight:${r.estilo.peso}">Aa</span>
          <span><strong>${escapar(r.frase)}</strong>, ${r.estilo.px}px ${nomePeso(r.estilo.peso)}: ${num(r.razao, 2)}:1, mínimo ${r.grande ? '3:1' : '4,5:1'}. ${r.passa ? 'Passava.' : 'Não passava.'}</span>
        </li>`).join('')}
      </ul>` : '';
    telaResultado(casca, {
      pontos,
      estatisticas: [`${acertos} de ${respondidos} acertos`, `${respondidos} ${respondidos === 1 ? 'cartão' : 'cartões'} em ${Math.round(DURACAO - restante)}s de relógio`, `tempo total: ${segundos}s`],
      recap,
      extraHtml,
      aoContinuar: () => finalizar(pontos)
    }, ciclo);
  }

  ciclo.ouvir(document, 'keydown', (e) => {
    if (!teclaUtil(e, raiz)) return;
    if (estado !== 'pergunta') return;
    const k = e.key.toLowerCase();
    if (k === 'a' || k === 'n') {
      e.preventDefault();
      responder(k === 'a');
    }
  });

  telaIntro(casca, {
    titulo: 'Corrida do Contraste',
    objetivo: 'Em 60 segundos, decida se cada texto passa no contraste AA da WCAG para o tamanho e o peso indicados.',
    duracao: '60 s de corrida',
    nomeIcone: 'contraste',
    passos: [
      'Texto normal precisa de 4,5:1; texto grande (24px, ou 18,66px em negrito) precisa de 3:1.',
      'Responda com <kbd>A</kbd> (passa AA) ou <kbd>N</kbd> (não passa), ou toque nos botões.',
      'Depois de cada resposta, a razão calculada aparece por um instante. O relógio pausa enquanto ela aparece.'
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
