# Case editor: Add-Component modal + Graph-view zoom fix

## Goals

1. The `/project/[projectId]/case/[caseId]/component/new` route renders the existing `<ComponentForm>` as a **centered modal overlay** instead of a full page. No separate full-page fallback — the route *is* the modal.
2. The Graph view's wheel zoom matches the Tree view: requires Ctrl/Cmd, swallows plain wheel, does **not** scroll the page.

## Out of scope

- Base & Comparative case creation stay as full-page screens (already triggered from the project detail page).
- `component/new` continues to be navigated to from the sidebar "Add Component" button — no change to the trigger.

## Implementation

### 1. Add-Component modal (`app/project/[projectId]/case/[caseId]/component/new/page.tsx`)

Wrap the existing `<ComponentForm>` in a modal shell:

- Fixed full-viewport backdrop (`rgba(0,0,0,0.45)`) — click to close.
- Centered card (max-width ~780px, max-height `calc(100vh - 96px)`), with the form body scrolling internally.
- Close button in the top-right; Esc to close; close → `router.back()` (falls back to case URL if history empty).
- `ComponentForm` saves as today; on success it already navigates to the case editor, which closes the modal.

Reuses `<ComponentForm>` unchanged — no changes to store contract, API calls, or validation.

### 2. Graph-view zoom (`components/lcapix/case/graph-view.tsx`)

Replace the React `onWheel` prop (passive, cannot `preventDefault`) with `useEffect` + native `addEventListener('wheel', handler, { passive: false })`, mirroring `tree-canvas.tsx:164-191`:

- Always `preventDefault()` to stop page scroll.
- Zoom only when `ctrlKey || metaKey` (including trackpad pinch on Chromium).
- Plain wheel is swallowed silently.
- Same delta math and clamp range as today.

## Risks

- Modal close via Esc/backdrop must navigate back, otherwise the URL is stuck at `/component/new`.
- `ComponentForm` renders a sticky bottom action bar — inside the modal it needs to sit at the bottom of the modal card, not the viewport.
