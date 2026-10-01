# Browser tests (Playwright)

`tests/e2e` drives the real app in Chromium: user journeys, contract tests for the hooks the redesign must keep, a screenshot baseline of every screen, and an accessibility baseline. Every run builds its own database from nothing and drops it afterwards, so it needs no dump and never touches the database `.env.local` names.

```
playwright.config.ts
tests/e2e/
  routes.json            every screen in CLAUDE_DESIGN_BRIEF §4, on seeded ids
  journeys/*.spec.ts     user flows F1–F14 (docs/flows/USER_FLOWS.md)
  contracts/*.spec.ts    test ids, accessible names, tour anchors (guardrails §4)
  visual/*.spec.ts       screenshot baseline → __snapshots__/visual/*-<platform>.png
  a11y/*.spec.ts         axe baseline → a11y/baseline.json
  support/               server, seed, fixtures and helpers
  fixtures/              the import CSV; font-cache/ for Google Fonts
```

## Running it

You need what `pnpm test:db` needs (docs/testing/DATABASE_TESTS.md): a local MySQL 8.0+ on 127.0.0.1, the `mysql` client on `PATH`, and a user that can create and drop databases, in the environment or `.env.local`. Then, once:

```bash
pnpm install
npx playwright install chromium   # the browser that matches @playwright/test
```

| Command | What it runs |
|---|---|
| `pnpm e2e` | journeys + contracts |
| `pnpm e2e:visual` | the screenshot baseline, compared pixel for pixel |
| `pnpm e2e:update` | rewrites the screenshot baseline |
| `pnpm e2e:a11y` | axe on every screen, compared with `a11y/baseline.json` |
| `pnpm e2e:a11y:update` | rewrites `a11y/baseline.json` (two passes) |
| `npx playwright test tests/e2e/journeys/compare.spec.ts` | one file (any project) |
| `npx playwright test --project=journeys -g "F9"` | tests whose title matches |

A run takes one to two minutes before the first test: building the database (3 s), starting `next dev`, seeding (10 s) and opening every route once so Next compiles it (60–100 s). `E2E_WARM=0` skips the warm-up; the first test to open each page then pays for its compile.

### What a run does

1. **webServer** `tests/e2e/support/serve.mjs`:
   - drops `lcapix_t_e2e_*` databases left by runs killed more than 3 hours ago;
   - builds `lcapix_t_e2e_<time>_<hex>` with `scripts/db/fresh.mjs` (baseline + every migration). Only 127.0.0.1 / localhost / ::1 are accepted;
   - starts `next dev -p 3120` on it, with every third-party key blanked and `block-outbound.cjs` preloaded. The server can reach this machine and Google Fonts (next/font) and nothing else: Hugging Face, Google OAuth, BLS/EIA/metals, PubChem, Upstash and the rest fail fast.
2. **globalSetup** seeds the shared world through the app's own API (`support/seed.ts`), writes one storage state per seeded user, and opens every route in a browser.
3. The tests run. The browser may load `http://localhost:3120` only (`support/net.ts`); any other request is aborted.
4. **globalTeardown** drops the database. The server's own shutdown drops it too, so nothing is left even if one of them is killed. Check with `node --env-file=.env.local scripts/db/fresh.mjs --list`.

Everything a run writes — seed state, results, traces, the HTML report — goes to `$TMPDIR/lcapix-e2e-3120/` (or `E2E_ARTIFACTS_DIR`), **outside the repo**. Tailwind v4 watches the whole project tree: a file written inside it makes `next dev` rebuild and every open page refetch itself mid-test.

### The seeded world

Built in a fixed order on an empty database, so ids and names are the same every run.

| Who | What |
|---|---|
| **Olivia Owner** (`owner@e2e.lcapix.test`) | **P1** "Example: painted steel bracket" (worked example, TRACI 2.1 / US): base case **C1** with run R1 (1.72 kg CO2 eq), comparative **C2** "Painted steel bracket (lighter blank)" (duplicate, steel 0.8 → 0.6 kg) with run R2. **P2** "Five-tier bicycle frame" (CML 2001 / Global): case **C5** Product → Machine/Line → Subprocess → Operation → Elemental task. |
| **Victor Viewer** | viewer on P1, not a member of P2 |
| **Emma Empty** | onboarded, no projects (the empty dashboard) |
| **Nico Newcomer** | signed up, not onboarded (the onboarding page) |

Passwords are random per run and exist only in the run's state directory. Journeys that change data never use this world: each signs up its own account through the API (`newUser()`), loads its own worked example, and signs in with `signIn()`.

### Fast loop while writing a test

```bash
node tests/e2e/support/serve.mjs            # terminal 1: server + fresh DB (Ctrl-C drops it)
E2E_REUSE=1 npx playwright test --project=journeys -g "F7"   # terminal 2, as often as you like
```

With `E2E_REUSE=1` the config attaches to that server, global setup seeds it once and reuses the seed afterwards, and teardown leaves the database alone.

Other switches: `E2E_SERVER_LOG=1` (show the dev server's stdout), `E2E_KEEP_DB=1` (keep the database after the run), `E2E_PORT` (default 3120), `E2E_OFFLINE=1` (never fetch a font that is not cached), `A11Y_DEBUG=1` (print every axe target).

## The suites

### Journeys (`journeys/`) — does the product still work?

| File | Protects |
|---|---|
| `auth.spec.ts` | F1 sign up → onboarding → home; onboarding validation; F2 wrong password shows the "Login failed" toast; log in; log out clears the session |
| `worked-example.spec.ts` | F4b: the worked example runs from the empty dashboard to "1.72 kg CO2 eq" (PROJ-1) |
| `case-editor.spec.ts` | F6 Add Component dialog, product quantity through the scale dialog, a step's life-cycle stage (EDIT-2), delete subtree / keep children / cancel (EDIT-1); F7 a flow and a transport leg (382.5 tkm); F8 a cost of 0 stays 0, a cleared cost goes empty (FLOW-3) |
| `results.spec.ts` | F9 run → total, thousands in the stage panel (RES-1), 3.5e-7 never shown as 0 (RUN-2); F10 PDF / PPTX / CSV downloads |
| `compare.spec.ts` | F12 "Duplicate and change one thing" → compare shows the unrun copy as "Incomplete — not ranked" |
| `import.spec.ts` | F13 routing CSV → preview → apply → the created case opens |
| `permissions.spec.ts` | a viewer reads; a viewer's save gets 403 and changes nothing; a non-member gets "Project not found" and is sent home |

Selectors are roles and accessible names (`getByRole`, `getByLabel`), so a journey also checks that its controls are reachable by name. Where an input has no accessible name the fallback (usually a placeholder) is named once in `support/editor.ts` or the test, with the reason; those inputs also show up in the a11y baseline under `label` / `select-name`.

**`test.fixme`** marks a journey the current UI cannot complete or that fails on a known bug. Each one says why. Today:

- `permissions.spec.ts` — a viewer still sees every edit control (no role-based UI).
- `case-editor.spec.ts` — switching steps while a save is still reloading writes the previous step's fields onto the new step (`app/project/[projectId]/case/[caseId]/page.tsx:703-704`). The test delays the reload, so it reproduces every time: turn it back into `test(...)` to check a fix.

### Contracts (`contracts/`) — do the hooks survive the redesign?

`hooks.spec.ts` pins what `docs/design-revamp/00-guardrails.md` §4 promises: `data-testid="tree-canvas-viewport"` / `"tree-canvas-stage"` (and `data-node-id` on nodes), the accessible names scripts and the guide use, every `data-tour` anchor in `lib/lcapix-tour-steps.ts`, and the landing walkthrough anchors. Names match case-insensitively with an optional leading "+" and trailing "→"; a spelling that differs only in case is recorded as an annotation.

Known gaps, kept visible rather than hidden:

- `test.fail`: the view tab is "Plot" (guardrails: "Graph", P04); the tier radiogroup is "Component type" (guardrails: "Process tier"); Graph view nodes clip their names to 2 px and carry `data-node` instead of `data-node-id`.
- `test.fixme`: the six tour anchors P11 adds (`case-add-component`, `case-flow-input`, `case-suggest-costs`, `case-run-assessment`, `results-total-impact`, `results-magic-insights`). A new selector in the tour file fails the classification test until it is listed.

### Visual baseline (`visual/`) — did anything move?

Every route in `routes.json` plus the interactive states in `support/states.ts` (editor Tree / List / Graph, inspector open, Add component dialog, Magic Insights), full page, at 1440×900, 1024×768 and 390×844: 140 committed screenshots (28 MB), plus one `fixme` (the component dialog cannot be opened at 390 px). Two runs, each on its own fresh server and database, matched 140/140. Pages taller than 10,000 px are captured down to 10,000 px (the library tables).

What keeps them identical run to run:

- a fresh database seeded in a fixed order; UTC, en-US, reduced motion, 1× scale, sRGB;
- CSS animations stopped and the caret hidden; the Next dev indicator and toasts hidden (`visual/screenshot.css`);
- relative times, dates, clock times and run numbers masked (`support/visual.ts`, `VOLATILE_TEXT`), plus Compare's run pickers; the browser clock is pinned to the seed time so "Updated just now" keeps the same width;
- the tree canvas re-fitted before capture (its first fit depends on when the strips above it finished loading);
- Magic Insights captured as its card, not the page (masks are painted above overlays);
- the sign-in hero, which rotates every 5 s regardless of reduced motion, paused on its first scenario by hovering it;
- `/api/insights` answered with the computed fallback;
- `settle()`: no `/api` call in flight, no spinner or skeleton, fonts loaded, React hydrated, and the layout (canvas fit, chart sizes) unchanged across three samples.

**Updating.** Run `pnpm e2e:update`. It writes the new images outside the repo and copies them into `tests/e2e/__snapshots__/` when the run ends (a file written inside the tree mid-run makes `next dev` rebuild under the other workers). Then open the changed PNGs (`git status tests/e2e/__snapshots__`, then look at each one) and commit only intended changes, listing them in the commit body. A failed comparison leaves `-actual`, `-expected` and `-diff` images in the results directory; `npx playwright show-report "$TMPDIR/lcapix-e2e-3120/report"` shows them side by side when the HTML reporter is on (CI).

**Platform.** Snapshot names end in the platform (`-darwin`, `-linux`). The committed baseline is macOS. Text renders differently on Linux, so CI cannot compare against it; see [CI](#ci).

### Accessibility baseline (`a11y/`) — did it get worse?

axe-core (WCAG 2.0–2.2 A/AA and best practice) on the same 47 screens at 1440×900. `baseline.json` holds, per screen, how many elements break each rule. A test fails when a count rises or a new rule appears; fewer violations pass with an annotation asking you to lower the baseline. Toasts and the dev overlay are left out.

`pnpm e2e:a11y:update` runs every screen twice and keeps the higher count per rule (a canvas still fitting can hide a node from axe), writes `baseline.json` and prints the top rules. Commit the new baseline only when the counts went down, or when a change that raised one was intended and reviewed.

Starting point (2026-09-30): 47 screens, 1,084 elements. `region` 903, `color-contrast` 73, `landmark-one-main` 38, `landmark-unique` 19, `label` 15 (critical), `select-name` 10 (critical), `target-size` 9, `page-has-heading-one` 7, `heading-order` 5, `link-in-text-block` 4, `landmark-no-duplicate-banner` 1.

## Adding things

**A journey.** Add a `test` to the right file in `journeys/` (or a new `*.spec.ts`). Start from your own data:

```ts
import { openCase, selectComponent, workedExample } from '../support/editor';
import { expect, test } from '../support/fixtures';

test('F7 delete a flow', async ({ api, newUser, signIn }) => {
  const user = await newUser('flow-delete');            // onboarded, own account
  const { projectId, caseId } = await workedExample(api, user);
  const { page } = await signIn(user);
  await openCase(page, projectId, caseId);
  await selectComponent(page, '20. Weld tab');
  // …drive the UI by role and name; assert on what the user sees, and on the
  // API (api.as(user.token).get(...)) for what was stored.
});
```

For read-only checks on the seeded world, `test.use({ storageState: storagePath('owner') })` and read ids from the `seed` fixture. Wait on the response you expect (`page.waitForResponse`) rather than on time; `open()` / `settle()` handle loading.

**A screen.** Add it to `routes.json` (with a `ready` text and, if it redirects by itself, `landsOn`), or to `STATES` in `support/states.ts` if it needs a click. Then `pnpm e2e:update` and `pnpm e2e:a11y:update`, and review both diffs.

**Review screenshots for people.** `scripts/capture-review.mjs` takes the same route list from a local dev server, signed in as a local test account whose credentials come from `LCAPIX_REVIEW_EMAIL` / `LCAPIX_REVIEW_PASSWORD` (or `.env.test.local`). It refuses any base URL that is not `http://localhost`, `127.0.0.1` or `[::1]`, and blocks every other origin in the browser. Ids come from `LCAPIX_REVIEW_IDS` or are looked up through the API.

```bash
LCAPIX_REVIEW_EMAIL=… LCAPIX_REVIEW_PASSWORD=… node scripts/capture-review.mjs --base=http://localhost:3002 --out=review-screens
```

**A seeded object.** Extend `support/seed.ts`, through the API only, at the end of the existing sequence so earlier ids do not shift (they appear in URLs and snapshots).

## CI

The `e2e` job in `.github/workflows/deploy.yml` runs on pull requests: a `mysql:8.0` service, the `mysql` client, `npx playwright install --with-deps chromium`, then `pnpm e2e` and `pnpm e2e:a11y`. It is not a dependency of `deploy`; make it required in branch protection to block merges. The results directory is uploaded as an artifact when the job fails.

The accessibility baseline was recorded on macOS. axe's counts come from the DOM and computed colours rather than from font rasterisation, and the canvas is re-fitted before each audit, so Linux should match; if the first CI run disagrees on a screen, download the `e2e-results` artifact (its `a11y/` folder has every finding) and compare before touching the baseline.

The visual job (`e2e-visual`) is optional and non-blocking (`continue-on-error`). Font rasterisation on Linux differs from macOS, and the app's `Inter` resolves to a system font (see below), so the macOS baseline cannot be compared there. The job runs with `--update-snapshots=missing` and uploads the generated `*-linux.png` files: commit a set from a trusted run to give CI its own baseline, after which the job compares against it.

## Things these tests found

- **Data loss in the inspector** — `handleSaveComponent` refills the form for the node that was selected when Save was clicked, after an `await` (`app/project/[projectId]/case/[caseId]/page.tsx:703-704`, via `applyScale` at `:612`). Switch steps during that reload and the next Save writes the previous step's name, type and parent onto the new one. After a product rescale this turns "20. Weld tab" into a second root "Painted steel bracket" product.
- **Google Fonts never load** — the `@import` in `app/lcapix.css:5` ends up in the middle of the bundled `layout.css` (after other rules), where browsers ignore it. `--font-ui: 'Inter'` and `'IBM Plex Mono'` fall back to system-ui / the next/font faces, so the UI renders differently per OS.
- **Graph view shows no names** — nodes are 54 px tall (`components/lcapix/case/graph-view.tsx:29`, used at `:293`) but hold three rows, so the name row is squeezed to 2 px. They also carry `data-node`, not `data-node-id` (`:286`).
- **Phone layouts** — at 390 px the sign-in pages are 489 px wide and the project workspace and results 481 px (horizontal scroll); the case editor has no phone layout, and its node-details strip covers the outline so "Add Component" cannot be clicked.
- **Sign-in hero ignores reduced motion** — `components/lcapix/auth/auth-shell.tsx:166-170` rotates every 5 s with no play/pause control (WCAG 2.2.2).
- **Unlabelled controls** — onboarding fields (`app/auth/onboarding/page.tsx`, `Field` renders a `<label>` with no `htmlFor`), the component form and add-flow inputs, the import page's selects, the class page's role select, the inspector's Unit/Name inputs; the results page's Method and Region selects are named by their help buttons ("What is an impact-assessment method?"). Inspector section headers are buttons without `aria-expanded`.
- **Project workspace** — the "Comparing … −28.0% CO₂ · +$240" banner is still hard-coded (Compare says −22.1% for the same cases, and there is no cost data); the "Edit" link wraps a button (nested interactive). At 390 px the home page's greeting is squeezed into a narrow column behind its buttons and the project cards run off the right edge.
- **Graph view tab** — labelled "Plot", not "Graph"; the Add Component tier radiogroup is named "Component type", not "Process tier" (guardrails §4).
