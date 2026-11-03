# Agent Execution Plan - Web Quests UI Design

## Overview
Develop a dynamic web-based learning platform for App UI Design and Figma preparation, hosted publicly on GitHub (`profmv/web-quests-ui-design`). The project integrates interactive educational slides with a paired dynamic quest featuring progressive locks, clinical eye challenges, wireframing tasks, and zero emojis.

## Project Waves

- [ ] **Wave 1: Inception, Architecture & Governance (Current)**
  - Initial prompt recorded in `docs/prompts/001_prompt_inicial.md`
  - Directory structure initialized (`quest/`, `slides/`, `docs/handoffs/`, `scripts/`, `artifacts/`, `.agents/`)
  - Harness tools created and catalogued in `scripts/README.md`
  - Governance nodes initialized in `.governanca/grafo.db` via `gov.py`
  - Skeleton-of-Thought architecture submitted for approval

- [ ] **Wave 2: Part 1 - Presentation Deck (`slides/`)**
  - Subagent task: Dedicated Slide Deck Designer
  - Interactive web presentation covering 4 core pillars:
    1. Visual Hierarchy (font size, weight, contrast, scanning patterns)
    2. Affordance & Signifiers (interactive cues, elevated buttons, bottom nav)
    3. Consistency & Standards (universal conventions, cognitive friction)
    4. Spacing & Grid (8px principle: 4, 8, 16, 24, 32px)
  - Keyboard navigation (`ArrowLeft`, `ArrowRight`, `Esc`, `Home`, `End`), touch swipe support, high-contrast accessible design
  - Standalone plenary view and embeddable side-drawer component

- [ ] **Wave 3: Part 2 - Dynamic Quest (`quest/`)**
  - Subagent task: Dedicated Quest & Gameplay Engineer
  - Chained cryptographic lock pipeline (AES-256-GCM + PBKDF2)
  - Interactive UI challenges:
    - Lock 0: Visual Hierarchy eye test (identifying and fixing font scale / contrast / scanning priority)
    - Lock 1: Affordance & Signifiers fix (transforming flat dead elements into unmistakable affordances)
    - Lock 2: Consistency & Patterns detective (spotting broken conventions and dark patterns)
    - Lock 3: The 8px Grid alignment workbench (snapping misaligned elements to 8px multiples)
    - Lock 4: Low-fidelity wireframing sandbox (abstracting real screens to box/line skeletons)
    - Lock 5: Usability critique & rapid solution generation (critique of everyday bad UI)
    - Lock 6: UI Minigame gauntlet (integrating challenges inspired by cantunsee, bezier, kerntype, color, userinyerface)
    - Lock 7: The Master Lock & Pair Certification
  - Progress code generation & restoration, pair backpack, pedagogical traps with debug feedback

- [ ] **Wave 4: Integration, Teacher Dashboard & Verification**
  - Unified root index (`index.html`) allowing split-screen or instant slide drawer consultation
  - Professor scoreboard (`quest/placar/index.html`) with passphrase-protected hash verification and CSV export
  - Automated verification suite (`check_no_emojis.py`, build tests, browser tests)
  - GitHub Pages deployment readiness (`.nojekyll`, zero backend dependencies)
