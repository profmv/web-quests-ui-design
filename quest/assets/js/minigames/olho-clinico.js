/**
 * OBJECTIVE: Minigame "Olho Clínico" - 8 rounds comparing two near-identical UI snippets;
 *            the player picks the one without the subtle flaw (R4, R7, R9 of the teaching spec).
 * USAGE: import { iniciar } from './minigames/olho-clinico.js';
 *        const jogo = await iniciar(elemento, { aoTerminar(resultado) {} }); jogo.destruir();
 * OUTPUTS: aoTerminar({ jogo: 'olho-clinico', pontos, acertos, total, segundos }) exactly once.
 * RULES: zero emojis, SVG icons only, keys 1/2 to choose, Enter for next round.
 */

import {
  icone, criarCiclo, montarCasca, telaIntro, telaResultado, criarFinalizador,
  embaralhar, teclaUtil, animar, num, razaoContraste
} from './comum.js';

const JOGO = 'olho-clinico';
// Phones stack the two options vertically, so they get more time to compare.
const TEMPO_RODADA = typeof matchMedia === 'function' && matchMedia('(max-width: 640px)').matches ? 22 : 15;

const SVG_ICONES = {
  agenda: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  local: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  pessoa: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  sino: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  coracao: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  casa: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v12h14V9"/>'
};

function svgIc(nome, traco = 2, tamanho = 24) {
  return `<svg class="mg-s-svg" width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${traco}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${SVG_ICONES[nome]}</svg>`;
}

function esp(px, ruim) {
  return `<span class="mg-esp" style="height:${px}px" data-medida="${px}"${ruim ? ' data-tom="ruim"' : ''}></span>`;
}

function tag(texto, estilo, ruim) {
  return `<span class="mg-anot mg-tag" style="${estilo}"${ruim ? ' data-tom="ruim"' : ''}>${texto}</span>`;
}

const COR_TEXTO_BOM = '#444c5a';
const COR_TEXTO_FRACO = '#8e95a1';

/* Each round: montar(falho) returns the snippet HTML (spans only, it lives inside a <button>). */
const RODADAS = [
  {
    id: 'grid',
    titulo: 'Grid de 8px',
    regra: 'Espaços fora da escala (13px) quebram o ritmo: 8 dentro do grupo, 24 antes da ação principal e padding igual ao maior espaço interno.',
    montar(falho) {
      const v = falho ? [13, 8, 8, 13, 16] : [24, 8, 8, 24, 24];
      const ruim = falho ? [true, false, false, true, false] : [];
      return `
        <span class="mg-s-card">
          ${esp(v[0], ruim[0])}
          <span class="mg-s-chip">Workshop</span>
          ${esp(v[1], ruim[1])}
          <span class="mg-s-tit">Dia do Design</span>
          ${esp(v[2], ruim[2])}
          <span class="mg-s-meta">16 de maio, Auditório B</span>
          ${esp(v[3], ruim[3])}
          <span class="mg-s-botao">Inscrever-se</span>
          ${esp(v[4], ruim[4])}
        </span>`;
    }
  },
  {
    id: 'alinhamento',
    titulo: 'Alinhamento',
    regra: 'Textos que dividem uma borda precisam começar na mesma linha; 4px de desvio já parecem descuido.',
    montar(falho) {
      const linhas = [
        ['agenda', 'Programação', '12 a 16 de novembro'],
        ['local', 'Auditório 2', 'Bloco C, térreo'],
        ['pessoa', 'Palestrantes', '8 convidados']
      ];
      return `
        <span class="mg-s-lista">
          ${linhas.map((l, i) => `
            <span class="mg-s-linha">
              <span class="mg-s-ico">${svgIc(l[0])}</span>
              <span class="mg-s-txt"${falho && i === 1 ? ' style="margin-left:4px"' : ''}>
                <span class="mg-s-forte">${l[1]}</span><span class="mg-s-fraco">${l[2]}</span>
              </span>
            </span>`).join('')}
          <span class="mg-anot mg-guia-v" style="left:56px"${falho ? ' data-tom="ruim"' : ''}></span>
          ${falho ? tag('+4px', 'left:64px;top:50%;transform:translate(76px,-50%)', true) : tag('borda comum', 'left:60px;top:-10px', false)}
        </span>`;
    }
  },
  {
    id: 'raio',
    titulo: 'Raio aninhado',
    regra: 'Raio externo = raio interno + padding (24 = 16 + 8); com raios iguais, a moldura engrossa nos cantos.',
    montar(falho) {
      const interno = falho ? 24 : 16;
      return `
        <span class="mg-s-galeria">
          <span class="mg-s-foto" style="border-radius:${interno}px"></span>
          <span class="mg-s-legenda"><span class="mg-s-forte-inv">Galeria do evento</span><span class="mg-s-fraco-inv">48 fotos</span></span>
          ${tag('R 24', 'left:-8px;top:-12px', falho)}
          ${tag(`r ${interno}`, 'left:24px;top:24px', falho)}
          ${tag(falho ? '24 &ne; 24 + 8' : '24 = 16 + 8', 'right:-8px;bottom:-12px', falho)}
        </span>`;
    }
  },
  {
    id: 'optico',
    titulo: 'Centralização óptica',
    regra: 'Um triângulo centrado pela caixa parece puxado para a esquerda; desloque-o uns 3px para a direita (centro óptico, slide 15).',
    montar(falho) {
      const dx = falho ? 0 : 3;
      const x0 = 25 + dx;
      const cx = (x0 * 2 + x0 + 30) / 3;
      return `
        <span class="mg-s-video">
          <svg class="mg-s-play" width="80" height="80" viewBox="0 0 80 80" aria-hidden="true" focusable="false">
            <circle cx="40" cy="40" r="40" class="mg-s-play-fundo"/>
            <polygon points="${x0},23 ${x0 + 30},40 ${x0},57" class="mg-s-play-tri"/>
            <g class="mg-anot mg-anot-svg${falho ? ' is-ruim' : ''}">
              <line x1="40" y1="2" x2="40" y2="78"/>
              <line x1="2" y1="40" x2="78" y2="40"/>
              <rect x="${x0}" y="23" width="30" height="34" fill="none" stroke-dasharray="3 3"/>
              <circle cx="${cx}" cy="40" r="3" class="mg-anot-ponto"/>
            </g>
          </svg>
          <span class="mg-s-dur">Aula 3, 12:40</span>
          ${tag(falho ? 'caixa centrada' : '+3px óptico', 'left:50%;top:12px;transform:translateX(-50%)', falho)}
        </span>`;
    }
  },
  {
    id: 'contraste',
    titulo: 'Contraste de texto',
    regra: 'Texto normal pede contraste mínimo de 4,5:1 com o fundo (WCAG 1.4.3); o cinza claro "elegante" reprova.',
    montar(falho) {
      const cor = falho ? COR_TEXTO_FRACO : COR_TEXTO_BOM;
      const r = razaoContraste(cor, '#ffffff');
      return `
        <span class="mg-s-notif">
          <span class="mg-s-avatar">PR</span>
          <span class="mg-s-notif-txt">
            <span class="mg-s-forte">Prof. Ramos</span>
            <span class="mg-s-desc" style="color:${cor}">Enviou o briefing do card de evento.</span>
            <span class="mg-s-hora" style="color:${cor}">há 5 min</span>
          </span>
          ${tag(`${num(r, 1)}:1`, 'right:8px;bottom:-10px', falho)}
        </span>`;
    }
  },
  {
    id: 'tracking',
    titulo: 'Espaço entre letras',
    regra: 'Num título, os espaços entre letras precisam parecer iguais; um par mais aberto parte a palavra em pedaços.',
    montar(falho) {
      const letras = ['N', 'Ú', 'M', 'E', 'R', 'O', 'S'];
      const extra = falho ? { 2: 4, 4: 3 } : {};
      return `
        <span class="mg-s-cab">
          <span class="mg-s-sobre">Painel da semana</span>
          <span class="mg-s-palavra">${letras.map((l, i) => {
            if (i === letras.length - 1) return `<span>${l}</span>`;
            const e = extra[i] || 0;
            return `<span>${l}</span><span class="mg-s-gap" style="width:${2 + e}px">${e ? `<span class="mg-anot mg-tag" data-tom="ruim" style="left:50%;top:calc(100% + 2px);transform:translateX(-50%)">+${e}</span>` : ''}</span>`;
          }).join('')}</span>
          <span class="mg-s-traco"></span>
          <span class="mg-s-meta">Inscrições, presença e certificados</span>
          ${falho ? '' : tag('2px em todos os pares', 'left:0;top:-12px', false)}
        </span>`;
    }
  },
  {
    id: 'traco',
    titulo: 'Peso dos ícones',
    regra: 'Ícones de um mesmo conjunto usam a mesma espessura de traço; misturar 1,25 e 2,75 com 2 deixa uns apagados e outros gritando.',
    montar(falho) {
      const icones = ['casa', 'busca', 'sino', 'coracao'];
      const tracos = falho ? [2, 2, 1.25, 2.75] : [2, 2, 2, 2];
      return `
        <span class="mg-s-barra">
          ${icones.map((n, i) => `
            <span class="mg-s-icbtn">${svgIc(n, tracos[i])}
              ${tag(num(tracos[i], tracos[i] % 1 ? 2 : 0), 'left:50%;bottom:-24px;transform:translateX(-50%)', tracos[i] !== 2)}
            </span>`).join('')}
        </span>`;
    }
  },
  {
    id: 'vertical',
    titulo: 'Centro vertical do botão',
    regra: 'O rótulo deve ficar no centro vertical do botão; padding assimétrico desalinha o texto em relação ao campo vizinho.',
    montar(falho) {
      return `
        <span class="mg-s-form">
          <span class="mg-s-campo">seu@email.com</span>
          <span class="mg-s-botao mg-s-botao-assinar"${falho ? ' style="padding-top:8px"' : ''}>Assinar</span>
          <span class="mg-anot mg-guia-h"${falho ? ' data-tom="ruim"' : ''}></span>
          ${tag(falho ? 'texto 4px abaixo' : 'centro em 24', 'right:0;top:-24px', falho)}
        </span>`;
    }
  }
];

export async function iniciar(raiz, opcoes = {}) {
  const ciclo = criarCiclo();
  const total = RODADAS.length;
  let inicio = 0;
  let acertos = 0;
  let bonus = 0;
  const historico = [];
  let estado = 'intro';
  let ordem = [];
  let indice = 0;
  let indiceBom = 0;
  let inicioRodada = 0;
  let pararRelogio = null;
  let botaoProxima = null;

  const casca = montarCasca(raiz, {
    id: JOGO,
    titulo: 'Olho Clínico',
    nomeIcone: 'olho',
    aoPular: () => finalizar(0, { pulado: true })
  }, ciclo);

  const finalizar = criarFinalizador(JOGO, opcoes, casca, ciclo, () => ({
    acertos,
    total,
    segundos: inicio ? (performance.now() - inicio) / 1000 : 0
  }));

  function comecar() {
    inicio = performance.now();
    ordem = embaralhar(RODADAS);
    indice = 0;
    mostrarRodada();
  }

  function mostrarRodada() {
    const r = ordem[indice];
    indiceBom = Math.random() < 0.5 ? 0 : 1;
    estado = 'escolha';
    casca.status.textContent = `Rodada ${indice + 1} de ${total}`;
    const opcoesHtml = [0, 1].map((n) => {
      const falho = n !== indiceBom;
      return `
        <button type="button" class="mg-oc-opcao" data-n="${n}" aria-label="Opção ${n + 1}">
          <span class="mg-oc-rot"><kbd>${n + 1}</kbd><span>Opção ${n + 1}</span><span class="mg-oc-veredito"></span></span>
          <span class="mg-oc-palco">${r.montar(falho)}</span>
        </button>`;
    }).join('');
    casca.corpo.innerHTML = `
      <div class="mg-oc">
        <div class="mg-oc-cab">
          <p class="mg-oc-pergunta"><strong>Qual versão está mais bem resolvida?</strong> <span class="mg-dica-teclas">Clique ou use <kbd>1</kbd> e <kbd>2</kbd>.</span></p>
          <div class="mg-tempo" aria-hidden="true">
            ${icone('relogio', 'mg-ic mg-ic-16')}
            <span class="mg-barra"><span class="mg-barra-fill"></span></span>
            <span class="mg-tempo-num">${TEMPO_RODADA}s</span>
          </div>
        </div>
        <div class="mg-oc-grade">${opcoesHtml}</div>
        <div class="mg-oc-retorno" hidden></div>
      </div>`;
    casca.corpo.querySelectorAll('.mg-oc-opcao').forEach((b) => {
      ciclo.ouvir(b, 'click', () => escolher(Number(b.dataset.n)));
    });
    casca.anunciar(`Rodada ${indice + 1} de ${total}. Escolha a opção 1 ou 2. ${TEMPO_RODADA} segundos.`);
    const primeira = casca.corpo.querySelector('.mg-oc-opcao');
    if (raiz.contains(document.activeElement) || document.activeElement === document.body) primeira.focus({ preventScroll: true });
    iniciarRelogio();
  }

  function iniciarRelogio() {
    inicioRodada = performance.now();
    const fill = casca.corpo.querySelector('.mg-barra-fill');
    const numEl = casca.corpo.querySelector('.mg-tempo-num');
    const tempoEl = casca.corpo.querySelector('.mg-tempo');
    const tique = () => {
      const passado = (performance.now() - inicioRodada) / 1000;
      const resta = Math.max(0, TEMPO_RODADA - passado);
      fill.style.transform = `scaleX(${resta / TEMPO_RODADA})`;
      numEl.textContent = `${Math.ceil(resta)}s`;
      tempoEl.classList.toggle('is-alerta', resta <= 5);
      if (resta <= 0) escolher(null);
    };
    tique();
    pararRelogio = ciclo.intervalo(tique, 100);
  }

  function escolher(n) {
    if (estado !== 'escolha') return;
    estado = 'revelado';
    if (pararRelogio) pararRelogio();
    const r = ordem[indice];
    const passado = (performance.now() - inicioRodada) / 1000;
    const resta = Math.max(0, TEMPO_RODADA - passado);
    const ok = n === indiceBom;
    if (ok) {
      acertos += 1;
      bonus += resta / TEMPO_RODADA;
    }
    historico.push({ rodada: r, ok, tempo: n === null });

    const grade = casca.corpo.querySelector('.mg-oc-grade');
    grade.classList.add('is-revelado');
    grade.querySelectorAll('.mg-oc-opcao').forEach((b) => {
      const m = Number(b.dataset.n);
      const bom = m === indiceBom;
      b.disabled = true;
      b.classList.add(bom ? 'is-bom' : 'is-ruim');
      if (m === n) b.classList.add('is-escolhida');
      b.querySelector('.mg-oc-veredito').innerHTML = bom
        ? `<span class="chip chip-ok">${icone('ok', 'mg-ic mg-ic-16')}Sem falha</span>`
        : `<span class="chip chip-redline">${icone('alvo', 'mg-ic mg-ic-16')}Falha</span>`;
      b.setAttribute('aria-label', `Opção ${m + 1}: ${bom ? 'sem falha' : 'com falha'}`);
    });
    const titulo = n === null ? 'Tempo esgotado.' : ok ? 'Acertou!' : 'Não foi dessa vez.';
    const ultima = indice === total - 1;
    const retorno = casca.corpo.querySelector('.mg-oc-retorno');
    retorno.hidden = false;
    retorno.innerHTML = `
      <div class="callout ${ok ? 'callout-ok' : 'callout-bad'} mg-oc-callout anim-pop">
        <span class="mg-callout-ic">${icone(ok ? 'ok' : 'erro')}</span>
        <span><strong>${titulo}</strong> A versão com falha está anotada em vermelho. <strong>${r.titulo}:</strong> ${r.regra}</span>
      </div>
      <button type="button" class="btn btn-primary mg-proxima">${ultima ? 'Ver resultado' : 'Próxima rodada'}${icone('seta', 'mg-ic mg-ic-16')}</button>`;
    if (!ok) animar(grade.querySelector(`.mg-oc-opcao[data-n="${n ?? indiceBom}"]`), 'anim-shake');
    botaoProxima = retorno.querySelector('.mg-proxima');
    ciclo.ouvir(botaoProxima, 'click', avancar);
    botaoProxima.focus({ preventScroll: true });
    retorno.scrollIntoView?.({ block: 'nearest' });
    casca.anunciar(`${titulo} A opção ${indiceBom + 1} era a correta. ${r.titulo}: ${r.regra}`);
  }

  function avancar() {
    if (estado !== 'revelado') return;
    indice += 1;
    if (indice < total) mostrarRodada();
    else mostrarResultado();
  }

  function pontuacao() {
    return Math.round((85 * acertos) / total + (15 * bonus) / total);
  }

  function mostrarResultado() {
    estado = 'fim';
    const pontos = pontuacao();
    const segundos = Math.round((performance.now() - inicio) / 1000);
    telaResultado(casca, {
      pontos,
      estatisticas: [`${acertos} de ${total} acertos`, `tempo: ${segundos}s`],
      recap: historico.map((h) => ({ ok: h.ok, titulo: h.rodada.titulo, texto: ` ${h.rodada.regra}` })),
      aoContinuar: () => finalizar(pontos)
    }, ciclo);
  }

  ciclo.ouvir(document, 'keydown', (e) => {
    if (!teclaUtil(e, raiz)) return;
    if (estado === 'escolha' && (e.key === '1' || e.key === '2')) {
      e.preventDefault();
      escolher(Number(e.key) - 1);
    } else if (estado === 'revelado' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      avancar();
    }
  });

  telaIntro(casca, {
    titulo: 'Olho Clínico',
    objetivo: `Em 8 rodadas, escolha a versão sem o defeito sutil antes que os ${TEMPO_RODADA} segundos acabem.`,
    duracao: 'cerca de 3 min',
    nomeIcone: 'olho',
    passos: [
      'As duas versões são quase iguais: procure espaçamento, alinhamento, raio, contraste, traço e centralização.',
      'Clique na melhor versão ou use <kbd>1</kbd> e <kbd>2</kbd>; <kbd>Enter</kbd> avança.',
      'Depois de cada escolha, as medidas aparecem em vermelho com a regra que explica o defeito.'
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
