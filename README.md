# LCAPIX

Life cycle assessment for classes and labs. A student or researcher builds a product's life cycle as a tree of
steps, from the product down to the tasks on a machine, attaches what goes in and comes out of each step, and
runs it under TRACI 2.1, ReCiPe Midpoint (H) or CML 2001. Every answer is per functional unit, every number
traces to its factor and source, and the four phases of ISO 14044 (goal and scope, inventory, impact assessment,
interpretation) are the steps a case moves through.

The case can be built from a company's own files instead of by hand: an ERP routing, a bill of materials, an
equipment list, or a DOE Industrial Assessment Center (ITAC) plant record. Spreadsheets and CSV files are read by
fixed rules, never by a model.

Live: [lca-pix.vercel.app](https://lca-pix.vercel.app). Free while in beta.

## Demo videos

Five short videos, one per journey, recorded on the release build with captions. Click one to play it on GitHub.

| Video | What it shows |
|---|---|
| [1. A student](docs/videos/lcapix-1-student.webm) | Start an assignment from Home, Guided mode with questions about their own product, the step bar, change an amount, read a document beside the tree, run, read the results, write the interpretation, hand in. |
| [2. A teacher](docs/videos/lcapix-2-teacher.webm) | Home, People, set an assignment, read the hand-ins, open a student's case read-only, Analytics, export a PDF report. |
| [3. Import](docs/videos/lcapix-3-import.webm) | A routing becomes a case; a bill of materials adds its lines, matched to the library or held; the column mapper for a file with unfamiliar headers; a DOE ITAC plant answered per unit. |
| [4. Editing](docs/videos/lcapix-4-editing.webm) | Add a step (its tier suggested from the parent), rename and delete it, change a unit in the Inventory, use your own factor, the cost view, documents beside the Inventory. |
| [5. Analysis](docs/videos/lcapix-5-analysis.webm) | Results and the full results page, a what-if, Compare and its fairness checks, Magic Insights, Reports. |

The data in the videos is real: the sample bracket study, the bundled touring bike documents (an ERP-style
routing, bill of materials and equipment list), and DOE ITAC plant WV0661's published record. The people in them
are test accounts.

## What is in this release

The release on the `v1-finish` branch, for classrooms:

- **A step bar on every case**, in ISO 14044's words, with one "Next" button. Each step is ticked from the case's
  own data, and a run after a hand-in asks the student to hand in again.
- **One docked panel beside the tree**: the step, results or write-up, with the source documents as its second tab.
- **Guided mode on for a student's first case**, asking about their own product, unit and steps.
- **A new step's tier suggested from its parent**, with the reason.
- **One name for each thing**: Run the case, what-if, Edit, Input and Output, Handed in.
- **One line per case** saying which flows use the Global average factor, instead of a notice on every flow.
- **Results at 3 significant figures** on every screen; exports keep every digit.
- **Every answer per functional unit.** An imported plant record covers a year of production; its answers are
  now per unit, and the screens say so in one line.
- **Class privacy**: a project with an assignment shows each student only their own case; only the student
  changes their assignment case.

The full record of this release, every change and bug fix with its commit, is in
[docs/release/RELEASE_LOG_2026-11-04.md](docs/release/RELEASE_LOG_2026-11-04.md).

## How it was checked

- **The math.** A test works out every total and every step's value a second time from the case's own rows with
  plain arithmetic, without the app's engine, for 42 runs: four real cases (the sample bracket and its what-if, the
  touring bike, ITAC plant WV0661) under three methods and three regions, plus a student's edits (a unit change,
  a direction change, a moved flow, an allocated share). All match. A browser test then checks the numbers on the
  screens against the run, for the sample and the plant.
- **The test suites** on the release build: 2,205 unit tests, 130 database tests and 2,114 API tests pass; the
  production build passes; TypeScript is at its recorded baseline. The browser journeys pass in Chromium,
  Safari's engine (WebKit) and Firefox.
- **A security pass** over all 61 API routes, with the fixes tested.
- **The database migrations** for this release, rehearsed on a copy of production data: they apply in order, change
  no rows of anyone's work, and do nothing when run again.

## Not in the app yet

- Normalisation and weighting (ISO 14044 optional elements); students use another tool for that part.
- Magic Insights' written summaries and reading PDF documents wait on a model key; everything else works without it.
- Some factor source names carry garbled characters from an old import; a cleanup is planned.

## Running it locally

Stack: Next.js 15, React 19, TypeScript, PostgreSQL (Neon in production), deployed on Vercel.

1. `npm install`
2. A local Postgres, and the connection in `.env.local` (`DATABASE_URL`, or `DATABASE_HOST`, `DATABASE_PORT`,
   `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`), plus `JWT_SECRET`. See `.env.example`.
3. A database with the schema, the factor library and every migration:
   `node --env-file=.env.local scripts/db/fresh.mjs --name=lcapix_dev`, then set `DATABASE_NAME=lcapix_dev`.
4. `npm run dev`, then open http://localhost:3002.

Tests: `npm test` (unit), `npm run test:db` and `npm run test:api` (against a throwaway local database), and the
browser journeys with Playwright (`npx playwright test --project=journeys`). See `docs/testing/E2E_TESTS.md`
and `docs/testing/DATABASE_TESTS.md`.

## Licence and contact

MIT licence. Questions: lcapix50@gmail.com, or an issue in this repository.
