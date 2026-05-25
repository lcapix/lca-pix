# LCAPIX v3 — Premium Polish Design

**Date:** 2026-05-21
**Author:** Brainstormed with Kavish
**Scope:** Layered animation + loading-state polish across the app to make it feel premium without bloating bundle size.

---

## Goals

1. Replace every visible spinner with a skeleton screen that matches final layout.
2. Add subtle motion on every interactive element so the app feels alive.
3. Make the "Run Assessment" completion a flagship moment.
4. Keep bundle lean — no Framer Motion; CSS animations + tiny custom hooks only.
5. Respect `prefers-reduced-motion`.

---

## Non-Goals

- No animated illustrations (Lottie/After Effects).
- No physics-based spring libraries.
- No animated page-to-page transitions that block navigation perceived latency >150ms.

---

## Architecture

### Animation primitives layer

A single CSS file additions to `app/lcapix.css` defining reusable keyframes:

- `@keyframes fadeSlideUp` (4px translateY + opacity)
- `@keyframes shimmer` (background-position sweep)
- `@keyframes pulseRing` (scale + opacity)
- `@keyframes drift` (slow gradient rotation, 60s)
- `@keyframes badgePop` (1 → 1.05 → 1)
- `@keyframes successGlow` (radial expand + fade)

Plus utility classes:
- `.skeleton` — base shimmering placeholder
- `.lift-hover` — applies translateY(-2px) + shadow on hover
- `.press-active` — applies scale(0.97) on `:active`
- `.reveal-on-mount` — uses IntersectionObserver-based hook for fade-in-on-scroll
- `@media (prefers-reduced-motion: reduce)` — disables transforms / keyframes globally

### Custom React hooks

Two tiny hooks in `lib/hooks/`:

1. **`useCountUp(target, duration)`** — animates a number from 0 → target using `requestAnimationFrame` with an ease-out curve. Returns a string formatted to the same precision as the target.
2. **`useReveal()`** — returns a ref. Adds an `is-revealed` class when the element enters the viewport. Used for tree node entry + scroll-triggered fades.

### Route progress bar

A top-of-page `<RouteProgressBar />` component mounted in `app/layout.tsx`. Uses Next.js `usePathname` to detect changes and animate a 2px green bar from 0% → 80% over 200ms on navigation start, completes to 100% + fades when the new page renders. CSS-only.

### Skeletons

For each fetched list/card we add a `<*Skeleton />` variant rendered while `isLoading`:

- `<ProjectCardSkeleton />` — used in `/home`
- `<CaseCanvasSkeleton />` — used in case editor
- `<AssessmentResultsSkeleton />` — used in results page
- `<IntegrationsTableSkeleton />` — used in admin/integrations

Each skeleton matches the dimensions of the final content so there's zero layout shift on data arrival.

---

## Component-level animations

### Bucket 1 — Loading states

| Location | Replace | With |
|---|---|---|
| Home page initial load | Spinner div | `<ProjectCardSkeleton />` × 6 grid |
| Project page initial load | Spinner div | Header skeleton + `<CaseCanvasSkeleton />` |
| Case editor initial load | Spinner | Three-pane skeleton (sidebar + canvas + inspector) |
| Results page | Spinner | KPI strip skeleton + chart skeleton |
| Admin/integrations | "Loading…" text | Table skeleton |
| `<HeroMockup />` first paint | None | `bloom-in` + `useReveal` |

### Bucket 2 — Micro-interactions

| Element | Animation |
|---|---|
| All `.card` | `lift-hover` (translateY -2px + shadow up on hover, 140ms cubic-bezier) |
| All `.btn` | `press-active` (scale 0.97 on `:active`, 80ms) |
| Tree node entry on canvas | Fade + slide-up cascade by depth: each node `animation-delay = depth * 40ms` |
| Impact total numbers | `useCountUp` from 0 over 700ms on first reveal |
| Chip transitions (Tree/List/Plot tabs) | Sliding underline indicator using a single absolutely-positioned `<div>` whose left/width animates between tab bounds |
| Notification badge | `badgePop` on count increase |
| Bell icon | One-shot `pulseRing` when a new notification arrives |
| Top contributors progress bars | Width animates from 0 → final on reveal (600ms ease-out) |
| Toast (Sonner) | Default Sonner animation already good; just confirm not disabled |

### Bucket 3 — Page transitions & big moments

| Moment | Animation |
|---|---|
| Route change | `<RouteProgressBar />` top bar (200ms → 100% on render) |
| Modal entry | `scale(0.96) → 1` + `opacity 0 → 1` + backdrop `backdrop-filter blur(0) → blur(8px)` over 200ms |
| Modal exit | Reverse, 150ms |
| Tree expand/collapse in modal | `max-height` + opacity (300ms ease-out) |
| **Run Assessment complete (flagship)** | See dedicated section below |

### Bucket 4 — Background atmosphere

| Element | Animation |
|---|---|
| Landing hero `.botanical-atmosphere` | Slow `drift` keyframe rotating the gradient over 60s; barely perceptible |
| Final CTA `.veridian-glow` | Adds a slow pulsing scale (1 → 1.02 → 1 over 8s) |

---

## Flagship moment — Run Assessment completion

**Trigger:** when `handleAssessmentCompleted` fires on the results page.

**Sequence (total ~1.4s):**

1. **t=0ms** — Toast appears bottom-right.
2. **t=0ms** — On the impact total number element, dispatch a one-shot `successGlow` animation: a radial green-glow `::before` pseudo-element scales from 0 → 1.8 + opacity 0 → 0.45 → 0 over 900ms.
3. **t=200ms** — Old impact value crossfades out (180ms), new value crossfades in (180ms) and `useCountUp` animates from 0 → final over 700ms.
4. **t=400ms** — Each top-contributor bar resets to 0 width and re-animates to its new percentage (staggered 60ms each).
5. **t=900ms** — Magic Insights button gets a single `pulseRing` to draw attention to the next action.

All wrapped in a guard so it only fires for *new* completions, not on initial page load.

---

## Implementation order

Phase 1 — Foundation (must land first):
1. Add keyframes + utility classes to `app/lcapix.css`
2. Add `useCountUp` and `useReveal` hooks
3. Add `<RouteProgressBar />` and mount in layout

Phase 2 — Skeletons:
4. Build the four skeleton components
5. Wire into respective pages, replace existing spinners

Phase 3 — Micro-interactions:
6. Apply `.lift-hover` / `.press-active` globally to cards + buttons
7. Add tree-node entry stagger
8. Add `useCountUp` to impact totals
9. Replace tab chips with sliding indicator
10. Add badge pop + bell pulse

Phase 4 — Big moments:
11. Modal entry/exit animation
12. Tree expand/collapse smoothing in modal
13. **Run Assessment flagship sequence**

Phase 5 — Atmosphere:
14. Hero `drift`
15. Veridian-glow pulse

---

## Error handling / fallbacks

- Every animation gated on `prefers-reduced-motion: no-preference`. Inside `prefers-reduced-motion: reduce`, all transforms/keyframes become `none` and durations become `0.01ms` (preserves transitionend events).
- `useCountUp` returns the final value immediately if `prefers-reduced-motion: reduce`.
- `useReveal` adds `is-revealed` immediately (no observer) under reduced motion.
- Route progress bar is purely additive — failure mode is "no bar shows" which is identical to current behavior.

---

## Testing

Manual smoke tests per phase:
- Phase 1: navigate /home → /project/1 → /home, confirm progress bar.
- Phase 2: throttle network in DevTools, confirm skeletons appear and don't cause layout shift.
- Phase 3: hover every card type, press every button type, switch tabs, watch a notification arrive.
- Phase 4: complete a Run Assessment; verify the sequence.
- Phase 5: leave landing page open 30s; verify drift is barely visible (not nauseating).

No new unit tests — this is presentational. The animation hooks (`useCountUp`) get a vitest test for the value sequence with mocked `requestAnimationFrame`.

---

## Out of scope (deferred)

- Animated route transitions between pages (content fade-through). Adds complexity; revisit if user feedback asks for it.
- Cursor-following glow on hero CTA. Cool but marginal value; skip for now.
- Sound effects. Not happening.

---

## Approval

Brainstormed with Kavish 2026-05-21. Confirmed:
- All four buckets included
- Run Assessment moment is flagship
- Comp-case fallback handled separately (already shipped in the same session)
