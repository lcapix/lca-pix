# LCAPIX v3 — Page Design Prompts

These prompts are copy-paste ready for v0.app / Figma Make / Stitch / Lovable / Framer / Claude Artifacts. Each prompt is self-contained — you can hand any one to a design tool and get back a mockup that fits the system.

**All prompts assume Direction A: "Data Cool" — Carbon/IBM-style, cool slate surfaces with emerald accent.**

---

## 0. Shared Design System (paste this at the top of every prompt)

```
DESIGN SYSTEM — DATA COOL (Carbon/IBM-inspired enterprise SaaS)

PALETTE (OKLCH, for accurate dark-mode color)
  Surfaces
    --surface-base:     oklch(0.17 0.016 240)   /* slate-900 */
    --surface-raised:   oklch(0.22 0.019 240)   /* slate-800 */
    --surface-overlay:  oklch(0.28 0.024 240)   /* slate-700 */
    --surface-inverted: oklch(0.98 0.003 240)   /* off-white */
  Text
    --text-primary:     oklch(0.98 0.003 240)
    --text-secondary:   oklch(0.82 0.014 240)
    --text-tertiary:    oklch(0.65 0.020 240)
    --text-disabled:    oklch(0.45 0.018 240)
  Brand (emerald)
    --brand-primary:    oklch(0.73 0.165 155)   /* emerald-500 */
    --brand-hover:      oklch(0.68 0.175 155)
    --brand-subtle:     oklch(0.23 0.055 155)   /* dark tinted bg for hover */
  Signals
    --signal-success:   oklch(0.75 0.155 155)
    --signal-warn:      oklch(0.78 0.160 75)
    --signal-error:     oklch(0.69 0.210 25)
    --signal-info:      oklch(0.70 0.140 240)
  Borders
    --border-subtle:    oklch(0.28 0.020 240 / 0.6)
    --border-strong:    oklch(0.45 0.025 240)
  Charts (categorical, 5 slots)
    emerald / teal / amber / rose / violet (matched luminance)

TYPOGRAPHY
  UI:        Inter Tight (400, 500, 600) — 14px base
  Numbers:   IBM Plex Mono (500) — every numerical value, tabular-nums enabled
  Display:   Inter Display (600, 700) — hero headlines only
  Sizes:     xs=11, sm=12, base=14, md=15, lg=18, xl=22, 2xl=28, 3xl=40, 4xl=56

SPACING                         RADII                  SHADOWS
  4 / 8 / 12 / 16 / 20 /          sm=4  md=6  lg=8      sm = faint
  24 / 32 / 40 / 48 / 64 /        pill=999              md = card resting
  80 / 96 px                      (no pill buttons)     overlay = modal

BREAKPOINTS (Tailwind standard, used on every page)
  sm: 640px    md: 768px    lg: 1024px    xl: 1280px    2xl: 1536px

VOICE / COPY
  • Direct, confident, data-first
  • No marketing fluff, no "revolutionize your journey"
  • Active voice, short sentences
  • Engineers are the audience — respect their intelligence
  • Numbers are the hero — let them speak

GUARDRAILS — DO NOT:
  ✗ Use minty/pastel green backgrounds
  ✗ Use gradient backgrounds (except 1 subtle hero gradient allowed)
  ✗ Use rainbow color hierarchy (orange/pink/yellow/blue/purple chips)
  ✗ Use generic stock photos of "happy sustainability team"
  ✗ Use leaf/earth/globe icons as brand marks
  ✗ Add emoji or playful illustrations
  ✗ Use rounded-pill buttons
  ✗ Use fonts other than Inter Tight / Inter Display / IBM Plex Mono
  ✗ Use AnimateOnScroll heavy animations — subtle fade-in only

LOGO
  Mark: 3 stacked squares, geometric, emerald on dark surface.
  Visualizes the LCA hierarchy: Product → Process → Flow.
  Wordmark: "LCAPIX" in Inter Display 600, all caps, tight kerning.
  Layout: mark + 1em gap + wordmark.
  Favicon: just the mark.
```

---

## 1. Landing Page — `/`

**Design prompt:**

> Design a **B2B SaaS landing page** for **LCAPIX**, a Life Cycle Assessment platform for sustainability engineers. [PASTE DESIGN SYSTEM BLOCK FROM SECTION 0]
>
> **Page intent:** Convince a practicing LCA engineer to sign up and try the product in under 30 seconds. This is a self-serve product with a free tier. Visitors should walk away knowing (a) what it does, (b) how it's different from SimaPro/openLCA/GaBi, (c) what the free tier includes.
>
> **Sections in order:**
>
> 1. **Sticky nav** (64px tall): Logo (LCAPIX mark + wordmark) on left, links "Product · Pricing · Docs · Changelog" center-right, "Log in" text link + "Sign up →" emerald primary button on the far right. Background: `--surface-base` with 1px bottom border `--border-subtle`, backdrop-blur-md on scroll.
>
> 2. **Hero** (full viewport height, dark slate gradient from `--surface-base` to `--surface-raised` at the bottom):
>    - Small eyebrow text: `BUILT FOR PRACTITIONERS · ISO 14040/14044` in `--text-tertiary`, Inter Tight 11px, tracked wide.
>    - Headline H1 (Inter Display 700, 56px on desktop, line-height 1.05): *"Built for sustainability engineers. Not greenwash."* — "greenwash" in emerald `--brand-primary`.
>    - Subhead (Inter Tight 400, 18px, `--text-secondary`, max-width 580px): "Run life-cycle assessments with cost and environmental impact in the same view. Import factors from openLCA, PubChem, and Electricity Maps. Export ISO-compliant PDF reports."
>    - Primary CTA (emerald filled, 48px tall, 24px horizontal padding, `--text-primary` label, Inter Tight 500, 15px, 6px radius): `Get started free →`
>    - Secondary CTA (outlined, same dimensions, `--border-strong`, `--text-primary` label): `Book a demo`
>    - Below CTAs, small horizontal divider and trust strip: "Used on EV batteries · Consumer products · Industrial processes" — 13px `--text-tertiary`.
>    - Below that, a large product screenshot in a rounded card (8px radius) with a `--shadow-overlay`. The screenshot should show a real assessment results view with an emerald bar chart on dark slate. Add a subtle emerald glow behind the screenshot.
>
> 3. **"Same input, three methods"** — a narrow comparison strip using real demo data. Dark surface, full width, 120px tall:
>    ```
>    Same EV Battery Pack (60 kWh):
>    ┌────────────────────┬────────────────────┬────────────────────┐
>    │ CML 2001           │ ReCiPe Midpoint(H) │ TRACI 2.1          │
>    │ 126.82 kg CO₂-eq   │  72.37 kg CO₂-eq   │  70.36 kg CO₂-eq   │
>    │ (Mono, 22px)        │ (Mono, 22px)        │ (Mono, 22px)        │
>    └────────────────────┴────────────────────┴────────────────────┘
>    ```
>    Headline: "Different methods. Different answers. We show you all three." Numbers in IBM Plex Mono 600 22px, emerald.
>
> 4. **Feature grid** — 6 cells in 3 cols × 2 rows on desktop, 2 cols × 3 rows on tablet, 1 col on mobile. Each cell is a card with: a 24px emerald line-icon (Lucide), title (Inter Tight 600, 16px), 2-line description (Inter Tight 400, 14px, `--text-secondary`):
>    - "Process hierarchies" — 5-tier tree with drag-and-drop editing
>    - "Multiple methods" — CML 2001, ReCiPe, TRACI side by side
>    - "Region-aware" — Grid carbon + labor costs via EIA + Electricity Maps
>    - "Cost × impact tradeoffs" — "For +$X you cut Y% CO₂" — the commercial edge
>    - "ISO PDF reports" — Source-attributed, ISO 14040/14044 compliant
>    - "Open data" — 5000+ factors from openLCA + live PubChem chemistry
>
> 5. **"How it works"** — 3 steps, horizontal on desktop, vertical on mobile. Each step has a number (mono, 48px, emerald), title (Inter Tight 600, 20px), and short description. Subtle connector line between steps (`--border-subtle`). Steps: "Build tree" / "Pick method + region" / "Run, compare, export".
>
> 6. **Comparison vs alternatives** — a data-dense table card. Rows: "Multi-method", "Cost + impact combined", "Location-aware", "Free tier", "Modern web UI", "Source attribution". Columns: LCAPIX (emerald checkmarks) / SimaPro / openLCA / GaBi. LCAPIX column is highlighted with `--surface-overlay` background.
>
> 7. **FAQ** — 6 accordion items, single column, max-width 720px centered: (a) "How is LCAPIX different from openLCA / SimaPro?" (b) "Is it ISO 14040/14044 compliant?" (c) "What valuation methods are supported?" (d) "Can I import my existing LCA data?" (e) "Do I need API keys?" (f) "What's the free tier limit?". Expand icon: `+` that rotates to `×`. Expanded state: `--surface-raised` background.
>
> 8. **Final CTA block** — full-width, `--surface-raised`, 200px tall, centered: "Ready to run your first assessment?" (Inter Display 700, 32px) + Primary CTA "Get started free →" below.
>
> 9. **Footer** — 4 columns on desktop (Product / Resources / Legal / Stay updated with email signup input), 1 col on mobile. `--surface-base` background. Bottom bar: © 2026 LCAPIX · Privacy · Terms · Security on left, socials (GitHub, LinkedIn, X) on right.
>
> **Responsive:**
> - <640px: nav collapses to hamburger; hero headline drops to 36px; screenshot scales fluid; feature grid 1 col; FAQ full width; sticky bottom CTA bar appears.
> - 640–1023px: 2-col feature grid; hero headline 44px.
> - ≥1024px: full desktop layout, max-width 1280px.
>
> **Motion:** Subtle 300ms fade-in on each section as it scrolls into view (IntersectionObserver). Nav gets a `backdrop-blur` when scrolled >20px. NO parallax, NO bouncy animations.
>
> **Deliverables:** Single Next.js 15 App Router page at `app/page.tsx` using Tailwind CSS 4 tokens. No external libs beyond lucide-react for icons. Fully typed TSX. Server-rendered by default; only interactivity (FAQ accordions, scroll fade) uses client components.

---

## 2. Auth Pages — `/auth/login` + `/auth/signup`

**Design prompt:**

> Design the **login and signup pages** for LCAPIX. [PASTE DESIGN SYSTEM BLOCK]
>
> **Page intent:** Fast friction-free auth. Never make someone think. These two pages share ~90% of their layout so design them as a single responsive template with conditional fields.
>
> **Layout — split-screen on desktop, stacked on mobile:**
>
> **Left pane** (40% width on lg+, full width on mobile):
> - Centered vertically, max-width 420px
> - Logo at top (mark + wordmark), 32px tall
> - Headline H1 (Inter Display 600, 28px): Login: "Welcome back." / Signup: "Create your account."
> - Subhead (14px, `--text-secondary`): Login: "Sign in to continue your assessments." / Signup: "Start running LCAs in under a minute."
> - Fields stack with 16px vertical gap:
>   - [Signup only] Name (text input)
>   - Email (text input, autocomplete="email")
>   - Password (text input with eye-toggle, autocomplete="current-password" or "new-password")
>   - [Signup only] Work email domain hint: "We'll use this for team features"
> - Primary submit button (emerald, 44px tall, full width): "Log in" / "Create account"
> - Below: "or" divider with horizontal rule on each side (`--border-subtle`)
> - Google SSO button (outlined, same dimensions): "Continue with Google" + Google icon
> - Below, muted link: Login: "New to LCAPIX? Create account →" / Signup: "Have an account? Log in →"
> - Error state: Red `--signal-error` inline banner above the first invalid field with icon + message.
> - Loading state: Primary button shows spinner and label changes to "Signing in…" / "Creating account…"
>
> **Right pane** (60% width on lg+, hidden on <md):
> - Full-height dark `--surface-base`
> - A quiet, editorial product quote: *"Three methods, same battery, three different answers. That's science."* in Inter Display 400 italic, 20px, `--text-secondary`, max-width 440px, centered.
> - Below the quote, the same "Same input, three methods" mini-comparison from the landing page (smaller scale) with real numbers 126.82 / 72.37 / 70.36.
> - A single subtle emerald accent line across the bottom 20% of the pane.
> - No other imagery — let the numbers be the art.
>
> **Interactions:**
> - Tab order: email → password → submit → SSO → footer link.
> - Cmd/Ctrl+Enter from any field submits the form.
> - Password eye-toggle uses `aria-label="Show password"` / "Hide password".
> - On success, route to `/home` with a subtle toast: "Welcome back, {name}" / "Account created."
> - Don't store password in localStorage. Use httpOnly cookie via API.
>
> **Responsive:**
> - <768px: Right pane hidden entirely. Left pane takes full width. Logo grows slightly (40px). Quote from right pane appears below the CTA as a small callout.
> - ≥1024px: Full split.
>
> **Accessibility:**
> - All inputs have visible labels (not just placeholders).
> - Error messages are associated with fields via `aria-describedby`.
> - Focus ring uses `--border-focus` (emerald) with 2px offset.
> - Min contrast 4.5:1 throughout.
>
> **Deliverables:** Two files — `app/auth/login/page.tsx` and `app/auth/signup/page.tsx`. Both client components. Shared `<AuthLayout>` component in `components/auth/auth-layout.tsx` housing the split-screen and the quote pane.

---

## 3. Home Dashboard — `/home`

**Design prompt:**

> Design the **project dashboard** for LCAPIX. [PASTE DESIGN SYSTEM BLOCK]
>
> **Page intent:** First thing a logged-in user sees. Must surface their projects and let them jump back into work or start something new within 2 clicks. The current version has a plain card list; we're upgrading to a denser, Carbon/IBM-style dashboard with live activity and aggregate stats.
>
> **Layout:**
>
> **Top bar** (app chrome, 56px tall, `--surface-base`, sticky, 1px bottom border):
> - Logo (mark + wordmark, 24px tall) on far left
> - Primary nav center: `Projects · Library · Integrations · Docs`
> - Global search (Cmd+K), Ctrl+K shortcut chip, opens a command palette
> - User avatar + dropdown on far right (account, theme toggle, logout)
>
> **Page content (max-width 1280px centered, 32px horizontal padding):**
>
> **Greeting strip** (80px tall, flex row):
> - Left: Greeting in Inter Display 600, 28px: "Welcome back, {user.name}"
> - Right: Primary CTA "+ New Project" (emerald, 40px tall)
>
> **KPI row** (4 stat cards, equal width, 24px gap, 100px tall each). Each card has:
> - Small label in `--text-tertiary` Inter Tight 500, 11px, tracked wide: PROJECTS / ASSESSMENTS / FACTORS / COMPONENTS
> - Large number in IBM Plex Mono 600, 32px, `--text-primary`
> - Below number: small trend indicator (↑ 2 this week in emerald, or ↓ / →)
> - Card background `--surface-raised`, 1px `--border-subtle`, 6px radius
>
> **Projects section:**
> - Section header row: H2 "Your Projects" (Inter Tight 600, 20px) + filter pills (All / Base only / Comparative only) + search input (240px wide) + sort dropdown
> - Toggle between grid view and table view (icon buttons top-right of section)
>
> **Project cards** (grid view, 3 cols on xl, 2 on lg, 1 on md and below, 24px gap):
> - Each card is `--surface-raised`, 1px border, 6px radius, 20px padding, hover raises shadow to `--shadow-md` and border to `--border-strong`
> - Top row: Project name (Inter Tight 600, 16px) + status badge (Active / Archived) in top-right
> - Description (13px, `--text-secondary`, 2-line clamp)
> - Separator rule
> - Bottom row: 3 mini stats inline: "2 cases · 12 components · Last run 3h ago" — numbers in mono. Each mini stat is clickable and deep-links.
> - Three-dot menu (opens actions: Open, Rename, Duplicate, Archive, Delete)
> - Click anywhere else on card = open project
>
> **Projects table view** (alternative to grid — same data but denser):
> - Columns: Name · Type · Cases · Components · Last run · Updated · Actions
> - Sortable column headers
> - Row hover highlights `--surface-overlay`
> - Click row = open project
>
> **Empty state** (no projects yet):
> - Center a card with a small emerald line-icon, headline "No projects yet", subhead "Create your first LCA project to get started.", and primary CTA.
>
> **Sidebar** (right side, 320px on xl only, hidden below xl):
> - "Recent activity" feed (last 10 integration_log entries across all projects)
> - Each item: timestamp (mono 11px), actor, action, icon. Collapsible.
>
> **Interactions:**
> - Hover card → 150ms shadow lift
> - `N` keyboard shortcut → opens New Project modal
> - `Cmd+K` → command palette that can navigate to any project, case, or admin page
> - Shift+click on card = open in new tab
> - Filter pills update URL query params (shareable links)
>
> **Responsive:**
> - <768px: Top nav collapses to drawer; greeting stacks; KPI row scrolls horizontally; project grid 1 col; sidebar hidden (activity accessible from nav drawer)
> - 768–1024px: 2-col grid; KPI row stays 4-wide but compact
> - ≥1280px: 3-col grid + sidebar
>
> **Deliverables:** `app/home/page.tsx` as server component with client-side filter/sort state in a small `<ProjectsToolbar>` client component. Projects fetched via server component. KPIs as a server component too. Command palette uses existing shadcn command component.

---

## 4. Project Detail — `/project/[projectId]`

**Design prompt:**

> Design the **project detail page** for LCAPIX. [PASTE DESIGN SYSTEM BLOCK]
>
> **Page intent:** A project is a container for cases. This page must let users (a) see all cases, (b) switch between them, (c) compare them, (d) jump into the case editor. Currently shows a tabbed case switcher + a case tree preview — we're cleaning that up.
>
> **Layout:**
>
> **Breadcrumb bar** (40px tall, `--surface-base`): Home / **Electric Vehicle Manufacturing**
>
> **Project header** (flex row, 100px tall, `--surface-raised` card):
> - Left 60%: Project title (Inter Display 600, 28px). Description below (13px, `--text-secondary`).
> - Right 40%: Horizontal button group: `[Compare Cases]` `[View Analytics]` `[+ Add Case ▼]` (dropdown: base case / comparative case / import)
>
> **Case tabs row** (sticky on scroll):
> - Horizontal pill-tab list of all cases, with the active one in emerald filled, inactive in outlined `--border-subtle`.
> - Each tab shows: case name, tiny badge for type (Base/Comp), 3 mini-stats underneath (component count, driver count, last run time) in mono 11px.
> - "+ Add case" ghost button at the end.
>
> **Two-pane main area** (flex, 60/40 split on lg+, stacked on <lg):
>
> **Left pane (60%) — Process Hierarchy Preview:**
> - Card header: "Case Tree" + right-side "View Hierarchy" icon button that opens fullscreen modal (the same modal from current app but redesigned — see Section 5).
> - Body: miniaturized tree visualization. Uses the 3-level color tokens for hierarchy (Product = emerald, Machine/Subprocess = slate variants, Leaf/Task = `--text-tertiary` border only). NO rainbow.
> - Below tree: horizontal toolbar: "Expand All / Collapse All / Search components".
> - Process tree node: 140px wide, 48px tall, 6px radius, dark surface, colored left border (4px) indicating hierarchy level. Hover = `--surface-overlay` background. Click = opens component inspector in right pane.
>
> **Right pane (40%) — Case Inspector:**
> - Top card: case title + type badge + "Edit Case" small outlined button
> - Second card: "Impact Overview" with:
>   - Total impact highlighted: "74.75 kg CO₂-eq" in mono 32px emerald (or whatever category is selected)
>   - Category switcher underneath (dropdown): Global Warming / Ozone Depletion / etc.
>   - Small info grid: "5 components · 4 categories · 13 assessments run"
>   - "Assessed" badge (emerald pill with check) or "Unassessed" (slate pill)
> - Third card: "Top contributors" — list of 5 components with their impact share as horizontal bars (emerald fill, slate track, mono percentage).
> - Fourth card: "Cost summary" — if costs exist: Labor / Energy / Material / Total in a 4-row mini table with mono numbers.
> - Actions at bottom: `[Run Assessment]` (primary) `[View Results]` (secondary) `[Export PDF]` (outlined).
>
> **Comparison banner** (only shown if project has >1 case): A thin horizontal card ABOVE the two panes reading "Comparing Base vs Renewable Scenario: -28% CO₂ / +$240" with a "Open Full Comparison" link. Numbers in mono, emerald for improvements, amber for regressions.
>
> **Keyboard interactions:**
> - `[` / `]` → switch between cases
> - `R` → run assessment modal
> - `V` → open fullscreen hierarchy view
> - `E` → export PDF
>
> **Responsive:**
> - <1024px: panes stack (tree full-width above, inspector full-width below)
> - <768px: case tabs become a horizontal-scrollable strip; header buttons collapse to an overflow menu
> - ≥1024px: full split as described
>
> **Deliverables:** `app/project/[projectId]/page.tsx` as main container. Break out `<CaseTabs>`, `<ProcessTreeMini>`, `<CaseInspector>` into separate client components.

---

## 5. Case Editor — `/project/[projectId]/case/[caseId]`

**Design prompt:**

> Design the **case editor page** for LCAPIX — the heaviest screen in the app. [PASTE DESIGN SYSTEM BLOCK]
>
> **Page intent:** Build and edit a hierarchical process tree (Product → Machine/Line → Subprocess → Operation → Elemental Task), attach environmental flows and costs to leaves, and iterate. Currently one 3,360-line file with a fullscreen tree visualization + side panels; we're redesigning interactions but keeping the hierarchy concept.
>
> **Page-level layout (3-pane IDE style, dark mode default):**
>
> **Top bar** (56px): Logo · Breadcrumb (Home / EV Manufacturing / **Baseline Production 2025**) · right-side: `[Run Assessment]` primary emerald button + overflow menu.
>
> **Left sidebar** (240px wide, collapsible to 56px icon-only):
> - "Components" list with search input at top
> - Tree (collapsible) — same 5-tier hierarchy but as a nav list, not a flowchart. Each row: hierarchy badge (tiny "P" / "M" / "S" / "O" / "T") in `--text-tertiary`, component name, expand chevron.
> - Selected row = emerald left border (3px) + `--surface-overlay` bg.
> - Right-click row → context menu: Duplicate / Rename / Move / Delete.
> - Sidebar bottom: "+ Add Component" button that opens a type-picker dropdown.
>
> **Main canvas (center, flex-1):**
> - Top toolbar row (44px): View toggle (Tree / List / Graph) · Zoom controls (— 100% + Fit) · Search (pattern: "find substance, component, or flow") · `Reset` button
> - Canvas: the process tree visualization, but redesigned:
>   - **NO rainbow colors.** Each hierarchy level uses the same dark card (`--surface-raised`) with a 3px colored left border: Product = emerald / Machine = `--signal-info` (slate-blue) / Subprocess = `--text-secondary` / Operation = `--text-tertiary` / Elemental Task = `--brand-primary` accent.
>   - Each node is a 180×64px card with: tiny uppercase hierarchy label (11px tracked) + component name (14px primary) + mini stats at bottom (mono 10px: "18 flows · $42 cost").
>   - Connection lines between nodes: 1px `--border-strong`, orthogonal routing (not curves).
>   - Hovered node: slight shadow lift + emerald border glow.
>   - Selected node: emerald 2px border + `--surface-overlay` bg.
>   - Can collapse any subtree with a chevron on the node.
>   - Pan: drag on empty canvas. Zoom: scroll + modifier key. Buttons for keyboard users.
> - Below canvas bottom edge, thin status bar (32px): "Showing 37 of 143 components · Last edited 4min ago · Auto-saving" in `--text-tertiary` 11px.
>
> **Right sidebar (inspector, 360px wide, collapsible):**
> - When no component selected: shows case overview (name, type, region, last assessment result).
> - When component selected: the component inspector with 4 collapsible sections:
>   1. **Properties** — name, type (read-only), quantity + unit inputs, description
>   2. **Drivers** (for elemental tasks only) — occupation code, labor hours, driver type select, driver category
>   3. **Environmental Flows** — table of flows: substance, direction (IN/OUT badge), quantity, unit, is_driver toggle. "+ Add flow" at bottom. Edit inline, not modal.
>   4. **Costs** — 6 fields: labor, energy, material, transportation, equipment, overhead. Auto-fill button "Auto-populate from BLS/EIA" with spinner when fetching.
> - Sticky inspector footer: "Delete component" link button at bottom-left + "Save" sticky green on changes.
>
> **Modal — Process Hierarchy Fullscreen** (triggered by expand button):
> - True fullscreen overlay (NOT the current half-visible mess)
> - Dark backdrop `oklch(0 0 0 / 0.75)` with backdrop-blur
> - Full tree at true scale, same node design as canvas
> - Top bar: Search / Zoom controls / Export SVG / Close (✕ visible, top-right)
> - ESC closes
>
> **Empty tree state:** Large emerald "+ Add Product" button in the canvas center with tip text "Every case starts with a Product node."
>
> **Interactions:**
> - Double-click node → open inspector, expand all sections
> - Drag node to move (within its parent's siblings)
> - Drag node to another parent (with valid-drop-zone highlight; invalid = red outline)
> - Cmd/Ctrl+Z = undo last edit (local history, up to 50 steps)
> - Right-click on empty canvas → "Add Product node here"
> - Inspector saves debounced 800ms after last edit
> - Cmd+S = force save immediately
> - `R` → run assessment modal
> - `V` → fullscreen view
>
> **Responsive:**
> - <1024px: Sidebar collapses to hamburger overlay. Canvas takes full width. Inspector slides in from right as drawer when component selected. Canvas node card width drops to 140px.
> - <768px: Tree canvas falls back to a List view only (tree is unusable on phones). Show toast "Tree view is optimized for larger screens; list view is active."
>
> **Deliverables:** Refactor `app/project/[projectId]/case/[caseId]/page.tsx` to be a thin orchestrator. Move tree canvas into `<CaseCanvas>`, sidebar into `<ComponentList>`, inspector into `<ComponentInspector>`. Target the original 3,360-line file dropping below 500 lines in the page itself. The fullscreen modal becomes `<ProcessHierarchyModal>`.

---

## 6. Assessment Results — `/project/[projectId]/case/[caseId]/results`

**Design prompt:**

> Design the **assessment results page** for LCAPIX. [PASTE DESIGN SYSTEM BLOCK]
>
> **Page intent:** Show the calculated environmental impact of a case. Must be scannable at a glance (total numbers) and drillable (per-component contribution, per-substance, per-flow). Currently a plain stats + run-button; we're upgrading to a Grafana-style dashboard.
>
> **Layout:**
>
> **Page header** (flex row, 80px):
> - Left: Breadcrumb + "Assessment Results" title + case name in `--text-secondary`
> - Right: `[Run new assessment]` primary emerald + `[Export PDF]` outlined + method/region pills showing "Method: CML 2001 · Region: Global" (click to open the Run Assessment modal).
>
> **KPI strip** (4 stat cards, 110px each):
> - Components Assessed — value in mono, `5 / 5` format
> - Driver Flows Processed — mono number
> - Impact Categories — mono number + tiny category list on hover
> - Last Run — relative time ("4 min ago") + timestamp on hover
>
> **Main 12-col grid, 32px gap:**
>
> **Row 1 (spans full width):** "Impact Overview" card
> - Left 40%: Total impact value for the currently-selected category in huge mono text (56px, emerald)
> - Right 60%: A horizontal stacked bar showing how components contribute to this category. Each segment labeled with component name and %. Clicking a segment filters all below to that component.
> - Category switcher tabs above the total: all impact categories as horizontal pills. Active pill = emerald filled.
>
> **Row 2 (8 cols):** "Impact by category" chart
> - Vertical bar chart, IBM Plex Mono axis labels, emerald bars
> - Y-axis: category name. X-axis: impact value (log scale option).
> - Hover reveals exact value + unit tooltip in mono.
> - Below chart, a small "Show as table" toggle → renders same data as dense table.
>
> **Row 2 (4 cols):** "Top contributors" list card
> - Top 5 components ranked by contribution to the selected category
> - Each row: rank number, component name, value in mono, mini horizontal bar showing % of total
>
> **Row 3 (full width):** "Flow-level detail" data table
> - Columns: Component · Substance · Direction · Amount · Unit · Factor · Impact value
> - All numeric columns right-aligned in mono font with tabular-nums
> - Sortable column headers
> - Filters above table: component multi-select, category select, direction (IN/OUT) toggle, search
> - Paginated if >50 rows (50/page)
> - Row hover = `--surface-overlay` bg
>
> **Row 4 (full width):** "Historical runs" timeline
> - Horizontal timeline with dots for each run on this case
> - X-axis: time. Y-axis: total impact for selected category.
> - Dots colored by status (emerald = success, amber = partial, red = failed)
> - Click dot = switches the entire page to show that run's data
> - "Compare to last run" toggle at top-right — shows delta badges next to each KPI
>
> **Empty state** (no runs yet): Big centered emerald CTA "Run first assessment →" with a tip "Make sure at least one component has flows with is_driver=TRUE."
>
> **Interactions:**
> - Category switcher updates every chart/table on the page live (no reload)
> - Clicking a bar in the contribution chart deep-links to the component editor with that component selected
> - `E` → open PDF export
> - `R` → open Run Assessment modal
> - Cmd+F focuses the flow table search
>
> **Responsive:**
> - <1280px: Row 2's 8/4 split becomes stacked
> - <1024px: All full-width; charts resize fluid
> - <768px: KPI strip horizontal scroll; data table becomes card list (each row = card); historical timeline becomes a vertical list
>
> **Deliverables:** `app/project/[projectId]/case/[caseId]/results/page.tsx` (server component for data fetch, client for filters/charts). Chart components wrap shadcn's chart primitives + Recharts. Data table uses shadcn's Table + TanStack Table for sort/filter.

---

## 7. Component Editor — `/project/[projectId]/case/[caseId]/component/new`

**Design prompt:**

> Design the **new/edit component form** page for LCAPIX. [PASTE DESIGN SYSTEM BLOCK]
>
> **Page intent:** Add or edit a single component in a case's process hierarchy. Must handle all 5 component types (Product, Machine/Line, Subprocess, Operation, Elemental Task) which each have different required fields. Edit view reuses this page with existing values prefilled.
>
> **Layout** — centered form, max-width 720px:
>
> **Breadcrumb + title bar:** Home / EV Manufacturing / Baseline 2025 / **New Component** (or component name in edit mode).
>
> **Form sections (stacked cards, 24px gap):**
>
> **Section 1 — Type & Placement** (`--surface-raised` card, 24px padding):
> - Big horizontal segmented control for component type: Product / Machine/Line / Subprocess / Operation / Elemental Task. Each segment: icon + label. Active = emerald filled.
> - Below: Parent component dropdown (searchable, shows the valid parent types only based on current type selection — e.g. Product has no parent, Machine must live under a Product, etc). Inline help text: "Where does this fit in the tree?"
>
> **Section 2 — Identity** (card):
> - Name (required, max 200 chars)
> - Description (optional, max 500 chars, textarea with char counter)
> - Quantity + Unit (side by side; Unit is a select with common units: kg, kWh, MJ, m³, unit, line, batch, cycle, task, sq ft)
>
> **Section 3 — Drivers** (only shown for Elemental Task type):
> - Driver type (select with autocomplete from `driver_impact_factors.driver_name` in the DB; popular options first)
> - Driver category (select: Energy / Materials / Transport / Labor / Waste)
> - Labor occupation code (optional; opens BLS occupation picker)
> - Labor hours (optional)
> - Helper callout: "Drivers link this task to characterization factors. If empty, this task contributes 0 impact."
>
> **Section 4 — Costs** (card, collapsed by default):
> - Header with toggle chevron showing "$0.00 estimated cost" when collapsed
> - Expanded: 6 field grid (labor / energy / material / transportation / equipment / overhead)
> - Auto-fill button "Fetch from BLS + EIA" — disabled if no driver type + no region set on case
> - Currency selector (defaults to USD)
>
> **Section 5 — Advanced** (card, collapsed):
> - Process type (free text)
> - Drivers JSON (code-style textarea for power users)
> - Custom metadata (key/value pairs)
>
> **Sticky bottom action bar** (full-width, `--surface-raised`, 64px tall, border-top):
> - Left: Cancel (text link back to case) + "Save as draft" (outlined, only shown on new components)
> - Right: Primary "Create component" / "Save changes" + kebab menu (Delete, Duplicate, Move)
>
> **Validation:**
> - Show inline errors below each invalid field with red `--signal-error` bar
> - Summary error banner at top if form has any errors, with anchor links to each bad field
> - On submit, disable button + show spinner + "Creating..." label
>
> **Responsive:**
> - <768px: Segmented control becomes select dropdown; 2-field rows (quantity+unit) stack; cost grid becomes 1 col
> - ≥1024px: full 720px centered
>
> **Deliverables:** `app/project/[projectId]/case/[caseId]/component/new/page.tsx` + `component/[componentId]/edit/page.tsx` sharing `<ComponentForm>` client component. Form uses `react-hook-form` + `zod` schema (zod already installed). Submit calls existing `POST /api/cases/[id]/components`.

---

## 8. Analytics + Comparisons — `/project/[id]/analytics` & `/project/[id]/comparisons/[id]`

**Design prompt:**

> Design the **analytics** and **comparison results** pages for LCAPIX. They share ~80% of visual DNA so design them as a pair. [PASTE DESIGN SYSTEM BLOCK]
>
> **Page intent:**
> - Analytics: roll-up view across all cases in a project. "How is my project trending?"
> - Comparisons: side-by-side 2–N cases. "Which scenario wins?"
>
> **Shared layout framework:**
>
> **Top bar:** Breadcrumb + page title + context pills (e.g. "Comparing: Baseline vs Renewable Scenario").
>
> **Control strip** (sticky, 60px):
> - Left: Case selector (for analytics: multi-select; for comparison: N cases to compare, drag to reorder)
> - Center: Method + Region pills (click to change, global for this view)
> - Right: Export buttons (PDF, PNG, CSV), Share link, view toggle (Dashboard / Table / Chart mode)
>
> **Main content — 12-col grid, tiled dashboards:**
>
> **For Analytics:**
> 1. Full-width: "Impact over time" multi-line chart. X=time, Y=total impact for selected category. One line per case. Emerald/teal/amber/rose/violet colors. Hover crosshair with vertical line across all series.
> 2. 6 cols each: "Category breakdown pie" + "Top contributors bar chart".
> 3. Full width: "Case comparison heatmap" — Y=cases, X=impact categories, cells colored by value magnitude (green=low, amber=mid, red=high).
> 4. 8 cols: "Flow-level contribution Sankey diagram" (simple) linking components → substances → impact categories. Emerald ribbons.
> 5. 4 cols: "Data quality score" gauge — composite score 0-100 based on factor coverage, regional specificity, and source quality.
>
> **For Comparisons (2-case mode):**
> 1. "Head-to-head KPI row": two cards side by side showing each case's total impact, cost, delta badges (−28% CO₂ in emerald, +$240 in amber).
> 2. Full-width: Grouped bar chart. X=impact categories, two adjacent bars per category (one per case).
> 3. Full-width: Radar chart showing both cases across all categories (normalized to max).
> 4. Full-width: "Component-level difference table" — Component × Impact Category cells. Show delta value + percent. Green cells = improvement, amber = regression.
> 5. At bottom: "Verdict" callout card: "Renewable Energy Scenario reduces Global Warming by 28% at +$240 cost. ROI: $8.50/kg CO₂ avoided."
>
> **For Comparisons (N-case mode, N≥3):** All cases in parallel bar groups, radar shows all. Difference table picks a baseline (user-selectable).
>
> **Interactions:**
> - Click any chart data point → filter all dashboards to that component/category
> - Legend items clickable to toggle series on/off
> - Drag charts to reorder (layout saved to user prefs)
> - "Lock comparison" checkbox freezes axis scales so you can screenshot a consistent snapshot
>
> **Export:**
> - PDF: renders the whole dashboard on an A4 landscape with the Data Sources section at the end (same PDF generator as single-case reports)
> - CSV: flat table of every data point
> - Share link: signed URL that recreates the filter state
>
> **Responsive:**
> - <1024px: charts stack full-width; radar chart simplifies to bar chart
> - <768px: comparisons reduce to "swipe between cases" interaction; analytics becomes a vertical list of charts
>
> **Deliverables:** `app/project/[projectId]/analytics/page.tsx` + `comparisons/[comparisonId]/page.tsx`. Shared `<DashboardGrid>` + chart components using Recharts + shadcn chart primitives. Sankey via a lightweight library like `recharts-sankey` or hand-rolled.

---

## 9. Admin — `/admin/integrations`

**Design prompt:**

> Redesign the **admin integrations dashboard** for LCAPIX. [PASTE DESIGN SYSTEM BLOCK]
>
> **Current state:** Already built in Phase 1 but visually rough (see screenshot in audit). Has 3 status cards, 2 import buttons, and a log viewer. We're polishing the visual design and adding more controls as new integrations go live.
>
> **Page intent:** Admin/power user dashboard to monitor integration health, trigger imports, set API keys, view audit log. Gary will demo this to customers.
>
> **Layout:**
>
> **Breadcrumb + title** ("Integrations").
>
> **Subnav tabs:** `Overview` · `Data Sources` · `API Keys` · `Activity Log` · `Schema`.
> Default = Overview.
>
> **Overview tab:**
>
> **Status cards row** (4 cards, equal width):
> 1. "Substances" — enriched/total with progress bar, "Run enrichment" link
> 2. "Valuation methods" — count imported, list them, "Import another" link
> 3. "Cost rates" — total cached, break down by type (labor/energy/material), "Refresh rates" link
> 4. "Integration health" — overall "all systems operational" or N endpoints failing, with traffic-light indicators
>
> **Integration status table** (full width):
> - Columns: Source · Status (dot + label) · Last run · Records · Action
> - Rows: openLCA / PubChem / Electricity Maps / BLS / EIA / Metals-API
> - Status dot: emerald=healthy, amber=degraded, red=failed, grey=inactive
> - Action column: "Run now" button or "Configure key" if not set up
> - Click row → drawer on right with recent history for that source
>
> **Data Sources tab:**
> - Per-source configuration cards, each showing:
>   - Current state (connected / disconnected / key required)
>   - Rate limit status (remaining / window)
>   - Last successful fetch
>   - Settings (TTL, geographic scope, method defaults)
>
> **API Keys tab:**
> - Table: Service · Status · Last used · Actions
> - Add/Edit/Rotate key actions in-row
> - Masked keys by default; click eye-icon to reveal temporarily
> - Auto-detect missing keys and prompt "Add key" inline on Overview tab
>
> **Activity Log tab:**
> - The existing log viewer, expanded to full page
> - Filters: source, status, date range, actor
> - Each row expandable to show JSON `details`
> - Export to CSV button top-right
>
> **Schema tab:**
> - Visual of which tables + columns each integration populates
> - Small ER-diagram with emerald arrows from API → tables
> - Click table → link to database/migrations sql file
>
> **Interactions:**
> - Run buttons show a progress toast with live count
> - Key rotation generates a new signed token and invalidates old
> - Every mutation goes through `integration_log` and shows in Activity Log live
>
> **Responsive:**
> - <1024px: subnav tabs become scrollable horizontal
> - <768px: status cards stack 1-col; table becomes card list
>
> **Deliverables:** Refactor `app/admin/integrations/page.tsx` into a layout with tab-based subpages. Each tab is its own file under `app/admin/integrations/(tabs)/*`. Route group pattern to avoid URL prefixes.

---

## 10. About + Guide — `/about` and `/guide`

**Design prompt:**

> Design the **about and guide pages** for LCAPIX. Lower priority; keep it simple and consistent. [PASTE DESIGN SYSTEM BLOCK]
>
> **About page:**
> - Hero: "What is LCAPIX?" + 2-3 paragraph explainer
> - Section: "The LCA methodology" — plain-English breakdown of the 5-tier hierarchy with a small diagram
> - Section: "Methods we support" — cards for CML 2001, ReCiPe, TRACI with short descriptions and sources
> - Section: "Team & credits" — attribution to openLCA, PubChem, BLS, EIA, Electricity Maps with their logos
>
> **Guide page:**
> - Left sidebar (240px): Table of contents, sticky, scrollspy highlighting
> - Main content: long-form Markdown-style docs with:
>   - Getting started (5 steps with screenshots)
>   - Data model explained (Product → Process → Flow → Substance → Factor chain)
>   - How to run your first assessment (3-min video placeholder + steps)
>   - Glossary (CML, GWP, LCA, CAS, etc.)
>   - FAQ
>   - API reference (future)
> - Code snippets in IBM Plex Mono
> - Images: screenshots from the actual app, embedded inline
>
> **Both pages:**
> - Max-width 720px for prose; 1280px for the overall layout
> - Inter Tight 16px body with relaxed 1.7 line-height (more readable for long-form)
> - Emerald link color with underline on hover
> - Footer anchor back to `/home` for logged-in users, `/` for visitors
>
> **Responsive:**
> - <1024px: guide sidebar collapses to a top-bar dropdown
> - <768px: all full-width stacked
>
> **Deliverables:** `app/about/page.tsx` + `app/guide/page.tsx` as server components (mostly static content). Guide uses MDX for long-form ease of editing.

---

## Appendix — Prompt Patterns for v0 / Figma Make / Stitch

### For v0.app:
Paste the full system block + the specific page prompt. Add at the end: "Generate this as Next.js 15 App Router, Tailwind CSS 4, TypeScript, shadcn/ui components. No external dependencies beyond what's standard."

### For Figma Make:
Paste the system block + page prompt. Add: "Generate a clickable prototype in Figma. Use component variants for each interactive state (hover, active, disabled). Use the color tokens as Figma styles."

### For Claude Artifacts:
Paste the system block + page prompt. Add: "Build this as a single self-contained React component using Tailwind utility classes. Use hardcoded demo data that matches the described UI. Don't use any state management libraries."

### For Stitch / Lovable:
They work best with plain-English specs. Use the layout sections verbatim and trim the token block to just color names + typography.

---

## Process suggestion

1. Start with page 1 (Landing) in your tool of choice
2. Iterate until you like it visually
3. Export the mockup (PNG or Figma link or v0 URL)
4. Drop it here — I'll wire the design into the real `/Users/kavishpandit/Desktop/lca/lca project v3/` Next.js app with the actual data
5. Repeat for each page

**Order recommendation:** Landing → Auth → Home → Case Editor (hardest) → Project detail → Results → Component editor → Admin → Analytics+Comparisons → About/Guide.
