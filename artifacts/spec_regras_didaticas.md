# Teaching Rules Spec and Deck Outline

Source of truth shared by `slides/` and `quest/`. Contains rules only, never lock answers or lock parameters.
Slide numbers are fixed: quest hints cite them with `JUMP_TO_SLIDE`.

## Story
The pair are junior designers at "Estudio Oito" (the name nods to the 8px grid). A client, the campus app "Agenda do Campus", sent a broken screen: the event card "Dia do Design". Each lock fixes one aspect of the same card, which evolves on the canvas from chaos to a Figma-ready component. People: Bia (lead designer, writes the briefs as canvas comments) and the client Prof. Ramos.

## Rules the locks depend on (slides must teach them exactly)

### R1 Modular type scale (slide 4)
- size(n) = base x ratio^n. Named ratios: Segunda Maior 1.125, Terca Maior 1.25, Quarta Justa 1.333, Quinta Justa 1.5.
- Studio rule: round every font size to the nearest multiple of 4.
- Line height: body text 1.5x, headings 1.25x, then round to the nearest multiple of 4.
- Example with base 16 and ratio 1.2 (not used by any lock): 16, 19.2 -> 20, 23.04 -> 24, 27.65 -> 28.

### R2 Visual weight and reading order (slide 5)
- The eye visits elements by visual weight. Compare in this order: 1) font size, 2) font weight, 3) contrast with the background.
- Only if size, weight and contrast tie, the scanning pattern decides: top before bottom, then left before right (F/Z pattern, slide 3).
- Colour hue alone does not make an element heavier; contrast does.

### R3 Button states (slide 7)
- Five states: Default, Hover, Focus, Pressed, Disabled.
- Hover: one tone darker than Default. Pressed: two tones darker than Default.
- Focus: a visible ring of at least 2px with 3:1 contrast against the adjacent background (WCAG 2.4.7 / 1.4.11).
- Disabled: lower contrast, no elevation, cursor `not-allowed`; never signalled by colour alone (also a label or icon change).

### R4 Contrast and touch targets (slides 8 and 9)
- WCAG 2.2 1.4.3: normal text 4.5:1; large text 3:1 (>= 24px regular or >= 18.66px bold).
- WCAG 2.2 1.4.11: non-text UI parts (borders, icons, focus rings) 3:1.
- Contrast ratio = (L1 + 0.05) / (L2 + 0.05), L = relative luminance.
- Touch targets: WCAG 2.2 2.5.8 minimum 24 x 24 CSS px; Apple HIG 44pt; Material 48dp. Studio rule: 48px.

### R5 Consistency and conventions (slide 10)
- External consistency (Jakob's law): magnifier = search, X = close, three lines = menu, gear = settings, heart = favourite, left arrow = back, bell = notifications, trash can = delete.
- Internal consistency: the same action always has the same look, label and position in the whole app; one primary button per screen.
- An outlined (ghost) secondary button next to a filled primary is a correct pattern, not an inconsistency.

### R6 Dark patterns (slide 11)
- Confirmshaming, pre-checked opt-in, roach motel (easy to enter, hard to leave), hidden costs, disguised ad / fake close button, trick question (double negative), false urgency.

### R7 Spacing (slides 12 and 13)
- Scale: 4, 8, 16, 24, 32, 48, 64. Every spacing value is a multiple of 8 (4 only for tight icon/text pairs).
- Proximity (Gestalt): related items closer than unrelated ones. Inner spacing <= outer spacing.
- Studio rhythm recipe: inside a group 8; between groups 16; before the main action 24; container padding equals the largest gap inside it.
- Remove the false claim that "almost all screen resolutions divide by 8". Correct claim: common device widths (360, 375, 390, 412, 768, 1280, 1440) are multiples of 8 or close to it, and density scales 1x/1.5x/2x/3x keep multiples of 8 on whole pixels.

### R8 Mobile layout grid (slide 14)
- 4 columns, 16px side margins, 16px gutters on a 360px-wide frame. Column width = (360 - 2x16 - 3x16) / 4 = 70.
- Content width = frame width - 2 x margin.

### R9 Clinical-eye details (slide 15)
- Optical alignment: shapes like play triangles and round icons need visual, not mathematical, centring.
- Nested radius: outer radius = inner radius + padding.
- Kerning: space between letter pairs; uneven pairs (AV, To, LT) look loose.

### R10 Low-fidelity wireframe (slide 16)
- Grey blocks, no colour or real images (box with an X for images), lines for text, one block per screen region.
- Mobile region vocabulary: App bar, Campo de busca, Chips de filtro, Banner (hero), Card, Item de lista, Barra de abas (bottom navigation), Botao flutuante (FAB).
- Abstraction rules: one block per region from top to bottom; a repeated item is drawn once per occurrence; decoration that carries no function is not a region.

### R11 Nielsen's 10 heuristics (slide 17), numbered
1. Visibilidade do status do sistema
2. Correspondencia entre o sistema e o mundo real
3. Controle e liberdade do usuario
4. Consistencia e padroes
5. Prevencao de erros
6. Reconhecer em vez de lembrar
7. Flexibilidade e eficiencia de uso
8. Estetica e design minimalista
9. Ajudar a reconhecer, diagnosticar e recuperar erros
10. Ajuda e documentacao
Each with one everyday example. Prevention (5) acts before the error; recovery (9) acts after it.

### R12 Figma bridge (slides 18-21)
- Frame vs group: a frame has its own size, fill, clipping, layout grid and auto layout; a group only bundles layers.
- Layer naming: semantic names describing purpose ("titulo", "botao-inscrever"), never "Rectangle 12" or "Group 3". Components use slash naming "Card/Evento".
- Auto layout: direction (vertical/horizontal), gap (space between items), padding (space between items and frame edge), alignment.
- Resizing per layer: Fixed (fixed size), Hug contents (size follows content), Fill container (stretches to the parent). Text that must wrap needs Fill container width.
- Frame size with auto layout and Hug height: height = padding top + sum of child heights + gap x (children - 1) + padding bottom.
- Components: main component and instances; variants are property=value sets (for example Estado=Default, Estado=Hover).
- Styles and variables (tokens): colour, spacing, radius and type values saved once and reused.
- Prototype: connections, trigger (On click), action (Navigate to), animation (Smart Animate). Handoff: inspect panel shows measurements and code values.

## Deck outline (22 slides)
1. Capa e missao (Estudio Oito story)
2. Interface e comunicacao
3. Escaneamento: padroes F e Z (fix Z marker overlap)
4. Escala tipografica modular (R1; fix sample sizes to match their labels)
5. Peso visual e ordem de leitura (R2; replaces "Teste do Card", keeps a before/after card)
6. Affordance vs signifier
7. Os 5 estados do botao (R3; Default example must pass 4.5:1)
8. Zona do polegar, navegacao inferior e alvos de toque (R4 targets)
9. Contraste WCAG: texto, texto grande, nao-texto e foco (R4) [new]
10. Lei de Jakob e consistencia (R5)
11. Dark patterns (R6)
12. Grid de 8px (R7 scale; fix demo captions; remove the false resolution claim)
13. Proximidade e ritmo (R7 recipe)
14. Layout grid mobile (R8) [new]
15. Olho clinico: alinhamento optico, raio aninhado, kerning (R9) [new]
16. Wireframe de baixa fidelidade (R10) [new]
17. As 10 heuristicas de Nielsen (R11) [new]
18. Ponte Figma 1: frames, grupos, camadas e nomes (R12)
19. Ponte Figma 2: auto layout e redimensionamento (R12) [new]
20. Ponte Figma 3: componentes, variantes, estilos e variaveis (R12) [new]
21. Ponte Figma 4: prototipo e handoff (R12) [new]
22. Roteiro da missao e "Explore mais" (fix the "4 etapas" text: the trail has 8 locks and 3 minigames)

## Slide errors reported by the playtest (must be fixed)
- Slide 4 type-scale labels (32/24/18/16) did not match rendered samples (24/20/16/15).
- Slide 11 (now 12) 8px demo captions were wrong.
- False claim that almost all resolutions divide by 8.
- "Default" button example failed 4.5:1.
- Two statistics without a source: cite the source or remove them.
- Slide 3 Z-pattern markers overlapped their labels.
- Large empty bands on many slides.
- Last slide said the quest has 4 stages.

## External references for glossary balloons
Link reachability could not be checked from the cloud session (egress policy blocks these hosts). Only stable URL patterns are used; Figma topics use Help Center search pages instead of article IDs.
- Figma Help Center search: https://help.figma.com/hc/en-us/search?query=<topic> (auto+layout, components, variants, variables, frames, constraints, prototyping, dev+mode)
- WCAG 2.2 Understanding: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html, https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html, https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html, https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html
- Nielsen Norman Group: https://www.nngroup.com/articles/ten-usability-heuristics/, https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/, https://www.nngroup.com/articles/clickable-elements/
- Deceptive design catalogue: https://www.deceptive.design/types
