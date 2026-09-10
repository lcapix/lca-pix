# Auth hero redesign — MontageHero

**Date:** 2026-06-02
**Status:** Shipped to `lcapix.vercel.app`

## Summary

Replace the static "Compare any two ways of making anything" panel on `/auth/login` and `/auth/signup` with an animated, scenario-cycling hero (`MontageHero`) that conveys breadth — same product, four different LCA trade-offs.

## Scope

- `components/lcapix/auth/auth-shell.tsx` — full rewrite of the `BrandPane` → `MontageHero`
- `app/auth/login/page.tsx`, `app/auth/signup/page.tsx` — no change (they pass `children` only)
- `/auth/onboarding` — out of scope (per user)

## Design

### Scenarios (4)

| # | Base | Alternative | Δ CO₂ | Δ Cost | Flavor |
|---|------|-------------|-------|--------|--------|
| 1 | Steel bracket (2.010 kg CO₂-eq) | Aluminum (3.406) | +69% | −18% | Lighter material, heavier footprint. |
| 2 | PET bottle (0.082) | HDPE (0.071) | −13% | −11% | Same shelf, smaller footprint. |
| 3 | Air freight (2.100 kg/tkm) | Sea (0.012) | −99% | −94% | Eighteen extra days, ninety-nine fewer percent. |
| 4 | Fossil PE (1.900) | Bio-based (−0.500) | −126% | +42% | Carbon negative on the bag, three times the land use. |

Scenario 1 is anchored to the manual-test runbook so returning customers recognise it.

### Visual treatment

- **Aurora background**: three radial-gradient blobs animated independently (18s / 22s / 26s) with `filter: blur(80–90px)`. GPU-cheap, CSS-only.
- **Dot-grid overlay**: 1px dots at 24px spacing with a radial mask so it's sharp under the cards and dissolves at edges.
- **Noise texture**: inline 600-byte SVG `feTurbulence`, 4% opacity, `mix-blend-mode: overlay`. Kills banding.
- **Edge vignette**: 120px inset shadow for "framed window" feel.
- **Glassmorphic cards**: `backdrop-blur(18px) saturate(140%)` over `surface-raised` mixed with transparent. Subtle inner highlight + green-tinted drop shadow.
- **Accent strip** down the left edge of each card: brand green on Base, amber on Alternative.
- **Number tweening**: rAF `useCountUp` hook eases CO₂ + cost + Δ% values to their new targets in 700ms. No animation library.
- **Headline morph**: per-scenario headline ("Steel or aluminum?" → "PET or HDPE?") with 480ms fade-up.
- **Dot indicator**: active dot is a 28px pill, inactive are 8px circles, animated `width` transition.
- **Reduced-motion**: all keyframes disabled via `@media (prefers-reduced-motion: reduce)`.

### Cadence

- Scenario auto-advances every 5s.
- Hover anywhere on the panel pauses rotation.
- Clicking a dot jumps to that scenario.

### Performance budget

- One file rewrite, no new dependencies.
- Aurora is 3 CSS keyframes, dot-grid is one `background-image`, noise is inline SVG.
- `useCountUp` is ~25 LOC, vanilla rAF.

## Out of scope (deferred)

- Form-side polish (Section 2 of the brainstorm) — user wanted the hero only.
- `/auth/onboarding` — kept its current look.
- Dark mode pass — uses existing CSS variables, will inherit theme automatically. The aurora deepens in dark mode via the `color-mix(...)` fallback in the panel background.

## Verified

- `pnpm exec tsc --noEmit`: no new errors.
- `pnpm build`: succeeds.
- `pnpm deploy:prod`: live on `lcapix.vercel.app`.
