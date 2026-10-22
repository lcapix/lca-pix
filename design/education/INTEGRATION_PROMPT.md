# Integration check: can the education screens be built on v1-hardening?

This branch, `v1-hardening-education-integration`, is for the backend developer. Check it out and paste the prompt below as the first message of a Claude Code session in that checkout. Every path is relative to the repo root.

```text
Check out the branch v1-hardening-education-integration of github.com/lcapix/lca-pix (it starts
from v1-hardening at b5bed3d) and read these first, in this order:
- design/education/README.md
- design/education/build-map.md, all of it. The two sections that matter most:
  "Backend work the screens need" and "Where a screen and the code disagree".
- design/education/specs/: rules.md, behaviour-spec-claude-design.md, sidebar.md, canvas.md, look.md
- design/education/screens/: 35 PNGs in six rows (a-website-to-home, b-file-to-project,
  c-case-work, d-project-pages, e-student-and-phone, f-states-and-errors). Look at every one.
- docs/release/DEPLOY_CHECKLIST.md
- The code the build map leans on: app/project/layout.tsx, lib/route-guard.ts, lib/auth.ts,
  lib/example-case.ts, app/api/example-project/route.ts,
  app/api/projects/[projectId]/progress/route.ts, app/api/projects/[projectId]/members/route.ts,
  app/api/auth/profile/route.ts, db/baseline/000-schema.sql, scripts/db/migrate.mjs

THE QUESTION
Can the education screens in design/education be integrated into the app on top of
v1-hardening, and what backend work does that take? This is an assessment. Do not build
anything yet.

## HARD RULES
- Work on this branch only. No commits to v1-hardening or main, and no merges into them.
- Local MySQL only. Build a throwaway database with scripts/db/fresh.mjs. Never connect to RDS,
  to production, or to lca-pix.vercel.app. Never run ops/legacy-scripts or the root database
  scripts.
- Never print a secret, including in a diff or a log. The repo is public.
- Back every claim with a file path and line, or with something you ran. The build map was
  made by reading the code only. Where you can, confirm a claim by running the app or a test.
- Stay inside the education purpose (below). Do not plan for anything the screens tag
  "Coming soon" unless I ask.
- Plain language, short sentences.

## STATE
- The design handoff is merged: PR 2 (v1-hardening-education into v1-hardening) added 44 files,
  all under design/education. It contains no app code.
- The build map was checked against commit 09723e5. v1-hardening is now at b5bed3d. The only
  changes since are the design files and one gitleaks ignore, so the code is the same.
- Its count: 275 screen elements. 113 built, 131 new screens over data that already exists,
  21 need backend work, 10 tagged Coming soon. The backend work is 12 items plus a "later"
  list.
- The newest migration is migrate-032-case-ownership.sql. New ones start at 033 and go
  through scripts/db/migrate.mjs.
- PR 3 (v1-hardening into main) is open with every check green. Merging it deploys to
  production: the workflow's deploy job runs on a push to main. docs/release/DEPLOY_CHECKLIST.md
  has to be done first (secrets rotated, Vercel env vars set, migrations 026 to 032 applied).
- origin/v2-modular has 3 commits cut from an older v1-hardening (704a964). 7 of its files were
  changed again by the hardening work: app/api/components/[componentId]/route.ts,
  app/api/ingest/apply/route.ts, app/project/[projectId]/case/[caseId]/page.tsx,
  app/project/[projectId]/import/page.tsx, components/lcapix/case/environmental-flows-editor.tsx,
  components/lcapix/case/inspector-panel.tsx, lib/lca-engine.ts.
- The education purpose, from the product owner: LCAPIX is a research tool that professors and
  labs use inside a class, beside Canvas. Canvas keeps the roster, deadlines and grades. No
  courses, sections, teaching teams or marking queue. A professor makes a project with a base
  case and comparative cases; students see those, and add their own case, which stays private
  to them and the professor. Individual and education accounts get the same experience for now.
- Facts from the build map that shape the work: there is no sidebar today (the screens assume
  one on every page); a case is a three-pane editor, not tabs; roles are owner, admin, editor,
  viewer, with no student or professor role; run numbers are global; the worked example is
  found by its name, with no sample flag; members_see_own_cases is all or nothing, so "see the
  professor's cases, keep your own private" needs a per-case rule in lib/route-guard.ts;
  adding a member needs an existing account and sends no email.
- Two places the screen must not be copied as drawn: the login and sign-up errors (F1.2b)
  would reveal which emails have accounts, so the code's neutral wording stays; and the landing
  page (F1.1) promises things with no code behind them, which the product owner decides on.

## WHAT I WANT BACK, in this order
1. THE VERDICT, in one line: integrate now, integrate in phases, or blocked, and why.
2. EVERY SCREEN, row by row: buildable now over today's API, needs backend item N, or blocked.
   Where the build map is wrong, say so and show why.
3. EVERY BACKEND ITEM, 1 to 12: is it needed for the first release, the approach, the schema
   change (migration number), the API change, the tests to add, the size in days, the risk, and
   what it depends on.
4. THE RISKS: the overlap with v2-modular, adding a sidebar to every page, the three-pane editor
   against the screens, the role mapping, per-case privacy, global run numbers, the 4.5 MB upload
   limit, anything that needs an email provider (invites, password reset), and the shared store
   the rate limits need.
5. A BUILD ORDER in phases: what ships in each phase, what stays tagged Coming soon, and which
   backend items must land before which screens.
6. QUESTIONS for the product owner, each with the choice it unlocks.

Write the answer to design/education/integration-assessment.md on this branch, and show me the
verdict and the build order in chat. When it is ready, open a pull request from this branch
into v1-hardening so the product owner can read it there.
```
