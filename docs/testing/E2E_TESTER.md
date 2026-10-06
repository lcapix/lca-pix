# UI tests with e2e (TesterArmy)

`e2e-tester/` runs the core LCAPIX journeys in Chromium with [e2e](https://e2e.tester.army/docs), the TesterArmy runner. Every step is an exact check (`screen`, `expect`, `fetch` against the app's API): no `agent.*` step, no model, no cost. It sits beside the Playwright suite in `tests/e2e` (docs/testing/E2E_TESTS.md), which keeps the screenshot and accessibility baselines and the contract tests.

```
e2e-tester/
  package.json          its own package: e2e ^0.16.0, @e2e-dev/web ^0.11.2, playwright ^1.63.0
  pnpm-lock.yaml
  e2e.config.ts         target, timeouts, the app command
  support/serve.mjs     starts the app on a fresh database, warms it, then reports ready
  support/fixtures.ts   test, expect, describe; netGuard, api, newUser(), signIn()
  support/api.ts        HTTP client for the app's API (accounts, worked example)
  support/editor.ts     case-editor locators (outline, inspector, toasts)
  support/downloads.ts  where waitForDownload() put a file
  fixtures/             small-routing.csv for the import test
  tests/*.e2e.ts        the tests
  tests/bugbash/        known-failure repros (tag bugbash); none today
  .e2e/                 run output (gitignored): report.json, summary.md, failures/, artifacts/, logs/app.log
```

## Rules

These are the owner's rules for every project (his global CLAUDE.md), applied here:

- **Any web UI change gets an e2e test, and the tests pass on localhost before anything deploys.** Run `pnpm e2e:tester` before you merge a UI change; add or change a test in `e2e-tester/tests/` with it.
- **Exact checks only.** Use `screen`, `expect` and `fetch`. Do not add `agent.act` / `agent.assert` / `agent.waitFor` / `agent.extract` steps: they need a model key, and none is available (a Claude Max plan is not a supported e2e provider). The config declares no `agents`, so an agent step fails with `MODEL_UNAVAILABLE`. Add them only when the owner provides a model key.
- **Telemetry off.** `E2E_TELEMETRY_DISABLED=1` is set by `pnpm e2e:tester`, by the package's own scripts and by the CI job. If you call the CLI directly, set it yourself: `E2E_TELEMETRY_DISABLED=1 npx e2e …`.
- **Never run `npx e2e feedback`** without asking the owner first: it sends data to an outside team.
- **Live external data never gates a deploy.** Nothing here depends on it: the dev server can reach only this machine (and Google Fonts for next/font), the browser only localhost, and every account and project is made by the test itself. A future test that reads live data (BLS rates, EIA, a company's jobs) stays a local spot check, outside the gating run (give it a tag and `--exclude-tag` it).
- Localhost only: the app is `http://localhost:3150` on a throwaway database on the local MySQL. Never point the config at production, RDS or lca-pix.vercel.app.

## Running it

You need what `pnpm test:db` needs (docs/testing/DATABASE_TESTS.md): a local MySQL 8.0+ on 127.0.0.1, the `mysql` client on `PATH`, and a user that can create and drop databases, in the environment or `.env.local`.

| Command (from the repo root) | What it does |
|---|---|
| `pnpm e2e:tester` | installs `e2e-tester/` if needed, then runs every test except tag `bugbash` |
| `pnpm e2e:tester tests/class.e2e.ts` | one file (paths are relative to `e2e-tester/`) |
| `pnpm e2e:tester --grep "Students see"` | tests whose title matches |
| `pnpm e2e:tester --headed --workers 1` | watch it in a visible browser |
| `pnpm --dir e2e-tester exec e2e list` | what would run, without starting anything |
| `pnpm --dir e2e-tester typecheck` | `tsc` on the config, support and tests |
| `pnpm --dir e2e-tester test:e2e:bugbash` | only the known-failure repros |

The Chromium build e2e uses (Playwright 1.63) downloads on the first run if it is missing; `pnpm --dir e2e-tester exec playwright install chromium` fetches it up front. It is a different build from the one the Playwright suite pins (1.59.1); both live side by side in the Playwright cache.

A run takes about two minutes: about 50 s of startup (database, `next dev`, warm-up), then 17 tests on two workers.

### What a run does

1. The runner starts `node e2e-tester/support/serve.mjs` (the target's `app.command`), which:
   - runs the Playwright suite's server, `tests/e2e/support/serve.mjs`, with `E2E_PORT=3150`: it builds `lcapix_t_e2e_<time>_<hex>` with `scripts/db/fresh.mjs` (baseline + every migration; 127.0.0.1 / localhost / ::1 only), starts `next dev -p 3150` on it with every third-party key blanked and `block-outbound.cjs` preloaded, and drops the database when it stops. It also drops `lcapix_t_e2e_*` databases left by runs killed more than three hours ago;
   - signs up a warm-up account through the API, loads its worked example and opens every page the tests visit in Chromium, so `next dev` compiles them before the first test (`E2E_WARM=0` skips this);
   - only then answers on `http://127.0.0.1:3151/`, the target's `readyUrl`.
2. The tests run, two at a time. Each makes its own accounts through the API (`newUser()`, a made-up client IP per signup so the signup rate limit is never hit) and its own data, and signs the browser in by writing the localStorage the login page writes (`signIn()`). The browser may load localhost only (`netGuard`).
3. When the run ends, fails or is interrupted, the runner stops the command; the server stops `next dev` and drops the database. Check with `node --env-file=.env.local scripts/db/fresh.mjs --list`. `E2E_KEEP_DB=1` keeps it.

Server state and the database name go to `$TMPDIR/lcapix-e2e-tester-3150/` (or `E2E_ARTIFACTS_DIR`); the runner's own output goes to `e2e-tester/.e2e/`, with the dev server's output in `.e2e/logs/app.log`.

### Reading a failure

The list reporter ends with a `Failed Tests` section: the error code, the failing line and the accessibility tree around the locator. `e2e-tester/.e2e/` keeps the rest: `summary.md` and `failures/<test>.md` with `--reporter list,markdown`, `report.json` (every step), and per attempt under `artifacts/`: `failure/screen.txt` (the whole accessibility tree at failure), a screenshot, and a Playwright trace for failed attempts (`npx playwright show-trace <file>` from `e2e-tester/`). `pnpm e2e:tester --last-failed` reruns what failed.

## The tests

| File | Test | Covers |
|---|---|---|
| `auth.e2e.ts` | sign up → onboarding → home with the empty dashboard | F1: "Create account" disabled until filled, sign-up form, onboarding prefilled with the name, company, home greets "Welcome back, Sam." with the empty-dashboard buttons |
| | log in with a wrong password shows the "Login failed" toast and stays on the form | F2: toast "Login failed" / "Invalid email or password", the inline alert, still on `/auth/login`, no `auth_token` stored |
| `worked-example.e2e.ts` | worked example → Run Assessment → results show the total | F4b: "Open the worked example" → project → "Open editor" → `tree-canvas-viewport` → "Run Assessment" enabled (PROJ-1) → results: "TOTAL IMPACT · GLOBAL WARMING", 1.72 kg CO2 eq |
| `case-editor.e2e.ts` | add a component through the Add Component dialog | F6: "Add Component" → "New component" dialog, tier radio "Operation", created under a parent (API) |
| | edit a step's life-cycle stage and save it | F6 edit and save (EDIT-2): production → use, stored (API) and shown after a reload |
| | delete a step with its subtree | F6 delete (EDIT-1), first choice: confirm → toast, both steps gone (UI and API) |
| | delete a step but keep its children (they move up) | second choice: Cancel then OK → "1 step moved up", the child now hangs off the product (API) |
| | cancelling both questions deletes nothing | third choice: Cancel twice → both questions asked, nothing deleted |
| | add a flow, and a transport leg worked out from mass × distance | F7: 0.5 kg aluminium; transport leg 0.85 t × 450 km = 382.5 tkm, stored with `transport_mass_kg` 850 and `transport_distance_km` 450 (API) |
| | a cost of 0 is stored as 0, and a cleared cost goes back to empty | F8 (FLOW-3): labor 0 stays 0, energy 12.5 then cleared to null, in the API and after reloads |
| `results-export.e2e.ts` | Export PDF / Export PPT / Export rows (CSV) downloads a … file | F10: each download's name (`LCAPIX_…`) and contents (`%PDF-`, a zip, the CSV header, method and rows) |
| `compare.e2e.ts` | duplicate from results → compare shows the unrun copy as "Incomplete — not ranked" | F12: "Duplicate and change one thing" dialog, the copy opens, "Compare Cases" (guardrails §4) → the copy is selected, "Incomplete — not ranked", never named as lowest |
| `import.e2e.ts` | import a routing CSV → review → apply → open the created case | F13: deterministic routing connector, the three operations reviewed before anything is written, one new case with the product and operations (API), "Open case" shows them in the outline |
| `class.e2e.ts` | "Students see only their own case": a second student cannot open the first student's case | B-A1: two editor students with a case each; before, a student reads the other's case; the instructor turns the switch on from the class page (toast, stored); after, the second student gets 404 from the API and "Case not found" in the editor, and still opens their own case |
| `permissions.e2e.ts` | a non-member opening another user's project gets "Project not found" and none of its data | F14: API 404, toast "Project not found", sent to `/home`, none of the project's names shown; its case URL shows "Case not found" |

Names and ids come from docs/design-revamp/00-guardrails.md §4 where it lists them: `tree-canvas-viewport`, "Add Component", "Run Assessment", "Compare Cases". The Add Component radiogroup is matched as "Process tier" or today's "Component type".

### Known failures

A test that exposes a product bug stays as a repro that fails until the bug is fixed (the e2e skill's convention): put it in `e2e-tester/tests/bugbash/<slug>.e2e.ts`, tag it `{ tags: ['bugbash'] }`, and assert the expected behaviour so it fails with `ASSERTION_FAILED` today. The gating run (`pnpm e2e:tester`, CI) excludes the tag; `pnpm --dir e2e-tester test:e2e:bugbash` runs them. When the fix lands, the repro turns green: drop the tag and move it next to the other tests. There are none today.

## Writing a test

```ts
import { workedExample } from '../support/api.ts';
import { inspector, openCase, selectComponent } from '../support/editor.ts';
import { expect, test } from '../support/fixtures.ts';

test('delete a flow', async ({ app, screen, api, newUser, signIn }) => {
  const user = await newUser('flow-delete');               // onboarded, its own account
  const { projectId, caseId } = await workedExample(api, user);
  await signIn(user, '/home');
  await openCase(app, screen, projectId, caseId);
  await selectComponent(screen, '20. Weld tab');
  // …drive the UI by role and name; assert on what the user sees, and on the
  // API (api.as(user.token).get(...)) for what was stored.
});
```

Things that differ from Playwright:

- Names match **exactly** (whole string, case-sensitive) for `getByRole` names, `getByLabel`, `getByPlaceholder` and `getByText`: `'Cut tube'` misses `10. Cut tube`. Use a RegExp or `{ exact: false }` when you mean part of it.
- A locator that matches two nodes fails at once (`LOCATOR_AMBIGUOUS`). Toasts often repeat what the page says ("Case not found"), and in dev React runs load effects twice, so a load-error toast can appear twice: scope to `toasts(screen)` and use `.first()` where that is expected.
- There is no `locator.or()` and no `toBeInstanceOf`.
- `check()` fails on a controlled switch that flips only after the server answers (the class page's): `tap()` it and `expect(...).toBeChecked()`.
- `browser.waitForDownload()` returns a path relative to the attempt's artifact folder; `downloadedFile()` finds it.
- Do not wait on time. Wait for what the user would see, or poll the API with `expect.poll`.
- Every test makes its own data, so tests run in any order, on any worker, again and again.

## CI

The `e2e-tester` job in `.github/workflows/deploy.yml` runs on pull requests: a `mysql:8.0` service, `pnpm install` for the app and for `e2e-tester/`, Chromium for Playwright 1.63 (`--with-deps`), a typecheck of the tests, then `e2e run --exclude-tag bugbash --reporter list,junit` with `E2E_TELEMETRY_DISABLED=1`. No model key is passed (there are no agent steps). In CI the config retries a failed test once. Report, junit, the app log and failure artifacts are uploaded unless the job was cancelled. It is not a dependency of `deploy`; make it required in branch protection to block merges.

## Why a separate package

- **Playwright versions.** `@e2e-dev/web` needs `playwright >=1.63`. The Playwright suite pins `@playwright/test` 1.59.1 (its screenshots are pixel-compared against that Chromium build), and the root's `playwright` bin is what `pnpm e2e` and `npx playwright test` run. pnpm resolves the engine's `playwright` peer from the root, so in one install either the e2e engine gets 1.59.1 or the root bin moves to 1.63 and `playwright test` breaks. Its own package keeps both.
- **Watching.** Tailwind v4 registers every tracked top-level folder as a recursive watch dependency of the CSS, so a file the runner writes under `e2e-tester/.e2e` would make `next dev` rebuild and refresh every open page mid-test. `app/globals.css` therefore has `@source not "../e2e-tester"` (the folder has no classes; the CSS is unchanged), and the root `tsconfig.json` excludes `e2e-tester` (it has its own).
