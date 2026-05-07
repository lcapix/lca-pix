# LCAPIX Prototype Inventory

Source: `/Users/kavishpandit/Desktop/lca/lca project v3/LCAPIX/` (Babel-in-browser React prototype)
Purpose: catalogue for porting as the new v3 frontend skeleton, replacing the current Stitch-derived UI while preserving backend, auth, Zustand, Vitest tests.

---

## 1. File summary

| File | Role | Key exports (on `window`) |
|---|---|---|
| `LCAPIX Design.html` | Babel page switcher | —  (host) |
| `styles.css` | Design tokens + utility classes | CSS only |
| `shared.jsx` | Primitives | `LogoMark, Logo, Icon, StatusDot, Sparkline, MiniBar, AppTopBar, Breadcrumb, fmtNum, fmtInt` |
| `data.jsx` | Demo fixtures | `DEMO_USER, DEMO_PROJECTS, DEMO_CASES, DEMO_TREE, DEMO_CONTRIBUTORS, DEMO_CATEGORIES, DEMO_FLOWS, DEMO_METHODS, DEMO_RUNS, DEMO_INTEGRATIONS, DEMO_ACTIVITY, HIERARCHY_TYPES` |
| `pages-landing.jsx` | Marketing + auth | `LandingPage, AuthPage` (+ inline `HeroMockup`, `ComparisonTable`) |
| `pages-app.jsx` | Home, Project, Case editor | `HomePage, ProjectPage, CaseEditorPage` (+ inline `MiniCanvas`, `MiniTree`, `TreeCanvas`, `ListView`, `GraphView`, `NodeDetailsStrip`, `MetricMini`, `InspectorPanel`, `InspectorSection`) |
| `pages-misc.jsx` | Results, Component form, Compare, Admin, About, Guide | `ResultsPage, ComponentFormPage, ComparePage, AdminPage, AboutPage, GuidePage` (+ inline `CategoryBarChart`, `RunTimeline`, `GroupedBarChart`) |
| `browser-window.jsx` | Chrome wrapper (not needed) | — |

---

## 2. Design tokens (styles.css) — grouped

### Surfaces / ink
`--surface-base`, `--surface-raised`, `--surface-overlay`, `--surface-sunken`, `--surface-inverted`, `--surface-canvas`
`--on-surface`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-disabled`

### Brand (emerald)
`--brand-h`, `--primary`, `--primary-container`, `--primary-fixed`, `--on-primary`, `--brand-primary`, `--brand-hover`, `--brand-subtle`, `--brand-glow`, `--brand-gradient`, `--brand-gradient-soft`
`--secondary-container`, `--on-secondary-container`
Accent variants (body classes): `.accent-teal`, `.accent-amber`, `.accent-violet`
Density variants: `.density-compact`, `.density-airy`
Dark toggle: `.theme-dark`

### Signals & borders
`--signal-success`, `--signal-warn`, `--signal-error`, `--signal-info`
`--outline-variant`, `--border-subtle`, `--border-strong`, `--border-focus`
Chart palette: `--chart-1 … --chart-5`

### Radii / shadows / fonts / density
`--r-sm/md/lg/xl/pill`
`--shadow-sm`, `--shadow-md`, `--shadow-botanical`, `--shadow-overlay`
`--font-ui` (Inter), `--font-mono` (IBM Plex Mono), `--font-display`
`--density`

## 3. Utility classes — grouped

| Group | Classes |
|---|---|
| Typography | `.mono`, `.display`, `.display-lg`, `.display-md`, `.headline`, `.title`, `.body`, `.body-sm`, `.label-md`, `.label-sm`, `.eyebrow`, `.eyebrow-muted` |
| Buttons | `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-tertiary`, `.btn-ghost`, `.btn-sm`, `.btn-lg` |
| Inputs | `.input`, `.label` (label *element* class for uppercase caption) |
| Cards | `.card`, `.card-section`, `.card-hover`, `.glass` |
| Chips | `.chip`, `.chip-active`, `.chip-brand`, `.chip-emerald`, `.chip-mono`, `.chip-gradient`, `.data-chip` |
| Logo | `.logo-mark`, `.logo-wordmark` |
| Layout | `.app-shell`, `.row`, `.col`, `.gap-4/8/12/16/20/24/32/40/48/64`, `.center-y`, `.between`, `.grid-12` |
| Atmosphere | `.veridian-glow`, `.botanical-atmosphere`, `.divider-tonal`, `.badge-dot` |
| Animations | `.fade-in`, `.bloom-in` (`@keyframes fadeIn`, `bloomIn`) |
| Responsive | `@media` breakpoints 1180/1024/820 hide `.home-sidebar`, shrink `.case-panes` columns, hide `.case-inspector`, `.case-sidebar` |

---

## 4. Icon set (all `name="…"` strings used in `<Icon>`)

From `shared.jsx` switch: `search, tree, layers, globe, dollar, file, database, plus, arrow-right, arrow-up, arrow-down, arrow-up-right, check, x, chevron-right, chevron-down, chevron-left, menu, more, eye, google, play, run, grid, list, filter, settings, bell, zap, shield, download, share, clock, chart-bar, circle, dot, command, sparkle, box, link, refresh, external, activity, alert, leaf, factory, battery, target`. Default: rounded-rect fallback.

Note: `google` is multicolor branded; others are single-stroke Lucide-style.

---

## 5. Per-page inventory

### 5.1 LandingPage (`pages-landing.jsx`)
- **Layout**: single-column scroll. Sticky glass nav (72px) → hero (7/5 grid with offset "factors indexed" number) → 3-col method cards → 1/2 feature intro + 3-col feature grid → 3-step "how it works" → comparison table → FAQ accordion → veridian-glow CTA → 4-col footer.
- **Sections**: sticky nav; botanical-atmosphere hero with `HeroMockup` (window-chrome bar, contributors bar chart, category tiles); `DEMO_METHODS` card row; 6 feature cards (`.card-hover`); how-it-works 01/02/03; `ComparisonTable` (4 competitors × 6 rows); FAQ w/ single-open accordion (+ rotates to ×); veridian CTA; footer with 3 link cols.
- **Interactions**: FAQ expand/collapse (`faqOpen` state), onNav to login/signup.
- **Shared deps**: `Logo`, `Icon`, `fmtNum`, `DEMO_METHODS`, `DEMO_CONTRIBUTORS`, `DEMO_CATEGORIES`.
- **Replaces**: `app/page.tsx` (the landing/root).

### 5.2 AuthPage (`mode='login' | 'signup'`)
- **Layout**: 44/56 split, full-height. Left pane = form; right pane = testimonial + 3-method data card with bottom brand strip.
- **Sections**: logo top-left; heading ("Welcome back." / "Create your account."); name (signup only) + email + password-with-eye inputs; primary submit; "or" divider; Google button; cross-link toggle.
- **Interactions**: mode toggled via `onNav('login'|'signup')`; eye-icon button stub.
- **Shared deps**: `Logo`, `Icon`, `DEMO_METHODS`, `fmtNum`.
- **Replaces**: `app/auth/login/page.tsx` and `app/auth/signup/page.tsx` (both modes from one component).

### 5.3 HomePage
- **Layout**: `AppTopBar` → flex row: main (flex 1) + right sidebar (280px, `.home-sidebar`).
- **Sections**: greeting header w/ Import + New Project; 4 KPI cards w/ `Sparkline`; projects header w/ filter chips (All/Base/Comparative/Active), search, grid/list toggle; projects grid (3-col) *or* list table; Recent Activity sidebar w/ `StatusDot` + timestamps.
- **Interactions**: `view` state grid/list; `filter` state; card clicks navigate (only ev-mfg wired); responsive hide of sidebar <1180px.
- **Shared deps**: `AppTopBar`, `Icon`, `Sparkline`, `MiniBar` (not here), `StatusDot`, `fmtNum`, `fmtInt`, `DEMO_USER`, `DEMO_PROJECTS`, `DEMO_ACTIVITY`.
- **Replaces**: `app/home/page.tsx`.

### 5.4 ProjectPage
- **Layout**: TopBar → Breadcrumb → content max-width 1440. Project header card → optional comparison banner → horizontal scrollable case tabs → 2-pane grid (1.5/1).
- **Sections**: project title + chip + Analytics / Compare Cases / Add Case buttons; comparison banner (gradient) with delta chips + Open Full Comparison link; case tabs (custom pill buttons, BASE/COMP label, drivers count); left pane = `MiniCanvas` (pan/zoom mini tree on `.surface-sunken` dot grid) w/ "Open editor" shortcut; right pane stack: Impact Overview card w/ assessed chip, Top contributors w/ `MiniBar` (fading opacity), Cost summary grid; action row = Run / Results / download ghost.
- **Interactions**: `activeCase` tab switch; pan/zoom/fit/wheel + drag on `MiniCanvas`; onNav to case, results, compare.
- **Shared deps**: `AppTopBar`, `Breadcrumb`, `Icon`, `MiniBar`, `fmtNum`, `fmtInt`, `DEMO_PROJECTS`, `DEMO_CASES`, `DEMO_TREE`, `DEMO_CONTRIBUTORS`, `HIERARCHY_TYPES`.
- **Replaces**: `app/project/[projectId]/page.tsx`.

### 5.5 CaseEditorPage (IDE)
- **Layout**: TopBar → Breadcrumb → toolbar strip → 3-pane `.case-panes` grid `220px / 1fr / 340px`, responsive down to single pane.
- **Toolbar**: Tree/List/Graph view toggle; zoom controls (−, %, +, Fit); search input "Find substance, component, or flow…"; Reset; Run Assessment.
- **Left pane** (`.case-sidebar`): search box, flat indented tree list (colored `t.short` badge, depth-based padding, active border-left), Add Component button.
- **Center pane**: dotted grid bg + `TreeCanvas` (switches to `ListView` / `GraphView`). Canvas = depth-columnar left-to-right hierarchy w/ cubic-bezier connectors. GraphView adds pan/zoom/fit + arrow markers. Then `NodeDetailsStrip` (128px high, 3 cols: identity / 2×2 metrics / top flows preview + Auto-saving indicator).
- **Right pane** (`.case-inspector`): `InspectorPanel` → header (type chip + label + id) + collapsible `InspectorSection`s (Properties, Environmental Flows w/ count, Costs w/ 6 cost categories + Auto-fill from BLS+EIA) + sticky footer Delete / Save.
- **Interactions**: selected node state; view toggle; canvas pan/drag/zoom/fit; accordion sections; auto-save indicator (visual).
- **Shared deps**: `AppTopBar`, `Breadcrumb`, `Icon`, `fmtNum`, `DEMO_TREE`, `DEMO_FLOWS`, `HIERARCHY_TYPES`, `DEMO_PROJECTS`, `DEMO_CASES`.
- **Replaces**: `app/project/[projectId]/case/[caseId]/page.tsx`.

### 5.6 ResultsPage
- **Layout**: TopBar → Breadcrumb → content. Header row → 4-KPI strip → Row 1 Impact Overview card (category chips + 360px/1fr: big number + contribution stacked bar with legend) → Row 2 (2/1: `CategoryBarChart` log-scale + Top contributors rank list) → Row 3 flow table (7 cols) → Historical Runs card w/ `RunTimeline` area chart.
- **Sections/components inline**: `CategoryBarChart`, `RunTimeline` (svg line+area+status-colored dots).
- **Interactions**: category chip selection drives big-number panel; filter chips on flow table (visual); chip "Compare to last run".
- **Shared deps**: `AppTopBar`, `Breadcrumb`, `Icon`, `MiniBar`, `fmtNum`, `DEMO_CATEGORIES`, `DEMO_CONTRIBUTORS`, `DEMO_FLOWS`, `DEMO_RUNS`, `DEMO_CASES`, `DEMO_PROJECTS`.
- **Replaces**: `app/project/[projectId]/case/[caseId]/results/page.tsx`.

### 5.7 ComponentFormPage
- **Layout**: TopBar → Breadcrumb → narrow (720) centered column, sticky bottom action bar (fixed).
- **Sections**: title + description; Type & Placement card (5-button type picker w/ 1px inner-grid border, Parent component `select`); Identity card (Name, Description textarea, Quantity + Unit side-by-side); Costs card collapsed; Advanced card collapsed (with JSON/metadata label).
- **Interactions**: type state, collapsed sections, sticky Cancel / Save as draft / Create component bar.
- **Shared deps**: `AppTopBar`, `Breadcrumb`, `Icon`, `HIERARCHY_TYPES`, `DEMO_PROJECTS`, `DEMO_CASES`.
- **Replaces**: `app/project/[projectId]/case/[caseId]/component/new/page.tsx` and `.../component/[componentId]/edit/page.tsx`.

### 5.8 ComparePage (Analytics)
- **Layout**: TopBar → Breadcrumb → header + PDF/Share → N-column head-to-head case cards → Verdict card (gradient, target icon) → Grouped bar chart card → Component diff table.
- **Sections**: case cards with colored left border (`--chart-N`), delta % + cost delta under non-baseline; Verdict sentence w/ key numbers; `GroupedBarChart` svg (5 cats × cases); diff table w/ per-cell delta badge.
- **Interactions**: mostly static; PDF / Share stubs.
- **Shared deps**: `AppTopBar`, `Breadcrumb`, `Icon`, `fmtNum`, `fmtInt`, `DEMO_CASES`, `DEMO_PROJECTS`, `DEMO_CONTRIBUTORS`, `DEMO_CATEGORIES`.
- **Replaces**: `app/project/[projectId]/analytics/page.tsx` and/or `comparison/page.tsx` & `comparisons/[comparisonId]/page.tsx`.

### 5.9 AdminPage (Integrations)
- **Layout**: TopBar → Breadcrumb → header + tab strip (underline active). Tabs: `overview | sources | keys | log | schema`.
- **Overview**: 4 KPI cards w/ StatusDot + MiniBar; integration status table (5 cols, Run now / Configure action).
- **Sources**: 2-col card grid — rate limit, last sync, TTL, records per integration.
- **Keys**: table of services w/ masked key + eye + Rotate.
- **Log**: filter chips (All/Success/Errors) + CSV export + list of activity rows with `StatusDot`.
- **Schema**: 3-col layout — source list → SVG arrow diagram → table names.
- **Interactions**: `tab` state; chip filters (visual).
- **Shared deps**: `AppTopBar`, `Breadcrumb`, `Icon`, `StatusDot`, `MiniBar`, `fmtInt`, `DEMO_INTEGRATIONS`, `DEMO_ACTIVITY`.
- **Replaces**: `app/admin/page.tsx` (and any integration subpages).

### 5.10 AboutPage
- **Layout**: TopBar → centered 720. Eyebrow + display title + 2 paragraphs; methodology card (5 pill sequence with arrows); 3-col methods cards; 3-col "Built on" source cards.
- **Shared deps**: `AppTopBar`, `HIERARCHY_TYPES`, `DEMO_METHODS`.
- **Replaces**: `app/about/page.tsx`.

### 5.11 GuidePage
- **Layout**: TopBar → `240px / 1fr` docs layout. Left TOC (active state w/ left-border) → Right article with eyebrow + display title + paragraphs + Tip callout (brand-primary left border) + inline `<kbd>` keys.
- **Sections**: toc = Getting started / Data model / First assessment / Glossary / FAQ / API reference. (Only Getting Started body is filled in prototype.)
- **Interactions**: `section` state (visual switch only).
- **Shared deps**: `AppTopBar`, `Icon` (minimal).
- **Replaces**: `app/guide/page.tsx`.

---

## 6. Inline components to extract into shared/primitives

Defined inline in page JSX, warrant standalone extraction when porting:

| Component | Source file | Purpose | Notes |
|---|---|---|---|
| `HeroMockup` | pages-landing | Mock product screenshot (window chrome + bars + category tiles) | Landing-only but reusable |
| `ComparisonTable` | pages-landing | 4×6 competitor matrix w/ branded first column | Landing-only |
| `MiniCanvas` | pages-app | Interactive mini pan/zoom tree (for project detail) | Could generalize |
| `MiniTree` | pages-app | Non-interactive SVG 3-col tree (unused fallback) | Skip or keep as fallback |
| `TreeCanvas` | pages-app | Case editor depth-columnar tree w/ bezier connectors | Core canvas |
| `ListView` | pages-app | Tabular alternative to TreeCanvas | Core |
| `GraphView` | pages-app | Pan/zoom/fit tree w/ arrow markers | Core |
| `NodeDetailsStrip` | pages-app | 128px 3-col strip below canvas | Extract |
| `MetricMini` | pages-app | label+value+unit cell for strip | Extract |
| `InspectorPanel` | pages-app | Right-pane property editor | Extract |
| `InspectorSection` | pages-app | Collapsible section with count chip | Extract (generic) |
| `CategoryBarChart` | pages-misc | Log-scale horizontal bars | Results |
| `RunTimeline` | pages-misc | SVG area + line + dots | Results |
| `GroupedBarChart` | pages-misc | SVG grouped bars with legend | Compare |

Already present on window that we would reuse as-is: `Logo`, `LogoMark`, `Icon`, `StatusDot`, `Sparkline`, `MiniBar`, `AppTopBar`, `Breadcrumb`, `fmtNum`, `fmtInt`. (We already have `Sparkline` in our app.)

---

## 7. Page → existing route mapping

| Prototype page | Replaces in current Next.js app |
|---|---|
| LandingPage | `app/page.tsx` |
| AuthPage(login) | `app/auth/login/page.tsx` |
| AuthPage(signup) | `app/auth/signup/page.tsx` |
| HomePage | `app/home/page.tsx` |
| ProjectPage | `app/project/[projectId]/page.tsx` |
| CaseEditorPage | `app/project/[projectId]/case/[caseId]/page.tsx` |
| ResultsPage | `app/project/[projectId]/case/[caseId]/results/page.tsx` |
| ComponentFormPage | `app/project/[projectId]/case/[caseId]/component/new/page.tsx` and `.../[componentId]/edit/page.tsx` |
| ComparePage | `app/project/[projectId]/analytics/page.tsx` (and/or `comparison/page.tsx`, `comparisons/[comparisonId]/page.tsx`) |
| AdminPage | `app/admin/page.tsx` |
| AboutPage | `app/about/page.tsx` |
| GuidePage | `app/guide/page.tsx` |
| Case/base/new flow | `app/project/[projectId]/case/base/new/page.tsx` (no direct prototype — derive from ComponentFormPage pattern) |
| Comparative/new flow | `app/project/[projectId]/case/comparative/new/page.tsx` (no direct prototype — reuse Project w/ Add Case modal) |
| New project | `app/project/new/page.tsx` (not in prototype — reuse ComponentForm patterns + landing CTA) |

---

## 8. Navigation model in prototype

All pages take `onNav(pageId, params?)` — a flat dispatcher pattern, not Next.js routing. Ports must translate to `next/link` + `useRouter()`. The dispatch ids used: `landing`, `login`, `signup`, `home`, `project`, `case`, `results`, `compare`, `newcomp`, `admin`, `about`, `guide`, plus `library`, `integrations` from `AppTopBar` nav.

---

## 9. State, interactions, atmosphere notes

- All component state is local (`React.useState`) — no Zustand, no fetch. Demo data is global via `window`.
- Pan/zoom logic appears 3× (MiniCanvas, TreeCanvas-via-GraphView) — should DRY into a single `PanZoomViewport` utility when porting.
- Auto-save indicator in `NodeDetailsStrip` is purely visual; wire to actual save mutation.
- Responsive breakpoints only handle 3 zones; below 820px the case editor collapses to canvas-only.
- Dark mode exists as a class (`.theme-dark`) but not toggled anywhere in prototype.
- Accent swaps (`.accent-teal`, `.accent-amber`, `.accent-violet`) also present but unused.
- No portals, no tooltip system beyond native `title=`, no modal primitives — "Add Case", "Delete", context menus are all inline buttons without overlays. Porting may want to add a generic modal/dropdown primitive.

---

## 10. Risks & notes for porting

1. **Babel-in-browser** — all JSX compiles at runtime via `<script type="text/babel">`. Port must convert to `.tsx` w/ proper imports (React import, component imports instead of `window.*`).
2. **Demo-data coupling** — pages pull directly from `DEMO_*` globals; swap to API/Zustand selectors we already have.
3. **Inline styles heavy** — much of the visual polish lives in `style={{…}}` objects (gradients, oklch color math, shadows). Consider CSS module extraction or Tailwind v4 utility bridge; bulk preservation is easier via inline to start.
4. **`oklch(from X …)` relative-color usage** requires modern browser support — already used extensively for per-type tints.
5. **SVG charts are hand-rolled** (no recharts/visx). Deterministic and small, ship as-is.
6. **No a11y affordances** on custom buttons (e.g. tab list on Admin lacks `role="tablist"`). Port should add.
7. **No tests** — prototype is visual only; existing 122 Vitest tests target our current backend/components and must be kept green while swapping UI shells.
