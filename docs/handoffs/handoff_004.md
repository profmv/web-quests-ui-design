# Handoff 004 - Jargon Removal, Hint Limit, Full Player Audit

- **Date:** 2026-11-04
- **Branch:** `claude/gifted-fermat-xjemck`
- **Environment:** Linux cloud session (Windows-only governance tooling under `C:\Repo\...` unavailable)

## 1. Done This Session

### 1.1 User-facing technical jargon removed (user request)
- Removed AES/PBKDF2/HMAC/WebCrypto/"Zero Emojis"/WCAG badges and fake verification seals from `index.html`, `quest/index.html`, `quest/placar/index.html`, `slides/index.html`, certificate (HTML + SVG) and restore message.
- Pedagogical WCAG content (slide 4, gauntlet challenge 1) kept.

### 1.2 Hint limit (user request)
- Team holds at most 3 hint credits; each revealed hint costs 1; every 2 solved locks restores 1 (capped at 3).
- State field `hintCredits` (signed in the progress code only when present, so older codes remain valid; older states are migrated by estimate).
- Backpack: progressive order enforced, revealed hints persist across reopenings, no reveals on already solved locks, header shows `Dicas (N/3)`, "+1 DICA" notice shown on the next stage.
- Files: `quest/assets/js/progress.js`, `quest/assets/js/app.js`, `quest/assets/css/quest.css`.

### 1.3 Defects found by player simulation and fixed
- Certificate SVG was invalid XML (unescaped `&` in team names) -> escaped; file names strip accents.
- New computer could not restore progress (onboarding modal blocked the button) -> "Ja temos um codigo" button in onboarding.
- Esc / Ctrl+S did nothing with focus inside the slides drawer -> slides iframe forwards them via same-origin `postMessage`.
- Gauntlet accepted clicks during the 1.8 s reset (round skip) -> buttons disabled after an error.
- Grid bench kept the clue after values left the 8px grid -> clue cleared.
- XSS: team names rendered with `innerHTML` in quest and scoreboard -> escaped (`quest/assets/js/util.js`).
- Mobile (390 px): wireframe and auto-layout benches did not stack, gauntlet/bench buttons did not wrap and covered "Testar Chave" -> responsive `.bench-split`, wrapping workbench buttons, non-sticky header and reduced card padding on phones, input min-width fix.
- Wrong contrast ratios in gauntlet options (2.1 -> 2.6, 16.2 -> 17.9).
- Progress file showed 0-based lock number; scoreboard CSV now quotes names safely, uses a BOM for Excel (documented Rule 2 exception), column `Autenticidade`.

## 2. Proven
- Full playthrough in Chromium (desktop): all 8 locks solved through their workbenches with wrong attempts first, certificate SVG valid XML, timer frozen at completion, reload persistence, save code, `.txt` download, scoreboard [VALID]/[FALHA], CSV export, 0 console errors.
- Hint economy observed: 3 -> 2 -> 3 -> 1 -> 2 -> 3 -> 3 (cap); 0 credits blocks reveal; legacy code (no `hintCredits`) still [VALID] and migrates.
- iPhone 13 emulation: 9 stages and 14 slides with no horizontal overflow and no overflowing elements.
- Decrypt chain lock 0..8 verified in Node after rebuild; changed files UTF-8 without BOM.

## 3. Not Proven / Open
- `python scripts/audit/check_no_emojis.py` -> [FAIL] 16 pre-existing hits, only in `docs/diario/DIARIO_2026-11-03_009.md` (pasted `gh` output with check-mark glyph). Left untouched pending user decision.
- `gov.py checar` and diary/lessons plugin commands not run (Windows paths absent).

## 4. Audit Findings Still Open (need user decision)
- `quest/etapas.source.mjs` (all answers in plain text) is deployed to GitHub Pages (`path: '.'`): anyone can read every answer at `/quest/etapas.source.mjs`.
- HMAC pepper and placar password (`placar2026`) are in client code: a forged "completed" code with the public pepper shows [VALID] (reproduced).
- Answers are trivially exposed in the UI: correct options carry `data-correto="true"`, are usually listed first, the third hint of every lock states the answer, and gauntlet options print their contrast ratio.
- Hints reference "Slide 5" for the 8px grid (actual slide 11); lock 1 uses 4 button states while slide 7 teaches 5.
- Quest ignores `SLIDE_CHANGED`/`JUMP_TO_SLIDE` (no hint-to-slide jumps).
- Portal and slides text lack Portuguese accents; quest text has them.
- `scripts/audit/__pycache__/*.pyc` tracked despite `.gitignore`.

## 5. Next Step
- User to prioritize section 4 (recommended first: stop deploying `etapas.source.mjs`).
