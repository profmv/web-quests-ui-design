# Handoff 008 - Teacher Passphrase Rotated, Encrypted Backup Refreshed

- **Date:** 2026-11-04
- **Branch:** `claude/gifted-fermat-xjemck` (pushed; PR to `master` opened in this session)
- **Environment:** Linux cloud session (Windows governance tooling and diary plugin unavailable)
- **Previous:** `docs/handoffs/handoff_007.md` (section 4 [PENDING] item closed here)

## 1. Done
1. **Passphrase rotation (teacher decision):** the passphrase the teacher supplied did not decrypt the old `scripts/build/etapas.source.enc.json` nor the old `quest/placar/verificacao.json`, and the previous passphrase was not remembered. The teacher chose to rotate: both files are now encrypted with the new passphrase. The new passphrase is NOT written in the repository; the teacher has it.
2. **Rebuild (commit `f9e769d`):** `quest/etapas.json`, `quest/placar/verificacao.json`, `scripts/build/etapas.source.enc.json` regenerated from the handoff 007 source. Student answers unchanged (only salts/IVs changed).
3. Handoff 007 section 4 risk is closed: `--restaurar` on the Windows clone now returns the current source.

## 2. Proven
- Build exit 0 with "[OK] Teacher verification file written" and "[OK] Encrypted source backup written".
- Round-trip: `--restaurar` of the new backup into a scratch path is byte-identical (`cmp`) to `quest/etapas.source.mjs`; scratch plaintext deleted afterwards.
- `quest/placar/verificacao.json` decrypts with the new passphrase (keys `versao`, `titulos`, `respostas`) using the same PBKDF2/AES-GCM routine as `quest/placar/placar.js`.
- `python scripts/audit/check_no_emojis.py` exit 0. The three rebuilt files have no BOM.

## 3. Not Proven
- Scoreboard page not opened in a browser with the new passphrase (Node decrypt only).
- `gov.py checar`, diary and lessons plugin commands (Windows paths absent).
- External link reachability; no fresh student playtest.

## 4. Notes
- Any old copy of the scoreboard file or backup still needs the OLD (lost) passphrase; only the files at `f9e769d` and later open with the new one.
- On the Windows clone, after pulling, run `node scripts/build/build_etapas.mjs --restaurar --placar-senha "<new passphrase>"` to get the gitignored source back.

## 5. Next Steps
1. Teacher: open `quest/placar/` in the browser and confirm the new passphrase unlocks it.
2. Fresh student playtest (no answer access) focused on locks 5-7.
3. Review and merge the PR to `master`; deploy after merge.
