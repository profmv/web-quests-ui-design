# Handoff 007 - Open Items from Handoff 006 Fixed

- **Date:** 2026-11-04
- **Branch:** `claude/gifted-fermat-xjemck` (pushed; not merged; no PR opened)
- **Environment:** Linux cloud session (Windows governance tooling and diary plugin unavailable)
- **Previous:** `docs/handoffs/handoff_006.md` (section 4 listed the open items fixed here)

## 1. Done
1. **Lock 7 hint 2 and 1-line message:** the hint now says the description AND the frame `conteudo` need Fill container (button also Fill; header, chips and other texts Hug). The 1-line description message explains that a Hug frame does not pass the card width down.
2. **Truncated labels (1366x768):** lock 7 Largura/Altura selects are full width; lock 6 shows the full heuristic name under each select; lock 5 `.order-name` wraps instead of ellipsis. Lock 6 problem callout keeps the space after "P1:".
3. **Glossary links:** `redim` relabelled "Figma: guia de auto layout (Fixed, Hug e Fill)"; `margem` now Material 3 window size classes; `regiao` now W3C ARIA landmark regions; final bonus button points to the auto layout guide and is labelled with it. No Help Center search URLs remain in the source.
4. **New targeted messages:** lock 6 pair swaps (P2/P3, P2/P6, P3/P6) via `trocas()`; lock 7 width 340 (loose frame size, N8-N11); lock 7 chips stacked in the header without their own frame (`cardAL({ chipsSoltos })`, N10 and N11).
5. **Cosmetic:** lock 4 marker A no longer touches the search icon; marker D no longer overlaps the urgency text; lock 4 all-OK message rewritten (it said "nada classificado"); lock 6 P1 aligned right, P4 off the field text; generic error message without nested parentheses; slide 19 Fill demo wraps (216px parent); lock 3 canvas order matches the export order (Default, Hover, Pressed, Focus, Disabled).
6. `quest/etapas.json` rebuilt (no passphrase). `quest/placar/verificacao.json` stays valid: it holds only titles and normalized answers, and no answer changed.

## 2. Proven
- Scripted Chromium (scratch scripts, not committed): all 8 locks open with their answers; every new targeted message fires with its exact text; 0 console errors; 390px with no horizontal page scroll on locks 3, 4, 6, 7; lock 7 selects 261px with no overflow; screenshots reviewed for lock 4 screen 1 (1366 and 390), lock 6 portal and right panel, slide 19 wrap demo (Fill text 2 lines, 198px).
- `python scripts/audit/check_no_emojis.py` exit 0 (155 files). All touched files UTF-8 without BOM.

## 3. Not Proven
- `gov.py checar`, diary and lessons plugin commands (Windows paths absent). Diary entries for this session were not written: the diary is plugin-managed and must not be edited by hand.
- External link reachability (proxy returns 403 for help.figma.com, nngroup.com, m3.material.io).
- No fresh student playtest after these fixes.

## 4. [PENDING] Encrypted source backup is stale (action required)
- `scripts/build/etapas.source.enc.json` still holds the handoff 006 source. The teacher passphrase was not available in this session.
- **Risk:** on the Windows clone, `--restaurar` would bring back the old source and a rebuild would silently drop items 1, 3, 4 and the lock 4 message above.
- **Fix:** in a session that has the updated `quest/etapas.source.mjs` (this cloud container, or a copy of it), run:
  `node scripts/build/build_etapas.mjs --placar-senha "<teacher passphrase>"`
  then commit `quest/etapas.json`, `quest/placar/verificacao.json`, `scripts/build/etapas.source.enc.json`.

## 5. Next Steps
1. Refresh the encrypted backup (section 4).
2. Fresh student playtest (no answer access) focused on locks 5-7.
3. Open a PR to `master` for review; deploy after merge.
