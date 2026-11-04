/**
 * OBJECTIVE: Main UI Application Controller for Web Quests: UI Design.
 * USAGE: Loaded by quest/index.html as ES Module.
 * ARCHITECTURE: Follows web-riddle-js chained decryption, HMAC progress code, zero emojis.
 */

import { normalizar, decifrarBloco } from "./crypto.js";
import {
  criarEstadoInicial,
  salvarEstadoLocal,
  carregarEstadoLocal,
  limparEstadoLocal,
  gerarCodigoProgresso,
  decodificarCodigoProgresso,
  baixarArquivoProgresso,
  garantirCreditosDicas,
  aplicarRecuperacaoDica,
  HINT_LIMIT,
  HINT_RESTORE_EVERY,
} from "./progress.js";
import { montarBancada } from "./bancadas.js";
import { escaparHtml } from "./util.js";

// Global cache for decrypted stages
let etapasCifradas = null;
let etapasDecifradas = [];
let estado = null;
let timerInterval = null;
let avisoPendente = ""; // Message carried over to the next rendered stage

// DOM References
const dom = {
  headerTeam: document.getElementById("header-team-names"),
  headerTimer: document.getElementById("header-timer-display"),
  headerHints: document.getElementById("header-hints-count"),
  locksTrack: document.getElementById("locks-track"),
  stageContainer: document.getElementById("stage-container"),
  
  // Slide Drawer
  btnSlides: document.getElementById("btn-open-slides"),
  drawerBackdrop: document.getElementById("drawer-backdrop"),
  drawer: document.getElementById("slide-drawer"),
  btnCloseDrawer: document.getElementById("btn-close-drawer"),
  
  // Onboarding Modal
  modalOnboarding: document.getElementById("modal-onboarding"),
  formOnboarding: document.getElementById("form-onboarding"),
  inputTeam1: document.getElementById("input-team-1"),
  inputTeam2: document.getElementById("input-team-2"),
  btnOnboardingRestore: document.getElementById("btn-onboarding-restore"),
  
  // Backpack Modal
  btnBackpack: document.getElementById("btn-open-backpack"),
  modalBackpack: document.getElementById("modal-backpack"),
  btnCloseBackpack: document.getElementById("btn-close-backpack"),
  backpackContent: document.getElementById("backpack-content"),
  
  // Save/Load Modal
  btnSaveLoad: document.getElementById("btn-open-saveload"),
  modalSaveLoad: document.getElementById("modal-saveload"),
  btnCloseSaveLoad: document.getElementById("btn-close-saveload"),
  txtExportCode: document.getElementById("txt-export-code"),
  btnCopyCode: document.getElementById("btn-copy-code"),
  btnDownloadFile: document.getElementById("btn-download-file"),
  formRestore: document.getElementById("form-restore"),
  txtRestoreCode: document.getElementById("txt-restore-code"),
  restoreFeedback: document.getElementById("restore-feedback"),
};

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------
async function inicializar() {
  configurarEventosGlobais();

  try {
    const resp = await fetch("etapas.json");
    if (!resp.ok) throw new Error("Não foi possível carregar etapas.json");
    etapasCifradas = await resp.json();
  } catch (err) {
    console.error("[FAIL] Error loading etapas.json:", err);
    dom.stageContainer.innerHTML = `
      <div class="stage-card">
        <h2 class="stage-title">[ERRO CRÍTICO] Falha ao carregar as fechaduras</h2>
        <p class="stage-enunciado">Verifique se o arquivo etapas.json foi gerado com 'node scripts/build/build_etapas.mjs'.</p>
      </div>
    `;
    return;
  }

  // Load or request team state
  estado = garantirCreditosDicas(carregarEstadoLocal());
  if (!estado || !estado.team || !estado.team[0]) {
    abrirModal(dom.modalOnboarding);
  } else {
    iniciarJogo();
  }
}

function iniciarJogo() {
  fecharModal(dom.modalOnboarding);
  atualizarCabecalho();
  iniciarTimer();
  descriptografarEtapasConhecidas().then(() => {
    renderizarTrilhaFechaduras();
    renderizarEtapaAtual();
  });
}

function iniciarTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(atualizarTimerDisplay, 1000);
  atualizarTimerDisplay();
}

function atualizarTimerDisplay() {
  if (!estado) return;
  const fim = estado.completedAt || Date.now();
  const diffSegundos = Math.max(0, Math.floor((fim - estado.startedAt) / 1000));
  window.__QUEST_ELAPSED__ = diffSegundos;

  const min = Math.floor(diffSegundos / 60);
  const seg = diffSegundos % 60;
  dom.headerTimer.textContent = `${String(min).padStart(2, "0")}:${String(seg).padStart(2, "0")}`;
}

function atualizarCabecalho() {
  if (!estado) return;
  const nomes = (estado.team || []).filter(Boolean).join(" & ") || "Equipe";
  dom.headerTeam.textContent = nomes;
  dom.headerHints.textContent = `${estado.hintCredits}/${HINT_LIMIT}`;
  dom.btnBackpack.setAttribute("aria-label", `Mochila de Dicas: ${estado.hintCredits} de ${HINT_LIMIT} disponíveis`);
  window.__QUEST_TEAM__ = estado.team;
}

// ---------------------------------------------------------------------------
// Cryptographic Stage Unlocking
// ---------------------------------------------------------------------------
async function descriptografarEtapasConhecidas() {
  etapasDecifradas = [];

  // Stage 0: Always opens with empty password
  const stage0 = await decifrarBloco(etapasCifradas.etapas[0], "");
  etapasDecifradas[0] = stage0;

  // Subsequent stages decoded with answers recorded in state
  for (let i = 0; i < (estado.answers || []).length; i++) {
    const tentativa = estado.answers[i];
    if (i + 1 < etapasCifradas.etapas.length) {
      const proxima = await decifrarBloco(etapasCifradas.etapas[i + 1], tentativa);
      if (proxima) {
        etapasDecifradas[i + 1] = proxima;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Render Locks Track
// ---------------------------------------------------------------------------
function renderizarTrilhaFechaduras() {
  dom.locksTrack.innerHTML = "";
  const total = etapasCifradas.totalFechaduras; // 9 total (0 to 8)

  for (let i = 0; i < total; i++) {
    const isUnlocked = estado.unlockedLocks.includes(i);
    const isActive = estado.currentLock === i;
    const isCompleted = estado.answers && estado.answers[i];

    const li = document.createElement("li");
    li.className = `lock-node ${isActive ? "active" : ""} ${isUnlocked ? "unlocked" : "locked"}`;

    const iconId = i === 8 ? "icon-award" : (isCompleted ? "icon-check" : (isUnlocked ? "icon-unlock" : "icon-lock"));
    const rotulo = i === 8 ? "Final" : `Lock ${i + 1}`;

    li.innerHTML = `
      <button type="button" class="lock-btn" data-index="${i}" ${!isUnlocked ? "disabled" : ""}>
        <svg class="icon icon-sm"><use href="#${iconId}"></use></svg>
        <span>${rotulo}</span>
      </button>
      ${i < total - 1 ? '<div class="lock-connector"></div>' : ""}
    `;

    li.querySelector(".lock-btn").addEventListener("click", () => {
      if (isUnlocked) {
        estado.currentLock = i;
        salvarEstadoLocal(estado);
        renderizarTrilhaFechaduras();
        renderizarEtapaAtual();
      }
    });

    dom.locksTrack.appendChild(li);
  }
}

// ---------------------------------------------------------------------------
// Render Current Stage Card & Workbench
// ---------------------------------------------------------------------------
function renderizarEtapaAtual() {
  const idx = estado.currentLock;
  const etapa = etapasDecifradas[idx];

  if (!etapa) {
    dom.stageContainer.innerHTML = `
      <div class="stage-card">
        <h2 class="stage-title">Fechadura Bloqueada</h2>
        <p class="stage-enunciado">Resolva a fechadura anterior para decifrar este enigma.</p>
      </div>
    `;
    return;
  }

  const isFinal = idx === 8;
  const isAlreadySolved = !!(estado.answers && estado.answers[idx]);

  dom.stageContainer.innerHTML = `
    <article class="stage-card">
      <header class="stage-header">
        <div>
          <span class="stage-pillar-badge">${etapa.pilar}</span>
          <h2 class="stage-title">${etapa.titulo}</h2>
        </div>
        <div class="stage-number-tag">
          ${isFinal ? "Conclusão Oficial" : `Fechadura ${idx + 1} de 8`}
        </div>
      </header>

      <p class="stage-enunciado">${etapa.enunciado}</p>

      ${!isFinal ? `
        <div class="pair-roles-box">
          <div class="role-col">
            <div class="role-header">
              <svg class="icon icon-sm"><use href="#icon-eye"></use></svg>
              <span>Navegador (${escaparHtml(estado.team[0] || "Integrante 1")})</span>
            </div>
            <p class="role-desc">${etapa.instrucoes_dupla.navegador}</p>
          </div>
          <div class="role-col">
            <div class="role-header">
              <svg class="icon icon-sm"><use href="#icon-pointer"></use></svg>
              <span>Piloto (${escaparHtml(estado.team[1] || "Integrante 2")})</span>
            </div>
            <p class="role-desc">${etapa.instrucoes_dupla.piloto}</p>
          </div>
        </div>
      ` : ""}

      <section class="workbench-panel" id="workbench-container"></section>

      ${!isFinal ? `
        <section class="answer-panel" id="answer-panel">
          <form class="answer-form" id="form-answer">
            <label for="answer-input" style="font-weight: 700; font-size: 0.875rem;">Chave da Fechadura:</label>
            <input 
              type="text" 
              id="answer-input" 
              class="answer-input" 
              placeholder="DIGITE A PALAVRA-CHAVE..." 
              autocomplete="off"
              spellcheck="false"
              ${isAlreadySolved ? `value="${estado.answers[idx]}" readonly` : ""}
            />
            <button type="submit" class="btn btn-primary" id="btn-submit-answer" ${isAlreadySolved ? "disabled" : ""}>
              <svg class="icon icon-sm"><use href="#icon-key"></use></svg>
              <span>${isAlreadySolved ? "Fechadura Decifrada" : "Testar Chave"}</span>
            </button>
          </form>
          <div id="answer-feedback" class="answer-feedback ${isAlreadySolved ? "success" : ""}">
            ${isAlreadySolved ? etapa.feedback_sucesso : ""}
          </div>
        </section>
      ` : ""}
    </article>
  `;

  if (avisoPendente && !isAlreadySolved) {
    const fbEl = document.getElementById("answer-feedback");
    if (fbEl) {
      fbEl.className = "answer-feedback info";
      fbEl.textContent = avisoPendente;
    }
  }
  avisoPendente = "";

  // Mount Workbench Widget
  const wbContainer = document.getElementById("workbench-container");
  montarBancada(etapa.tipo_desafio, wbContainer, etapa.dados_desafio, () => {
    const input = document.getElementById("answer-input");
    if (input && !input.value && etapa.resposta_esperada) {
      input.value = etapa.resposta_esperada;
      input.focus();
    }
  });

  // Attach Answer Submission Listener
  if (!isFinal && !isAlreadySolved) {
    const form = document.getElementById("form-answer");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      tentarDesbloquearFechadura(idx);
    });
  }
}

// ---------------------------------------------------------------------------
// Answer Attempt Logic
// ---------------------------------------------------------------------------
async function tentarDesbloquearFechadura(indice) {
  const input = document.getElementById("answer-input");
  const btn = document.getElementById("btn-submit-answer");
  const feedback = document.getElementById("answer-feedback");
  const panel = document.getElementById("answer-panel");

  const tentativa = normalizar(input.value);
  if (!tentativa) {
    feedback.className = "answer-feedback error";
    feedback.textContent = "[AVISO] Digitem a palavra-chave antes de testar.";
    input.focus();
    return;
  }

  btn.disabled = true;
  feedback.className = "answer-feedback info";
  feedback.textContent = "Testando a chave criptográfica...";

  // Attempt to decrypt the next stage in the chain
  const proximoIndice = indice + 1;
  const proximaEtapaCifrada = etapasCifradas.etapas[proximoIndice];

  let etapaDecifrada = null;
  if (proximaEtapaCifrada) {
    etapaDecifrada = await decifrarBloco(proximaEtapaCifrada, tentativa);
  }

  btn.disabled = false;

  if (etapaDecifrada) {
    // Correct answer!
    estado.answers[indice] = tentativa;
    estado.attemptsPerLock[indice] = (estado.attemptsPerLock[indice] || 0) + 1;
    if (!estado.unlockedLocks.includes(proximoIndice)) {
      estado.unlockedLocks.push(proximoIndice);
    }
    etapasDecifradas[proximoIndice] = etapaDecifrada;

    const dicaRecuperada = aplicarRecuperacaoDica(estado);
    atualizarCabecalho();

    // Check if completed last lock
    if (proximoIndice === 8) {
      estado.completedAt = Date.now();
    }

    estado.currentLock = proximoIndice;
    salvarEstadoLocal(estado);

    feedback.className = "answer-feedback success";
    feedback.textContent = etapasDecifradas[indice].feedback_sucesso || "Fechadura decifrada com sucesso!";
    if (dicaRecuperada) {
      avisoPendente = `[+1 DICA] A dupla recuperou uma dica. Disponíveis: ${estado.hintCredits} de ${HINT_LIMIT}.`;
    }

    setTimeout(() => {
      renderizarTrilhaFechaduras();
      renderizarEtapaAtual();
    }, 900);
  } else {
    // Wrong answer
    estado.errorCount = (estado.errorCount || 0) + 1;
    estado.attemptsPerLock[indice] = (estado.attemptsPerLock[indice] || 0) + 1;
    salvarEstadoLocal(estado);

    panel.classList.remove("shake");
    void panel.offsetWidth; // trigger reflow
    panel.classList.add("shake");

    feedback.className = "answer-feedback error";
    feedback.textContent = "[ERRO] Essa palavra-chave não abre a fechadura. Revisem os conceitos na bancada ou consultem os slides (Ctrl+S).";
  }
}

// ---------------------------------------------------------------------------
// Global Events & Modals
// ---------------------------------------------------------------------------
function configurarEventosGlobais() {
  // Slide Drawer Toggle (Ctrl+S / Alt+S / Button)
  dom.btnSlides.addEventListener("click", alternarDrawer);
  dom.btnCloseDrawer.addEventListener("click", fecharDrawer);
  dom.drawerBackdrop.addEventListener("click", fecharDrawer);

  // Keyboard shortcuts pressed while focus is inside the slides iframe
  window.addEventListener("message", (e) => {
    if (e.origin !== window.location.origin || !e.data || typeof e.data !== "object") return;
    if (e.data.type === "CLOSE_DRAWER") fecharDrawer();
    if (e.data.type === "TOGGLE_DRAWER") alternarDrawer();
  });

  // Onboarding: restore an existing code on a new computer
  dom.btnOnboardingRestore.addEventListener("click", () => {
    fecharModal(dom.modalOnboarding);
    dom.txtExportCode.value = "";
    abrirModal(dom.modalSaveLoad);
    dom.txtRestoreCode.focus();
  });

  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.altKey) && (e.key === "s" || e.key === "S")) {
      e.preventDefault();
      alternarDrawer();
    }
    if (e.key === "Escape") {
      fecharDrawer();
      fecharModal(dom.modalBackpack);
      fecharSaveLoad();
    }
  });

  // Onboarding Form
  dom.formOnboarding.addEventListener("submit", (e) => {
    e.preventDefault();
    const t1 = dom.inputTeam1.value.trim();
    const t2 = dom.inputTeam2.value.trim();
    if (!t1 || !t2) {
      alert("Por favor preencham os nomes dos dois integrantes da dupla.");
      return;
    }
    estado = criarEstadoInicial(t1, t2);
    salvarEstadoLocal(estado);
    iniciarJogo();
  });

  // Backpack Modal
  dom.btnBackpack.addEventListener("click", () => {
    renderizarMochila();
    abrirModal(dom.modalBackpack);
  });
  dom.btnCloseBackpack.addEventListener("click", () => fecharModal(dom.modalBackpack));

  // Save / Load Modal
  dom.btnSaveLoad.addEventListener("click", async () => {
    if (estado) {
      dom.txtExportCode.value = await gerarCodigoProgresso(estado);
    }
    abrirModal(dom.modalSaveLoad);
  });
  dom.btnCloseSaveLoad.addEventListener("click", fecharSaveLoad);

  dom.btnCopyCode.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(dom.txtExportCode.value);
      alert("[OK] Código de progresso copiado para a área de transferência!");
    } catch (err) {
      dom.txtExportCode.select();
      document.execCommand("copy");
    }
  });

  dom.btnDownloadFile.addEventListener("click", () => {
    if (estado) baixarArquivoProgresso(estado);
  });

  dom.formRestore.addEventListener("submit", async (e) => {
    e.preventDefault();
    const codigo = dom.txtRestoreCode.value.trim();
    const resultado = await decodificarCodigoProgresso(codigo);

    if (resultado.valido) {
      dom.restoreFeedback.className = "answer-feedback success";
      dom.restoreFeedback.textContent = `[OK] Progresso restaurado para a equipe: ${resultado.dados.team.join(" & ")}. Carregando...`;
      estado = garantirCreditosDicas(resultado.dados);
      salvarEstadoLocal(estado);
      setTimeout(() => {
        fecharModal(dom.modalSaveLoad);
        iniciarJogo();
      }, 1000);
    } else {
      dom.restoreFeedback.className = "answer-feedback error";
      dom.restoreFeedback.textContent = `[FAIL] ${resultado.erro}`;
    }
  });
}

function alternarDrawer() {
  const isOpen = dom.drawer.classList.contains("open");
  if (isOpen) {
    fecharDrawer();
  } else {
    dom.drawer.classList.add("open");
    dom.drawerBackdrop.classList.add("open");
  }
}

/**
 * Opens the slides drawer on a given slide (1-based) via the slides JUMP_TO_SLIDE API.
 */
function abrirSlide(numero) {
  dom.drawer.classList.add("open");
  dom.drawerBackdrop.classList.add("open");
  const frame = dom.drawer.querySelector("iframe");
  if (frame && frame.contentWindow) {
    frame.contentWindow.postMessage({ type: "JUMP_TO_SLIDE", slideIndex: numero }, window.location.origin);
  }
}

/**
 * Renders one "Abrir Slide N" button per slide number mentioned in a hint.
 */
function botoesSlides(texto) {
  const numeros = [...new Set([...String(texto).matchAll(/\bSlide (\d{1,2})\b/g)].map((m) => Number(m[1])))];
  if (numeros.length === 0) return "";
  return `<div class="hint-slide-links">${numeros.map((n) => `
    <button type="button" class="btn btn-secondary btn-ir-slide" data-slide="${n}">
      <svg class="icon icon-sm"><use href="#icon-slides"></use></svg>
      Abrir Slide ${n}
    </button>`).join("")}</div>`;
}

function fecharDrawer() {
  dom.drawer.classList.remove("open");
  dom.drawerBackdrop.classList.remove("open");
}

function fecharSaveLoad() {
  fecharModal(dom.modalSaveLoad);
  // Without a team there is nothing to play: return to onboarding
  if (!estado || !estado.team || !estado.team[0]) abrirModal(dom.modalOnboarding);
}

function abrirModal(modalEl) {
  modalEl.classList.add("open");
}

function fecharModal(modalEl) {
  modalEl.classList.remove("open");
}

// ---------------------------------------------------------------------------
// Backpack (Mochila de Dicas)
// ---------------------------------------------------------------------------
function renderizarMochila() {
  if (!estado) return;
  const idx = estado.currentLock;
  const etapa = etapasDecifradas[idx];
  const creditos = estado.hintCredits;
  const resumo = `
    <div class="hint-budget" role="status">
      <strong>Dicas disponíveis: ${creditos} de ${HINT_LIMIT}</strong>
      <span>A cada ${HINT_RESTORE_EVERY} fechaduras abertas, a dupla recupera 1 dica (máximo ${HINT_LIMIT}).</span>
    </div>
  `;

  if (!etapa || !etapa.pistas || etapa.pistas.length === 0) {
    dom.backpackContent.innerHTML = `${resumo}<p class="role-desc">Não há dicas disponíveis nesta etapa.</p>`;
    return;
  }

  const pistas = etapa.pistas;
  const reveladas = Math.min(estado.hintsPerLock[idx] || 0, pistas.length);
  const resolvida = !!(estado.answers && estado.answers[idx]);

  function motivoBloqueio(pIdx) {
    if (resolvida) return "Fechadura já aberta";
    if (pIdx > reveladas) return "Revele a anterior";
    if (creditos <= 0) return "Sem dicas";
    return "";
  }

  dom.backpackContent.innerHTML = `
    ${resumo}
    <p style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 12px;">
      As dicas são progressivas: cada uma revela mais que a anterior. Decidam juntos antes de gastar.
    </p>
    <ul class="hints-list">
      ${pistas.map((pista, pIdx) => {
        const aberta = pIdx < reveladas;
        const motivo = motivoBloqueio(pIdx);
        return `
        <li class="hint-item">
          <div class="hint-header">
            <span>Dica ${pIdx + 1} de ${pistas.length}</span>
            ${aberta
              ? `<span class="stat-pill">Revelada</span>`
              : `<button type="button" class="btn btn-secondary btn-revelar-dica" data-pidx="${pIdx}" ${motivo ? "disabled" : ""}>
                  ${motivo || "Revelar (gasta 1)"}
                </button>`}
          </div>
          ${aberta ? `<div class="hint-text">${pista}</div>${botoesSlides(pista)}` : ""}
        </li>`;
      }).join("")}
    </ul>
  `;

  dom.backpackContent.querySelectorAll(".btn-ir-slide").forEach((btn) => {
    btn.addEventListener("click", () => {
      fecharModal(dom.modalBackpack);
      abrirSlide(Number(btn.dataset.slide));
    });
  });

  dom.backpackContent.querySelectorAll(".btn-revelar-dica").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pIdx = Number(btn.dataset.pidx);
      if (resolvida || pIdx !== reveladas || estado.hintCredits <= 0) return;
      estado.hintCredits -= 1;
      estado.hintsUsed = (estado.hintsUsed || 0) + 1;
      estado.hintsPerLock[idx] = reveladas + 1;
      salvarEstadoLocal(estado);
      atualizarCabecalho();
      renderizarMochila();
    });
  });
}

// Boot application
window.addEventListener("DOMContentLoaded", inicializar);
