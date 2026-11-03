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
} from "./progress.js";
import { montarBancada } from "./bancadas.js";

// Global cache for decrypted stages
let etapasCifradas = null;
let etapasDecifradas = [];
let estado = null;
let timerInterval = null;

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
  estado = carregarEstadoLocal();
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
  dom.headerHints.textContent = estado.hintsUsed || 0;
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
  let senhaAtual = stage0?.resposta_esperada || "f-pattern";
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
              <span>Navegador (${estado.team[0] || "Integrante 1"})</span>
            </div>
            <p class="role-desc">${etapa.instrucoes_dupla.navegador}</p>
          </div>
          <div class="role-col">
            <div class="role-header">
              <svg class="icon icon-sm"><use href="#icon-pointer"></use></svg>
              <span>Piloto (${estado.team[1] || "Integrante 2"})</span>
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

  // Mount Workbench Widget
  const wbContainer = document.getElementById("workbench-container");
  montarBancada(etapa.tipo_desafio, wbContainer, etapa.dados_desafio, (chaveRevelada) => {
    const input = document.getElementById("answer-input");
    if (input && !input.value) {
      input.value = chaveRevelada;
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

    // Check if completed last lock
    if (proximoIndice === 8) {
      estado.completedAt = Date.now();
    }

    estado.currentLock = proximoIndice;
    salvarEstadoLocal(estado);

    feedback.className = "answer-feedback success";
    feedback.textContent = etapasDecifradas[indice].feedback_sucesso || "Fechadura decifrada com sucesso!";

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

  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.altKey) && (e.key === "s" || e.key === "S")) {
      e.preventDefault();
      alternarDrawer();
    }
    if (e.key === "Escape") {
      fecharDrawer();
      fecharModal(dom.modalBackpack);
      fecharModal(dom.modalSaveLoad);
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
  dom.btnCloseSaveLoad.addEventListener("click", () => fecharModal(dom.modalSaveLoad));

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
      dom.restoreFeedback.textContent = `[VALID] Progresso autenticado com sucesso para a equipe: ${resultado.dados.team.join(" & ")}. Carregando...`;
      estado = resultado.dados;
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

function fecharDrawer() {
  dom.drawer.classList.remove("open");
  dom.drawerBackdrop.classList.remove("open");
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

  if (!etapa || !etapa.pistas || etapa.pistas.length === 0) {
    dom.backpackContent.innerHTML = `<p class="role-desc">Não há dicas adicionais disponíveis nesta etapa.</p>`;
    return;
  }

  const pistas = etapa.pistas;
  dom.backpackContent.innerHTML = `
    <p style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 12px;">
      As dicas são progressivas e devem ser usadas em comum acordo pela dupla.
    </p>
    <ul class="hints-list">
      ${pistas.map((pista, pIdx) => `
        <li class="hint-item">
          <div class="hint-header">
            <span>Dica ${pIdx + 1} de ${pistas.length}</span>
            <button type="button" class="btn btn-secondary btn-revelar-dica" data-pidx="${pIdx}">
              Revelar Dica (+1 uso)
            </button>
          </div>
          <div class="hint-text" id="pista-text-${pIdx}" style="display: none;">
            ${pista}
          </div>
        </li>
      `).join("")}
    </ul>
  `;

  const btns = dom.backpackContent.querySelectorAll(".btn-revelar-dica");
  btns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const pIdx = btn.dataset.pidx;
      const elTexto = document.getElementById(`pista-text-${pIdx}`);
      if (elTexto.style.display === "none") {
        elTexto.style.display = "block";
        btn.disabled = true;
        btn.textContent = "Revelada";
        estado.hintsUsed = (estado.hintsUsed || 0) + 1;
        estado.hintsPerLock[idx] = (estado.hintsPerLock[idx] || 0) + 1;
        salvarEstadoLocal(estado);
        atualizarCabecalho();
      }
    });
  });
}

// Boot application
window.addEventListener("DOMContentLoaded", inicializar);
