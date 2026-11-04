/**
 * OBJECTIVE: Interactive workbench engines for all 8 quest locks + certificate renderer.
 * USAGE: import { montarBancada } from './bancadas.js';
 * ACCESSIBILITY: Keyboard navigable, high contrast, prefers-reduced-motion safe.
 * RULE 5: Strictly ZERO emojis. Inline SVGs only.
 */

import { escaparHtml, nomeArquivoSeguro } from "./util.js";

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
  const html = `
    <div class="workbench-title-bar">
      <span class="workbench-label">
        <svg class="icon icon-sm"><use href="#icon-eye"></use></svg>
        Bancada Mini-Diff: Inspeção de Hierarquia
      </span>
      <span class="stat-pill">${dados.pergunta || "Selecione o cartão correto"}</span>
    </div>
    <div class="diff-container" role="radiogroup" aria-label="Opções de Cartão">
      <div class="diff-card" id="diff-card-a" tabindex="0" role="radio" aria-checked="false">
        <div>
          <span class="diff-card-label">${dados.opcao_a.rotulo}</span>
          <div style="${dados.opcao_a.titulo_estilo} margin-top: 8px;">${dados.opcao_a.titulo_texto}</div>
          <div style="${dados.opcao_a.corpo_estilo} margin-top: 8px;">${dados.opcao_a.corpo_texto}</div>
        </div>
        <button type="button" style="${dados.opcao_a.botao_estilo} margin-top: 16px;">${dados.opcao_a.botao_texto}</button>
      </div>

      <div class="diff-card" id="diff-card-b" tabindex="0" role="radio" aria-checked="false">
        <div>
          <span class="diff-card-label">${dados.opcao_b.rotulo}</span>
          <div style="${dados.opcao_b.titulo_estilo} margin-top: 8px;">${dados.opcao_b.titulo_texto}</div>
          <div style="${dados.opcao_b.corpo_estilo} margin-top: 8px;">${dados.opcao_b.corpo_texto}</div>
        </div>
        <button type="button" style="${dados.opcao_b.botao_estilo} margin-top: 16px;">${dados.opcao_b.botao_texto}</button>
      </div>
    </div>
    <div id="diff-feedback-slot"></div>
  `;
  container.innerHTML = html;

  const cardA = container.querySelector("#diff-card-a");
  const cardB = container.querySelector("#diff-card-b");
  const slot = container.querySelector("#diff-feedback-slot");

  function escolher(opcao) {
    cardA.classList.remove("selected-correct", "selected-incorrect");
    cardB.classList.remove("selected-correct", "selected-incorrect");

    if (opcao === dados.opcao_correta) {
      const elCorreto = opcao === "A" ? cardA : cardB;
      elCorreto.classList.add("selected-correct");
      elCorreto.setAttribute("aria-checked", "true");
      slot.innerHTML = `
        <div class="clue-reveal-box">
          <svg class="icon"><use href="#icon-key"></use></svg>
          <span>${dados.dica_revelada}</span>
        </div>
      `;
      if (onClue) onClue("F-PATTERN");
    } else {
      const elErrado = opcao === "A" ? cardA : cardB;
      elErrado.classList.add("selected-incorrect");
      slot.innerHTML = `
        <div class="answer-feedback error" style="display: block; margin-top: 12px;">
          [AVISO] No Cartão A, o corpo tem tamanho 22px em negrito e o título apenas 13px cinza. A hierarquia está invertida e confunde o escaneamento natural!
        </div>
      `;
    }
  }

  cardA.addEventListener("click", () => escolher("A"));
  cardB.addEventListener("click", () => escolher("B"));
  cardA.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); escolher("A"); } });
  cardB.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); escolher("B"); } });
}

// ---------------------------------------------------------------------------
// 2. State Fixer (Affordance & Button State Machine)
// ---------------------------------------------------------------------------
function montarStateFixer(container, dados, onClue) {
  const html = `
    <div class="workbench-title-bar">
      <span class="workbench-label">
        <svg class="icon icon-sm"><use href="#icon-sliders"></use></svg>
        Bancada de Estados de Componente (Signifiers)
      </span>
      <span class="stat-pill">4 Estados Necessários</span>
    </div>
    <div class="state-fixer-grid">
      ${dados.estados_obrigatorios.map((est) => `
        <div class="state-item">
          <div class="state-name">Estado: ${est.toUpperCase()}</div>
          <select class="state-select" data-estado="${est}">
            <option value="">-- Selecione o signifier adequado --</option>
            ${(dados.configuracoes_disponiveis[est] || []).map((cfg, idx) => `
              <option value="${cfg.id}" data-correto="${cfg.correto}">${cfg.texto}</option>
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
      const opt = sel.selectedOptions[0];
      if (!opt || opt.dataset.correto !== "true") {
        todosCorretos = false;
      }
    });

    if (todosRespondidos && todosCorretos) {
      slot.innerHTML = `
        <div class="clue-reveal-box">
          <svg class="icon"><use href="#icon-key"></use></svg>
          <span>${dados.dica_revelada}</span>
        </div>
      `;
      if (onClue) onClue("SIGNIFIER");
    } else if (todosRespondidos) {
      slot.innerHTML = `
        <div class="answer-feedback error" style="display: block; margin-top: 12px;">
          [AVISO] Alguns estados ainda não comunicam o affordance correto. Revise os estados Hover, Active e Disabled.
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
      slot.innerHTML = `
        <div class="clue-reveal-box">
          <svg class="icon"><use href="#icon-key"></use></svg>
          <span>${dados.dica_revelada}</span>
        </div>
      `;
      if (onClue) onClue("CONSISTENCIA");
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
      slot.innerHTML = `
        <div class="clue-reveal-box">
          <svg class="icon"><use href="#icon-key"></use></svg>
          <span>${dados.dica_revelada}</span>
        </div>
      `;
      if (onClue) onClue("RITMO8PX");
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
          ${dados.blocos_disponiveis.map((b) => `
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
            <div class="wireframe-slot" data-index="${idx}" data-expected="${pos.bloco_correto}">
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
      const exp = slot.dataset.expected;
      if (!slotsState[idx]) completo = false;
      if (slotsState[idx] !== exp) correto = false;
    });

    if (completo && correto) {
      feedbackSlot.innerHTML = `
        <div class="clue-reveal-box">
          <svg class="icon"><use href="#icon-key"></use></svg>
          <span>${dados.dica_revelada}</span>
        </div>
      `;
      if (onClue) onClue("WIREFRAME");
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
      ${dados.questoes.map((q) => `
        <div class="critique-q" data-qid="${q.id}">
          <div style="font-weight: 700; font-size: 0.875rem; margin-bottom: 8px;">${q.enunciado}</div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${q.opcoes.map((opt) => `
              <label style="display: flex; align-items: flex-start; gap: 8px; font-size: 0.875rem; cursor: pointer; padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-surface);">
                <input type="radio" name="critique_${q.id}" value="${opt.id}" data-correto="${opt.correto}" />
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
    const q1 = container.querySelector("input[name='critique_q1']:checked");
    const q2 = container.querySelector("input[name='critique_q2']:checked");

    if (q1 && q2) {
      if (q1.dataset.correto === "true" && q2.dataset.correto === "true") {
        slot.innerHTML = `
          <div class="clue-reveal-box">
            <svg class="icon"><use href="#icon-key"></use></svg>
            <span>${dados.dica_revelada}</span>
          </div>
        `;
        if (onClue) onClue("HEURISTICA");
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

  function renderizarRodada() {
    if (rodadaAtual >= etapas.length) {
      container.innerHTML = `
        <div class="clue-reveal-box">
          <svg class="icon"><use href="#icon-key"></use></svg>
          <span>${dados.dica_revelada}</span>
        </div>
      `;
      if (onClue) onClue("OLHOCLINICO");
      return;
    }

    const item = etapas[rodadaAtual];
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
        ${item.opcoes.map((opt) => `
          <button type="button" class="btn btn-secondary gauntlet-opt-btn" data-correto="${opt.correto}" style="justify-content: flex-start; text-align: left; padding: 10px 14px;">
            ${opt.texto}
          </button>
        `).join("")}
      </div>
      <div id="gauntlet-alert-slot"></div>
    `;

    const btns = container.querySelectorAll(".gauntlet-opt-btn");
    const alertSlot = container.querySelector("#gauntlet-alert-slot");

    btns.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.correto === "true") {
          rodadaAtual++;
          renderizarRodada();
        } else {
          rodadaAtual = 0;
          btns.forEach((b) => { b.disabled = true; });
          alertSlot.innerHTML = `
            <div class="answer-feedback error" style="display: block; margin-top: 12px;">
              [ERRO DE PRECISÃO] Resposta incorreta! O circuito do gauntlet foi reiniciado. Calibre o olhar e tente novamente.
            </div>
          `;
          setTimeout(renderizarRodada, 1800);
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
  const estado = {
    direcao: "",
    gap: "",
    padding: "",
  };

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
        <div>
          <div style="font-size: 0.8125rem; font-weight: 700; color: var(--text-subtle); margin-bottom: 4px;">Direção do Frame</div>
          <select class="state-select" id="figma-direcao">
            <option value="">-- Selecione a direção --</option>
            <option value="horizontal">Horizontal (Row)</option>
            <option value="vertical" data-correto="true">Vertical (Column)</option>
          </select>
        </div>

        <div>
          <div style="font-size: 0.8125rem; font-weight: 700; color: var(--text-subtle); margin-bottom: 4px;">Gap entre Itens (Espaçamento)</div>
          <select class="state-select" id="figma-gap">
            <option value="">-- Selecione o token de gap --</option>
            <option value="5">5px (Aleatório)</option>
            <option value="16" data-correto="true">16px (Grid 8px)</option>
            <option value="33">33px (Arbitrário)</option>
          </select>
        </div>

        <div>
          <div style="font-size: 0.8125rem; font-weight: 700; color: var(--text-subtle); margin-bottom: 4px;">Padding Interno</div>
          <select class="state-select" id="figma-padding">
            <option value="">-- Selecione o token de padding --</option>
            <option value="10">10px</option>
            <option value="24" data-correto="true">24px (Grid 8px)</option>
            <option value="45">45px</option>
          </select>
        </div>
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

  const selDir = container.querySelector("#figma-direcao");
  const selGap = container.querySelector("#figma-gap");
  const selPad = container.querySelector("#figma-padding");
  const frame = container.querySelector("#figma-preview-frame");
  const slot = container.querySelector("#figma-feedback-slot");

  function atualizarFigma() {
    if (selDir.value) frame.style.flexDirection = selDir.value === "vertical" ? "column" : "row";
    if (selGap.value) frame.style.gap = `${selGap.value}px`;
    if (selPad.value) frame.style.padding = `${selPad.value}px`;

    const dirOk = selDir.selectedOptions[0]?.dataset.correto === "true";
    const gapOk = selGap.selectedOptions[0]?.dataset.correto === "true";
    const padOk = selPad.selectedOptions[0]?.dataset.correto === "true";

    if (dirOk && gapOk && padOk) {
      frame.style.borderColor = "var(--success)";
      slot.innerHTML = `
        <div class="clue-reveal-box">
          <svg class="icon"><use href="#icon-key"></use></svg>
          <span>${dados.dica_revelada}</span>
        </div>
      `;
      if (onClue) onClue("AUTOLAYOUT");
    }
  }

  selDir.addEventListener("change", atualizarFigma);
  selGap.addEventListener("change", atualizarFigma);
  selPad.addEventListener("change", atualizarFigma);
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
