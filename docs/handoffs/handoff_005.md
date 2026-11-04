# Handoff 005 - Answer-Leak Hardening, Source Custody, Accents, Slide Jumps

- **Date:** 2026-11-04
- **Branch:** `claude/gifted-fermat-xjemck`
- **Environment:** Linux cloud session (Windows-only governance tooling under `C:\Repo\...` unavailable)

## 1. Done This Session (all section 4 items of handoff_004, prioritized by the user)

### 1.1 Plain-text answer source (user choice: untrack + Pages filter)
- `quest/etapas.source.mjs` is gitignored and removed from the index. Only `quest/etapas.json` is committed.
- `.github/workflows/deploy.yml` assembles `_site/` with `index.html`, `assets/`, `slides/`, `quest/` only (no `docs/`, `scripts/`, source).
- `scripts/build/build_etapas.mjs` now fails with exit 1 and prints the restore command when the source is missing (it used to exit 0 silently).
- Restore command (bash or PowerShell, keeps UTF-8; `git show ... >` in PowerShell 5 would write UTF-16):
  `git restore --source="$(git log --diff-filter=D -1 --format=%h -- quest/etapas.source.mjs)~1" --worktree -- quest/etapas.source.mjs`
- **[WARNING] for the Windows clone:** the next `git pull` deletes the local `quest/etapas.source.mjs`. Run the restore command above right after pulling.

### 1.2 In-UI answer leaks (user choice: all three)
- Benches shuffle options per render; correctness lives in JS memory (opaque tokens). No `data-correto` / `data-expected` in the DOM (verified: 0 on locks 1, 4, 5).
- Additional leak found and closed: `bancadas.js` hardcoded every answer (`onClue("SIGNIFIER")`, ...). The answer input is now filled from the decrypted stage (`resposta_esperada`).
- Diff picker: random card order, labels follow screen position. Figma bench: options no longer tagged "(Grid 8px)".
- Third hints point at the answer without stating it.
- Gauntlet: ratios moved to a `detalhe` field; correct answer shows all ratios, wrong answer shows only the chosen option's ratio (showing all would give away the retry).

### 1.3 Polish (user choice: all four)
- Hint-to-slide jumps: hints with "Slide N" get "Abrir Slide N" buttons (drawer + `JUMP_TO_SLIDE`). Hints now cite correct slide numbers. Slides engine accepts control messages only from the same origin.
- Portuguese accents restored in `index.html` and `slides/index.html` (text nodes and title/aria-label/alt/content attributes only); verb "e" -> "é" reviewed sentence by sentence. Slide search is accent-insensitive.
- Diary `DIARIO_2026-11-03_009.md`: 16 check-mark glyphs -> `[OK]`; emoji audit now passes.
- Scoreboard: password compared by SHA-256 (plain text removed from the page; change procedure in a code comment). Short note under the table explains that the authenticity column cannot stop deliberate forgery.

### 1.4 Earlier in the session
- Lock 1 teaches 5 button states (Focused added, matches slides 7 and 13). Grid hint pointed to slide 5; corrected to 11. `scripts/audit/__pycache__/*.pyc` untracked.

## 2. Proven
- Full Chromium playthrough of all 8 locks through their benches (wrong attempts on locks 0, 5, 6 first), certificate reached, team name with HTML escaped, 0 console errors.
- Scoreboard: wrong password rejected, `placar2026` accepted via hash, note visible.
- Hint jump opens the drawer on the requested slide.
- 390 px: no horizontal overflow on portal and slides.
- CI site assembly simulated from `git archive HEAD`: 16 site files, no source/docs/scripts.
- Missing-source build exits 1 with the restore hint; restore command reproduces the file byte-identical.
- `python scripts/audit/check_no_emojis.py` exit 0; changed files UTF-8 without BOM.

## 3. Not Proven / Open
- `gov.py checar` and the Windows plugin commands not run (paths absent).
- GitHub Pages deploy not run (deploys on `master` only; this branch is not merged).
- **Answers remain public** in git history (`quest/etapas.source.mjs` in earlier commits) and in tracked governance files (`docs/handoffs/handoff_003.md`, `docs/diario/DIARIO_2026-11-03_007.md`, `docs/licoes/.estado/estado.json`, `scripts/diario/capturas/**`). Untracking stops future exposure only. Real fixes: make the repository private, or change the answers before the next class.
- Scoreboard forgery is inherent to a client-only design (documented on the page).

## 4. Next Step
- User: decide between making the repo private or rotating answers; merge the branch to `master` to deploy; on Windows, restore the source after pulling.
