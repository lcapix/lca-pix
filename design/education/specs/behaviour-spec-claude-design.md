> Copied as written from the Claude Design handoff of 15 October 2026. It is the behaviour and data spec the screens in `../screens/` were drawn from. Where a screen and this file disagree, the screen is newer and wins (see `../README.md`, "What changed since the Claude Design handoff"). The prototype files it names (`LCAPIX App v3.dc.html`, `LCAPIX Layout Directions.dc.html`, `LCAPIX Identity v4.dc.html`, `support.js`, `briefs/`) are not in this repo; Kavish can share them.

# Handoff: LCAPIX for teaching and research (education path), version one

## Overview
LCAPIX is a life-cycle assessment (LCA) tool. This handoff covers the **education path** only: professors and researchers who run a study, and students who join their professor's project. The Individual and Enterprise paths are out of scope and must not change.

The product idea in one line: **a researcher starts on a finished sample study, reads it in the order research is done, makes their own copy to try it, then starts their own project and brings people in.**

Version one ships only what the backend supports today, plus a few clearly tagged "Coming soon" items where they explain a gap. Every feature below is tagged:
- **TODAY**: the backend does it now.
- **NEW UX**: a new screen or view over data that already exists.
- **BACKEND**: needs new backend work. Do not build in v1 unless the backend lands. Show at most a single "Coming soon" line.

## About the design files
The files in this bundle are **design references created in HTML**: prototypes that show the intended look and behaviour. They are not production code to copy. Recreate them in the target codebase's environment (its framework, component library and patterns). If there is no environment yet, pick the most suitable framework for the project. The `.dc.html` files open directly in a browser (keep `support.js` beside them).

## Fidelity
- **`LCAPIX App v3.dc.html`: high fidelity.** Final colours, type, spacing and most interactions. Use it for components, copy, states and visual detail.
- **`LCAPIX Layout Directions.dc.html`: mid fidelity, and it is the source of truth for structure.** Section **2a** defines navigation, pages and AI functions. Sections **1a, 1b and 1c** are layout directions. Where 2a and App v3 disagree on navigation or layout, **2a wins**.

**Recommended build:** the navigation from **2a** with the nested sidebar of **1c**, and the **1b split** (tree left, current step right) inside a case. 1a (one step at a time) is not recommended for v1.

The App v3 file is mid-way through a round 2 pass. It holds the research dashboard template, the Progress pipeline, the inventory status tabs, the in-row "Global average or my own number" choice and "Remove the sample". These are present in the markup, but their logic is switched off (flags default to false in `EX3` inside `eduVals()`). Treat the spec below as the target, and read those templates for markup and copy.

---

## 1. Information architecture (from 2a)

### The rule
The sidebar has **two levels only: places, then projects.** A project can hold 40 student cases, so **cases never appear in the sidebar.** A case lives on its project's Cases page and in a switcher in the case's own header.

### Sidebar (256px wide, background `#eef1ef`)
```
LCAPIX (logo)
Home
Findings              12
Reports                3
Analytics
PROJECTS
▸ Painted steel bracket   [SAMPLE]
    Overview
    Cases               34
    Compare
    People              31     (owner only; hidden for students)
▸ Aluminium enclosure
  All projects ›
Help
(avatar at the foot → Profile)
```
- Only the **open** project expands. The others are one line each. Show at most 5 projects, then "All projects ›".
- Mark the current place with a white background, weight 600 and `aria-current="page"`. Nested items have an 18px indent and a 2px left rule, `#d5dbd7`, or `#006a44` when active.
- Counts use IBM Plex Mono, 12px/18px, in a pill (`#e5f1ea` / `#005537`).
- Students see Home, Findings, Reports and Help, plus the shared project with Overview, Cases and Compare. No Analytics and no People.
- The guide (see 6) is one card at the foot of the sidebar. It is the **only** place the guide speaks outside a case.

### Inside a case: its own header
One header row, min-height 76px, white, 1px bottom border `#e3e7e4`:
- Left: the case name as `h1` (Inter Tight 600 20px/28px). Under it a facts line in 13px `#3d4340`: `Base case · 1 bracket · TRACI 2.1 · US · Run #118`. Add `· Sample, read-only` on the seeded sample cases.
- Right: **Case ▾** switcher, then **Run Assessment**, the only primary on the screen. On the read-only sample, Run is replaced by **Make my own copy**.
- Under the header: the case's tabs **Tree · Inventory · Results · Write-up**, with **Compare** at the right end. These replace "Back to…", "View Results", "Open in canvas" and the old four-phase row.
- The switcher lists the project's cases grouped by owner. It adds search above 8 cases, and changing case keeps the current tab.

### Rows above the work
At most **one header + one tab row**. No trail row (the sidebar shows where you are), no banner rows, and no toolbar row on first open (see 4.1).

---

## 2. Pages

### Global

**Home** (NEW UX, built from existing data)
- While the sample is the researcher's only project, **Home is the sample study's Overview** (see the Overview spec below).
- Once they have a project of their own, Home shows these cards in order:
  1. **Continue**: the last case opened, its latest result and its next step. One click opens its tree.
  2. **Needs attention**: flows without a value and runs out of date, each linking to the row.
  3. **Shared with you**, then **Your projects** with each latest result.
  4. **Recent findings.**
  5. The sample as one small dashed card with **Open** and **Remove the sample** (TODAY: delete the project).
- Students: "Shared with you" first. Starting their own project is a small secondary link lower down. No "+ New Project" at the top right.

**Findings** (NEW UX for the view; BACKEND to store them)
- A finding is a short statement pinned from Results or Compare, with the run it came from and the numbers it quotes. Example: `Steel is 89% of the bracket · Run #101 · worldsteel 2022, Global average`.
- Filter by project, case and author. Findings feed Reports.
- Data: `{id, projectId, caseId, runId, text, quotedNumbers[], authorId, createdAt}`.

**Reports**
- TODAY: export a case report as PDF, PowerPoint or CSV. It contains the answer, hotspots, confidence and the write-up.
- NEW UX: pick findings and comparisons to include, in order. One status per report: Draft, Handed in or Exported.
- BACKEND: reports as saved objects with versions.

**Analytics** (only numbers LCAPIX already computes: no scores, gauges or forecasts)
- Professor:
  - TODAY: how many students ran, wrote up and handed in.
  - NEW UX: the flows students most often leave empty, and how many exercise 4 predictions were right.
- Researcher (NEW UX): results across cases and projects on one unit, and how much of each answer rests on average factors.

**Help**: exercises list, "The sample study, section by section" (replays the guide walk), keyboard shortcuts, display settings.

**Profile**: name, institution, research area, email (read-only), projects with role, exercise progress, display settings. Join requests and notifications are **Coming soon** (BACKEND).

### Project

**Overview**: the study in research order. **The filled-in sample is this page.** It has seven sections, top to bottom. Each shows one number or sentence and has one door. Left spine: numbered circles 01–07 joined by a 1.5px line `#d5dbd7`.

| # | Section | Shows | Door |
|---|---|---|---|
| 1 | The question | Research question, functional unit, method | Goal and scope (case Tree tab, product selected) |
| 2 | How it is made | Small read-only tree with each operation's share, a "needs a value" mark, and a tier legend | Tree tab |
| 3 | What goes in | Counted flows as `amount × factor = impact` with source, plus one line naming the flows with no factor | Inventory tab |
| 4 | The answer | 1.72 kg CO₂-eq per bracket, "What builds this number" bars, one plain confidence sentence | Results tab |
| 5 | A what-if | Shorter cure cycle 1.667, 3.1% lower, "What changed" note | Compare |
| 6 | The write-up | The example write-up, tagged EXAMPLE and not saved as the case's write-up | Write-up tab |
| 7 | What next | Make my own copy (primary) · Start my own project · Add people (locked until an own project exists: "After you start your own project. The sample is never shared.") | each one |

- Header: `SAMPLE` pill, project name (h1, 22px/30px), and the facts line `A finished study · 1 bracket · TRACI 2.1 · US · Run #101`.
- **No people are invented.** The sample has no students.
- A student's Overview for the shared project has the same seven sections, filled in by the professor's work. Section 7 offers **Make your own case** (or **Open your case**) and a small **Start your own project**.

**Cases**
- TODAY: list, open, duplicate.
- NEW UX: grouped by owner (for a student: "Dr. Rivera's cases", "Your cases", "Classmates' cases"), search, sort by result or last run.
- For a professor, a **Pipeline · Table** switch:
  - Pipeline columns: Not run yet · Run · Written · Ticked as hand-in.
  - Each card shows initials, name, case, 4 progress segments, and the next missing thing ("No run yet", "No write-up yet", "Not ticked as hand-in").
  - The Table view stays for screen readers. No reminders: nothing notifies students today.

**Compare**
- TODAY: two cases. Comparability checks (method, region, functional unit, both runs current), totals side by side, change by step.
- NEW UX: a "What changed" input diff, three or more cases at once, and "Pin as finding".
- BACKEND: compare across projects.

**People**
- TODAY: add by email or CSV (they need an account first, no email is sent), Can read / Can change, and the "Students see only their own case" switch with both modes described.
- NEW UX: an activity list (who ran, changed or handed in what, when).
- BACKEND: comments, invite by email, requests to join.

### Case (header + tabs, split layout)
Body: a two-column grid, padding 16px, gap 16px.
- **Left (≈55%): the tree, always.** Dotted canvas (`radial-gradient(#e3e7e4 1px, transparent 1px)` at 16px).
- **Right (≈45%): the current tab's panel.** The guide speaks only as the panel's first line.
- **Tree tab**
  - Right panel: details of the selected step (tier, share, flows with source, "Use my own number").
  - Tree controls on first open: −, %, +, Fit. Everything else (List, Graph, Outline, By tier, Compact, Map, Reset layout) goes behind one **View ▾** menu, after the tour.
- **Inventory tab**
  - Left becomes a **slim indented tree**: 30px rows, 16px indent per tier, tier swatch, needs-value dot, flow count. Picking a step filters the table, and picking a row marks its step.
  - Right: status tabs with counts, **All · Needs a value · Counted · No factor**.
  - Table columns: Flow (with step and IN/OUT) · Amount (96px, mono) · Unit · Factor · source · Feeds (which step and what share of the answer) · Status.
  - Steel row: an in-row choice, "No US factor for steel. Keep the Global average · Use my own number".
  - Electricity rows needing a value get the machine calculator.
- **Results tab**
  - The answer first (52–72px number).
  - "What builds this number" bars.
  - A "What changed" note against the Base case, or against the previous run for the Base case itself.
  - Confidence: a plain sentence first.
  - Run history, where older runs open read-only with "Back to Run #n".
  - Other 8 categories behind one button.
  - Magic Insights (see 6).
  - One primary: **Try a what-if**.
- **Write-up tab**: Interpretation, Assumptions, "This is my hand-in" (student: it doesn't lock the case), Export (PDF · PowerPoint · CSV).

### Phone (≤600px)
Sidebar folds away. A case shows the Outline, read-only, with "Open on a larger screen to edit".

### Below 1280px wide
The split keeps the tree. The step panel narrows (min 320px), and the guide folds to its card.

---

## 3. Sequence: one thing at a time
1. **Sign-up** (teaching): email or Google. The first Tab stop is "Continue with Google". Then:
   - Call `POST /api/example-project` (TODAY) right after sign-up. It is built on request so a failure never blocks sign-up. If it fails, Home shows the three ways in (sample, file, empty) with **Retry**.
   - Seed the run, the comparative case and its run by calling the existing routes in order: run → duplicate → change one flow → run. A copy never carries the original's runs.
2. **Overview walk.** On first sign-in the guide walks the seven sections, one short line each, with Skip and Next. This **replaces** the old four-step intro (`phases`).
3. **Make my own copy** duplicates the sample's Base case, named after the person (`Elena Rivera’s case`), **without runs**. The six exercises happen there. Exercise 4 asks for a prediction before the first run.
4. **Start my own project**: from a file or empty. The sample tree is no longer offered once the sample exists.
5. **Add people**: unlocked only once an own project exists. The sample is never shared.
6. Once an own project exists, the sample steps aside to a small card on Home.

**One guide voice at a time:**
- The tier tour comes first. The exercise card appears after the tour ends or is skipped.
- No toast ever covers text or a button. Confirmations appear on the line where the action happened ("✓ Saved · Steel 0.80 kg on 10. Cut blank"), or in a status bar at the foot of the main area.
- Dialogs never open on top of a side panel. Close the panel first, or put the content in the panel.

**Locked steps** look locked: tinted `#f8faf8`, a grey number, `aria-disabled`, and their reason as the subtitle ("After you start your own project"). A step is "current" after the **last** completed step, never the first skipped one.

---

## 4. Rules that hold everywhere

### 4.1 Nothing bloats
- First open of a tree: at most 5 controls in the toolbar.
- One control per action per screen.
- "Coming soon" said once per screen at most.
- A student's case is lighter: tree, Inventory, Run and the guide. No View menu, no column toggle, no Add Component.

### 4.2 Numbers follow from each other
The sample uses counted flows only. Impact = amount × factor, and the shares add up.

| Step | Flow | Amount | Factor (kg CO₂-eq/unit) | Source | Impact |
|---|---|---|---|---|---|
| 10. Cut blank | Steel, cold-rolled IN | 0.80 kg | 1.900 | worldsteel 2022 · Global average (fallback: no US value) | 1.520 |
| 10. Cut blank | Electricity IN | 0.05 kWh | 0.350 | EPA eGRID 2023 · US | 0.0175 |
| Deburr edges | Electricity IN | 0.0013 kWh | 0.350 | EPA eGRID 2023 · US (machine calculator: 0.75 kW × 0.0022 h × 80%) | 0.0005 |
| 20. Weld tab | Electricity IN | 0.12 kWh | 0.350 | EPA eGRID 2023 · US | 0.042 |
| 20. Weld tab | Argon IN | 0.02 kg | none in TRACI 2.1 | | 0 |
| 30. Powder coat and cure | Electricity IN | 0.40 kWh | 0.350 | EPA eGRID 2023 · US | 0.140 |
| 30. Powder coat and cure | Powder coating IN | 0.03 kg | none in TRACI 2.1 | | 0 |
| 40. Pack and ship | Cardboard IN | 0.06 kg | none in TRACI 2.1 | | 0 |
| 40. Pack and ship | Scrap steel OUT | 0.12 kg | output, no climate factor | | 0 |
| Fold and tape | Packaging tape IN | 0.002 kg | none in TRACI 2.1 | | 0 |

- **Totals:** 10. Cut blank 1.538 (89.4%) · 30. Powder coat and cure 0.140 (8.1%) · 20. Weld tab 0.042 (2.4%) · 40. Pack and ship 0 ("has no counted climate flow"). **Total 1.72 kg CO₂-eq per bracket.**
- **Shorter cure cycle:** cure electricity 0.40 → 0.25 kWh gives 1.667 kg, 3.1% lower. "What changed: 0.053 kg less, all from 30. Powder coat and cure."
- A row never says both "Unit not recognised" and "Counted". Statuses:
  - **Counted**
  - **Counted · no climate factor**
  - **Needs an amount**
  - **Left out · unit can't convert**
- Round display totals to 2 decimals for a Base case and 3 for a comparative case. Percentages use the 2-decimal total.

### 4.3 The tree stays visible
- Text on a step never renders under 12px. Zoom floors at 86%. Below 100%, a step shows only its icon and name, and the tree pans rather than shrinking.
- Compact node: 112×44. Full node: 128×72. Spacing: 140px horizontal, 120px per tier row (compact: 124px and 84px).
- Tier lanes are labelled in IBM Plex Mono 14px/18px.
- The tree is **one Tab stop**: roving tabindex. Arrow keys move parent, child and sibling, Shift+arrows move the step 20px, and Enter selects. Announce selections in an `aria-live="polite"` region.

### 4.4 Accessibility
- A "Skip to content" link, a page `<title>` per screen, `lang="en"`, and one `h1` per screen.
- Inventory, Progress, Cases and Compare are real tables (the HTML uses ARIA roles over grids; use `<table>` in the build).
- Text contrast is at least 4.5:1: use `#6b7470` or darker for text on white, never `#858f8a`. No text under 12px, including the sidebar.
- Targets are at least 24×24.
- Focus is trapped in dialogs and in the guide when it overlays. Esc closes them.
- "Larger text" scales the main area and the sidebar by 1.15. "Higher contrast" swaps colour tokens: text greys go to `#141816`, borders to `#5e6663`. Do it with tokens, not the prototype's in-place restyle. Both settings persist.
- Focus ring: 2px `#006a44`, offset 3px.

---

## 5. Data & state

### Objects
- `Project {id, name, isSample, ownerId, question, functionalUnit, method:'TRACI 2.1', region:'US', boundary}`
- `Case {id, projectId, name, kind:'base'|'comparative', ownerId, copiedFrom}`
- `Step {id, caseId, parentId, tier:0..4, name, order}`. The tiers are Product, Machine / line, Subprocess, Operation and Elemental task.
- `Flow {id, stepId, substance, direction:'IN'|'OUT', amount, unit, factorId|ownNumber}`
- `Run {id, caseId, number, at, frozen:{inputs, factors, goalScope}, totals:{byCategory}, byStep, missingCount, excludedCount}`. Each run freezes its inputs, so older runs stay readable.
- `Membership {projectId, userId, role:'owner'|'change'|'read'}` and `privacy:'open'|'ownOnly'` on the project.
- `WriteUp {caseId, interpretation, assumptions, isHandIn}`
- BACKEND: `Finding`, `Report`, `Activity`, `Comment`.

### Client state (prototype keys, for reference)
- Navigation: `screen` (`auth, home, project, people, progress, case, canvas, results, writeup, compare, data, library, help, profile`) and `acct` (`inst` professor, `stu` student). URL `?acct=…&screen=…` also works.
- Case: `eCase`, `eProj`, `eMode` (model/inv), `eView` (0 Tree, 1 List, 2 Graph, 3 Outline, 4 By tier), `eSel`, `eCompact`, `eMap`, `ePos` (moved steps; session only, never "saved").
- Guide: `eWalk` (0–6, or null) and `eWalkDone`. Tour: `eTour` and `eTourDone`. Exercise answers: `eAns[persona][0..5]`.
- Inventory: `eInvF` (status tab) and `eInvStep` (slim-tree filter).
- Display: `eBig` and `eHC`, persisted in `localStorage['lcapix-v3-display']`.

---

## 6. Generative AI: functions and how to build them

**Rules for every function:**
1. **LCAPIX computes every number.** The model never calculates. After every reply, check each number in the text against the source run, and drop the text if any number doesn't match.
2. **Labelled and linked.** Every output says it is generated and links to the run, file or rows it read.
3. **A person accepts it.** Nothing generated is saved or added until accepted.
4. **The professor sets the rules** per project: which functions students may use. Log usage per person.

| Function | Where | In → Out | How to build | Status |
|---|---|---|---|---|
| Read a file into a tree | Start a project from a file | BOM, routing or equipment list (XLSX/CSV, text PDFs; 12 MB max; no scanned PDF or DOCX) → drafted tree with tiers and flows | Server-side text extraction, then a model call with a fixed JSON schema `{step, tier, parent, flow, amount, unit}`. Validate every row and show the review screen (untick rows, name the project). A file with variant tabs or a "variant" column becomes one project with one case per variant. | TODAY |
| Suggest a tier | Sort into tiers, import review | Step name + neighbours → tier + one-line reason | Same call, or per row. Shown as a suggestion; the person picks. | TODAY |
| A written reading of a run | Results · Magic Insights | Frozen run JSON → 3–4 sentences citing step numbers | Send only the run. Number check after the reply. Cache by run id. Three suggested questions are scripted. | NEW UX |
| Explain a comparison | Compare, part 4 | Two runs + input diff → one paragraph | Deltas computed deterministically; the model only phrases them. Number check. | NEW UX |
| Ask about this study | Results, guide | Short question + this case's run and inventory → short answer with links | Retrieval scoped to this case. Refuse questions outside it. Log Q&A to the project. | BACKEND (Coming soon) |
| Draft the write-up | Write-up | Run + comparison + findings → draft marked Draft | Off for students unless the professor enables it. Never auto-saves. Record that a draft was used. | BACKEND |
| Fill in a missing amount | Inventory row | Step, machine, similar rows → proposed **inputs** (power, hours, load) | Model proposes inputs only; the machine calculator computes. Show the implied sum. | BACKEND |
| Feedback on a hand-in | Professor · Cases | Write-up + run + professor's rubric → comments | Professor only. Comments are edited before a student sees them. Grades stay in Canvas. | BACKEND |

**The guide is scripted in v1, not generative.** It is a face made from three of the logo's pixels: the eyes blink and the mouth pulses while it speaks. It greets with what is open ("3 flows need a value") and offers three scripted next steps.

---

## 7. Design tokens

**Type**
- Inter Tight (400/500/600/700) for UI. IBM Plex Mono (400/500/600) for numbers, labels and kickers.
- Body: 14px/20px.

| Use | Size / line height | Weight |
|---|---|---|
| Kicker (letter-spacing .08em, uppercase) | 12px/16px | Mono 500 |
| Small | 12px | |
| Secondary | 13px/19px | |
| Card title | 15–18px/22–26px | 600 |
| Screen h1 | 20–22px/28–30px | 600 |
| Answer number (letter-spacing −.02em) | 44–72px | 600 |

**Colour**

| Role | Hex |
|---|---|
| Ink | `#191c1b` |
| Text 2 | `#3d4340` |
| Text 3 | `#5e6663` |
| Minimum text grey | `#6b7470` |
| Borders | `#e3e7e4`, `#eceeec`, `#d5dbd7`, `#c4ccc7` |
| Surfaces | `#ffffff`, `#f8faf8`, `#f4f5f3` (app), `#eef1ef` (sidebar), `#e9ecea` (segmented track) |
| Primary | `#006a44` (hover `#005537`) |
| Primary tints | `#e5f1ea`, `#f1f8f4`, `#cfe6d8`, `#a7d3b8` |
| Guide / dark | `#141816`, `#0f1412`, mint `#5ddda1` |
| Warning | `#fdf3e1` bg, `#ecd29a` border, `#c98a1a` strong border, `#8f5b00` icon, `#7a4d00`/`#5c3a00` text |
| Error | `#fdeceb` bg, `#f4c7c2` border, `#ba1a1a` / `#93000a` |
| Info | `#e8f1fa` / `#0b5fa5` |

**Tier colours** (fill / border / ink)

| Tier | Fill | Border | Ink |
|---|---|---|---|
| Product | `#a7d3b8` | `#3d7256` | `#16331f` |
| Machine / line | `#f0a68a` | `#a8472b` | `#3a1a0f` |
| Subprocess | `#f5c971` | `#8a6414` | `#3a2a0a` |
| Operation | `#7bb5e8` | `#356da0` | `#0f2238` |
| Elemental task | `#c8b5e8` | `#7c61b5` | `#1f1438` |

**Shape and motion**
- Radius: 6, 8, 10 (buttons), 12, 14, 16 (cards), 18–20 (large cards), 24–28 (app frame), 999 (pills).
- Shadows:

| Use | Shadow |
|---|---|
| Card hover | `0 6px 16px rgba(20,28,24,.06)` |
| Menu | `0 18px 44px rgba(20,28,24,.16)` |
| Dialog | `0 30px 70px rgba(20,28,24,.24)` |
| Selected step | `0 0 0 4px rgba(0,106,68,.16)` |

- Motion: `rise` 320–360ms `cubic-bezier(.2,0,0,1)` for entering cards, `drop` 180ms for menus, `slideIn` 260–280ms for panels.
- Respect `prefers-reduced-motion`.

**Buttons**
- Primary: 40–42px tall, `#006a44`, white 600.
- Secondary: 1px `#d5dbd7` border on white, weight 500.
- Dark: `#191c1b`.
- "Coming soon" tag: pill `#fdf3e1` / `#ecd29a` / `#7a4d00`, Mono 600 12px uppercase.

## 8. Assets
- **Logo:** a six-pixel pyramid on `#141816` (inline SVG in the files). Five white squares and one mint `#5ddda1` square mark the five-tier hierarchy. See `LCAPIX Identity v4.dc.html` for construction, the wordmark and size tests.
- **Guide face:** three pixels of the logo, two white eyes and a mint mouth (inline SVG, 36×36 viewBox).
- **Icons:** simple 24px stroke icons, inline in App v3. Replace them with the codebase's icon set.
- **No raster imagery.**

## 9. Files in this bundle
- `LCAPIX Layout Directions.dc.html`: **structure (2a) and layouts (1a/1b/1c).** Start here.
- `LCAPIX App v3.dc.html`: the high-fidelity prototype. Education screens live in `eduVals()` and the `e…` template blocks. Run it with `?acct=inst&screen=home` or `?acct=stu&screen=home`. A later screen key seeds a consistent mid-study state.
- `LCAPIX Identity v4.dc.html`: logo, wordmark, loader.
- `support.js`: runtime needed to open the `.dc.html` files locally. It is not part of the product.
- `briefs/`: the round 1 brief, the UX review evidence and the film-scene list the prototype must support.

## 10. Acceptance checks
1. A new researcher's first screen after sign-up is the filled-in Overview with its seven sections in order. Each section opens its screen in one click.
2. No person on it is invented. Every number on it is one LCAPIX computes.
3. The first prediction (exercise 4) happens on a case with no run.
4. "Add people" is locked until an own project exists, and says why.
5. On first open of a tree the guide shows one card, and the toolbar has at most 5 controls.
6. For every Inventory row, amount × factor equals the share shown in Results.
7. At 1024×768 with the guide open, no step text renders under 12px.
8. From any tab of a case, every other tab, the switcher and Compare are one click away, in the same place.
9. Cases never appear in the sidebar.
10. The first Tab stop on sign-up is "Continue with Google". Focus never leaves an open dialog.
11. No text under 12px or under 4.5:1.
12. Every AI output is labelled, linked, number-checked and accepted by a person before it is saved.
