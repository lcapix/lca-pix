# The case Tree tab: canvas, tiers, steps and the floating step panel

Screens: `../screens/c-case-work/E03-case-tree.png` (panel shown), `E03b-tree-panel-hidden.png` (panel hidden), `../screens/f-states-and-errors/E03c-keyboard-and-step-menu.png` (focus, keys, step menu, run states).

Rules from the behaviour spec still hold: the tree stays visible, step text never renders under 12px, and the tree is one Tab stop (roving tabindex, arrow keys move between parent, child and sibling, Enter selects, selections announced in an `aria-live="polite"` region).

## Canvas
- Background `#F4F5F3` with a dot grid: `radial-gradient(#D5DBD7 1px, transparent 1px)` at 16px.
- The canvas fills its card. Size and centre the tree in the space the panel leaves free, so it never floats in empty space; the lanes run the full width.

## Top bar inside the canvas
- Left: an info pill. White, 1px `#E3E7E4`, radius 999, padding 6 12, 12px `#3D4340`, a 14px tree icon, then "17 steps", a 1 by 12 `#D5DBD7` divider, "10 flows", a divider, "Edited 2 min ago".
- Right: the zoom group (minus, percent, plus, Fit), the Impact · Cost switch where the screen has it (`E14-step-costs.png`), then, for someone who can change the case, a dark "Add step" button (`#191C1B`, height 36, radius 10, white 13px 600, plus icon). Students get no Add step.
- At most 5 controls on first open.

## Tier lanes
- Five full-width bands, one per tier, about 120 tall. Alternate the ground: white at 45% opacity, then transparent. Top border 1px dashed `#DFE3E0`.
- Label at the band's top left (12 from the left, 6 from the top): a 10px swatch (radius 3, tier fill, 1.5px tier border) and the tier name in IBM Plex Mono 500 12px, letter-spacing .08em, uppercase, `#5E6663`: PRODUCT, MACHINE / LINE, SUBPROCESS, OPERATION, ELEMENTAL TASK.

## Connectors
- Solid `#A9B3AE`, 1.5px, elbow routing: straight down from the parent's bottom centre, a horizontal bus, straight down into each child's top centre. A small 6px radius at each elbow. Never diagonal.

## Steps
- 128 by 72 (124 by 68 when five must fit across), radius 14, white, 1px border in the tier's border colour, padding 0 10, column, gap 4, centred.
- Row 1: a 20 by 20 tile (radius 6, tier fill, 1.5px tier border, 12px icon in the tier ink), then the name, Inter Tight 600 12/15 `#191C1B`, at most two lines. If the step needs an amount, a small amber alert icon (`#8F5B00`) at the right.
- Row 2: a sub line, 12px `#5E6663` (or amber `#8F5B00` 600 "Needs an amount"), and on the right, where the view asks for it, a value chip: IBM Plex Mono 500 12/16, padding 0 6, radius 999, `#E5F1EA` on `#005537` (a share, an amount or a cost).
- Selected: 2px `#006A44` border and `0 0 0 4px rgba(0,106,68,.16)`.
- Needs an amount: dashed 1.5px `#C99A3A` border. The words "Needs an amount" are always there; the colour is never the only signal.
- Tier fill / border / ink:
  - Product `#A7D3B8` / `#3D7256` / `#16331F`
  - Machine / line `#F0A68A` / `#A8472B` / `#3A1A0F`
  - Subprocess `#F5C971` / `#8A6414` / `#3A2A0A`
  - Operation `#7BB5E8` / `#356DA0` / `#0F2238`
  - Elemental task `#C8B5E8` / `#7C61B5` / `#1F1438`

## Bottom of the canvas (floating)
- Left: a "Process tiers" legend card, collapsed by default: white, 1px `#E3E7E4`, radius 12, shadow `0 6px 18px rgba(20,28,24,.08)`, height 36, "Process tiers" 13px 600 and a chevron.
- Next to it the dark Magic Insights pill (`look.md` section 11).

## The step panel floats over the canvas
- A card about 420 wide, anchored top right inside the canvas (16 from the right, below the top bar), white, radius 16, 1px `#E3E7E4`, menu shadow `0 18px 44px rgba(20,28,24,.16)`. Its body scrolls inside the card; the card never runs past the canvas.
- Head row: a drag handle (six dots), "Step · 10. Cut blank", a "More" button (…) and a "Collapse panel" button (chevron).
  - The More menu holds Dock right, Dock left and Reset position. These are the non-drag way to move the panel (WCAG 2.5.7). Every icon button has an accessible name ("Move panel", "More for the step panel", "Collapse panel").
- When Guided mode is on, the guide line is the panel's first block (the face, "GUIDED MODE · EXERCISE 2 OF 6 · MATERIALS", one or two sentences, the BETA pill and "Turn off").
- Then the step: tier tile, "Operation · under Cutting", the name, a one-line description; then each flow as a row with IN or OUT, an amount box (border `#858F8A`), the unit, the sum `0.80 × 1.900 = 1.520 kg CO₂-eq` in mono and the source tag. The steel row carries the in-row choice "Keep the Global average · Use my own number". A saved change confirms on its own line ("✓ Saved · Steel 0.80 kg on 10. Cut blank"), never as a toast.
- "Hide panel" and "Show panel" sit in the case tab row, left of Compare (an icon plus the word). Hidden, the tree re-centres across the full canvas (`E03b`). Showing it again restores the last position.
- The panel must never cover the focused step: when a step under the panel takes focus, the canvas pans it into the free space (WCAG 2.4.11).
