/**
 * OBJECTIVE: Interactive workbench engines for all 8 quest locks + certificate renderer.
 * USAGE: import { montarBancada } from './bancadas.js';
 * ACCESSIBILITY: Keyboard navigable, high contrast, prefers-reduced-motion safe.
 * RULE 5: Strictly ZERO emojis. Inline SVGs only.
 */

import { escaparHtml, nomeArquivoSeguro } from "./util.js";

/**
 * Returns a shuffled copy (Fisher-Yates). Option order must not reveal the answer.
 */
function embaralhar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Shuffles options and replaces their ids with opaque per-render tokens.
 * Correctness stays in JS memory (returned map), never in the DOM.
 */
function prepararOpcoes(opcoes) {
  const corretas = new Map();
  const lista = embaralhar(opcoes).map((opt, idx) => {
    const token = `o${idx}`;
    corretas.set(token, opt.correto === true);
    return { ...opt, token };
  });
  return { lista, corretas };
}

function caixaPista(texto) {
  return `
    <div class="clue-reveal-box">
      <svg class="icon"><use href="#icon-key"></use></svg>
      <span>${texto}</span>
    </div>
  `;
}

/**
 * Mounts the workbench for a stage. onRevealedClue() is called (without the answer:
 * the caller already holds it in the decrypted stage) when the bench is solved.
 */
export function montarBancada(tipo, containerEl, dados, onRevealedClue) {
  if (!containerEl) return;
  containerEl.innerHTML = "";

  switch (tipo) {
    case "diff-picker":
      montarDiffPicker(containerEl, dados, onRevealedClue);
      break;
    case "state-fixer":
      montarStateFixer(containerEl, dados, onRevealedClue);
      break;
    case "pattern-hunter":
      montarPatternHunter(containerEl, dados, onRevealedClue);
      break;
    case "grid-aligner":
      montarGridAligner(containerEl, dados, onRevealedClue);
      break;
    case "wireframe-builder":
      montarWireframeBuilder(containerEl, dados, onRevealedClue);
      break;
    case "critique-evaluator":
      montarCritiqueEvaluator(containerEl, dados, onRevealedClue);
      break;
    case "clinical-gauntlet":
      montarClinicalGauntlet(containerEl, dados, onRevealedClue);
      break;
    case "figma-ready":
      montarFigmaReady(containerEl, dados, onRevealedClue);
      break;
    case "certificate-generator":
      montarCertificado(containerEl, dados);
      break;
    default:
      containerEl.innerHTML = `<p class="role-desc">[Bancada não configurada para este desafio]</p>`;
  }
}

// ---------------------------------------------------------------------------
// 1. Diff Picker (Can't Unsee Style)
// ---------------------------------------------------------------------------
function montarDiffPicker(container, dados, onClue) {
  // Random left/right order; labels follow the on-screen position, not the data key.
  const chaves = embaralhar(["A", "B"]);
  const cartao = (chave, pos) => {
    const op = chave === "A" ? dados.opcao_a : dados.opcao_b;
    const rotulo = pos === 0 ? "Cartão A" : "Cartão B";
    return `
      <div class="diff-card" data-pos="${pos}" tabindex="0" role="radio" aria-checked="false">
        <div>
          <span class="diff-card-label">${rotulo}</span>
          <div style="${op.titulo_estilo} margin-top: 8px;">${op.titulo_texto}</div>
          <div style="${op.corpo_estilo} margin-top: 8px;">${op.corpo_texto}</div>
        </div>
        <button type="button" tabindex="-1" style="${op.botao_estilo} margin-top: 16px;">${op.botao_texto}</button>
      </div>
    `;
  };

  const html = `
    <div class="workbench-title-bar">
      <span class="workbench-label">
        <svg class="icon icon-sm"><use href="#icon-eye"></use></svg>
        Bancada Mini-Diff: Inspeção de Hierarquia
      </span>
      <span class="stat-pill">${dados.pergunta || "Selecione o cartão correto"}</span>
    </div>
    <div class="diff-container" role="radiogroup" aria-label="Opções de Cartão">
      ${chaves.map((ch, pos) => cartao(ch, pos)).join("")}
    </div>
    <div id="diff-feedback-slot"></div>
  `;
  container.innerHTML = html;

  const cards = [...container.querySelectorAll(".diff-card")];
  const slot = container.querySelector("#diff-feedback-slot");

  function escolher(pos) {
    cards.forEach((c) => {
      c.classList.remove("selected-correct", "selected-incorrect");
      c.setAttribute("aria-checked", "false");
    });
    const el = cards[pos];
    el.setAttribute("aria-checked", "true");

    if (chaves[pos] === dados.opcao_correta) {
      el.classList.add("selected-correct");
      slot.innerHTML = caixaPista(dados.dica_revelada);
      if (onClue) onClue();
    } else {
      el.classList.add("selected-incorrect");
      slot.innerHTML = `
        <div class="answer-feedback error" style="display: block; margin-top: 12px;">
          [AVISO] Neste cartão o corpo do texto (22px em negrito) pesa mais que o título (13px cinza). A hierarquia está invertida e confunde o escaneamento natural!
        </div>
      `;
    }
  }

  cards.forEach((card, pos) => {
    card.addEventListener("click", () => escolher(pos));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); escolher(pos); }
    });
  });
}

// ---------------------------------------------------------------------------
// 2. State Fixer (Affordance & Button State Machine)
// ---------------------------------------------------------------------------
function montarStateFixer(container, dados, onClue) {
  const opcoesPorEstado = {};
  dados.estados_obrigatorios.forEach((est) => {
    opcoesPorEstado[est] = prepararOpcoes(dados.configuracoes_disponiveis[est] || []);
  });

  const html = `
    <div class="workbench-title-bar">
      <span class="workbench-label">
        <svg class="icon icon-sm"><use href="#icon-sliders"></use></svg>
        Bancada de Estados de Componente (Signifiers)
      </span>
      <span class="stat-pill">${dados.estados_obrigatorios.length} Estados Necessários</span>
    </div>
    <div class="state-fixer-grid">
      ${dados.estados_obrigatorios.map((est) => `
        <div class="state-item">
          <div class="state-name">Estado: ${est.toUpperCase()}</div>
          <select class="state-select" data-estado="${est}">
            <option value="">-- Selecione o signifier adequado --</option>
            ${opcoesPorEstado[est].lista.map((cfg) => `
              <option value="${cfg.token}">${cfg.texto}</option>
            `).join("")}
          </select>
        </div>
      `).join("")}
    </div>

    <div class="interactive-preview-box">
      <div style="font-size: 0.8125rem; font-weight: 700; color: var(--text-subtle); margin-bottom: 8px;">
        Área de Teste do Botão (Passe o mouse, clique ou teste o foco)
      </div>
      <button type="button" id="fixer-demo-btn" class="btn btn-primary" style="padding: 12px 24px; font-size: 1rem;">
        Confirmar Pagamento
      </button>
    </div>
    <div id="fixer-feedback-slot"></div>
  `;
  container.innerHTML = html;

  const selects = container.querySelectorAll(".state-select");
  const slot = container.querySelector("#fixer-feedback-slot");

  function checarEstados() {
    let todosRespondidos = true;
    let todosCorretos = true;

    selects.forEach((sel) => {
      if (!sel.value) todosRespondidos = false;
      if (!opcoesPorEstado[sel.dataset.estado].corretas.get(sel.value)) {
        todosCorretos = false;
      }
    });

    if (todosRespondidos && todosCorretos) {
      slot.innerHTML = caixaPista(dados.dica_revelada);
      if (onClue) onClue();
    } else if (todosRespondidos) {
      slot.innerHTML = `
        <div class="answer-feedback error" style="display: block; margin-top: 12px;">
          [AVISO] Alguns estados ainda não comunicam o affordance correto. Revise cada estado com base no Slide 7.
        </div>
      `;
    }
  }

  selects.forEach((sel) => sel.addEventListener("change", checarEstados));
}

// ---------------------------------------------------------------------------
// 3. Pattern Hunter (Consistência vs Dark Patterns)
// ---------------------------------------------------------------------------
function montarPatternHunter(container, dados, onClue) {
  let neutralizados = 0;
  const total = dados.armadilhas.length;

  const html = `
    <div class="workbench-title-bar">
      <span class="workbench-label">
        <svg class="icon icon-sm"><use href="#icon-pointer"></use></svg>
        Bancada Anti-Dark Pattern: Desarme as Armadilhas
      </span>
      <span class="stat-pill" id="hunt-counter">Desarmadas: 0 / ${total}</span>
    </div>
    <div class="modal-deceptive-mock">
      <div style="font-size: 1.125rem; font-weight: 700; margin-bottom: 8px;">Deseja cancelar seu plano?</div>
      <div class="huntable-item" id="trap-wording" tabindex="0">
        <p style="font-size: 0.875rem; color: #475569;" id="txt-wording">
          Desmarque a opção abaixo caso você não queira deixar de não perder acesso imediato a todas as ferramentas.
        </p>
      </div>

      <div class="huntable-item" id="trap-optin" style="margin: 12px 0;" tabindex="0">
        <label style="display: flex; align-items: center; gap: 8px; font-size: 0.75rem; color: #64748b; cursor: pointer;">
          <input type="checkbox" id="chk-optin" checked />
          <span id="txt-optin">Quero renovar automaticamente e receber mensagens patrocinadas cobradas na fatura.</span>
        </label>
      </div>

      <div class="huntable-item" id="trap-buttons" style="display: flex; gap: 8px; align-items: center; justify-content: flex-end; margin-top: 16px;" tabindex="0">
        <a href="#cancelar" id="btn-cancel" style="font-size: 0.75rem; color: #94a3b8; text-decoration: none;">Confirmar cancelamento</a>
        <button type="button" id="btn-keep" class="btn btn-primary" style="background: #16a34a; font-size: 0.875rem;">Manter meu plano com desconto</button>
      </div>
    </div>
    <div id="hunt-feedback-slot"></div>
  `;
  container.innerHTML = html;

  const counter = container.querySelector("#hunt-counter");
  const slot = container.querySelector("#hunt-feedback-slot");

  function desarmar(id, el, onDone) {
    if (el.classList.contains("disarmed")) return;
    el.classList.add("disarmed");
    neutralizados++;
    counter.textContent = `Desarmadas: ${neutralizados} / ${total}`;
    onDone();

    if (neutralizados >= total) {
      slot.innerHTML = caixaPista(dados.dica_revelada);
      if (onClue) onClue();
    }
  }

  const itemWording = container.querySelector("#trap-wording");
  itemWording.addEventListener("click", () => {
    desarmar("wording", itemWording, () => {
      container.querySelector("#txt-wording").innerHTML = "<strong>Texto Normalizado:</strong> Você está prestes a cancelar sua assinatura do plano Pro.";
    });
  });

  const itemOptin = container.querySelector("#trap-optin");
  itemOptin.addEventListener("click", () => {
    desarmar("optin", itemOptin, () => {
      container.querySelector("#chk-optin").checked = false;
      container.querySelector("#txt-optin").innerHTML = "<strong>Opt-in desativado:</strong> Consentimento deve ser explícito e desmarcado por padrão.";
    });
  });

  const itemButtons = container.querySelector("#trap-buttons");
  itemButtons.addEventListener("click", () => {
    desarmar("buttons", itemButtons, () => {
      itemButtons.innerHTML = `
        <button type="button" class="btn btn-secondary" style="font-size: 0.875rem;">Manter Plano</button>
        <button type="button" class="btn" style="background: var(--error); color: white; font-size: 0.875rem;">Confirmar Cancelamento</button>
      `;
    });
  });
}

// ---------------------------------------------------------------------------
// 4. Grid Aligner (8px Modular Grid)
// ---------------------------------------------------------------------------
function montarGridAligner(container, dados, onClue) {
  const valores = {
    paddingCard: 13,
    gapTitulo: 7,
    gapCorpo: 21,
    paddingBotao: 11,
  };

  const html = `
    <div class="workbench-title-bar">
      <span class="workbench-label">
        <svg class="icon icon-sm"><use href="#icon-grid"></use></svg>
        Bancada do Grid de 8px: Ajuste de Ritmo Modular
      </span>
      <label style="display: flex; align-items: center; gap: 6px; font-size: 0.8125rem; font-weight: 600; cursor: pointer;">
        <input type="checkbox" id="toggle-grid-overlay" />
        <span>Sobrepor Grade 8px</span>
      </label>
    </div>

    <div class="grid-controls">
      <div class="grid-control-row">
        <div class="grid-control-label">
          <span>Padding do Card</span>
          <span id="lbl-pad-card">13px</span>
        </div>
        <input type="range" class="grid-slider" id="sld-pad-card" min="8" max="48" step="1" value="13" />
      </div>

      <div class="grid-control-row">
        <div class="grid-control-label">
          <span>Distância Título / Subtítulo</span>
          <span id="lbl-gap-titulo">7px</span>
        </div>
        <input type="range" class="grid-slider" id="sld-gap-titulo" min="4" max="32" step="1" value="7" />
      </div>

      <div class="grid-control-row">
        <div class="grid-control-label">
          <span>Espaço Corpo / Botão</span>
          <span id="lbl-gap-corpo">21px</span>
        </div>
        <input type="range" class="grid-slider" id="sld-gap-corpo" min="8" max="40" step="1" value="21" />
      </div>

      <div class="grid-control-row">
        <div class="grid-control-label">
          <span>Padding Vertical do Botão</span>
          <span id="lbl-pad-btn">11px</span>
        </div>
        <input type="range" class="grid-slider" id="sld-pad-btn" min="4" max="24" step="1" value="11" />
      </div>
    </div>

    <div class="grid-canvas-preview">
      <div class="grid-overlay-bg" id="grid-overlay"></div>
      <div id="harmonic-card" style="background: var(--bg-surface); border: 2px solid var(--border-color); border-radius: 8px; width: 100%; max-width: 380px; padding: 13px; z-index: 1;">
        <h4 id="harmonic-title" style="font-size: 1.125rem; font-weight: 700; margin-bottom: 7px;">Cartão de Notificação</h4>
        <p id="harmonic-body" style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 21px; line-height: 1.5;">
          Ajuste as métricas para múltiplos de 8px até encaixar perfeitamente no ritmo modular do design system.
        </p>
        <button type="button" id="harmonic-btn" class="btn btn-primary" style="padding-top: 11px; padding-bottom: 11px; width: 100%;">
          Ação Harmônica
        </button>
      </div>
    </div>
    <div id="grid-feedback-slot"></div>
  `;
  container.innerHTML = html;

  const toggleGrid = container.querySelector("#toggle-grid-overlay");
  const overlay = container.querySelector("#grid-overlay");
  const card = container.querySelector("#harmonic-card");
  const title = container.querySelector("#harmonic-title");
  const body = container.querySelector("#harmonic-body");
  const btn = container.querySelector("#harmonic-btn");
  const slot = container.querySelector("#grid-feedback-slot");

  toggleGrid.addEventListener("change", () => {
    overlay.classList.toggle("visible", toggleGrid.checked);
  });

  function verificarHarmonia() {
    const isMultiplo8 = (n) => n > 0 && n % 8 === 0;
    const padCardOk = isMultiplo8(valores.paddingCard);
    const gapTitOk = isMultiplo8(valores.gapTitulo);
    const gapCorpoOk = isMultiplo8(valores.gapCorpo);
    const padBtnOk = isMultiplo8(valores.paddingBotao);

    if (padCardOk && gapTitOk && gapCorpoOk && padBtnOk) {
      card.style.borderColor = "var(--success)";
      slot.innerHTML = caixaPista(dados.dica_revelada);
      if (onClue) onClue();
    } else {
      card.style.borderColor = "var(--border-color)";
      slot.innerHTML = "";
    }
  }

  function bindSlider(id, prop, lblId, updateStyle) {
    const sld = container.querySelector(id);
    const lbl = container.querySelector(lblId);
    sld.addEventListener("input", () => {
      const val = parseInt(sld.value, 10);
      valores[prop] = val;
      lbl.textContent = `${val}px`;
      updateStyle(val);
      verificarHarmonia();
    });
  }

  bindSlider("#sld-pad-card", "paddingCard", "#lbl-pad-card", (v) => { card.style.padding = `${v}px`; });
  bindSlider("#sld-gap-titulo", "gapTitulo", "#lbl-gap-titulo", (v) => { title.style.marginBottom = `${v}px`; });
  bindSlider("#sld-gap-corpo", "gapCorpo", "#lbl-gap-corpo", (v) => { body.style.marginBottom = `${v}px`; });
  bindSlider("#sld-pad-btn", "paddingBotao", "#lbl-pad-btn", (v) => {
    btn.style.paddingTop = `${v}px`;
    btn.style.paddingBottom = `${v}px`;
  });
}

// ---------------------------------------------------------------------------
// 5. Wireframe Builder (Low-Fi Abstraction)
// ---------------------------------------------------------------------------
function montarWireframeBuilder(container, dados, onClue) {
  const slotsState = [null, null, null, null];

  const html = `
    <div class="workbench-title-bar">
      <span class="workbench-label">
        <svg class="icon icon-sm"><use href="#icon-layout"></use></svg>
        Bancada Wireframe Low-Fi: Esqueleto Estrutural
      </span>
      <span class="stat-pill">4 Seções Estruturais</span>
    </div>

    <div class="bench-split">
      <div>
        <div style="font-size: 0.8125rem; font-weight: 700; color: var(--text-subtle); margin-bottom: 8px;">
          Banco de Blocos Estruturais (Clique para posicionar)
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;" id="wire-blocks-bank">
          ${embaralhar(dados.blocos_disponiveis).map((b) => `
            <button type="button" class="btn btn-secondary wire-bank-btn" data-id="${b.id}" style="justify-content: flex-start; text-align: left;">
              <div>
                <div style="font-weight: 700;">${b.titulo}</div>
                <div style="font-size: 0.75rem; color: var(--text-subtle);">${b.desc}</div>
              </div>
            </button>
          `).join("")}
        </div>
      </div>

      <div>
        <div style="font-size: 0.8125rem; font-weight: 700; color: var(--text-subtle); margin-bottom: 8px;">
          Estrutura Mobile (Wireframe)
        </div>
        <div class="wireframe-slots-container">
          ${dados.posicoes.map((pos, idx) => `
            <div class="wireframe-slot" data-index="${idx}" tabindex="0" role="button">
              <span style="font-size: 0.75rem; color: var(--text-subtle);">${pos.rotulo}</span>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
    <div id="wire-feedback-slot"></div>
  `;
  container.innerHTML = html;

  const bankBtns = container.querySelectorAll(".wire-bank-btn");
  const slots = container.querySelectorAll(".wireframe-slot");
  const feedbackSlot = container.querySelector("#wire-feedback-slot");

  let blocoSelecionado = null;

  bankBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      bankBtns.forEach((b) => b.classList.remove("btn-primary"));
      btn.classList.add("btn-primary");
      blocoSelecionado = {
        id: btn.dataset.id,
        titulo: btn.querySelector("div > div:first-child").textContent,
      };
    });
  });

  slots.forEach((slot) => {
    slot.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); slot.click(); }
    });
    slot.addEventListener("click", () => {
      if (!blocoSelecionado) return;
      const idx = parseInt(slot.dataset.index, 10);
      slotsState[idx] = blocoSelecionado.id;
      slot.innerHTML = `
        <div class="wireframe-block-draggable">
          ${blocoSelecionado.titulo}
        </div>
      `;
      checarWireframe();
    });
  });

  function checarWireframe() {
    let completo = true;
    let correto = true;

    slots.forEach((slot, idx) => {
      const exp = dados.posicoes[idx].bloco_correto;
      if (!slotsState[idx]) completo = false;
      if (slotsState[idx] !== exp) correto = false;
    });

    if (completo && correto) {
      feedbackSlot.innerHTML = caixaPista(dados.dica_revelada);
      if (onClue) onClue();
    } else if (completo) {
      feedbackSlot.innerHTML = `
        <div class="answer-feedback error" style="display: block; margin-top: 12px;">
          [AVISO] A posição dos blocos não condiz com a convenção de layout mobile (Top App Bar no topo, Bottom Bar na base). Reorganize os blocos.
        </div>
      `;
    }
  }
}

// ---------------------------------------------------------------------------
// 6. Critique Evaluator (Heurísticas de Usabilidade)
// ---------------------------------------------------------------------------
function montarCritiqueEvaluator(container, dados, onClue) {
  const questoes = dados.questoes.map((q) => ({ ...q, preparadas: prepararOpcoes(q.opcoes) }));

  const html = `
    <div class="workbench-title-bar">
      <span class="workbench-label">
        <svg class="icon icon-sm"><use href="#icon-alert"></use></svg>
        Tribunal da Usabilidade: Diagnóstico de Falha Crítica
      </span>
      <span class="stat-pill">Heurísticas de Nielsen</span>
    </div>

    <div style="background: var(--bg-page); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 16px;">
      <div style="font-weight: 700; font-size: 0.9375rem; margin-bottom: 4px;">${dados.caso_titulo}</div>
      <p style="font-size: 0.875rem; color: var(--text-muted); line-height: 1.5;">${dados.caso_relato}</p>
    </div>

    <div style="display: flex; flex-direction: column; gap: 16px;">
      ${questoes.map((q) => `
        <div class="critique-q" data-qid="${q.id}">
          <div style="font-weight: 700; font-size: 0.875rem; margin-bottom: 8px;">${q.enunciado}</div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${q.preparadas.lista.map((opt) => `
              <label style="display: flex; align-items: flex-start; gap: 8px; font-size: 0.875rem; cursor: pointer; padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-surface);">
                <input type="radio" name="critique_${q.id}" value="${opt.token}" />
                <span>${opt.texto}</span>
              </label>
            `).join("")}
          </div>
        </div>
      `).join("")}
    </div>
    <div id="critique-feedback-slot"></div>
  `;
  container.innerHTML = html;

  const slot = container.querySelector("#critique-feedback-slot");
  const radios = container.querySelectorAll("input[type=radio]");

  function checarCritique() {
    const marcadas = questoes.map((q) => container.querySelector(`input[name='critique_${q.id}']:checked`));

    if (marcadas.every(Boolean)) {
      if (questoes.every((q, i) => q.preparadas.corretas.get(marcadas[i].value))) {
        slot.innerHTML = caixaPista(dados.dica_revelada);
        if (onClue) onClue();
      } else {
        slot.innerHTML = `
          <div class="answer-feedback error" style="display: block; margin-top: 12px;">
            [AVISO] Diagnóstico incorreto. Releia as 10 heurísticas de Jakob Nielsen sobre prevenção de perda de dados e mensagens de erro construtivas.
          </div>
        `;
      }
    }
  }

  radios.forEach((r) => r.addEventListener("change", checarCritique));
}

// ---------------------------------------------------------------------------
// 7. Clinical Gauntlet (5 Micro-Desafios Rápidos)
// ---------------------------------------------------------------------------
function montarClinicalGauntlet(container, dados, onClue) {
  let rodadaAtual = 0;
  const etapas = dados.etapas_gauntlet;
  const PAUSA_MS = 1800;

  // Optional per-option detail (e.g. measured contrast ratio) is shown only after answering.
  function listaDetalhes(opcoes) {
    const comDetalhe = opcoes.filter((o) => o.detalhe);
    if (comDetalhe.length === 0) return "";
    return `<ul class="gauntlet-details">${comDetalhe.map((o) => `<li>${o.texto}: <strong>${o.detalhe}</strong></li>`).join("")}</ul>`;
  }

  function renderizarRodada() {
    if (rodadaAtual >= etapas.length) {
      container.innerHTML = caixaPista(dados.dica_revelada);
      if (onClue) onClue();
      return;
    }

    const item = etapas[rodadaAtual];
    const { lista, corretas } = prepararOpcoes(item.opcoes);
    container.innerHTML = `
      <div class="workbench-title-bar">
        <span class="workbench-label">
          <svg class="icon icon-sm"><use href="#icon-sparkles"></use></svg>
          ${item.titulo}
        </span>
        <span class="stat-pill">Precisão: ${rodadaAtual + 1} / ${etapas.length}</span>
      </div>
      <div style="font-weight: 700; font-size: 0.9375rem; margin-bottom: 12px;">${item.pergunta}</div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${lista.map((opt) => `
          <button type="button" class="btn btn-secondary gauntlet-opt-btn" data-token="${opt.token}" style="justify-content: flex-start; text-align: left; padding: 10px 14px;">
            ${opt.texto}
          </button>
        `).join("")}
      </div>
      <div id="gauntlet-alert-slot" aria-live="polite"></div>
    `;

    const btns = container.querySelectorAll(".gauntlet-opt-btn");
    const alertSlot = container.querySelector("#gauntlet-alert-slot");
    const detalhes = listaDetalhes(item.opcoes);

    btns.forEach((btn) => {
      btn.addEventListener("click", () => {
        // Lock the round while feedback is shown (prevents skipping rounds)
        btns.forEach((b) => { b.disabled = true; });
        if (corretas.get(btn.dataset.token)) {
          rodadaAtual++;
          if (!detalhes) { renderizarRodada(); return; }
          alertSlot.innerHTML = `
            <div class="answer-feedback success" style="display: block; margin-top: 12px;">
              [OK] Correto! Medições desta rodada:${detalhes}
            </div>
          `;
          setTimeout(renderizarRodada, PAUSA_MS);
        } else {
          rodadaAtual = 0;
          alertSlot.innerHTML = `
            <div class="answer-feedback error" style="display: block; margin-top: 12px;">
              [ERRO DE PRECISÃO] Resposta incorreta! O circuito do gauntlet foi reiniciado. Calibre o olhar e tente novamente.${detalhes}
            </div>
          `;
          setTimeout(renderizarRodada, detalhes ? PAUSA_MS * 2 : PAUSA_MS);
        }
      });
    });
  }

  renderizarRodada();
}

// ---------------------------------------------------------------------------
// 8. Figma Ready (Auto-Layout Configurator)
// ---------------------------------------------------------------------------
function montarFigmaReady(container, dados, onClue) {
  const campos = [
    {
      id: "figma-direcao", rotulo: "Direção do Frame", vazio: "-- Selecione a direção --",
      opcoes: [
        { texto: "Horizontal (Row)", valor: "row", correto: false },
        { texto: "Vertical (Column)", valor: "column", correto: true },
      ],
    },
    {
      id: "figma-gap", rotulo: "Gap entre Itens (Espaçamento)", vazio: "-- Selecione o token de gap --",
      opcoes: [
        { texto: "5px", valor: 5, correto: false },
        { texto: "16px", valor: 16, correto: true },
        { texto: "33px", valor: 33, correto: false },
      ],
    },
    {
      id: "figma-padding", rotulo: "Padding Interno", vazio: "-- Selecione o token de padding --",
      opcoes: [
        { texto: "10px", valor: 10, correto: false },
        { texto: "24px", valor: 24, correto: true },
        { texto: "45px", valor: 45, correto: false },
      ],
    },
  ].map((c) => ({ ...c, preparadas: prepararOpcoes(c.opcoes) }));

  const html = `
    <div class="workbench-title-bar">
      <span class="workbench-label">
        <svg class="icon icon-sm"><use href="#icon-sliders"></use></svg>
        Bancada Figma Ready: Auto-Layout & Tokens
      </span>
      <span class="stat-pill">Atalho: Shift + A</span>
    </div>

    <div class="bench-split">
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${campos.map((c) => `
          <div>
            <label for="${c.id}" style="display: block; font-size: 0.8125rem; font-weight: 700; color: var(--text-subtle); margin-bottom: 4px;">${c.rotulo}</label>
            <select class="state-select" id="${c.id}">
              <option value="">${c.vazio}</option>
              ${c.preparadas.lista.map((o) => `<option value="${o.token}">${o.texto}</option>`).join("")}
            </select>
          </div>
        `).join("")}
      </div>

      <div style="background: var(--bg-page); border: 2px dashed var(--border-color); border-radius: 8px; padding: 16px; display: flex; align-items: center; justify-content: center;">
        <div id="figma-preview-frame" style="background: var(--bg-surface); border: 2px solid var(--border-color); border-radius: 6px; padding: 12px; width: 100%; display: flex; flex-direction: row; gap: 8px; transition: all var(--transition-normal);">
          <div style="background: var(--primary-bg); color: var(--primary); padding: 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; flex: 1; text-align: center;">Item 1</div>
          <div style="background: var(--primary-bg); color: var(--primary); padding: 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; flex: 1; text-align: center;">Item 2</div>
          <div style="background: var(--primary-bg); color: var(--primary); padding: 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; flex: 1; text-align: center;">Item 3</div>
        </div>
      </div>
    </div>
    <div id="figma-feedback-slot"></div>
  `;
  container.innerHTML = html;

  const frame = container.querySelector("#figma-preview-frame");
  const slot = container.querySelector("#figma-feedback-slot");
  const selects = campos.map((c) => container.querySelector(`#${c.id}`));

  function escolhida(i) {
    const token = selects[i].value;
    return campos[i].preparadas.lista.find((o) => o.token === token) || null;
  }

  function atualizarFigma() {
    const [dir, gap, pad] = [0, 1, 2].map(escolhida);
    if (dir) frame.style.flexDirection = dir.valor;
    if (gap) frame.style.gap = `${gap.valor}px`;
    if (pad) frame.style.padding = `${pad.valor}px`;

    const todosOk = [dir, gap, pad].every((o) => o && o.correto);
    frame.style.borderColor = todosOk ? "var(--success)" : "var(--border-color)";
    if (todosOk) {
      slot.innerHTML = caixaPista(dados.dica_revelada);
      if (onClue) onClue();
    } else if ([dir, gap, pad].every(Boolean)) {
      slot.innerHTML = `
        <div class="answer-feedback error" style="display: block; margin-top: 12px;">
          [AVISO] O frame ainda não está pronto: confira a direção dos itens empilhados e se os tokens pertencem ao grid de 8px.
        </div>
      `;
    } else {
      slot.innerHTML = "";
    }
  }

  selects.forEach((sel) => sel.addEventListener("change", atualizarFigma));
}

// ---------------------------------------------------------------------------
// 9. Certificate Generator (SVG Export & Team Validation)
// ---------------------------------------------------------------------------
function montarCertificado(container, dados) {
  const equipeBruta = (window.__QUEST_TEAM__ || ["Designers", "Web Devs"]).join(" & ");
  const equipeStr = escaparHtml(equipeBruta);
  const tempoSegundos = window.__QUEST_ELAPSED__ || 0;
  const minutos = Math.floor(tempoSegundos / 60);
  const segundos = tempoSegundos % 60;
  const tempoFormatado = `${minutos}min ${segundos}s`;
  const dataHoje = new Date().toLocaleDateString("pt-BR");

  const html = `
    <div class="certificate-frame" id="cert-printable-area">
      <svg class="cert-badge"><use href="#icon-award"></use></svg>
      <div class="cert-title">CERTIFICADO DE CONQUISTA OFICIAL</div>
      <div style="font-size: 0.9375rem; color: var(--text-muted); margin-bottom: 8px;">
        Web Quests: UI Design de Aplicativos & Preparação para o Figma
      </div>
      <p style="font-size: 0.875rem; color: var(--text-subtle);">
        Certificamos que a valorosa dupla abaixo desvendou as 8 fechaduras,
        dominando os 4 pilares essenciais de Design de Interface.
      </p>

      <div class="cert-team">${equipeStr}</div>

      <div class="cert-stats">
        <span class="stat-pill"><svg class="icon icon-sm"><use href="#icon-timer"></use></svg> Tempo: ${tempoFormatado}</span>
        <span class="stat-pill"><svg class="icon icon-sm"><use href="#icon-check"></use></svg> 8 Fechaduras Decifradas</span>
        <span class="stat-pill"><svg class="icon icon-sm"><use href="#icon-award"></use></svg> Selo: Figma Ready</span>
        <span class="stat-pill">Data: ${dataHoje}</span>
      </div>

    </div>

    <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 16px;">
      <button type="button" class="btn btn-primary" id="btn-export-svg">
        <svg class="icon icon-sm"><use href="#icon-download"></use></svg>
        Baixar Certificado em SVG
      </button>
      <button type="button" class="btn btn-secondary" id="btn-print-cert">
        <svg class="icon icon-sm"><use href="#icon-external"></use></svg>
        Imprimir / Salvar PDF
      </button>
    </div>
  `;
  container.innerHTML = html;

  const btnSvg = container.querySelector("#btn-export-svg");
  const btnPrint = container.querySelector("#btn-print-cert");

  btnPrint.addEventListener("click", () => {
    window.print();
  });

  btnSvg.addEventListener("click", () => {
    const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <rect width="800" height="600" fill="#f8fafc" stroke="#2563eb" stroke-width="8" rx="16"/>
  <rect x="20" y="20" width="760" height="560" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" rx="12"/>
  
  <text x="400" y="100" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="28" font-weight="bold" fill="#0f172a">
    CERTIFICADO DE CONQUISTA OFICIAL
  </text>
  <text x="400" y="140" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="16" fill="#475569">
    Web Quests: UI Design &amp; Preparação para o Figma
  </text>
  
  <text x="400" y="220" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="14" fill="#64748b">
    Certificamos com honras a conclusão da trilha de 8 fechaduras pela dupla:
  </text>
  
  <text x="400" y="290" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="24" font-weight="bold" fill="#1d4ed8">
    ${equipeStr}
  </text>
  
  <line x1="200" y1="320" x2="600" y2="320" stroke="#cbd5e1" stroke-width="2"/>
  
  <text x="400" y="370" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="14" fill="#334155">
    Tempo de Conclusão: ${tempoFormatado} | 8 Fechaduras Decifradas | Selo: Figma Ready
  </text>
  <text x="400" y="410" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13" fill="#64748b">
    Emitido em: ${dataHoje}
  </text>

  <rect x="280" y="470" width="240" height="44" rx="8" fill="#eff6ff" stroke="#2563eb" stroke-width="1"/>
  <text x="400" y="498" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13" font-weight="bold" fill="#1d4ed8">
    DOMÍNIO COMPROVADO DE UI DESIGN
  </text>
</svg>
    `.trim();

    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `certificado-${nomeArquivoSeguro(equipeBruta)}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}
