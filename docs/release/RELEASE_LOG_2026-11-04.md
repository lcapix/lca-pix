# Release log: the education release, 4 November 2026

A record of what changed between the last release (`8a95026`, live from 31 October) and this one
(`v1-finish`, 85 commits, 269 files). Written so a person or an AI assistant reading the repository can
find what was built, why, which bugs were found and fixed, and how each was checked. Every commit hash
below is in `git log 8a95026..v1-finish`.

## Orientation

- **Product:** LCAPIX, life cycle assessment for university LCA classes and labs. A case is a tree of
  steps (product, machine or line, subprocess, operation, elemental task) with flows (inputs and
  outputs) on each step, run under TRACI 2.1, ReCiPe Midpoint (H) or CML 2001.
- **Stack:** Next.js 15 (App Router), React 19, TypeScript, PostgreSQL on Neon, Vercel. A push to
  `main` is a production deploy.
- **Where things live:**
  - `app/`: pages and API routes. `app/api/**/route.ts` is the API.
  - `components/lcapix/`: the screens. The case workspace is `components/lcapix/workspace/`.
  - `lib/`: pure logic and handlers. Engine math in `lib/calc*`; workspace logic in `lib/workspace/`;
    number formatting in `lib/ui/format.ts`; access rules in `lib/route-guard.ts`.
  - `db/pg/`: the schema (`000-schema.sql`), the factor library (`001-reference.sql`) and the
    numbered migrations (`db/pg/migrations/migrate-NNN-*.sql`).
  - `scripts/db/`: `migrate.mjs` (the runner), `fresh.mjs` (a database from nothing), `rehearse.mjs`
    (migrations on a copy of production), `backup.sh` (dump Neon and prove it restores),
    `integrity-report.mjs`.
  - `tests/`: unit (`*.test.ts` beside the code and in `tests/`), `tests/api-real/` (API against a
    real throwaway database), `tests/e2e/` (Playwright: journeys, parity, contracts, demo videos).
- **Docs:** `docs/release/EDUCATION_RELEASE_RUNBOOK.md` (how a release goes out),
  `docs/testing/E2E_TESTS.md`, `docs/testing/DATABASE_TESTS.md`.

## The engine's rules (unchanged in this release, now audited)

1. A flow's factor is the one for the case's region, else the Global one; one row per flow and
   impact category.
2. Embodied factors count on inputs only; elementary factors (emissions) count on outputs only.
3. A person's own factor overrides the library when its unit matches the method's.
4. The amount is converted to the factor's unit (the factor's denominator, else the substance's unit).
5. An allocation share multiplies down the tree.
6. Every answer is reported per functional unit: `per_fu_scale = reference_flow / modeled_output`.
   An imported plant record covers its whole year (DOE ITAC plant WV0661: 5,200 units), so its run is
   multiplied by 1/5,200 once when read (`lib/workspace/per-fu.ts`). The Inventory keeps the
   documents' amounts and says so in one line.

## Database migrations in this release

Applied in order by `scripts/db/migrate.mjs`; each runs in one transaction with its ledger row in
`schema_migrations`. 043 and 044 were already on production.

| File | What it does | Rows of people's work |
|---|---|---|
| `migrate-045-writeup-limits.sql` | Adds `case_table.limitations` (the write-up's Limits field) | none changed; new column is empty |
| `migrate-046-flow-stage.sql` | Adds `flows.life_cycle_stage` (a person's override of the stage rule) with a CHECK of the five stages; moves three steps of the sample study from materials to production | only the sample project's three steps |
| `migrate-047-import-column-maps.sql` | New table `import_column_map`: a person's column choices for a spreadsheet layout, reused for the next file with the same headers | none |
| `migrate-048-rate-limit-hits.sql` | New unlogged table `rate_limit_hits`, so rate limits are shared by every Vercel server | none |

Rehearsed twice on copies of production (22 October and 4 November): every migration applies, no
table loses rows, a second run applies nothing. The schema comparison on the 4 November copy lists the
same 20 CHECK constraints in a different text form; a fresh database put through the same `pg_dump`
and `pg_restore` shows the same form, and the allowed values are identical, so it comes from the dump,
not from a real difference.

## What changed, by area

### The class journey (ISO 14044 phases)

- A step bar on every case: goal and scope, inventory, impact assessment, interpretation, hand in, each
  ticked from the case's own data, with one Next button (`8341072`).
- A run after a hand-in asks the student to hand in again (`ddd445a`).
- The class journey finishes end to end: assignment, student copy, hand-in, teacher review
  (`3c9417b`, `5faa46f`).
- A project opens on its Cases board; the old Overview screen is removed (`975a31f`). Home leads to
  the student's own copy; case tabs are browser history entries (`a6214e3`).
- Guided mode starts on for a student's first case and says so once; its questions name the
  student's own product, unit, material and steps instead of the sample bracket (`5f0f218`, `ddd445a`).

### The case workspace

- One docked panel beside the tree with two tabs: the step, results or write-up, and the source
  documents. It goes under the tree on a tablet (`be4f905`, `62242dc`, `0bd90a1`).
- A new step's tier is suggested from its parent, with the reason (`1df03d5`,
  `lib/workspace/tier-suggest.ts`).
- One name per thing: Run the case, what-if, Edit, Input and Output, Handed in, Step in the report
  (`dc5bf03`, `47006f0`, `2b59d3e`, `f6a454d`).
- One line per case says which flows use the Global average factor, in place of a notice on every flow
  (`0ffd54e`).
- Step panel, Inventory and costs save only on Save; Enter never saves; leaving with unsaved edits asks
  first, including browser Back (`6dd2533`, `d0d0df7`, `a7fc211`).
- Each flow counts in its own life-cycle stage (`9625b13`, migration 046).
- A material, energy or transport cost with no flow offers to add the flow (`da477b3`).

### Numbers

- Results read at 3 significant figures on every screen; exports keep every digit (`d02a62c`).
- Differences are worked out from exact values and then rounded, so Compare and the Overview print the
  same change (`670697f`).
- "Same" means the two numbers read the same at 3 significant figures; every percentage and share is
  computed from exact values (`e3641a0`).
- Every answer per functional unit (`18d5929`).
- Results tab and full results page print the same numbers and the same "How sure" (`96ba6a0`).

### Compare, what-if and the report

- Compare prints no percentage across different regions or methods, one percentage per pair, and its
  fix reruns the case that differs (`ba6a8cf`).
- The case header names the run on show; a copy shows no base-case banner (`a566388`).
- The write-up gains Limits (migration 045) and refuses a change across methods (`ad1a2a8`).
- The PDF report carries the comparison against the base, the run number and the author's name
  (`2892662`).

### Import (routing, bill of materials, equipment list, DOE ITAC record)

- A held line stays on its real step; only plausible matches are offered; life-cycle stages are set
  (`17f2707`).
- The review is lean and ends on Next; the routing's steps open on arrival; every line has a visible
  Change; only lines that need a look start open; narrow cards stack (`759aaa2`, `890df49`,
  `98e077c`, `426edc2`).
- Import asks which column is which instead of guessing, and remembers the answer per layout
  (`6f3ed9b`, migration 047). PDFs are read only when a reader is configured (`4d77583`, `778c281`).
- Documents can be imported into the case they were opened from (`5ae28e1`); a handed-in copy is no
  longer offered as a target (`f7567cc`).

### Class privacy and access

- Creating an assignment turns on "each student sees only their own case and the teaching staff's".
- A project's member list no longer sends classmates' names and emails to other students.
- Only the student changes their assignment case; the instructor and TA read it.
- A case hidden from students (an answer key) can no longer be an assignment's template.
- All four in `b50392e`, with tests in `tests/api-real/flows/f42-class-privacy.test.ts`.

### Accounts, data sources and pages

- Delete my account and Change password on Profile; Forgot password says how to get back in
  (`2e303fc`, `9684035`).
- Privacy, terms, security and pricing pages say what the beta does (`ff04823`, `5a71fd2`).
- Data sources page: which cost sources answer live and which datasets the factors cite (`2f54b63`,
  `e8a76ed`, `ee7b958`).
- Magic Insights says plainly that AI wording is off in the beta (`7687009`).
- Rate limits shared across servers through the database (`fb12686`, migration 048).

## Bugs found and fixed

Each was found by a test, the math audit or a walk through the screens, and each fix has a test.

| Bug | What a person saw | Fix |
|---|---|---|
| Per-unit answer 5,200 times too high | An imported ITAC plant's Results tab showed the whole year's impact labelled as one unit's, while the Cases board was right | `18d5929` |
| Sign-in loop | Home and Log in bounced between each other when the browser held a valid token but no signed-in flag | `c6c6799` |
| Guided questions about the wrong product | Every Guided question named the sample bracket, whatever the student was studying | `5f0f218`, `ddd445a` |
| Stale "Handed in" | A run after a hand-in still showed Handed in, so a student would think the instructor had the newer result | `ddd445a` |
| Continue card for the wrong person | On a shared computer, Home offered the previous person's last case | `caba3ae` |
| Analytics double counting | A hand-in copy counted as a second student case and drew the student twice on the chart | `6dace22` |
| Lost first keystroke | A rename box could drop the first letter typed | `3da265e` |
| Flow name hidden | The step panel's direction box covered the flow's name | `ddd445a`, `6ed6d18` |
| Confusing delete | Deleting a step with nothing under it offered to "keep its 0 steps" | `b5d22df` |
| Percentages from rounded numbers | A 3.1% change could read 2.9%; a small answer could read 0% or Same | `e3641a0` |
| Different numbers on two screens | The Results tab and the full results page could disagree | `96ba6a0` |
| Comparing across methods | Compare printed a percentage between runs under different regions or methods | `ba6a8cf` |
| Teacher's view lost the student's note | The student's case note was hidden from the teacher after the privacy change | `97fdcda` |
| Leftover "Comparative case" wording | Old name in the case header, phone view and guides | `2b59d3e`, `47006f0` |
| Data source counts | openLCA rows were counted as the EPA TRACI file; quarantined factors were counted | `e8a76ed`, `ee7b958` |

## How it was checked

| Check | Result on the release build |
|---|---|
| TypeScript | at its recorded baseline (7 known errors, none new) |
| Unit tests | 2,205 pass; 48 skipped (8 older files that need a live local server) |
| Database tests | 130 pass |
| API tests against a real database | 2,114 pass, 61 files |
| Production build | passes |
| Browser tests, Chromium | 188: 183 passed in one full run; the other 5 pass on a second run (4 page-load timeouts on the development server, 1 test updated for new wording) |
| Browser journeys, WebKit and Firefox | every journey passes |
| Math audit, engine (`tests/api-real/flows/f41-math-audit.test.ts`) | 42 runs (4 real cases, 3 methods, 3 regions, a student's edits): every total and step value matches plain arithmetic on the case's rows to 1 part in a billion |
| Math audit, screens (`tests/e2e/journeys/math-screens.spec.ts`) | Results, Cases board, full results and each Inventory row match the run, per unit, for the sample and ITAC WV0661 |
| Migrations | rehearsed on two copies of production (see above) |

To rerun: `npm test`, `npm run test:db`, `npm run test:api`, and
`npx playwright test --project=journeys` (also `journeys-webkit`, `journeys-firefox`). Tests use a
throwaway local Postgres; they never touch production.

## Demo videos

Five, one per journey, recorded on the release build from real data (the sample study, the bundled
touring bike documents, and DOE ITAC plant WV0661's published record), in `docs/videos/`. The README
lists them. They are regenerated by `tests/e2e/demo/videos.spec.ts`.

## Known gaps

- Normalisation and weighting (ISO 14044 optional elements) are not in the app.
- 51 factor source names carry garbled characters from an old import; 27 older substances have an
  empty category; 3 steps carry a stored tier level that does not match their place in the tree. None
  changes a result. A cleanup migration is planned.
- Magic Insights' written summaries and reading PDFs need a model key; everything else works without
  one.
- PDF and slide exports keep their own number format; aligning them to 3 significant figures is a
  follow-up.
- A short list of low-risk access items from the security review is tracked privately and scheduled
  after this release.
