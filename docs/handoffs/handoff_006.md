# Handoff 006 - Restructured Trail: Workspace Theme, Value-Chain Locks, Minigames, Verified Scoreboard

- **Date:** 2026-11-04
- **Branch:** `claude/gifted-fermat-xjemck` (pushed; not merged; no PR opened)
- **Environment:** Linux cloud session (Windows-only governance tooling under `C:\Repo\...` unavailable)
- **Contract:** `artifacts/contrato_entrega_reestruturacao.md` (signed by the user). Teaching rules and slide numbering: `artifacts/spec_regras_didaticas.md`.
- **Session stopped by the user** during the second round of acceptance fixes (section 4 lists what was in progress).

## 1. Decisions (grill-me rounds 1-3)
- Restructure (not polish); everything solvable in the browser, plus an optional Figma bonus mission.
- Original in-page minigames; external sites only as optional "Explore mais" cards.
- New answers for every lock; no answers in any tracked file.
- Answers are values produced by the pair's own work and carried from lock to lock (no guessable keywords).
- ~100-minute class; lab desktop first, phone usable (panels become tabs).
- One art direction: generic design-tool workspace (no product branding).
- Slides: fix every reported error and add the Figma-prep section.
- Scoreboard on the reference model (web-riddle-js).
- Rejection criteria chosen by the user: "solvable without learning" and "wall of text".

## 2. Done
- **Design system:** `assets/css/tokens.css` (all text pairs measured >= 4.5:1; `[hidden]` honoured globally).
- **Slides (22):** workspace frames; rules R1-R12; 8 new slides (contrast, mobile layout grid, clinical-eye details, low-fi wireframe, Nielsen heuristics, Figma bridge 2-4); all errors reported by the first playtest fixed. Portal restyled.
- **Quest:** `quest/index.html` + `assets/js/app.js`, `ui.js`, `progress.js`, `crypto.js`; benches in `assets/js/bancadas/` (tipografia, leitura, ritmo, estados, consistencia, wireframe, heuristicas, autolayout simulator with Shift+A, nested frames, Fixed/Hug/Fill); minigames in `assets/js/minigames/` (Olho Clinico, Corrida do Contraste, Ajuste Fino). Glossary balloons with slide jumps and external links; 2 hints per lock; pair roles swap each lock; certificate, `tokens.json` download and Figma bonus mission.
- **Predictable mistakes:** stored as salted hashes with targeted messages (lock 0: 14, lock 4: per-screen, lock 6: per-heuristic, others 8-12).
- **Progress code `WQ2.`:** team-bound answer hashes, times, errors, hints, minigame points; answers and bench work only inside a vault encrypted with the pair's password (restore on another computer).
- **Scoreboard (`quest/placar/`):** teacher passphrase decrypts `verificacao.json` (PBKDF2 600k); counts the verified prefix; flags broken seal, wrong answers, copied codes (same start, different names) and impossible timings; editable scoring rules; CSV (UTF-8 with BOM for Excel, documented exception); print.
- **Build:** `scripts/build/build_etapas.mjs --placar-senha "<passphrase>"` encrypts the locks, enforces the 120-word briefing limit, hashes mistakes, writes `verificacao.json` and the encrypted source backup `scripts/build/etapas.source.enc.json`; `--restaurar` recovers the gitignored source.

## 3. Proven
- Scripted Chromium runs: all 8 locks open with their answers; targeted messages fire; 0 console errors; 390px with no horizontal page scroll on every lock and the final screen.
- The lock 7 simulator reaches the target size through the UI; checklist 5/5; the export code changes when names or the component are missing.
- Progress code contains no readable answers; restore on a second browser context works; scoreboard rejects a wrong passphrase, ranks a real code 8/8, and marks a forged code (team renamed) [FAIL] 0/8.
- Acceptance playtest 1 (fresh agent, no answer access): learning 4, fun 4, difficulty 3.5, visual 4; failed difficulty curve and glossary links; bugs listed. Fixed in `04822fa`.
- Focused re-test (fresh agent, no answer access): learning 5, fun 4, difficulty curve 4 (PASS, felt 2-2-2-3-3-3-2/3-4), elimination PASS (lock 7 code depends on naming and component), glossary links FAIL (minor), bugs FAIL (truncated select labels).
- Emoji audit exit 0; touched files UTF-8 without BOM.

## 4. Open (from the focused re-test, not yet fixed)
1. **Lock 7 hint 2 is wrong:** it says "o resto em Hug", but the frame `conteudo` must be Fill container for the description to wrap (`quest/etapas.source.mjs`, lock 7 `dicas[1]`). Also reword the 1-line-description mistake message: the description AND its parent frame need Fill.
2. **Truncated labels in the right panel at 1366x768:** lock 7 sizing selects ("Fill contai"), lock 6 heuristic selects, lock 5 stack names. Fix: make the lock 7 size selects full width, show the chosen heuristic name under each select, let `.order-name` wrap.
3. **Glossary labels:** lock 7 "redimensionamento" uses the general auto layout guide; "margens do layout grid" and the final "Ajuda do Figma" button are Help Center searches; lock 5 "região" link is about prototype fidelity.
4. **Missing targeted messages:** lock 6 prevention/recovery swap; lock 7 width left at the loose frame size (340); lock 7 chips without their own horizontal frame.
5. **Cosmetic:** lock 4 marker A over the search icon; lock 6 P1 touching text, P4 covering the field at 390px; nested parentheses in the generic error message; lock 4 all-OK message says "nada classificado"; slide 19 "Fill container: quebra" demo does not wrap (`slides/index.html` line ~1385); lock 3 canvas order differs from export order.
6. After fixing items 1 and 4, rebuild: `node scripts/build/build_etapas.mjs --placar-senha "<passphrase>"` and commit `quest/etapas.json`, `quest/placar/verificacao.json`, `scripts/build/etapas.source.enc.json`.

## 5. Not Proven
- `gov.py checar` and Windows plugin commands (paths absent in the cloud session).
- External links reachability (egress policy blocked the hosts); the Figma Help article IDs and NN/g URLs are unverified.
- Real class timing (estimate 95-120 min from playtests); real human minigame timer pressure; screen reader run.
- GitHub Pages deploy (runs only on `master`).

## 6. Custody and Next Steps
- **Teacher passphrase:** given to the user in chat only; never stored in the repository. It decrypts `verificacao.json` and the source backup. To change it, rebuild with a new `--placar-senha`.
- **Windows clone:** after `git pull`, restore the source with `node scripts/build/build_etapas.mjs --restaurar --placar-senha "<passphrase>"`.
- **Next:** fix section 4, rerun a fresh student playtest, then open a PR to `master` for review (deploy after merge).
