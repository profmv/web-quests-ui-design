/**
 * Web Quests UI Design - Slide Deck Engine
 * Rule 5 Compliant: Zero Emojis or Unicode Pictograms.
 * Pure Vanilla JavaScript ES6+
 *
 * Contract kept for the quest (slides embedded in an iframe drawer):
 * - URL hash #N opens slide N (1-based).
 * - Outgoing postMessage: SLIDES_READY, SLIDE_CHANGED, CURRENT_SLIDE_REPORT,
 *   TOGGLE_DRAWER and CLOSE_DRAWER (the last two only to the same origin).
 * - Incoming postMessage (same origin only): JUMP_TO_SLIDE {slideIndex: N},
 *   NEXT_SLIDE, PREV_SLIDE, GET_CURRENT_SLIDE.
 */

(function () {
  'use strict';

  // DOM Elements
  const stage = document.querySelector('.deck-stage');
  const slides = Array.from(document.querySelectorAll('.slide'));
  const totalSlides = slides.length;
  const progressFill = document.querySelector('.deck-progress-fill');
  const counterCurrent = document.querySelector('.slide-counter-current');
  const counterTotal = document.querySelector('.slide-counter-total');
  const topicTitle = document.querySelector('.deck-topic-title');
  const btnPrev = document.querySelector('#btn-prev');
  const btnNext = document.querySelector('#btn-next');
  const btnFullscreen = document.querySelector('#btn-fullscreen');
  const btnDrawer = document.querySelector('#btn-drawer');
  const btnSearch = document.querySelector('#btn-search');
  const btnHelp = document.querySelector('#btn-help');

  // Drawer Elements
  const drawer = document.querySelector('#deck-drawer');
  const drawerOverlay = document.querySelector('#deck-drawer-overlay');
  const drawerList = document.querySelector('#drawer-slide-list');
  const btnCloseDrawer = document.querySelector('#btn-close-drawer');

  // Search Modal Elements
  const searchModal = document.querySelector('#deck-search-modal');
  const modalOverlay = document.querySelector('#deck-modal-overlay');
  const searchInput = document.querySelector('#modal-search-input');
  const searchResults = document.querySelector('#modal-search-results');
  const btnCloseSearch = document.querySelector('#btn-close-search');

  // Help Modal Elements
  const helpModal = document.querySelector('#deck-help-modal');
  const btnCloseHelp = document.querySelector('#btn-close-help');

  const embedded = window.parent && window.parent !== window;
  if (embedded) document.documentElement.classList.add('is-embedded');

  let currentSlideIndex = 0;
  let lastFocus = null;
  let touchStartX = 0;
  let touchStartY = 0;

  // Initialize total slide counter display
  if (counterTotal) {
    counterTotal.textContent = String(totalSlides);
  }

  /**
   * Builds the slide list for the drawer navigation
   */
  function buildDrawerList() {
    if (!drawerList) return;
    drawerList.innerHTML = '';
    slides.forEach((slide, index) => {
      const titleElem = slide.querySelector('.slide-title');
      const titleText = titleElem ? titleElem.textContent.trim() : `Slide ${index + 1}`;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'drawer-slide-item';
      if (index === currentSlideIndex) item.classList.add('active');
      const num = document.createElement('span');
      num.className = 'drawer-slide-num';
      num.textContent = String(index + 1).padStart(2, '0');
      const name = document.createElement('span');
      name.className = 'drawer-slide-name';
      name.textContent = titleText;
      item.append(num, name);
      if (index === currentSlideIndex) item.setAttribute('aria-current', 'page');
      item.addEventListener('click', () => {
        goToSlide(index);
        closeDrawer();
      });
      drawerList.appendChild(item);
    });
  }

  /**
   * Updates state, accessibility attributes, progress bar and postMessage notifications
   */
  function goToSlide(index, updateHash = true) {
    if (index < 0) index = 0;
    if (index >= totalSlides) index = totalSlides - 1;

    currentSlideIndex = index;

    slides.forEach((slide, i) => {
      const isActive = i === currentSlideIndex;
      slide.classList.toggle('active', isActive);
      slide.setAttribute('aria-hidden', String(!isActive));
      if (isActive) {
        slide.scrollTop = 0;
        const frame = slide.querySelector('.frame');
        if (frame) frame.scrollTop = 0;
      }
    });

    // Update Progress Bar
    const progressPercent = ((currentSlideIndex + 1) / totalSlides) * 100;
    if (progressFill) {
      progressFill.style.width = `${progressPercent}%`;
    }

    // Update Counter
    if (counterCurrent) {
      counterCurrent.textContent = String(currentSlideIndex + 1);
    }

    // Update Navigation Buttons State
    if (btnPrev) btnPrev.disabled = currentSlideIndex === 0;
    if (btnNext) btnNext.disabled = currentSlideIndex === totalSlides - 1;

    // Update Header Topic Title
    const activeSlide = slides[currentSlideIndex];
    if (activeSlide && topicTitle) {
      const activeTitle = activeSlide.querySelector('.slide-title');
      const activeTag = activeSlide.querySelector('.slide-tag');
      const text = activeTitle ? activeTitle.textContent.trim() : '';
      const tagText = activeTag ? activeTag.textContent.trim() + ' | ' : '';
      topicTitle.textContent = `${tagText}${text}`;
    }

    // Update Drawer Active Item
    if (drawerList) {
      const items = drawerList.querySelectorAll('.drawer-slide-item');
      items.forEach((item, i) => {
        item.classList.toggle('active', i === currentSlideIndex);
        if (i === currentSlideIndex) {
          item.setAttribute('aria-current', 'page');
        } else {
          item.removeAttribute('aria-current');
        }
      });
    }

    // Update URL hash
    if (updateHash) {
      window.location.hash = `#${currentSlideIndex + 1}`;
    }

    // Inter-frame postMessage broadcast (for quest shell integration)
    const slideInfo = {
      type: 'SLIDE_CHANGED',
      currentSlide: currentSlideIndex + 1,
      totalSlides: totalSlides,
      title: activeSlide && activeSlide.querySelector('.slide-title') ? activeSlide.querySelector('.slide-title').textContent.trim() : ''
    };

    if (embedded) {
      window.parent.postMessage(slideInfo, '*');
    }
  }

  function nextSlide() {
    if (currentSlideIndex < totalSlides - 1) {
      goToSlide(currentSlideIndex + 1);
    }
  }

  function prevSlide() {
    if (currentSlideIndex > 0) {
      goToSlide(currentSlideIndex - 1);
    }
  }

  // Fullscreen Management
  function toggleFullscreen() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  }

  function updateFullscreenIcon() {
    if (!btnFullscreen) return;
    const isFullscreen = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    const useElem = btnFullscreen.querySelector('use');
    if (useElem) {
      useElem.setAttribute('href', isFullscreen ? 'assets/icons/sprite.svg#icon-minimize' : 'assets/icons/sprite.svg#icon-maximize');
    }
    btnFullscreen.setAttribute('aria-label', isFullscreen ? 'Sair da Tela Cheia' : 'Entrar em Tela Cheia');
  }

  document.addEventListener('fullscreenchange', updateFullscreenIcon);
  document.addEventListener('webkitfullscreenchange', updateFullscreenIcon);

  // Drawer Controls
  function rememberFocus() {
    if (!document.querySelector('#deck-drawer.open, #deck-search-modal.open, #deck-help-modal.open')) {
      lastFocus = document.activeElement;
    }
  }

  function restoreFocus() {
    if (lastFocus && lastFocus !== document.body && typeof lastFocus.focus === 'function' && document.contains(lastFocus)) {
      lastFocus.focus();
    } else if (stage) {
      // Never leave focus inside a closed dialog (keys would be swallowed)
      stage.focus({ preventScroll: true });
    }
    lastFocus = null;
  }

  function openDrawer() {
    rememberFocus();
    buildDrawerList();
    if (drawer) drawer.classList.add('open');
    if (drawerOverlay) drawerOverlay.classList.add('open');
    drawer?.setAttribute('aria-hidden', 'false');
    const activeItem = drawerList ? drawerList.querySelector('.drawer-slide-item.active') : null;
    if (activeItem) activeItem.focus();
  }

  function closeDrawer() {
    const wasOpen = drawer && drawer.classList.contains('open');
    if (drawer) drawer.classList.remove('open');
    if (drawerOverlay) drawerOverlay.classList.remove('open');
    drawer?.setAttribute('aria-hidden', 'true');
    if (wasOpen) restoreFocus();
  }

  // Search Modal Controls
  function openSearchModal() {
    if (searchModal && modalOverlay) {
      rememberFocus();
      searchModal.classList.add('open');
      modalOverlay.classList.add('open');
      searchModal.setAttribute('aria-hidden', 'false');
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
        renderSearchResults('');
      }
    }
  }

  function closeSearchModal() {
    if (searchModal && modalOverlay && searchModal.classList.contains('open')) {
      searchModal.classList.remove('open');
      modalOverlay.classList.remove('open');
      searchModal.setAttribute('aria-hidden', 'true');
      restoreFocus();
    }
  }

  function renderSearchResults(query) {
    if (!searchResults) return;
    searchResults.innerHTML = '';
    // Accent-insensitive: "botao" finds "botão"
    const semAcento = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const q = semAcento(query.trim());

    const matches = slides.map((slide, index) => {
      const titleElem = slide.querySelector('.slide-title');
      const tagElem = slide.querySelector('.slide-tag');
      const bodyElem = slide.querySelector('.slide-body');
      const title = titleElem ? titleElem.textContent : '';
      const tag = tagElem ? tagElem.textContent : '';
      const content = bodyElem ? bodyElem.textContent : '';
      return { index, title, tag, fullText: semAcento(`${tag} ${title} ${content}`) };
    }).filter(item => !q || item.fullText.includes(q));

    if (matches.length === 0) {
      const emptyNote = document.createElement('div');
      emptyNote.className = 'search-empty';
      emptyNote.textContent = 'Nenhum slide correspondente encontrado.';
      searchResults.appendChild(emptyNote);
      return;
    }

    matches.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'search-result-item';
      const label = document.createElement('span');
      const strong = document.createElement('strong');
      strong.textContent = String(item.index + 1).padStart(2, '0');
      label.append(strong, ` \u00b7 ${item.title.trim()}`);
      const tag = document.createElement('span');
      tag.className = 'search-result-tag';
      tag.textContent = item.tag.replace(/\s+/g, ' ').trim();
      btn.append(label, tag);
      btn.addEventListener('click', () => {
        goToSlide(item.index);
        closeSearchModal();
      });
      searchResults.appendChild(btn);
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderSearchResults(e.target.value);
    });
  }

  // Help Modal Controls
  function openHelpModal() {
    if (helpModal && modalOverlay) {
      rememberFocus();
      helpModal.classList.add('open');
      modalOverlay.classList.add('open');
      helpModal.setAttribute('aria-hidden', 'false');
      if (btnCloseHelp) btnCloseHelp.focus();
    }
  }

  function closeHelpModal() {
    if (helpModal && modalOverlay && helpModal.classList.contains('open')) {
      helpModal.classList.remove('open');
      modalOverlay.classList.remove('open');
      helpModal.setAttribute('aria-hidden', 'true');
      restoreFocus();
    }
  }

  // Close all overlays
  function closeAllOverlays() {
    closeDrawer();
    closeSearchModal();
    closeHelpModal();
  }

  // Event Listeners for Controls
  if (btnPrev) btnPrev.addEventListener('click', prevSlide);
  if (btnNext) btnNext.addEventListener('click', nextSlide);
  if (btnFullscreen) btnFullscreen.addEventListener('click', toggleFullscreen);
  if (btnDrawer) btnDrawer.addEventListener('click', openDrawer);
  if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', closeDrawer);
  if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);
  if (btnSearch) btnSearch.addEventListener('click', openSearchModal);
  if (btnCloseSearch) btnCloseSearch.addEventListener('click', closeSearchModal);
  if (btnHelp) btnHelp.addEventListener('click', openHelpModal);
  if (btnCloseHelp) btnCloseHelp.addEventListener('click', closeHelpModal);
  if (modalOverlay) modalOverlay.addEventListener('click', closeAllOverlays);

  // Keyboard Event Listener
  document.addEventListener('keydown', (e) => {
    // If typing in search input, handle Escape and Enter only
    if (document.activeElement === searchInput) {
      if (e.key === 'Escape') {
        closeSearchModal();
      } else if (e.key === 'Enter') {
        const firstItem = searchResults ? searchResults.querySelector('.search-result-item') : null;
        if (firstItem) {
          firstItem.click();
        }
      }
      return;
    }

    // Inside the quest drawer: forward drawer shortcuts to the parent page
    if (embedded && (e.ctrlKey || e.altKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      window.parent.postMessage({ type: 'TOGGLE_DRAWER' }, window.location.origin);
      return;
    }

    if (e.key === 'Escape') {
      const anyOpen = document.querySelector('#deck-drawer.open, #deck-search-modal.open, #deck-help-modal.open');
      closeAllOverlays();
      if (embedded && !anyOpen) {
        window.parent.postMessage({ type: 'CLOSE_DRAWER' }, window.location.origin);
      }
      return;
    }

    // Leave browser shortcuts (Ctrl+F, Cmd+K...) alone
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // Space or Enter on a focused control activates it instead of turning the page
    const tag = e.target && e.target.tagName;
    const onControl = tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (onControl && e.key === ' ') return;

    // Navigation Keys
    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
      case ' ':
        e.preventDefault();
        nextSlide();
        break;
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault();
        prevSlide();
        break;
      case 'Home':
        e.preventDefault();
        goToSlide(0);
        break;
      case 'End':
        e.preventDefault();
        goToSlide(totalSlides - 1);
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        toggleFullscreen();
        break;
      case 'k':
      case 'K':
      case '/':
        e.preventDefault();
        openSearchModal();
        break;
      case 'm':
      case 'M':
      case 'o':
      case 'O':
        e.preventDefault();
        if (drawer && drawer.classList.contains('open')) {
          closeDrawer();
        } else {
          openDrawer();
        }
        break;
      case 'h':
      case 'H':
      case '?':
        e.preventDefault();
        openHelpModal();
        break;
    }
  });

  // Touch Swipe Support
  if (stage) {
    stage.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    stage.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].screenX;
      const touchEndY = e.changedTouches[0].screenY;
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;

      // Ensure horizontal swipe is dominant and exceeds 45px
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 45) {
        if (deltaX < 0) {
          nextSlide();
        } else {
          prevSlide();
        }
      }
    }, { passive: true });
  }

  // Inter-frame PostMessage Listener (Quest <-> Slides API)
  window.addEventListener('message', (event) => {
    // Only the hosting quest page (same origin) may drive the deck
    if (event.origin !== window.location.origin) return;
    if (!event.data || typeof event.data !== 'object') return;
    const msg = event.data;

    switch (msg.type) {
      case 'JUMP_TO_SLIDE': {
        const targetIndex = typeof msg.slideIndex === 'number' ? msg.slideIndex - 1 : 0;
        goToSlide(targetIndex);
        break;
      }
      case 'NEXT_SLIDE':
        nextSlide();
        break;
      case 'PREV_SLIDE':
        prevSlide();
        break;
      case 'GET_CURRENT_SLIDE': {
        const activeSlide = slides[currentSlideIndex];
        const response = {
          type: 'CURRENT_SLIDE_REPORT',
          currentSlide: currentSlideIndex + 1,
          totalSlides: totalSlides,
          title: activeSlide && activeSlide.querySelector('.slide-title') ? activeSlide.querySelector('.slide-title').textContent.trim() : ''
        };
        if (event.source) {
          event.source.postMessage(response, '*');
        }
        break;
      }
    }
  });

  // Hash Navigation Handler
  function handleHash() {
    const hash = window.location.hash.replace('#', '');
    const slideNumber = parseInt(hash, 10);
    if (!isNaN(slideNumber) && slideNumber >= 1 && slideNumber <= totalSlides) {
      goToSlide(slideNumber - 1, false);
    } else {
      goToSlide(0, false);
    }
  }

  window.addEventListener('hashchange', handleHash);

  // Initial Run
  buildDrawerList();
  handleHash();

  // Notify parent frame that slides are ready
  if (embedded) {
    window.parent.postMessage({
      type: 'SLIDES_READY',
      totalSlides: totalSlides
    }, '*');
  }

})();
