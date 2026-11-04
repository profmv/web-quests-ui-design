# Delivery Contract - Web Quests UI Design Restructure

- **Date:** 2026-11-04
- **Status:** [OK] Signed by the user
- **Inputs:** grill-me rounds 1-3, reference analysis (web-riddle-js), student playtest of the previous trail.

## Goal
A ~100-minute trail where a pair rebuilds one broken app screen into a Figma-ready component, producing real design values that carry from lock to lock.

## Deliverable
Shared design system, fixed and extended slides, new quest (8 locks + 3 minigames), new scoreboard. Same stack and branch, phased pushes, one PR to `master`; deploy only after the user merges.

## Content (delegated decisions)
- **Story:** junior design pair at a studio; a client's "campus event card" screen is broken; each lock fixes one aspect of the same screen, which evolves on the canvas from chaos to polished.
- **Locks (value chain):**
  0. Visual hierarchy: type scale (base x ratio) -> H1 snapped to 8px
  1. Scanning F/Z: reading order of blocks -> order code
  2. 8px spacing: paddings and gaps -> card height
  3. Affordance and states: 5 states with signifiers -> touch target / contrast value
  4. Consistency and dark patterns: icon and pattern matching with decoys -> position code
  5. Low-fi wireframe: skeleton from a real screen -> block / layout code
  6. Nielsen heuristics: critique of an everyday screen -> heuristic numbers
  7. Figma bridge: layers, naming, constraints, auto layout, component matching a ghost outline -> final W x H
- **Minigames:** 3 original interludes of 2-4 minutes (spot-the-flaw "clinical eye", contrast race, kerning drag). External sites only as optional "Explore more" cards.
- **Finish:** certificate, "download our tokens" JSON for Figma Variables, optional Figma bonus mission with no lock depending on it.

## Acceptance Criteria
1. A fresh student-playtest agent scores >= 4/5 on all four criteria; difficulty rises from ~1-2 to 4.
2. No lock passes by guessing, elimination, or copying values from its statement.
3. At least 2 targeted messages for predictable mistakes per lock.
4. No lock statement above 120 words before the first interaction.
5. Every lock cites a slide; glossary balloons link to Figma Help, WCAG or NN/g.
6. 6-8 new slides (heuristics, wireframing, Figma bridge); every reported slide error fixed.
7. One visual theme (design-tool workspace) across portal, slides, quest and scoreboard.
8. Lab desktop 1366x768 and 390px: no horizontal scroll; panels become tabs on phones.
9. Scoreboard (reference model): hashes not answers in codes; teacher-passphrase verification file; scoring stops at first failed lock; copied codes and impossible timings flagged; red [FAIL] for tampered; editable scoring; CSV export.
10. 0 console errors; emoji audit passes; WCAG AA contrast; reduced motion and keyboard navigation; UTF-8 without BOM.

## Negative Scope (rejects the delivery)
- Any lock solvable without learning.
- Walls of text.

## Constraints
- No answers in any tracked file (handoffs, diary, captures, progress code). Answers live only in the gitignored source.
- Static stack, no server.

## Assumptions
- Generic workspace look, no Figma logo or branding imitation.
- Offline-first, no CDN dependencies.
- `gov.py` and Windows plugin commands are not runnable in the cloud session; reported as unverified.

## Risks
- The value chain is harder to author and tune; mitigated by targeted mistake messages.
- The 100-minute estimate comes from a simulated playtest, not real students.

## Phases
1. Design system + slide fixes + new slides
2. Locks 0-3 + minigame 1
3. Locks 4-7 + minigames 2-3 + Figma bonus
4. Scoreboard + playtest re-run + PR
