# LCAPIX v3 — Brand & UI Redesign Design

**Date:** 2026-04-13
**Status:** Approved direction, ready for implementation planning
**Owner:** Kavish Pandit
**Precedes:** `2026-04-13-brand-redesign-implementation.md`

---

## Goal

Elevate LCAPIX from "dev prototype that works" to a polished commercial product. One coordinated pass covering: brand system, new landing page, every authenticated page redesigned, responsive behavior everywhere, and an accessible component library.

## Non-goals (explicitly out of scope for this pass)

- Replacing shadcn/ui with another component library
- Breaking the monolithic 3,360-line case editor into smaller components at the data-layer level (only page-level refactors)
- Multi-theme support beyond light/dark (high-contrast mode stays as-is)
- i18n / localization
- Mobile-native apps (web-responsive only)
- Custom illustrations or photography (we use real product screenshots as the art)

## Direction (locked)

**"Data Cool"** — Carbon/IBM-inspired enterprise SaaS. Cool slate surfaces, emerald accent, IBM Plex Mono for all numerical values, Inter Tight for UI, Swiss-grid discipline. Reads as telemetry dashboard, not marketing site.

Reference competitors: Grafana · Stripe · Linear · Bloomberg Terminal (for density).
Anti-references: Climate startups with leaf logos · Notion-style warm softness · Material Design's rounded playfulness.

---

## 1. Design Tokens

### 1.1 Color (OKLCH)

```css
/* Surfaces — 4-level depth */
--surface-base:       oklch(0.17 0.016 240)      /* slate-900, primary bg */
--surface-raised:     oklch(0.22 0.019 240)      /* slate-800, card bg */
--surface-overlay:    oklch(0.28 0.024 240)      /* slate-700, hover/selected */
--surface-inverted:   oklch(0.98 0.003 240)      /* near-white, for reversed patches */

/* Text — 4-level hierarchy */
--text-primary:       oklch(0.98 0.003 240)      /* body text on dark */
--text-secondary:     oklch(0.82 0.014 240)      /* descriptions */
--text-tertiary:      oklch(0.65 0.020 240)      /* labels, metadata */
--text-disabled:      oklch(0.45 0.018 240)      /* disabled state */

/* Brand (emerald) */
--brand-primary:      oklch(0.73 0.165 155)      /* emerald-500 */
--brand-hover:        oklch(0.68 0.175 155)      /* emerald-600 */
--brand-subtle:       oklch(0.23 0.055 155)      /* dark-tinted emerald bg for hover */
--brand-fg-on-brand:  oklch(0.05 0.010 240)      /* text color ON emerald buttons */

/* Signals */
--signal-success:     oklch(0.75 0.155 155)      /* same family as brand */
--signal-warn:        oklch(0.78 0.160 75)       /* amber */
--signal-error:       oklch(0.69 0.210 25)       /* red */
--signal-info:        oklch(0.70 0.140 240)      /* slate-blue */

/* Borders */
--border-subtle:      oklch(0.28 0.020 240 / 0.6)
--border-strong:      oklch(0.45 0.025 240)
--border-focus:       var(--brand-primary)

/* Chart categorical (5 slots, matched luminance ~0.73) */
--chart-1:            oklch(0.73 0.165 155)      /* emerald */
--chart-2:            oklch(0.72 0.140 200)      /* cyan */
--chart-3:            oklch(0.78 0.160 75)       /* amber */
--chart-4:            oklch(0.69 0.195 350)      /* rose */
--chart-5:            oklch(0.70 0.155 290)      /* violet */
```

**Light-mode flip strategy:** Because OKLCH keeps perceived lightness uniform across hues, light mode simply inverts the `--surface-*` and `--text-*` lightness channels. The brand, signals, and chart colors keep their chroma — only their L values shift ~+0.15 for sufficient contrast on light backgrounds. Implementation: a single `.light` class on `<html>` overrides the token definitions.

### 1.2 Typography

```css
--font-ui:        'Inter Tight', ui-sans-serif, system-ui, sans-serif
--font-mono:      'IBM Plex Mono', ui-monospace, 'SF Mono', monospace
--font-display:   'Inter Display', var(--font-ui)

/* Size scale — 14px base, 1.125 ratio */
--text-xs:   11px / 1.4        /* labels, captions */
--text-sm:   12px / 1.4        /* secondary UI */
--text-base: 14px / 1.5        /* body default */
--text-md:   15px / 1.5        /* primary UI */
--text-lg:   18px / 1.4        /* card titles */
--text-xl:   22px / 1.3        /* section titles */
--text-2xl:  28px / 1.2        /* page titles */
--text-3xl:  40px / 1.15       /* dashboard headline */
--text-4xl:  56px / 1.05       /* landing hero (desktop) */

/* Weights */
--weight-normal:   400
--weight-medium:   500
--weight-strong:   600
--weight-display:  700
```

**Numerical data rule (enforced in CSS utility + component library):** every numeric value — impacts, costs, percentages, CAS numbers, CIDs, dates, timestamps, factor values — renders in `font-mono` with `font-variant-numeric: tabular-nums`. A Tailwind utility `.num` and a `<Num>` React component encode this.

**Font loading:** `next/font/google` for Inter Tight and IBM Plex Mono (already pattern-matched by existing `app/layout.tsx`). Inter Display loaded the same way. `font-display: swap` to avoid FOIT.

### 1.3 Spacing

```css
--space-1:   4px
--space-2:   8px
--space-3:   12px
--space-4:   16px       /* default card padding */
--space-5:   20px
--space-6:   24px       /* section gap */
--space-8:   32px       /* page section gap */
--space-10:  40px
--space-12:  48px
--space-16:  64px
--space-20:  80px
--space-24:  96px       /* page-level vertical rhythm */
```

Base unit is 4px. Avoid arbitrary pixel values; always land on a scale step.

### 1.4 Radii

```css
--radius-sm:   4px      /* inputs, small buttons */
--radius-md:   6px      /* cards, standard buttons */
--radius-lg:   8px      /* hero cards, modals */
--radius-pill: 999px    /* badges ONLY — not buttons */
```

### 1.5 Shadows

```css
--shadow-sm:         0 1px 2px oklch(0 0 0 / 0.12)
--shadow-md:         0 4px 12px oklch(0 0 0 / 0.18)
--shadow-overlay:    0 24px 48px oklch(0 0 0 / 0.35)
--shadow-emerald:    0 0 0 2px var(--brand-primary)   /* focus ring */
```

### 1.6 Motion

Three timing functions only:

```css
--ease-standard:  cubic-bezier(0.4, 0, 0.2, 1)   /* 95% of transitions */
--ease-decelerate: cubic-bezier(0, 0, 0.2, 1)    /* entering elements */
--ease-accelerate: cubic-bezier(0.4, 0, 1, 1)    /* leaving elements */

--duration-fast:   150ms        /* hover, toggle */
--duration-normal: 250ms        /* modal, dropdown */
--duration-slow:   400ms        /* page transitions */
```

No spring physics. No parallax. Fade + slide only.

### 1.7 Breakpoints (Tailwind defaults)

| Name | Width | Use case |
|------|-------|----------|
| `sm` | 640px | Large phone |
| `md` | 768px | Tablet portrait |
| `lg` | 1024px | Tablet landscape / small laptop |
| `xl` | 1280px | Desktop |
| `2xl` | 1536px | Large desktop |

**Mandatory responsive rule:** every authenticated page declares layout behavior at `sm`, `md`, `lg`, and `xl` explicitly. No "desktop only" pages. When a screen is genuinely desktop-only (case tree canvas), we show a helpful toast on `<md` and route to a list-view fallback.

---

## 2. Logo & Brand Mark

### 2.1 Concept

Three stacked squares, geometrically precise, emerald on dark. Visualizes the LCAPIX hierarchy: **Product → Process → Flow**. The mark literally IS the product concept.

### 2.2 Spec

```
Frame:   24×24 px base grid
Layout:  Three 6×6 px squares, stacked vertically, 3 px gaps
Color:   Emerald fill (--brand-primary)
Corners: 1 px rounded (r=1) — sharp but not brutalist
Stroke:  none
```

ASCII representation:
```
┌──┐
│▓▓│     <- top square (Product)
└──┘
  │
┌──┐
│▓▓│     <- middle square (Process)
└──┘
  │
┌──┐
│▓▓│     <- bottom square (Flow)
└──┘
```

### 2.3 Wordmark

- Text: `LCAPIX`
- Font: Inter Display 600
- Size: matches mark height (24 px caps in standard logo)
- Kerning: −2% tracking (tightened from default)
- Case: all caps

### 2.4 Lockups

```
Horizontal (primary):       [mark] [8px gap] LCAPIX
Stacked (favicon bg):       [mark above LCAPIX, 4px gap]
Icon only (favicon):        [mark]
Monochrome (dark bg):       emerald mark + white wordmark
Monochrome (light bg):      dark mark + dark wordmark
Inverted (reversed):        white mark + white wordmark on emerald bg
```

### 2.5 Rules

- **Minimum size:** 16px tall for the mark; below that use favicon monogram only
- **Clear space:** reserve padding equal to the height of one square (6 px @ 24 px mark)
- **Don't:** stretch the mark, add effects, place on a busy background, colorize the squares differently
- **Do:** scale proportionally, pair with wordmark consistently, use only in `--brand-primary` (no other colors)

### 2.6 Favicon & app icons

- 32×32 and 16×16 favicon: stacked 3-square mark only
- Apple touch icon 180×180: mark centered on `--surface-base` background with 48 px padding
- OG image 1200×630: lockup (mark + wordmark) on `--surface-base`, emerald gradient accent in bottom-right, tagline "Built for sustainability engineers."

---

## 3. Landing Page Architecture

(Full spec is in `page-design-prompts.md` section 1. Here's the architectural summary.)

**Route:** `/` (replaces current redirect to `/auth/login`)
**Auth state:** public, no token required
**SSR strategy:** fully server-rendered with zero client JS on the critical path
**Dynamic elements** (the 3 requires-client sections): FAQ accordion, scroll fade-in, sticky-nav backdrop blur

### Sections (top → bottom)

1. **Sticky nav** (64px, dark, backdrop-blur on scroll)
2. **Hero** (full-viewport, dark gradient, headline "Built for sustainability engineers. Not greenwash.", primary + secondary CTA, trust strip, product screenshot)
3. **Three-method comparison strip** (real numbers from demo DB: 126.82 / 72.37 / 70.36)
4. **Feature grid** (6 cells: process hierarchies / methods / region-aware / cost×impact / PDF reports / open data)
5. **How it works** (3 steps horizontal)
6. **Comparison vs alternatives** (feature table vs SimaPro/openLCA/GaBi)
7. **FAQ** (6 items, accordion)
8. **Final CTA** (full-width dark band)
9. **Footer** (4-col on desktop, 1-col mobile)

### Data sources

- Product screenshot in hero: pre-rendered PNG at `public/screenshots/results-hero.png` (regenerated manually when results UI changes)
- Method comparison numbers: static for now (later: `/api/demo/results` read-only endpoint)
- All other content: static in JSX

### SEO

- `<title>`: "LCAPIX — Built for sustainability engineers"
- `<meta description>`: "Run life-cycle assessments with cost and environmental impact in the same view. CML, ReCiPe, TRACI methods. Free tier available."
- OpenGraph + Twitter cards with OG image
- JSON-LD SoftwareApplication schema
- `<link rel="canonical">`

---

## 4. Information Architecture

### 4.1 Public routes

| Route | Title | Purpose |
|-------|-------|---------|
| `/` | Landing | Marketing entry point |
| `/about` | About | Company + methodology explainer |
| `/guide` | Guide | Docs + tutorials |
| `/auth/login` | Log in | Authentication |
| `/auth/signup` | Sign up | Account creation |

### 4.2 Authenticated routes

| Route | Title | Purpose |
|-------|-------|---------|
| `/home` | Dashboard | Project list + activity |
| `/project/new` | New Project | Project creation form |
| `/project/[id]` | {Project name} | Project overview w/ case tabs |
| `/project/[id]/analytics` | Analytics | Multi-case dashboard |
| `/project/[id]/comparisons` | Comparisons | Case comparison selector |
| `/project/[id]/comparisons/[id]` | {Comparison name} | Side-by-side comparison |
| `/project/[id]/case/[id]` | {Case name} | Case editor (3-pane IDE) |
| `/project/[id]/case/[id]/results` | Assessment Results | Dashboard of results |
| `/project/[id]/case/[id]/component/new` | New Component | Component form |
| `/project/[id]/case/[id]/component/[id]/edit` | Edit Component | Same form, edit mode |
| `/admin/integrations` | Integrations | Admin: factors, rates, keys |

### 4.3 Global navigation

**App top bar** (56px, sticky, on all authenticated pages):
- Logo → `/home`
- Primary nav: `Projects` · `Library` · `Integrations` · `Docs`
- Global search (`Cmd+K`) with command palette
- User avatar → dropdown (Account · Theme · Logout)

**Landing top bar** (64px, separate from app bar):
- Logo
- `Product` · `Pricing` · `Docs` · `Changelog`
- `Log in` link + `Sign up →` button

**Breadcrumbs:** every page below `/home` has breadcrumbs below the app bar.

---

## 5. Component Polish Rules

### 5.1 Buttons

Primary (emerald, solid):
```
height: 40px (standard) / 44px (auth) / 48px (landing hero)
padding-x: 24px / 28px / 32px
radius: --radius-md
font: Inter Tight 500, 14/15/15 px
background: --brand-primary
color: --brand-fg-on-brand (near-black)
hover: --brand-hover
disabled: opacity 0.5 + pointer-events: none
```

Secondary (outlined):
```
background: transparent
border: 1px --border-strong
color: --text-primary
hover: --surface-overlay bg
```

Ghost (text-only):
```
background: transparent
color: --text-secondary
hover: --text-primary + --surface-overlay bg
```

**Forbidden:** pill-shaped buttons (except badges), gradient fills, 3D shadows.

### 5.2 Inputs

```
height: 36px
padding: 8px 12px
radius: --radius-sm
border: 1px --border-subtle
background: --surface-base
color: --text-primary
placeholder: --text-tertiary
focus: --border-focus 2px ring
error: --signal-error border + red helper text below
disabled: opacity 0.5
```

Textareas: same spec but `min-height: 80px`.

### 5.3 Cards

```
background: --surface-raised
border: 1px --border-subtle
radius: --radius-md
padding: 16px (compact) / 24px (standard) / 32px (hero)
hover (if interactive): --border-strong + --shadow-md, 150ms transition
```

### 5.4 Badges

```
height: 20px
padding-x: 8px
radius: --radius-pill
font: Inter Tight 500, 11px, uppercase, tracked +0.05em
variants:
  - default: --surface-overlay bg, --text-secondary fg
  - success: --signal-success bg at 0.15 opacity, --signal-success fg
  - warn, error, info: same pattern
```

### 5.5 Tables

```
header row: 40px tall, --surface-overlay bg, --text-tertiary fg, 11px uppercase
data row: 44px tall, bottom border 1px --border-subtle
hover row: --surface-overlay bg
number columns: text-align right, font-mono, tabular-nums
sticky header when scrolling
zebra stripes: NOT used (cleaner without)
```

### 5.6 Modals / Dialogs

```
backdrop: oklch(0 0 0 / 0.75) with backdrop-blur-md (8px)
panel: --surface-raised, radius --radius-lg, --shadow-overlay
max-width: sm/md/lg/xl/2xl sizing options
close X button: 24px icon, top-right, --text-tertiary → --text-primary on hover
ESC key closes
click outside closes (unless form is dirty)
focus trap enforced
```

**Fix from current state:** modals must cover the parent surface completely — no z-index bleed-through of the top nav. Modal root portal to `document.body` with `z-index: 100`.

### 5.7 Toasts

```
position: bottom-right, 24px from edges
width: 360px max
height: auto, min 56px
background: --surface-overlay
border-left: 4px solid (brand for default, signal for typed)
auto-dismiss: 5s for success/info, manual only for error
stack: up to 3 visible, rest queued
```

### 5.8 Forms

- Inline labels above inputs (not floating)
- Required asterisk in `--signal-error`
- Helper text below input in `--text-tertiary` 12px
- Error text replaces helper, in `--signal-error`
- Submit on `Cmd/Ctrl+Enter` from any field
- Disable submit until valid; show per-field errors on blur, not on every keystroke

### 5.9 Charts (Recharts + shadcn)

- Axis labels: 11px `--text-tertiary`, IBM Plex Mono
- Data labels: 12px `--text-secondary`, mono
- Gridlines: 1px `--border-subtle`, dashed
- Emerald is always the primary series; rotate through chart-2 through chart-5 for additional series
- Tooltip: `--surface-overlay` bg, `--shadow-md`, mono for values
- Legend: bottom, `--text-secondary`, clickable to toggle series
- Empty state: mini icon + "No data to display"

---

## 6. Responsive Strategy

### 6.1 Breakpoint matrix

| Page type | <640 | 640-1023 | 1024-1279 | ≥1280 |
|-----------|------|----------|-----------|-------|
| Landing | 1-col everything, hamburger nav, sticky bottom CTA | 2-col feature grid, shrink hero H1 | 3-col feature grid, full hero | Max-width 1280 |
| Auth | Form only (right pane hidden) | Form only | Split view | Split view |
| Home | 1-col projects, scroll KPI row | 2-col projects | 3-col projects, sidebar hidden | 3-col + sidebar |
| Project detail | Tabs scroll horizontal, panes stack | Panes stack | 60/40 panes | 60/40 panes |
| Case editor | List view only (canvas hidden) | List + inspector drawer | 3-pane IDE | 3-pane IDE |
| Results | Full-width charts, data table → card list | Stacked charts | 8/4 grid | 12-col grid |
| Component form | Single col form | Single col form, wider | Max-width 720 centered | Max-width 720 centered |
| Analytics | Charts stack full-width | Charts stack | 2-col | 12-col grid |
| Admin | Subnav tabs horizontal scroll, cards stack | Cards 2-col | Cards 4-col | Full table |

### 6.2 Patterns for narrow viewports

- **Drawer navigation:** top bar → hamburger → slide-in left drawer with nav
- **Stacked forms:** side-by-side fields stack with 12px vertical gap
- **Mini-charts:** Recharts `ResponsiveContainer` + reduced-density axes
- **Card-list fallback:** any table becomes a vertical list of summary cards below `md`
- **Sticky bottom CTA:** on landing and long forms, a single primary CTA pinned to bottom
- **Horizontal scroll:** tabs, KPI strips, and breadcrumbs become horizontally scrollable with right-edge fade

### 6.3 Touch targets

Minimum 44×44 px hit area for any interactive element on touch devices. Applies to: buttons, icon-only controls, table row actions, tab pills, sidebar items.

---

## 7. Accessibility Baseline

- WCAG 2.1 AA compliance minimum. The high-contrast theme option (already in `globals.css`) handles AAA on demand.
- Color contrast: ≥4.5:1 for body text, ≥3:1 for large text and UI components, verified via browser DevTools
- Keyboard: every interactive element reachable via Tab. Focus visible with `--border-focus` 2px ring and 2px offset
- Semantic HTML: `<nav>`, `<main>`, `<section>`, `<article>` — not `<div>` soup
- ARIA: only where HTML semantics fall short. `aria-label` on icon-only buttons. `aria-describedby` linking inputs to error text. Modals have `role="dialog"` + `aria-modal="true"` + `aria-labelledby`
- Motion: respects `prefers-reduced-motion` — all transitions drop to 0.01ms
- Form errors: live region announces the summary when validation fails on submit
- Screen reader pass: test on VoiceOver (macOS) for the critical flows (auth, create project, run assessment, export PDF)

---

## 8. Dark & Light Modes

Dark mode is the default (matches the Data Cool aesthetic).

### 8.1 Theme switcher

Already present as `components/theme-toggle.tsx`. Keep the 3-state cycle: Light → Dark → System.

### 8.2 Light mode translation

Not a full redesign — a token-level flip. Light mode defines:

```css
.light {
  --surface-base:    oklch(0.99 0.002 240)    /* near white */
  --surface-raised:  oklch(0.97 0.004 240)    /* off-white card */
  --surface-overlay: oklch(0.94 0.006 240)    /* hover state */
  --text-primary:    oklch(0.15 0.016 240)    /* slate-900 */
  --text-secondary:  oklch(0.35 0.022 240)
  --text-tertiary:   oklch(0.55 0.024 240)
  --text-disabled:   oklch(0.72 0.018 240)
  --border-subtle:   oklch(0.88 0.008 240)
  --border-strong:   oklch(0.72 0.015 240)
  /* Brand + signals + charts stay the same (tuned L in definitions) */
}
```

### 8.3 Per-mode preferences

- Screenshots used in the landing page: dark mode only (that's the marketing look)
- Charts: same colors both modes — chart-1 through chart-5 keep their luminance ~0.73 which works on both surfaces
- PDF export: currently light mode only (paper-friendly); keep this

---

## 9. Key UX Fixes (what changes in interactions, not just visuals)

1. **AuthGuard hydration race** (already fixed in commit `79e6c0e`) — wait for Zustand to hydrate before redirecting.
2. **Project cards actually clickable** (already fixed) — was a SQL bug in `GET /api/projects/[id]`.
3. **Run Assessment modal** (already built in Phase 1) — method + region selector.
4. **Process hierarchy modal** — rebuilt: fullscreen overlay, no more bleed-through, visible close X, zoom + search + export controls.
5. **Case tree canvas** — list view fallback below `md` with toast explaining why. No more "tree unusable on phone."
6. **Component editor** — segmented control for type replaces the unclear dropdown. Parent field is aware of valid parent types for the selected type.
7. **Auto-save indicators** — every edit-in-place input shows a tiny "Saved 2s ago" below, debounced 800ms.
8. **Command palette** — `Cmd+K` from anywhere. Search projects, cases, components, substances; navigate; trigger actions ("Run assessment", "Export PDF", "Toggle theme").
9. **Keyboard shortcut overlay** — `?` shows a cheatsheet modal listing all global and page-specific shortcuts.
10. **Empty states** — every zero-data view has a deliberate empty state with a clear CTA, not a blank region.

---

## 10. Typography System Examples

### Page title pattern
```
PROJECT
{Name in 28/1.2 Inter Display 600 primary}
{Short description in 14/1.5 Inter Tight 400 secondary}
```

### Metric card pattern
```
TOTAL IMPACT          <- 11px tracked uppercase, --text-tertiary
74.75                 <- 40px Plex Mono 600, --brand-primary
kg CO₂-eq             <- 12px Inter Tight 400, --text-secondary
↑ 2.3% vs last run    <- 11px Inter Tight 500, signal color
```

### Data table row pattern
```
Oven Heating Task      Global Warming      13.12   kg CO₂-eq
^ Inter Tight 500      ^ Inter Tight 400   ^ Mono  ^ Plex Mono
  primary                secondary          600     400, tertiary
```

---

## 11. Success Criteria

After implementation, the following must be true:

1. **Brand consistency:** every page uses only the defined token values. No arbitrary hex colors or font sizes in new code.
2. **Responsive:** every authenticated page passes a manual audit at widths 375, 768, 1024, 1440 without horizontal scroll or broken layout.
3. **Landing page:** `/` shows a real landing page (not a redirect). Lighthouse score ≥90 in Performance, ≥95 in Accessibility.
4. **Tests:** current 84 tests stay green. Add visual regression for landing page and auth flow (optional).
5. **Accessibility:** no WCAG AA contrast failures. All interactive elements focusable.
6. **Modal fixes:** the process hierarchy modal no longer bleeds through the top nav. Close X is always visible.
7. **Perceived polish:** a user who hasn't seen the app before says "this looks like a real product" within 5 seconds of hitting `/`.

---

## 12. Out of scope (explicit list to prevent creep)

- ECP Library (Phase 2 feature)
- Combined cost × environmental report (Phase 3)
- Team collaboration UI (project_members table exists but no UI yet)
- Stripe / billing integration
- Email notifications
- Audit log UI beyond the current log viewer
- Custom theme editor
- White-label support for resellers

These are intentionally deferred. Don't add any of them in this pass.

---

## 13. Dependencies (what this design doc assumes)

- Phase 1 API integration is complete (✅ done as of commit `14d28e5`)
- AWS RDS is populated with demo data (`john@lcaproject.com` / `Lcapix@guerry123`)
- Dev server runs on port 3002 with `pnpm run dev`
- Claude Preview tooling works for live UI verification during implementation

## 14. Next steps

1. **User builds mockups** in v0.app / Figma Make / Stitch / Lovable using prompts in `2026-04-13-page-design-prompts.md`
2. **User returns mockups** (PNG / Figma link / v0 URL)
3. **Implementation plan** (`2026-04-13-brand-redesign-implementation.md`, next doc) breaks the work into bite-sized tasks
4. **Execution** via subagent-driven development, one page at a time, each with TDD + visual verification
