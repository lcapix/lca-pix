# Parity ledger: classic screens vs the education screens

**Why this exists.** The education release (66d49ff) rebuilt the screens from 35 design pictures. What no
picture showed was dropped without anyone deciding to drop it (a student found flow delete, substance swap
and the step-tier choice missing on production, 2026-10-27). The rule since then: **the classic version's
functionality, in the design of the new screens.** This ledger lists every action and every piece of
information the classic screens offered and where it lives now.

**Baseline.** Classic = commit 9227580, the parent of the education release. The classic case editor and
results page still exist on main behind `NEXT_PUBLIC_LCAPIX_WORKSPACE=classic` (`lib/ui-flags.ts:11`);
other pages were rewritten in place, so their classic version is read with `git show 9227580:<path>`.

**Status words.**
- **kept**: works on the new screens.
- **hidden**: works, but a user would not find it (right-click only, a key only, a page nothing links to).
- **partial**: some of it works.
- **missing**: gone.
- **dropped**: removed on purpose, with Shreya's decision named.

**Tests.** Every row gets a browser test whose title starts with its ID ("E13 delete a flow"), so
`grep -rn "E13 " tests/e2e/parity tests/e2e` finds it. A kept row's test gates CI. A missing, hidden or partial row's
test is a known-failure repro until H2 fixes it; then it gates, so a later redesign cannot drop it silently.

Path keys: `WS/` = `components/lcapix/workspace/`, `CL/` = `components/lcapix/case/`,
`LCE/` = `lib/case-editor/`. Line numbers are main at 8a2e27c unless marked classic.

---

## Summary (2026-10-27, H0)

Counted from the rows below by status word. "Missing in classic too" means the Note says so (not a
regression).

| Section | Rows | Kept | Moved | Partial | Hidden | Missing | Dropped | Of missing: missing in classic too |
|---|---|---|---|---|---|---|---|---|
| E. Case editor | 20 | 5 | 0 | 3 | 2 | 10 | 0 | 3 |
| R. Results | 16 | 3 | 2 | 5 | 0 | 6 | 0 | 0 |
| I. Import | 8 | 1 | 0 | 3 | 0 | 4 | 0 | 3 |
| C. Class | 8 | 2 | 1 | 1 | 1 | 3 | 0 | 3 (C05 to C07 are new features) |
| P. Project pages | 136 | 59 | 20 | 22 | 6 | 26 | 3 | 2 |
| G. Home, library, account, navigation | 146 | 70 | 17 | 14 | 11 | 26 | 8 | 11 |
| **Total** | **334** | **140** | **40** | **48** | **20** | **75** | **11** | **22** |

After the 11 drops Shreya accepted on 2026-10-27, the revamp has **121 regressions** to fix: 53 missing, 48
partial and 20 hidden. Another 22 rows were never built in either version; H2 builds the ones the plan names,
such as assignments (C06, C07).

**How they were lost.** There are four patterns, and H2 fixes each one at its root:
1. **Behind a build flag.** The classic editor, results, analytics, compare and new-project form exist
   only when `NEXT_PUBLIC_LCAPIX_SHELL` or `NEXT_PUBLIC_LCAPIX_WORKSPACE` is `classic`, so production never
   shows them.
2. **Unlinked.** Pages that work but that nothing in the new navigation links to: both library pages,
   `/class`, `/start`, the classic new-case forms and saved comparisons. The classic project Overview
   is still the only place to rename or delete a case, delete a project or clone from base, and the
   sample project never shows it.
3. **Dropped in the rebuild.** Controls that no design picture showed: flow delete, substance swap, step
   tier choice, life-cycle stage, product scale, method picker, the flow table and the ISO summary.
4. **Tests rewritten to match.** `tests/e2e/journeys/case-editor.spec.ts` now expects one-click Add step
   and "Delete step takes the subtree". The classic check "delete a step but keep its children" survives
   only in the stale `e2e-tester/`, which cannot start on main: its warm-up runs the now read-only sample
   and gets 403.

**Severity 1: wrong information or a dead end for real users.**

| ID | What a user meets |
|---|---|
| P13 | The new overview names the two cases it is comparing and does not invent a percent or a dollar change (`WS/project-hub.tsx`) |
| E01, E08 | Add step always makes a machine/line, auto-selected, so the next flow lands on it |
| E09, E13 | No way to change a flow's substance or delete a flow |
| R01, R02, R07 | No full results page, no method choice, no data-quality statement on desktop |
| G64 | A user who skipped "Institution" at sign-up can never save a profile edit (`app/profile/page.tsx:172`) |
| G02 | An email sign-up who leaves before "About you" is never sent back to it |
| G123, G124 | The factor and substance libraries have no link anywhere |

**Drops (accepted by Shreya 2026-10-27; marked `dropped` in the rows).**

| IDs | What | Pick |
|---|---|---|
| P51, P54 | Analytics verdict card and change-vs-baseline chart: never worked in classic (needed two loaded cases) | drop |
| G31, G117 | Recent activity and the notifications bell: a browser-only store nothing in the new screens feeds | drop, and remove the dead bell from `/guide` and `/about` |
| G04, G115, G146 | The guided Tour: no trigger in the shell, superseded by Guided mode | drop, unmount `GlobalTour` |
| G88, G96 | "Welcome back" and "Account created" toasts | drop |
| P116 | Decorative "ISO 14040/44 Compliant" chip | drop (it is also an unbacked claim) |
| G138 | Palette offers Dark and High contrast themes that the new design has no styles for (inferred) | remove the commands now; a real dark and high-contrast theme is its own task |
| P45, P50, P52 to P56 | Classic single-case Analytics page (the route now shows class progress) | do not bring back a second page; put its unique parts (category radar and log scale, cost per unit impact, component diff) into Results and Compare |

## E. Case editor

| ID | Capability | Classic | Now (main) | API | Status |
|---|---|---|---|---|---|
| E01 | Add a step, choosing tier and parent | One click made a machine/line named "New step" | `components/lcapix/workspace/add-step-form.tsx` | POST `cases/[caseId]/components` accepts any tier under any parent | kept |
| E02 | Add a step as a student ("Can change") | The button was hidden for an editor | `components/lcapix/workspace/tree-tab.tsx` | same | kept |
| E03 | Rename a step | Step menu only | `components/lcapix/workspace/step-panel.tsx` | PUT `components/[componentId]` | kept |
| E04 | Move a step under another parent | Any higher-tier step, in the step panel and the step menu | `components/lcapix/workspace/step-panel.tsx` | PUT `parent_component_id` | kept |
| E05 | Change a step's tier | No | No | PUT accepts `component_type` | missing in both |
| E06 | Delete a step and its children | Step panel and step menu. Confirm: "Delete it and its N steps" | `components/lcapix/workspace/tree-tab.tsx` | DELETE `components/[componentId]?children=delete` | kept |
| E07 | Delete a step but keep its children | The same confirm: "Delete it, keep its steps" | `components/lcapix/workspace/tree-tab.tsx` | `?children=reparent` | kept |
| E08 | Add a flow | A warning when the step has steps under it: "Flows usually go on the lowest step." | `components/lcapix/workspace/step-panel.tsx` | POST `components/[componentId]/flows` | kept |
| E09 | Swap a flow's substance | Change substance, in the step panel and Inventory | `components/lcapix/workspace/step-panel.tsx` | PUT `flows/[flowId]` `substance_id`, unit re-checked server side | kept |
| E10 | Change a flow's quantity | `CL/flows/flow-row.tsx:122-139` | `WS/step-panel.tsx:250-267`, `WS/inventory-tab.tsx:331-347` | PUT | kept |
| E11 | Change a flow's unit | Step panel and Inventory | `components/lcapix/workspace/step-panel.tsx` | PUT `unit` | kept |
| E12 | Change a flow's direction (in/out) | Direction select, In or Out, in the step panel and Inventory | `components/lcapix/workspace/step-panel.tsx` | PUT `flow_type` | kept |
| E13 | Delete a flow | Delete flow, with a confirm | `components/lcapix/workspace/step-panel.tsx` | DELETE `flows/[flowId]` | kept |
| E14 | Override a factor | No | Only when a regional factor fell back to Global (`WS/step-panel.tsx:291-307`) | PUT/DELETE `flows/[flowId]/factor` | kept (new) |
| E15 | Cost lines (six kinds) | `CL/inspector/costs-section.tsx` | `WS/cost-panel.tsx:245-262, 302, 338, 604` | PUT/DELETE `components/[componentId]/costs` | kept |
| E16 | Scale the product (quantity) | Quantity and Apply, on the product step | `components/lcapix/workspace/step-panel.tsx` | POST `cases/[caseId]/scale` | kept |
| E17 | Process library when adding a flow | `CL/environmental-flows-editor.tsx:104-119` | Shared add-flow form (`CL/flows/substance-picker.tsx:149-175`) | GET `process-templates` | kept |
| E18 | Transport leg from mass × distance | Add-flow form | Shared add-flow form (inferred: same component; covered by the ported test) | POST flows | kept (to confirm by test) |
| E19 | Set a step's life-cycle stage (production, use, end of life) | Life-cycle stage select on the step panel | `components/lcapix/workspace/step-panel.tsx` | PUT `components/[componentId]` | kept |
| E20 | Undo | No | No | None | missing in both |

## R. Results

The new Results is a 420px floating panel over the tree (`WS/tree-tab.tsx:38`, `app/ds.css:472`); the
classic page is full width up to 1440px (`components/lcapix/results/results-page.tsx:176-179`).

| ID | Capability | Classic (`components/lcapix/results/`) | Now (main) | Status |
|---|---|---|---|---|
| R01 | Full-page results, printable | `results-page.tsx:176-179` | `components/lcapix/workspace/full-results.tsx:129`; "Open full page" in `results-panel.tsx:119` | kept |
| R02 | Choose method and region for a run | `results-header.tsx:132-200`, run dialog `results-page.tsx:302-309` | `components/lcapix/workspace/case-workspace.tsx` run dialog | kept |
| R03 | Total for the selected category, change vs the previous comparable run | `dashboard-hero.tsx:88-163` | `components/lcapix/workspace/full-results.tsx:172` | kept |
| R04 | KPI row: categories, components, last run | `dashboard-hero.tsx:166-199` | `components/lcapix/workspace/full-results.tsx:184` | kept |
| R05 | Top 5 contributors for any category | `dashboard-hero.tsx:210-284` | `components/lcapix/workspace/full-results.tsx:253` | kept |
| R06 | Switch the whole page to another category | `impact-categories-panel.tsx:51-120` | `components/lcapix/workspace/full-results.tsx:148` | kept |
| R07 | ISO summary: goal and scope, per-functional-unit table, data-quality statement | `iso-run-summary.tsx:67-175` | `components/lcapix/workspace/full-results.tsx:507` | kept |
| R08 | Stage panel and boundary gaps | `stage-panel.tsx:32-143` | `components/lcapix/workspace/full-results.tsx:588` | kept |
| R09 | Flow table: amount × factor = impact per category, filters, Global-fallback flag, jump to step | `flow-table.tsx:72-222` | `components/lcapix/workspace/full-results.tsx:630` | kept |
| R10 | Run history with method, region, status, timeline | `historical-runs-card.tsx:56-104` | `components/lcapix/workspace/full-results.tsx:275` | kept |
| R11 | Frozen data-quality warnings for the run | `data-quality-warnings.tsx:5-24` | `components/lcapix/workspace/full-results.tsx:311` | kept |
| R12 | Older-run banner | `older-run-banner.tsx:22-44` | `WS/results-panel.tsx:120-129` | kept |
| R13 | Export PDF, PowerPoint, CSV | `results-header.tsx:204-229` | Write-up tab (`WS/write-up-panel.tsx:224-241`) and `/reports` | moved |
| R14 | Write-up | `results-page.tsx:256-264` | Write-up tab | moved |
| R15 | Duplicate the case, compare | `next-steps-bar.tsx:37-53` | What-if button, Compare link | kept |
| R16 | Magic Insights on the selected category | `results-page.tsx:311-325` | Button; modal has its own category picker | kept |
| R17 | Categories left out for lack of a factor are named, never shown as zero (finding 1.8, 2.11) | n/a (discovery run 1, 2) | `components/lcapix/workspace/results-panel.tsx` "Not counted" note; `components/lcapix/workspace/full-results.tsx` Coverage; `method_categories` from GET /api/cases/:id/assessments | kept |
| R18 | Magic Insights says "no cost was entered", "the top two steps" only with two, and labels each Source data value (finding 1.16) | n/a (discovery run 1) | `lib/insights/insight-text.ts`; `components/lcapix/magic-insights/contributors-list.tsx` | kept |
| R19 | No "Compare to base" on the base case itself (finding 1.17) | n/a (discovery run 1) | `components/lcapix/magic-insights-modal.tsx` | kept |
| R20 | A run is named by its place in its case, "Run 1" (finding 2.8) | n/a (discovery run 2) | `lib/results/full-results-view.ts` `runLabel`; `case_run_number` from the API | kept |
| R21 | Six-digit values never run into their shares; the unit wraps (finding 3.3) | n/a (discovery run 3) | `components/lcapix/workspace/results-panel.tsx` What builds this number; `.ws-answer` in `app/ds.css` | kept |
| R22 | One money format with thousands grouped, "$101,150.00" (finding 3.4) | n/a (discovery run 3) | `lib/ui/format.ts` `money` | kept |
| R23 | Results says when the case changed after its run, with Compare's rule (finding 3.11) | n/a (discovery run 3) | `components/lcapix/workspace/results-panel.tsx`, `components/lcapix/workspace/full-results.tsx`; `changed_after_run` from GET /api/cases/:id/inventory | kept |

## I. Document import

| ID | Capability | Classic | Now (main) | Status |
|---|---|---|---|---|
| I01 | Candidate matches with % score | old `flow-row.tsx:115-129` | `flow-row.tsx:81-89` | kept |
| I02 | Factor value, unit, variant and source per candidate | Never | `app/project/[projectId]/import/_components/flow-row.tsx` option text; factor of the project's method and region from `app/api/ingest/preview/route.ts` (`factor_method`) | kept |
| I03 | More than the top 3 candidates, search the whole library | No (top 3, `lib/ingest/maplca.ts:165`) | "Search the whole library" in `app/project/[projectId]/import/_components/flows-table.tsx`, in the project's method | kept |
| I04 | British spellings match (Aluminium) | No | `lib/substances/spelling.ts` inside `matchSubstance` (`lib/ingest/maplca.ts`); proven against the library in `tests/api-real/flows/f13-import.test.ts` | kept |
| I05 | Full provenance and a direction column | old `flow-row.tsx:46-50` | `app/project/[projectId]/import/_components/flow-row.tsx` provenance under the line, and an "In or out" column | kept |
| I06 | Substance id in review notes | old `maplca.ts:223-224` | `lib/ingest/maplca.ts` review note names the substance id | kept |
| I07 | Held lines listed one by one after Save | old `done-card.tsx:33-36` | `app/project/[projectId]/import/_components/done-card.tsx` "Held lines" list | kept |
| I08 | Held line: pick a substance with candidates and scores | n/a (held lines are new) | `components/lcapix/workspace/held-lines.tsx`: scores and factors in the study's method, the whole library | kept |
| I09 | DOE's ITAC workbook imports as downloaded (16.8 MB): the browser sends only the plant's row (finding 3.2) | n/a (discovery run 3) | `lib/ingest/itac-browser.ts`; `app/project/[projectId]/import/_components/pick-form.tsx` takes an ITAC workbook of any size | kept |
| I10 | The lines table fits its card at 1024 px (finding 3.6) | n/a (discovery run 3) | `.ip-lines-table` in `app/ds.css` | kept |
| I11 | The saved screen does not say "and their hours" when none were read, and shows one step count (finding 3.8) | n/a (discovery run 3) | `app/project/[projectId]/import/_components/done-card.tsx` | kept |
| I12 | "Into" starts on the project's case; the equipment list opens when that case has steps (finding 3.9) | n/a (discovery run 3) | `lib/import/use-import.ts`; `app/project/[projectId]/import/_components/pick-form.tsx` | kept |

## C. Class

| ID | Capability | Classic | Now (main) | Status |
|---|---|---|---|---|
| C01 | Add students by email or CSV | `/class` | People page (`people-page.tsx:427, 439-512`) | moved |
| C02 | Students see only their own case | `/class` | People page toggle with confirm | kept |
| C03 | Per-student lesson progress | `/class` (`class/page.tsx:336-339`) | `components/lcapix/project/cases-page.tsx` Progress line and Lessons column (`lessonsOf`) | kept |
| C04 | Hand-in tick, visible to the instructor | `/class` (`class/page.tsx:344`) | Cases board column, Analytics | kept |
| C05 | Base case instructions shown to the student | No | `components/lcapix/workspace/case-header.tsx` AssignmentInstructions | kept |
| C06 | Assignments (instructions, due date, template), many per project | No | `app/project/[projectId]/assignments/page.tsx`; `lib/assignments/handlers.ts`; migrate-043 | kept |
| C07 | Submission frozen at hand-in; instructor submissions list | No | `assignments/page.tsx` Hand in and Hand-ins; frozen read-only copy with its write-up | kept |
| C08 | Student Home for someone who also owns projects | n/a | `components/lcapix/home/assigned-to-you.tsx` on both Homes | kept |
| C09 | Adding an email with no account says so, once, in words (finding 2.2) | n/a (discovery run 2) | `lib/project/people-view.ts` lastAddLines | kept |
| C10 | People shows full names and access in words, with an inline access choice (finding 2.3) | n/a (discovery run 2) | `components/lcapix/project/people-page.tsx` (tested with P34) | kept |
| C11 | A student on the instructor's read-only base case can start their own copy (finding 2.5) | n/a (discovery run 2) | `components/lcapix/workspace/case-header.tsx` Make my own copy | kept |
| C12 | An empty case can be copied, as classic allowed (finding 2.6) | n/a (discovery run 2) | `app/api/cases/[caseId]/duplicate/route.ts` | kept |

## P. Project pages

Headline: classic project-level capabilities were mostly not deleted. They survive in three places users rarely reach: the Overview page for non-sample projects (`/project/[id]` still renders the whole classic overview, now role-gated, so rename case, delete case, delete project, clone from base, Add Case to the classic forms and the Class page live only there), behind `NEXT_PUBLIC_LCAPIX_SHELL=classic` (classic Analytics, classic Compare, classic new-project form), or at unlinked URLs (`/start` has no link at all). The real user-facing losses are on Analytics, Compare, New project, and the project goal and scope editor. "missing" below includes code that survives only behind a build flag, since production users cannot reach it; "hidden" means reachable, but only from a classic button or a typed URL. Verified by reading code at 9227580 and 8a2e27c unless marked inferred.

Path legend:
- OVc = `9227580:app/project/[projectId]/page.tsx`; OVm = `components/lcapix/project/project-overview-page.tsx`
- PH = `components/lcapix/project/project-header.tsx`; CA = `components/lcapix/project/case-actions.tsx`; UPA = `lib/project/use-project-actions.ts`
- CT = `components/lcapix/project/case-tabs.tsx`, TP = `components/lcapix/project/case-tree-panel.tsx` (same line numbers in both versions)
- CMPc = `9227580:app/project/[projectId]/comparison/page.tsx` (main keeps a copy at `comparison/_components/classic-comparison.tsx`, flag only); CMPm = `components/lcapix/compare/compare-page.tsx`; UC = `lib/compare/use-compare.ts`
- ANc = `9227580:app/project/[projectId]/analytics/page.tsx` (main copy at `analytics/_components/classic-analytics.tsx`, flag only); ANm = `components/lcapix/project/analytics-page.tsx`
- CL = `app/project/[projectId]/class/page.tsx` (main changes only dash glyphs); PP = `components/lcapix/project/people-page.tsx`; CP = `components/lcapix/project/cases-page.tsx`
- ST = `app/project/[projectId]/start/page.tsx` (unchanged)
- NPc = `9227580:app/project/new/page.tsx` (main copy at `app/project/new/_components/classic-new-project.tsx`, flag only); NPm = `components/lcapix/project/new-project-form.tsx`
- NC = `components/lcapix/project/new-case-form.tsx`; BN, CN = `app/project/[projectId]/case/base/new/page.tsx`, `app/project/[projectId]/case/comparative/new/page.tsx` (unchanged)
- IMc / IMm = `app/project/[projectId]/import/page.tsx` at 9227580 / main; RP = `components/lcapix/reports/reports-page.tsx`
- NAV = `lib/shell/project-nav.ts`; RT = `lib/shell/routes.ts`; TB = `components/lcapix/app-top-bar.tsx`

### Project overview /project/[projectId]

| ID | Capability | Classic (9227580) | Now (main) | API | Status | Note |
|---|---|---|---|---|---|---|
| P01 | Overview shown for every project | OVc:33-226 | `components/lcapix/workspace/project-hub.tsx` for every project; the sample opens read-only with Make my own copy (`app/project/[projectId]/page.tsx`) | GET /api/projects/:id, GET /api/projects/:id/cases | kept |  |
| P02 | Project name heading | PH c:50-64 | `components/lcapix/workspace/project-hub.tsx` | GET /api/projects/:id | kept |  |
| P03 | "comparison" chip when there are comparatives | PH c:65-71 | `components/lcapix/workspace/project-hub.tsx` | none | kept |  |
| P04 | Project description | PH c:72-82 | `components/lcapix/workspace/project-hub.tsx` | GET /api/projects/:id | kept | New projects now save description '' (see P106), so this is empty for them |
| P05 | Analytics button (?caseId=active) | PH c:84-96 | `components/lcapix/workspace/project-hub.tsx` Analytics opens the active case's full results | none | kept |  |
| P06 | Compare Cases button (disabled under 2 cases) | PH c:97-109 | `components/lcapix/workspace/project-hub.tsx` | none | kept | Target is the new Compare |
| P07 | Class button to /class | PH c:110-117 | `components/lcapix/workspace/project-hub.tsx` | none | kept | Only entry to /class; sidebar links /people |
| P08 | Import Data button | PH c:118-127 | `components/lcapix/workspace/project-hub.tsx` | none | kept | Hidden for viewers |
| P09 | Add Case (to base/new or comparative/new) | PH c:128-136, `lib/project/workspace.ts:18-22` | `components/lcapix/workspace/project-hub.tsx` | none | kept | Opens the classic forms, not the new case/new; hidden for viewers |
| P10 | Delete project (confirm) | PH c:137-145, UPA:102-125 | `components/lcapix/workspace/project-hub.tsx` | DELETE /api/projects/:id | kept | Owner only; this is the only delete-project control |
| P11 | Breadcrumb Projects > name | OVc:107-112 | `components/lcapix/workspace/project-hub.tsx` | none | kept |  |
| P12 | KPI strip (Cases, Steps, Global Warming, Cost) | OVc:128, `workspace.ts:65-96` | `components/lcapix/workspace/project-hub.tsx` | GET /api/cases/:id/components, GET /api/cases/:id/assessments, GET /api/assessments/:runId | kept |  |
| P13 | Comparison banner "X vs Y" | OVc:131-133, `comparison-banner.tsx:31-51` | `components/lcapix/workspace/project-hub.tsx` `Banner`, from `lib/project/comparison-banner.ts` over GET /api/projects/:id/compare: the runs' own numbers, or why there are none | none | kept |  |
| P14 | Case tabs: pick base, cycle comparatives, show counts | CT:57,118,207 | `components/lcapix/workspace/project-hub.tsx` | none | kept |  |
| P15 | Add comparative / Add case from the tabs | CT:301-311, 328-343 | `components/lcapix/workspace/project-hub.tsx` | none | kept | Same target as P09 |
| P16 | Active case description | OVc:145 | `components/lcapix/workspace/project-hub.tsx` | none | kept |  |
| P17 | Mini canvas: drag, zoom, select node | TP:111-135 | `components/lcapix/workspace/project-hub.tsx` MiniCanvas, "Add a step" | GET /api/cases/:id/components | kept |  |
| P18 | Open editor | TP:72-82 | `components/lcapix/workspace/project-hub.tsx` | none | moved | Opens the new workspace |
| P19 | View Full Hierarchy dialog (search, expand/collapse all, zoom, pan) | TP:84-90, `hierarchy-dialog.tsx:60-121` | `components/lcapix/workspace/hierarchy-view.tsx` (search, expand/collapse all, zoom, drag to pan) | GET /api/cases/:id, GET /api/cases/:id/components | kept |  |
| P20 | Node details: path, costs, flows, open in editor, dismiss | `node-details-card.tsx:105-252` | `components/lcapix/workspace/project-hub.tsx` `NodeDetails` (path, impact share, cost, flows, steps under it) | none | kept |  |
| P21 | Empty comparative: Clone from base / Start blank | `empty-case-overlay.tsx:80-91`, UPA:128-160 | `components/lcapix/workspace/project-hub.tsx` | POST /api/cases/:id/clone-from | kept | Only place in main that clones into an existing case |
| P22 | Impact overview (latest GWP, method, steps, categories, flows) | OVc:173-181 | `components/lcapix/workspace/project-hub.tsx` | GET /api/assessments/:runId | kept |  |
| P23 | Top contributors | OVc:183 | `components/lcapix/workspace/project-hub.tsx` | GET /api/assessments/:runId | kept |  |
| P24 | Cost summary | OVc:185 | `components/lcapix/workspace/project-hub.tsx` | GET /api/cases/:id/components | kept |  |
| P25 | ISO journey stepper, present/missing layers, run readiness | OVc:188-195, `case-journey.tsx` | `components/lcapix/workspace/project-hub.tsx` | GET /api/cases/:id/completeness | kept |  |
| P26 | Run Assessment (gated, remembered method/region) | CA c:36-46, UPA:164-199 | `components/lcapix/workspace/project-hub.tsx` | POST /api/cases/:id/assessments | kept | Lands on the workspace Results tab via redirect |
| P27 | Results button | CA c:47-59 | `components/lcapix/workspace/project-hub.tsx` | none | moved | /results redirects to ?tab=results (`case/[caseId]/results/page.tsx:16-20`) |
| P28 | Rename case (dialog) | CA c:60-68, OVc:211-220, UPA:64-95 | `components/lcapix/workspace/project-hub.tsx` TextDialog | PUT /api/cases/:id | kept | The only rename-case UI in main; not on Cases or in the workspace |
| P29 | Delete case (confirm) | CA c:69-79, UPA:36-62 | `components/lcapix/workspace/project-hub.tsx` ConfirmDialog, admin | DELETE /api/cases/:id | kept | Admin and above; the only delete-case UI |
| P30 | Every control visible to every member | PH c, CA c | `lib/project-role.ts` in `components/lcapix/workspace/project-hub.tsx` and the Cases menu; Delete case needs admin, as the server does | GET /api/projects/:id (my_role) | kept |  |

### Class /project/[projectId]/class (classic) vs People, Cases, Analytics (new)

| ID | Capability | Classic (9227580) | Now (main) | API | Status | Note |
|---|---|---|---|---|---|---|
| P31 | Reach the page | Overview Class button (PH c:110-117) | `app/project/[projectId]/class/page.tsx` server redirect to /cases | none | kept | Sidebar goes to /people; sample has no Overview button |
| P32 | Members list (owner, name, email, access) | CL:227-262 | PP:197-254 | GET /api/projects/:id/members | moved | |
| P33 | Add one person by email with role (admin only if owner) | CL:90-109, 264-286 | PP:289-292, 419-550 | POST /api/projects/:id/members | moved | Now also many emails and CSV |
| P34 | Change someone's access | CL:103 (re-add email) | PP:236-249 | POST /api/projects/:id/members | moved | Better: inline select |
| P35 | Remove member | CL:111-120, 250-253 | PP:254, 334-346 | DELETE /api/projects/:id/members?user_id= | moved | Now asks to confirm |
| P36 | "Students see only their own case" switch | CL:122-140, 172-218 | PP:293-320, 347-358 | PUT /api/projects/:id | moved | Turning it on now asks to confirm |
| P37 | Own-only notice for non-managers | CL:219-224 | `components/lcapix/project/people-page.tsx` own-only note for non-managers | GET /api/projects/:id/progress | kept |  |
| P38 | Per-case progress table with link to case | CL:291-353 | `cases-page.tsx` Progress on every card and the table | GET /api/projects/:id/progress | kept |  |
| P39 | Steps, flows, run count per case | CL:333-335 | `cases-page.tsx` steps · flows · runs | progress returns them (`progress/route.ts:97-117`) | kept |  |
| P40 | Lessons answered N of M, "predicted", lesson-title tooltip | CL:336-338 | `cases-page.tsx` Lessons column, "predicted", titles on hover | progress lessons_answered, prediction_made | kept |  |
| P41 | Write-up column (interpretation + assumptions) | CL:340-343 | `cases-page.tsx` Write-up column (`writeUpOf`) | progress has_interpretation, has_assumptions | kept | Assumptions not shown |
| P42 | Hand-in column | CL:344 | CP:231, ANm:127 | progress is_final | kept | |
| P43 | Editors/viewers can open the page | Overview Class button, read-only list | People for every member (`lib/shell/project-nav.ts` projectPagesFor); read-only list and notice for editors and viewers (`components/lcapix/project/people-page.tsx`) | GET /api/projects/:id/members | kept | class.spec.ts P43 test |
| P44 | Back to the project | CL:160-162 | sidebar | none | moved | |

### Analytics /project/[projectId]/analytics

| ID | Capability | Classic (9227580) | Now (main) | API | Status | Note |
|---|---|---|---|---|---|---|
| P45 | Single-case analytics for any case (?caseId, default base) | ANc:34, `lib/analytics/load.ts:12-25` | `components/lcapix/project/analytics-page.tsx:34` opens the case's full results page | GET /api/projects/:id/cases, GET /api/cases/:id/assessments, GET /api/assessments/:runId | kept |  |
| P46 | Who can open it | any member via Overview | A solo owner sees their own cases (`components/lcapix/project/analytics-page.tsx`) | none | kept | |
| P47 | Header: project name, assessed-case count | ANc:91-96 | `components/lcapix/project/analytics-page.tsx` counts the cases it shows | GET /api/projects/:id | kept | |
| P48 | PDF export (window.print) | `analytics-header.tsx:60-65` | `@media print` in `app/ds.css:1284` on the full results page | none | kept |  |
| P49 | Back to project button and breadcrumb | `analytics-header.tsx:31-37` | sidebar | none | moved | |
| P50 | Case card: GWP, change vs base, total cost, tiles | ANc:103, `case-cards.tsx` | `components/lcapix/workspace/full-results.tsx:190` | as P45 | kept |  |
| P51 | Verdict card | ANc:106-108 | MISSING | none | dropped | Dropped by Shreya 2026-10-27. Dead in classic too: only one case is loaded |
| P52 | Category comparison: Absolute / Radar / Log-scale toggle | ANc:111-115, `category-comparison-panel.tsx:110-120` | `components/lcapix/workspace/full-results.tsx:384` | as P45 | kept |  |
| P53 | Cost analysis: cost by kind, cost per unit impact | ANc:119-121, `cost-analysis-panel.tsx:174` | `components/lcapix/workspace/full-results.tsx:214`, from the run's frozen costs | GET /api/cases/:id/assessments (run_steps) | kept |  |
| P54 | Delta vs baseline chart | ANc:124-129 | MISSING | none | dropped | Dropped by Shreya 2026-10-27. Dead in classic (needs 2 loaded cases) |
| P55 | Component breakdown stacked bar | ANc:132-137 | `components/lcapix/workspace/full-results.tsx:446`, one bar per case | as P45 | kept |  |
| P56 | Component diff table | ANc:140-146 | `components/lcapix/workspace/full-results.tsx:248`, steps matched by their path of names | as P45 | kept |  |
| P57 | No-data card with Try again | ANc:98-99 | ANm:62-67 ErrorCard retry | none | kept | |

### Compare /project/[projectId]/comparison (and /comparisons redirects)

| ID | Capability | Classic (9227580) | Now (main) | API | Status | Note |
|---|---|---|---|---|---|---|
| P58 | Breadcrumb and back button | CMPc:268-286 | CMPm:127-138, sidebar | none | moved | |
| P59 | Pick any cases with chips; base can be deselected; no cap | CMPc:296-350 | `components/lcapix/compare/compare-page.tsx` chips toggle any case, the base included; COMPARE_MAX_CASES = 100 | GET /api/projects/:id/cases | kept |  |
| P60 | Default: base plus all copies | CMPc:127-137 | `lib/compare/use-compare.ts` defaultPick | none | kept |  |
| P61 | Shareable ?cases= URL | CMPc:207-214 | UC:110-113 | none | kept | |
| P62 | Re-read on window focus | CMPc:98-104 | UC:76-80 | none | kept | |
| P63 | Saved comparisons list with "Compare these" | CMPc:149-164, 353-395 | `components/lcapix/compare/compare-page.tsx` `SavedComparisons` (?tab=saved), GET /api/comparisons?project_id= | GET /api/comparisons?project_id= (still exists) | kept |  |
| P64 | Method / Region / Per-FU chips and mismatch warning | CMPc:410-440 | CMPm:192-222 | GET /api/projects/:id/compare | kept | Reworked as four checks |
| P65 | Compare across regions on purpose (warning only) | CMPc:428-438 | `lib/compare/comparability.ts` region is a warning; `verdict` says "Fair to compare, with a warning" | GET /api/projects/:id/compare | kept |  |
| P66 | Per-case total and % vs base | CMPc:705-729 | CMPm:229-268 | GET /api/projects/:id/compare | kept | |
| P67 | Per-case "N nodes · N flows" | CMPc:731 | `components/lcapix/compare/compare-page.tsx` per-case card | GET /api/projects/:id/compare | kept |  |
| P68 | Per-case run picker (run #, method, region, date) | CMPc:742-757, 181-186 | `components/lcapix/compare/compare-page.tsx` run picker (Run n · method · region · date); runs= kept in the address | compare?runs= still parsed (`compare/route.ts:20,72`) | kept |  |
| P69 | "Compared on run #x because ..." reason | CMPc:650-660 | `components/lcapix/compare/compare-page.tsx` "Compared on Run n because ..." when not the latest | GET /api/projects/:id/compare | kept |  |
| P70 | Stale run marker | CMPc:760-766 | CMPm:147-149, 247 | GET /api/projects/:id/compare | kept | Plus a new "Run again" button (UC:120-133) |
| P71 | Older run (no snapshot) note | CMPc:768-772 | `components/lcapix/compare/compare-page.tsx` older-run note when resultsSource is not snapshot | GET /api/projects/:id/compare | kept |  |
| P72 | Incomplete case: reason plus "Open the case" link | CMPc:696-704 | `components/lcapix/compare/compare-page.tsx` "Open the case" for a case with no run or an incomplete one | GET /api/projects/:id/compare | kept |  |
| P73 | Per-case Results link | CMPc:733-740 | CMPm:462-485 menu | none | moved | |
| P74 | Ranking: lowest copy in the category, with not-ranked reasons | CMPc:467-512 | `components/lcapix/compare/compare-page.tsx` `Ranking` (rankCases) with a reason for each case not ranked | none | kept |  |
| P75 | Next: "Duplicate the base to test another change" | CMPc:534-536 | `components/lcapix/compare/compare-page.tsx` "Duplicate the base" (case/new?kind=whatif&from=) | none | kept |  |
| P76 | Next: "Export a report" | CMPc:537-541 | Reports in sidebar | none | moved | |
| P77 | What differs, all copies (run scope, exchanges, steps, costs) | CMPc:600-602, `what-differs.tsx` | `components/lcapix/compare/what-differs.tsx` as the "What differs" tab | GET /api/projects/:id/compare | kept |  |
| P78 | Results tab (values / change / relative) | CMPc:603 | `components/lcapix/compare/compare-page.tsx` tabs always visible; a failed check says why | GET /api/projects/:id/compare | kept |  |
| P79 | Where the change comes from: by step or by material | CMPc:604, `change-panel.tsx:21` | `components/lcapix/compare/change-panel.tsx` as the "By step or material" tab | GET /api/projects/:id/compare | kept |  |
| P80 | Hotspots tab | CMPc:605 | `components/lcapix/compare/compare-page.tsx` Hotspots tab, always visible | GET /api/projects/:id/compare | kept |  |
| P81 | Cost tab | CMPc:606-608 | `components/lcapix/compare/compare-page.tsx` Cost tab, always visible | GET /api/projects/:id/compare | kept |  |
| P82 | Data quality tab | CMPc:609 | CMPm:445-446 | GET /api/projects/:id/compare | kept | Behind toggle |
| P83 | Impact category selector | CMPc:588-598 | CMPm:154-165 | none | kept | |
| P84 | Single case readable alone | CMPc:402-403 | `components/lcapix/compare/compare-page.tsx` `OneCase` | none | kept |  |

### Start /project/[projectId]/start

| ID | Capability | Classic (9227580) | Now (main) | API | Status | Note |
|---|---|---|---|---|---|---|
| P85 | Reach the page | NPc:120 after create | `app/project/[projectId]/start`, `case/base/new`, `case/comparative/new` go to `case/new?kind=` | none | kept |  |
| P86 | Build by hand: "Base case", described "Built by hand", opens with ?learn=1 (lesson rail + reference pane) | ST:26-52, 103-111 | `components/lcapix/project/new-case-form.tsx` "Built by hand" and ?learn=1; the case offers Guided mode (`case-workspace.tsx` LearnOffer) | POST /api/projects/:id/cases | kept |  |
| P87 | Start from documents, /import?first=1 (guided banner) | ST:138-144 | New case and New project open `/import?first=1` | none | kept |  |
| P88 | "Open the project and decide later" | ST:148-153 | `new-case-form.tsx` "Open the project and decide later" | none | kept |  |
| P89 | Base case name clash (409) | ST:40-43 | `start-empty.ts:18-22` | POST /api/projects/:id/cases | kept | |

### Import /project/[projectId]/import (page-level only)

| ID | Capability | Classic (9227580) | Now (main) | API | Status | Note |
|---|---|---|---|---|---|---|
| P90 | Header back button (to project or case) | IMc:58, `import-header.tsx` c:22-39 | `import/_components/import-header.tsx` "Back to the case/project" on every step | none | kept |  |
| P91 | Project status card | IMc:68-72 | IMm:130-132 | GET /api/cases/:id/completeness | kept | |
| P92 | Pick form: connector, new or append, attach step, file, plant id, lot size, preview, sample, template | IMc:74-98 | IMm:134-160 | POST /api/ingest/preview | kept | Adds reads-left |
| P93 | Append banner with unplaced count | IMc:102-104 | IMm:74-82 (Save blocked reason) | none | moved | |
| P94 | Case name | IMc:105-107 | IMm:165-170 | none | kept | |
| P95 | Apply / Start over | IMc:151-157 | IMm:113 | POST /api/ingest/apply | kept | |
| P96 | Done: completeness checklist, add another, open case, start new | IMc:161-169 | IMm:255-267, `done-card.tsx:108-144` | GET /api/cases/:id/completeness | kept | Checklist reworded as "where it stands" |
| P97 | Sample dialog (load, download, copy) | IMc:173-181 | IMm:271-273 | none | kept | |
| P98 | Error card with ID hints | IMc:60-62 | IMm:117-126 | none | kept | Adds choose another, try sample, start empty |

### New case: case/base/new, case/comparative/new, case/new

| ID | Capability | Classic (9227580) | Now (main) | API | Status | Note |
|---|---|---|---|---|---|---|
| P99 | Base case: name + multi-line description | BN:246-290, 55-62 | NC:171-233, 95; BN unchanged | POST /api/projects/:id/cases | kept | New form: description is one line, 500 chars |
| P100 | Comparative: pick reference base case | CN:317-337, 96 | NC:151-167 | POST /api/cases/:id/duplicate (sets parent_case_id, `duplicate/route.ts:98`) | kept | Can now copy any case |
| P101 | Copy base steps, flows, costs (checkbox, on by default) | CN:345-356, 106-120 | NC always copies | POST /api/cases/:id/clone-from vs /duplicate | kept | |
| P102 | Empty comparative case (copy unticked) | CN:350 | `new-case-form.tsx` empty comparative with parent_case_id; ?kind=emptycomp | POST /api/projects/:id/cases | kept |  |
| P103 | Name clash 409 shown | BN, CN | NC:97 | POST /api/projects/:id/cases | kept | |
| P104 | Reach the forms | Overview Add Case (P09) | Cases "+ New case" (CP:105-107) to NC; BN and CN only via Overview | none | kept | Two parallel flows now |

### New project /project/new

| ID | Capability | Classic (9227580) | Now (main) | API | Status | Note |
|---|---|---|---|---|---|---|
| P105 | Name, required, 409 inline | NPc:218-246, 122-123 | NPm:148-165, 101 | POST /api/projects | kept | |
| P106 | Goal of the study (description + goal_statement) | NPc:248-270, 67-69, 95 | `components/lcapix/project/new-project-form.tsx` goal saved as description and goal_statement | POST /api/projects, PUT /api/projects/:id | kept |  |
| P107 | Functional unit | NPc:281-293 | NPm:174-177 | PUT /api/projects/:id | kept | |
| P108 | System boundary | NPc:294-310 | NPm:178-187 | PUT /api/projects/:id | kept | |
| P109 | Method | NPc:322-347 | NPm:188-195 | PUT /api/projects/:id | kept | Now defaults to the sample's |
| P110 | Region | NPc:348-372 | NPm:196-205 | PUT /api/projects/:id | kept | |
| P111 | ISO help tips (goal, FU, boundary, method, region) | NPc:252,284,297,325,351 | `new-project-form.tsx` HelpTip (`components/lcapix/workspace/help-tip.tsx`) on goal, FU, boundary, method, region | none | kept |  |
| P112 | ISO five-phase rail | NPc:178-204 | `new-project-form.tsx` five-phase rail, classic text | none | kept |  |
| P113 | Warning when settings fail to save | NPc:107-111 | NPm:236-257 | PUT /api/projects/:id | kept | Better: Continue anyway / Open the project |
| P114 | Then choose how to start | NPc:120 (to /start) | NPm:212-234 | none | moved | |
| P115 | Cancel / Back | NPc:147-166, 384-394 | NPm:135-140, 264 | none | kept | |
| P116 | "ISO 14040/44 Compliant" chip | NPc:408-427 | MISSING | none | dropped | Dropped by Shreya 2026-10-27. Decorative |

### Cases /project/[projectId]/cases (new; no classic page)

| ID | Capability | Classic (9227580) | Now (main) | API | Status | Note |
|---|---|---|---|---|---|---|
| P117 | Case list with base/comparative | CT:57-343 (tabs) | CP:110-257 | GET /api/projects/:id/progress | moved | Overview tabs also kept |
| P118 | Rename / delete / clone / run a case from the list | CA, TP (Overview) | `components/lcapix/project/cases-page.tsx` CaseMenu: rename (dialog), copy, run, delete (confirm), role-gated | PUT/DELETE /api/cases/:id | kept |  |
| P119 | Import from the case list | PH Import button | MISSING on CP; NC "From a file" and Overview | none | moved | |

### Reports /reports (new)

| ID | Capability | Classic (9227580) | Now (main) | API | Status | Note |
|---|---|---|---|---|---|---|
| P120 | Export a run as PDF, PPTX or CSV | `results-header.tsx:200` (case results page) | RP:255-277 | GET /api/assessments/:runId/export?format= | moved | |
| P121 | Pick project, case, run | results page run history | RP:175, 196, 207 | GET /api/cases/:id/assessments | kept | |
| P122 | Export analytics or a comparison | ANc print (P48); CMPc link (P76) | MISSING; RP:369 "Coming soon" | none | missing | |

### Project settings (cross-page)

| ID | Capability | Classic (9227580) | Now (main) | API | Status | Note |
|---|---|---|---|---|---|---|
| P123 | Rename project | none in classic UI | `components/lcapix/workspace/project-settings.tsx` name; header and sidebar update on save | PUT /api/projects/:id (project_name accepted) | kept |  |
| P124 | Delete project | P10 | P10 | DELETE /api/projects/:id | kept | Overview only |
| P125 | Archive project | none (Home shows status only, `lib/home/projects.ts:57`) | MISSING | none (inferred: no column, no route) | missing | Not a regression |
| P126 | Edit FU, boundary, goal, exclusions after creation | case editor GoalScopeCard: `lib/case-editor/use-goal-scope.ts:95-125`, `goal-scope-card.tsx:113-197` | `project-settings.tsx` FU, boundary, goal, exclusions | PUT /api/projects/:id | kept |  |
| P127 | Change project default method/region after creation | none (chosen per run) | `project-settings.tsx` default method and region | PUT /api/projects/:id (lcia_method, region_code accepted) | kept |  |
| P128 | Members and roles | P32-P36 | PP | /members GET, POST, DELETE | moved | |
| P129 | Duplicate a case | CN + clone-from; P21 | NC; workspace `make-copy.ts:12-24` and `results-panel.tsx:93` | POST /api/cases/:id/duplicate | kept | |
| P130 | Rename case | P28 | P28 | PUT /api/cases/:id | kept | Overview only |
| P131 | Delete case | P29 | P29 | DELETE /api/cases/:id | kept | Overview only |
| P132 | Case hand-in status | shown at CL:344; set in `write-up-card.tsx:57` | shown on CP and ANm; set in `write-up-panel.tsx:62` | PUT /api/cases/:id (is_final) | moved | |

### Classic project shell (top bar on every project page)

| ID | Capability | Classic (9227580) | Now (main) | API | Status | Note |
|---|---|---|---|---|---|---|
| P133 | Tour button | TB:279-312 | MISSING (TB:122 returns null in the shell; GlobalTour still mounted, project `layout.tsx:23`) | none | missing | Inferred: Guided mode is a different feature |
| P134 | Search button | TB:333-342 | HIDDEN: Cmd+K only (`command-palette.tsx:46`) | none | hidden | |
| P135 | Notifications bell | TB:362-460 | MISSING in the shell | none | missing | Inferred |
| P136 | Docs, profile, Integrations, logout | TB:25-28, 560-600 | `sidebar.tsx:225-273` | none | moved | |
| P137 | The sidebar counts a case or a person added, without a reload (findings 1.9, 2.4) | n/a (discovery run) | `lib/shell/use-shell.ts` (the newest load wins); refresh after the case exists (`new-project-form.tsx`, Cases menu) | - | kept |  |
| P138 | Cases board: the base case is not "copied", and "N people have no case yet" is counted only from a view that sees every case (finding 2.7) | n/a (discovery run) | `components/lcapix/project/cases-page.tsx` | - | kept |  |
| P139 | Compare: A and B show the same number with the same decimals (finding 2.9) | n/a (discovery run) | `components/lcapix/compare/compare-page.tsx` | - | kept |  |
| P140 | Compare: pickers for A and B, and the letters follow the pick (finding 2.10) | n/a (discovery run) | `components/lcapix/compare/compare-page.tsx` | - | kept |  |
| P141 | The Overview uses the number and money formats of Results (finding 3.4) | n/a (discovery run) | `lib/project/workspace.ts` workspaceKpis; `components/lcapix/workspace/project-hub.tsx` | - | kept |  |

### Classic capabilities the new navigation no longer links to

- `/project/[id]/class`, the per-case progress table with lessons, steps and flows. Only from the Overview "Class" button, and not on the sample.
- `/case/base/new`, `/case/comparative/new` and the empty-comparative option. Only from Overview Add Case.
- Clone from base, rename case, delete case, delete project. Overview only.
- `/project/[id]/start` and the `?learn=1` lesson rail. Nothing links to them.
- The saved comparisons list. `/comparisons` redirects to a page that ignores `?tab=saved`.
- People for editors and viewers: typed URL only.
- Analytics for a solo owner: the sidebar hides it, and the Overview button leads to an empty state.
- Flag only, unreachable in production: classic Analytics, classic Compare, classic new-project form, classic results page, the classic editor's GoalScopeCard.

### Missing or partial, needs only UI

P37, P39, P40, P41, P45, P48, P50, P52-P56 (the components still exist under `analytics/_components`), P63, P65, P67, P68, P69, P71, P72, P74, P75, P77, P79 (WhatDiffersPanel and ChangePanel still exist), P78, P80, P81, P84, P86, P87, P102, P106, P111, P112, P118, P123, P126, P127, P133, P135. Also P13: replace the hardcoded numbers with a real comparison from GET /api/projects/:id/compare.

### Needs API or schema

- P125 archive project: no column or route (inferred).
- P122 comparison or analytics report export: the export route works per run only (inferred).
- Saving or deleting comparisons was never in the classic UI. POST and DELETE /api/comparisons exist, so that would be UI only if wanted.

## G. Home, library, account, navigation

Read-only audit of Home, the factor and substance libraries, profile, admin integrations, the auth pages, global navigation, the command palette and the Magic Insights entry points, classic 9227580 against main 8a2e27c (main changed only APIs after 66d49ff, so the UI picture is the 66d49ff one). Top findings, all verified by reading code:

1. /library/factors and /library/substances are orphaned: their only links were the Home KPI tiles (lib/home/projects.ts:174,182), which now render only under SHELL=classic.
2. The Home onboarding gate is gone (lib/home/use-home.ts:58-75 is classic only): an email sign-up who leaves before About you is never sent back; login goes straight to /home.
3. Profile and onboarding disagree: onboarding makes institution optional and offers teaching/lab/own_study; /profile still requires "Company" and offers only the 5 legacy use cases. A user who skipped institution cannot save any profile edit, and editing use case overwrites "teaching", which Home uses.
4. Notifications bell, recent-activity feed and Tour button are gone from the shell; /guide/* and /about still render the classic top bar outside the shell, where the bell and a dead Tour button survive.
5. Saved comparisons are unreachable: /comparisons redirects to ?tab=saved, which the new Compare page ignores.
6. Command palette "Recent projects" reads a store nothing fills under the shell.
7. Guide and FAQ describe the classic results page and classic analytics (run modal, KPI strip, radar, PDF export, log scale), all now behind the flag.

Legend: `atb` = components/lcapix/app-top-bar.tsx, `sb` = components/lcapix/shell/sidebar.tsx, `eh` = components/lcapix/home/edu-home.tsx, `hc/` = app/home/_components/, `cp` = components/global/command-palette.tsx, `pp` = app/profile/page.tsx. C: = file at 9227580, M: = file on main. Rows are verified unless the Note says inferred.

### Home (/home)

| ID | Capability | Classic (9227580) | Now (main) | API | Status | Note |
|---|---|---|---|---|---|---|
| G01 | Dashboard at /home | app/home/page.tsx:21-116 | app/home/page.tsx:12-15 -> eh:25-59 | - | moved | classic dashboard only with SHELL=classic (hc/classic-home.tsx) |
| G02 | Onboarding gate: needsOnboarding -> /auth/onboarding | lib/home/use-home.ts:58-75 | `app/auth/login/page.tsx` needsOnboarding (one rule with Google) | GET /api/auth/profile (still returns needsOnboarding, app/api/auth/profile/route.ts:59) | kept |  |
| G03 | Greeting + project count line | hc/home-greeting.tsx:23-31 | eh:160-161; lib/home/home-view.ts:62-70 | GET /api/projects, /api/auth/profile | kept | |
| G04 | "Walk me through" guided tour | hc/home-greeting.tsx:34-41; app/home/page.tsx:109-113 | MISSING; Guided mode switch sb:218-224 | - | dropped | Dropped by Shreya 2026-10-27. different feature: guide cards only where a page calls useSidebarGuide (lib/shell/guide-slot.ts:20) |
| G05 | New project | hc/home-greeting.tsx:42-48 | eh:196-198; sb:205-212 | POST /api/projects (on /project/new) | kept | hidden for students (lib/shell/project-nav.ts:165-169) |
| G06 | KPI PROJECTS | lib/home/projects.ts:156-161; hc/home-kpis.tsx:19-31 | `components/lcapix/home/edu-home.tsx` Home counts | GET /api/projects | kept |  |
| G07 | KPI CASES + process steps | projects.ts:162-168 | `components/lcapix/home/edu-home.tsx` Home counts | GET /api/projects (case_count, component_count still sent, app/api/projects/route.ts:26-29) | kept |  |
| G08 | KPI FACTORS, links /library/factors | projects.ts:169-176 | `components/lcapix/home/edu-home.tsx` factors tile, says when it could not load | GET /api/integrations/status | kept |  |
| G09 | KPI SUBSTANCES, links /library/substances | projects.ts:177-184 | `components/lcapix/home/edu-home.tsx` substances tile, says when it could not load | GET /api/integrations/status | kept |  |
| G10 | Filter chips All / Single case / Comparison / Active | hc/projects-toolbar.tsx:54-78; projects.ts:77-93 | `components/lcapix/home/edu-home.tsx` Segmented filter | client | kept |  |
| G11 | Search projects | hc/projects-toolbar.tsx:80-112 (name + description) | `components/lcapix/home/edu-home.tsx` HomeSearch matches descriptions | GET /api/projects/{id}/cases per project | kept |  |
| G12 | Grid / list toggle | hc/projects-toolbar.tsx:113-170 | `components/lcapix/home/edu-home.tsx` Layout grid or list | - | kept |  |
| G13 | Sort control | none | none | order is updated_at DESC (app/api/projects/route.ts:84) | missing | Not a regression: absent in classic too; the switcher orders by activity (project-nav.ts:93-109) |
| G14 | Open project | hc/project-list-views.tsx:29,186 | eh:203 | - | kept | |
| G15 | Card: description | project-list-views.tsx:50-62 | `components/lcapix/home/edu-home.tsx` card | GET /api/projects (description still sent) | kept |  |
| G16 | Card: active/archived chip | project-list-views.tsx:64-78 | MISSING | none | missing | always "active" in classic |
| G17 | Card: case count | project-list-views.tsx:92-100 | eh:206 (home-view.ts:132-137) | GET /api/projects | kept | adds people and hand-ins |
| G18 | Card: process step count | project-list-views.tsx:102-110 | `components/lcapix/home/edu-home.tsx` card | component_count still sent | kept |  |
| G19 | Card: last run | project-list-views.tsx:112; projects.ts:60-62 | `components/lcapix/home/edu-home.tsx` card "Last run" | GET /api/projects (base_run) | kept |  |
| G20 | Card: SINGLE CASE / COMPARISON chip | project-list-views.tsx:122-132 | `components/lcapix/home/edu-home.tsx` card chip | - | kept |  |
| G21 | Card: "Updated X ago" | project-list-views.tsx:133-141 | `components/lcapix/home/edu-home.tsx` card | updated_at still sent | kept |  |
| G22 | List view columns Name/Type/Cases/Comps/Last run/Updated | project-list-views.tsx:150-238 | `components/lcapix/home/edu-home.tsx` ProjectList | - | kept |  |
| G23 | Delete project from the list | none | only "Remove the sample" eh:137-150,246 | DELETE /api/projects/{id} | missing | Not a regression: absent in classic too; delete stays on the overview header (lib/project/use-project-actions.ts:102-115) |
| G24 | Pin project | none | `components/lcapix/home/edu-home.tsx` Pin / Unpin, named, says why it failed | PUT/DELETE /api/projects/{id}/pin | kept |  |
| G25 | Load error + Retry | hc/project-states.tsx:12-40 | eh:35-41 | GET /api/projects | kept | |
| G26 | Loading state | project-states.tsx:43-72 | eh:42-48 | - | kept | text, not skeleton |
| G27 | Empty: ISO 14040 five-phase rail | project-states.tsx:95-99; projects.ts:192-218 | `components/lcapix/home/edu-home.tsx` EmptyHome ISO rail | - | kept |  |
| G28 | Empty: create first project | project-states.tsx:111-116 | eh:106-117 | - | kept | |
| G29 | Empty: worked example | project-states.tsx:117-125; use-home.ts:131-151 | eh:93-105 "Open the sample study"; also onboarding | POST /api/example-project | kept | stays on /home instead of opening the project |
| G30 | Empty: trust strip | project-states.tsx:127-130 | `components/lcapix/home/edu-home.tsx` EmptyHome trust strip | - | kept |  |
| G31 | Recent activity sidebar | hc/recent-activity.tsx:8-95 | MISSING | none (client store) | dropped | Dropped by Shreya 2026-10-27. |

### /library/factors (file unchanged except punctuation; line numbers match in both)

| ID | Capability | Classic (9227580) | Now (main) | API | Status | Note |
|---|---|---|---|---|---|---|
| G32 | Entry point | via G08 | `app/library/factors/page.tsx` in the shell, ds | - | kept |  |
| G33 | Page chrome | AppTopBar app/library/factors/page.tsx:137 | shell (app/library/layout.tsx:1-6; atb:122 returns null) | - | moved | |
| G34 | Back to home | :147-165 | same | - | kept | |
| G35 | Header: N factors across M methods | :168-177 | same | GET /api/integrations/status, GET /api/driver-factors | kept | |
| G36 | Explainer | :179-220 | same | - | kept | |
| G37 | Filter by method chips | :222-268 | same | - | kept | |
| G38 | Filter by impact category | none | none | - | missing | Not a regression: absent in classic too; search matches category (:129) |
| G39 | Search substance/method/region/source/category | :119-132, :273-293 | same | - | kept | |
| G40 | Table with Source column (factor sources) | :348-386 | same | GET /api/driver-factors | kept | |
| G41 | Data quality score shown | typed :34, never rendered | same | - | missing | Not a regression: absent in classic too |
| G42 | 200-row cap notice | :361, :400 | same | - | kept | |
| G43 | Error state | :102-107 | same | - | kept | |
| G44 | Edit factor | none | none | no write route (driver-factors GET only) | missing | Not a regression: absent in classic too |

### /library/substances (unchanged except punctuation)

| ID | Capability | Classic (9227580) | Now (main) | API | Status | Note |
|---|---|---|---|---|---|---|
| G45 | Entry point | via G09 | `app/library/substances/page.tsx` in the shell, ds | - | kept |  |
| G46 | Page chrome | AppTopBar app/library/substances/page.tsx:125 | shell | - | moved | |
| G47 | Back to home | :135-155 | same | - | kept | |
| G48 | Header counts | :158-160 | same | GET /api/substances | kept | |
| G49 | Explainer | :186-200 | same | - | kept | |
| G50 | Category cards filter | :202-270 | same | - | kept | |
| G51 | Search name/CAS/category | :110-120, :274-293 | same | - | kept | |
| G52 | Clear filter | :304-306 | same | - | kept | |
| G53 | Table substance/CAS/category/unit | :363-385 | same | - | kept | |
| G54 | 200-row cap | :373, :397 | same | - | kept | |
| G55 | Add custom substance | not on page; lib/case-editor/use-add-flow-form.ts:261 | not on page; same hook via components/lcapix/workspace/add-flow-in-panel.tsx:11-18 | POST /api/substances (route.ts:87) | kept | never on the library page |
| G56 | Edit substance | none | none | no PUT (route.ts GET :9, POST :87) | missing | Not a regression: absent in classic too |

### /profile

| ID | Capability | Classic (9227580) | Now (main) | API | Status | Note |
|---|---|---|---|---|---|---|
| G57 | Reached from account menu | atb:563-573 | sb:261-263 | - | moved | |
| G58 | Page chrome | AppTopBar pp:217 | shell (app/profile/layout.tsx) | - | moved | |
| G59 | Back to home | pp:228-250 | same | - | kept | |
| G60 | Header: name, email, company | pp:252-266 | same | GET /api/auth/profile | kept | |
| G61 | Meta row: role, focus, country, joined | pp:270-277, 514-575 | `app/profile/page.tsx` meta row | GET /api/auth/profile | kept |  |
| G62 | Edit full name (required) | pp:324-336 | same | PUT /api/auth/profile | kept | |
| G63 | Edit country | pp:339-356 | pp:339-358 | PUT /api/auth/profile | kept | onboarding no longer asks |
| G64 | Edit company (required) | pp:365-377, :172 | `app/profile/page.tsx` optional | PUT /api/auth/profile | kept |  |
| G65 | Edit role | pp:378-386 | pp:379-387 | PUT /api/auth/profile | kept | now the only place to set it |
| G66 | Edit primary use case | pp:387-402 (5 legacy) | `app/profile/page.tsx` onboarding choices | PUT (accepts both sets, lib/onboarding.ts:26-31) | kept |  |
| G67 | Read-only email / username / member since | pp:411-428 | pp:413-430 | GET /api/auth/profile | kept | |
| G68 | Load error + Retry | pp:281-308 | same | GET /api/auth/profile | kept | |
| G69 | Discard / Save bar | pp:~480-498 | pp:~482-500 | PUT /api/auth/profile | kept | |
| G70 | Change password | none | none | no route (app/api/auth has google, login, logout, me, profile, signup) | missing | Not a regression: absent in classic too |
| G71 | Delete account | none | none | no route | missing | Not a regression: absent in classic too |
| G72 | Sign out | not on page; atb:599-606 | not on page; sb:269-271 (lib/auth/sign-out.ts:18-34) | POST /api/auth/logout | kept | also clears lcapix-recent-projects |
| G73 | API tokens | none | none | no route or table | missing | Not a regression: absent in classic too |

### /admin/integrations (page and tabs unchanged)

| ID | Capability | Classic (9227580) | Now (main) | API | Status | Note |
|---|---|---|---|---|---|---|
| G74 | Top-nav link (admins) | atb:25-29, 263 | not in top-level nav | GET /api/auth/me | moved | profile menu only, sb:264-268 |
| G75 | Account menu entry (admins) | atb:585-597 | sb:264-268 | GET /api/auth/me | kept | |
| G76 | Palette "Admin" (all users) | cp:91-94 | cp:97-100 | - | kept | non-admins get the access notice |
| G77 | Admin gate / access notice | app/admin/integrations/page.tsx:14-25 | same | GET /api/auth/me | kept | |
| G78 | Refresh | _components/dashboard-header.tsx:56-60; overview-tab.tsx:37-39 | same | GET /api/integrations/status | kept | |
| G79 | Tabs Overview / Data Sources / API Keys / Activity Log / Schema | lib/admin/integrations.ts:139-145 | same | GET /api/integrations/status, GET /api/integrations/log | kept | |
| G80 | Import openLCA CML 2001, PubChem enrich | components/integrations/import-buttons.tsx:30,39 | same | POST /api/integrations/openlca/import, POST /api/integrations/pubchem/enrich | kept | |
| G81 | Page chrome | AppTopBar integrations-dashboard.tsx:22 | shell (app/admin/layout.tsx) | - | moved | |

### /auth/login

| ID | Capability | Classic (9227580) | Now (main) | API | Status | Note |
|---|---|---|---|---|---|---|
| G82 | Email + password login | C:115-163 | M:106-136 | POST /api/auth/login | kept | |
| G83 | Show/hide password | C:218-238 | M:188-190 | - | kept | |
| G84 | Field validation | C:95-113 | M:97-104 | - | kept | |
| G85 | Bad-credentials message | C:156-160 (toast + line) | M:122-125 (under password) | POST /api/auth/login | moved | |
| G86 | Google sign-in | C:276-285 | M:149-152 | GET /api/auth/google | kept | |
| G87 | ?error= codes (10 known, generic fallback) | C:22-63, 80-93 (toast) | M:29-70, 87-95, 143-147 (ErrorCard) | - | kept | |
| G88 | "Welcome back!" toast | C:152-154 | MISSING | - | dropped | Dropped by Shreya 2026-10-27. info only |
| G89 | Redirect to /home | C:155 | M:130 | - | kept | no onboarding gate there now (G02) |
| G90 | Link to sign-up | C:287-295 | M:201-206 | - | kept | |
| G91 | Forgot / reset password | none | M:173-175, 193 "coming soon" | no route | missing | Not a regression: absent in classic too; now advertised |

### /auth/signup

| ID | Capability | Classic (9227580) | Now (main) | API | Status | Note |
|---|---|---|---|---|---|---|
| G92 | Name / email / password create | C:48-99, 121-198 | M:40-78, 94-145 | POST /api/auth/signup | kept | |
| G93 | Password rule + hint | C:36-42, 194-196 | M:33-35, 141-143 | - | kept | |
| G94 | Duplicate / other errors | C:92-95 (toast + line) | M:58-61, 112-119 (inline + "Log in instead") | POST /api/auth/signup | kept | |
| G95 | Google sign-up | C:231-240 | M:87-90 | GET /api/auth/google | kept | |
| G96 | "Account created" toast | C:86-88 | MISSING | - | dropped | Dropped by Shreya 2026-10-27. info only |
| G97 | Then go to onboarding | C:91 | M:72 | - | kept | |
| G98 | Link to login | C:242-250 | M:163-168 | - | kept | |

### /auth/onboarding

| ID | Capability | Classic (9227580) | Now (main) | API | Status | Note |
|---|---|---|---|---|---|---|
| G99 | Prefill from profile | C:48-73 | M:39-59 | GET /api/auth/profile | kept | |
| G100 | Leave if already done | C:63 | M:51 | GET /api/auth/profile | kept | done now means onboarded_at only (lib/onboarding.ts:34-36); classic also reopened it when company was empty |
| G101 | Full name required | C:78, 193-205 | M:78-81, 132-145 | PUT /api/auth/profile | kept | |
| G102 | Company required | C:79, 207-218 | M:146-159 "Institution", optional | PUT /api/auth/profile | moved | intentional; clashes with /profile (G64) |
| G103 | Role (optional) | C:220-227 | MISSING (old value kept, M:32, 91) | PUT /api/auth/profile | moved | /profile only |
| G104 | Use case (5 options) | C:22-28, 229-242 | `lib/onboarding.ts` USE_CASES | PUT /api/auth/profile | kept |  |
| G105 | Country (optional) | C:244-251 | MISSING (old value kept, M:93) | PUT /api/auth/profile | moved | /profile only |
| G106 | Save, then /home | C:75-118 | `app/auth/onboarding/page.tsx` the button says what Save will do | PUT /api/auth/profile, POST /api/example-project | kept |  |
| G107 | Success / failure toasts | C:109, 114 | M:212-230 inline | - | moved | |

### /auth/callback and Google route

| ID | Capability | Classic (9227580) | Now (main) | API | Status | Note |
|---|---|---|---|---|---|---|
| G108 | Token hand-off, store, redirect (next whitelist /home, /auth/onboarding) | app/auth/callback/page.tsx:44-91 | unchanged | POST /api/auth/google/session | kept | |
| G109 | Failure: toast + /auth/login?error=oauth_sync_failed | :92-98 | unchanged; login shows it as a card | - | kept | |
| G110 | Choose onboarding vs home | app/api/auth/google/route.ts (onboarded_at or company) | `app/api/auth/google/route.ts` needsOnboarding | GET /api/auth/google | kept |  |

### Global navigation (classic AppTopBar vs shell)

| ID | Capability | Classic (9227580) | Now (main) | API | Status | Note |
|---|---|---|---|---|---|---|
| G111 | Logo -> /home | atb:251-253 | sb:85-93 | - | kept | |
| G112 | Projects -> /home | atb:26, 263-276 | sb:96-107 Home; sb:199-204 All projects | - | kept | |
| G113 | Docs -> /guide | atb:28 | sb:225-228 "Help" | - | kept | /guide leaves the shell (G121) |
| G114 | Integrations (admins) | atb:27 | sb:264-268 | GET /api/auth/me | moved | same as G74 |
| G115 | Tour button (contextual guided tour) | atb:283-313; components/global/global-tour.tsx | MISSING in shell | - | dropped | Dropped by Shreya 2026-10-27. GlobalTour still mounted (app/project/layout.tsx:23) with no trigger; the button survives only on /guide and /about, where nothing listens |
| G116 | Search ⌘K hint | atb:314-357 (not clickable) | MISSING in sidebar; sample Overview button components/lcapix/home/sample-overview.tsx:390-397 | - | partial | ⌘K still works |
| G117 | Notifications bell: unread count, list, mark all read, open target | atb:358-513 | MISSING in shell; HIDDEN on /guide and /about | none (client store) | dropped | Dropped by Shreya 2026-10-27. nothing in the workspace pushes events (only producer: lib/results/use-results.ts:179, classic results page) |
| G118 | Account menu: name + email | atb:551-561 | sb:241-253 name + institution; email only when no name | GET /api/auth/profile | partial | |
| G119 | Account menu: Profile | atb:563-573 | sb:261-263 | - | kept | |
| G120 | Account menu: Log out | atb:599-606 | sb:269-271 | POST /api/auth/logout | kept | |
| G121 | One nav on every signed-in page | AppTopBar in app/project/layout.tsx:21 and each page | shell on SignedIn layouts (home, project, library, profile, admin, findings, reports); classic bar still on /guide/* (app/guide/layout.tsx:24-26) and /about (app/about/page.tsx:43-45) | - | partial | two navs; Help drops the sidebar |
| G122 | Recent projects shortcut | cp:62-69, 105-120 | sb:181-196 Recent; components/lcapix/shell/project-switcher.tsx:30-205 | GET /api/projects | moved | |
| G123 | Page /library/factors | linked via G08 | sidebar and Home tile | - | kept |  |
| G124 | Page /library/substances | linked via G09 | sidebar and Home tile | - | kept |  |
| G125 | Page /project/[id]/start | app/project/new/page.tsx:120 | `/project/[id]/start` goes to case/new?kind=hand | - | kept |  |
| G126 | Saved comparisons /project/[id]/comparisons and /comparisons/[id] | list on app/project/[projectId]/comparison/page.tsx:85-160 | `components/lcapix/compare/compare-page.tsx` ?tab=saved | GET /api/comparisons | kept |  |
| G127 | Page .../case/[caseId]/component/new | Redirects to the case with the Add step form open (`?add=step`) | `app/project/[projectId]/case/[caseId]/component/new/page.tsx` | - | kept | |
| G128 | Page .../component/[componentId]/edit | Redirects to the case with that step selected (`?componentId=`) | `app/project/[projectId]/case/[caseId]/component/[componentId]/edit/page.tsx` | - | kept | |
| G129 | Case-by-case analytics (radar, normalised view, log scale, PDF export) | app/project/[projectId]/analytics/page.tsx | `components/lcapix/workspace/full-results.tsx:384` (Absolute, Radar, Log scale) and print | - | kept |  |
| G130 | /project/[id]/case/[caseId]/results | page | `components/lcapix/workspace/full-results.tsx` | - | kept | |

### Command palette

| ID | Capability | Classic (9227580) | Now (main) | API | Status | Note |
|---|---|---|---|---|---|---|
| G131 | Open with ⌘K / Ctrl+K | cp:44-53 | cp:44-58 | - | kept | also opens on lcapix:open-search (cp:51-57) |
| G132 | Home | cp:83-86 | cp:89-92 | - | kept | |
| G133 | Projects | cp:87-90 | cp:93-96 | - | kept | |
| G134 | Admin | cp:91-94 | cp:97-100 | - | kept | |
| G135 | About | cp:95-98 | cp:101-104 | - | kept | page sits outside the shell |
| G136 | Guide | cp:99-102 | cp:105-108 | - | kept | page sits outside the shell |
| G137 | Recent projects (top 5) | cp:62-69, 105-120, fed by lib/home/use-home.ts:91 | cp:69-75, 111-126 reads useProjectStore; its only setter is use-home.ts:91 (classic) | - | partial | inferred runtime: empty, or a stale persisted list until sign-out |
| G138 | Theme Light / Dark / High contrast | cp:124-137 | cp:130-143 | - | dropped | Dropped by Shreya 2026-10-27. app/ds.css has 0 dark or high-contrast rules; inferred: the shell stays light |
| G139 | Commands for Findings, Reports, New project, Profile, Log out | none | none | - | missing | Not a regression: absent in classic too |

### Magic Insights entry points

| ID | Capability | Classic (9227580) | Now (main) | API | Status | Note |
|---|---|---|---|---|---|---|
| G140 | Results header button, pulses after a run | components/lcapix/results/results-header.tsx:224-240; lib/results/use-results.ts:177 | classic results only (flag); workspace buttons tree-tab.tsx:406, inventory-tab.tsx:136, results-panel.tsx:307 | POST /api/insights | moved | no pulse |
| G141 | Next-steps "See what drives it" | components/lcapix/results/next-steps-bar.tsx:34-40 | classic results only | POST /api/insights | moved | |
| G142 | Opens on the category picked on Results | app/project/[projectId]/case/[caseId]/results/page.tsx:280 | `components/lcapix/workspace/full-results.tsx:153` Magic Insights opens on the category chosen on the full results page | - | kept |  |
| G143 | AI narration | lib/insights/use-magic-insights.ts (facts only) | adds run_id (use-magic-insights.ts:216); server number-check, cache, project switch (app/api/insights/route.ts:206-212) | POST /api/insights | kept | no run means computed text only |
| G144 | Project AI on/off switch | none | `project-settings.tsx`, owner only; `lib/data-transformers.ts` reads ai_enabled so a save never flips it | PUT /api/projects/{id} ai_enabled (route.ts:143-147) | kept |  |
| G145 | Footer: provenance, Open case editor, Close | components/lcapix/magic-insights/footer.tsx | same file, names the model or "Computed by LCAPIX" | - | kept | |
| G146 | Tour step on Magic Insights | lib/lcapix-tour-steps.ts:92 | same | - | dropped | Dropped by Shreya 2026-10-27. its anchor data-tour="results-magic-insights" is rendered in neither version (grep); the tour is unreachable in the shell |
| G147 | Teaching a class leads somewhere: Home offers to set up a class, students seeing only their own case (finding 2.1) | n/a (discovery run) | `components/lcapix/home/edu-home.tsx` SetUpClass | - | kept |  |
| G148 | Sign-up and onboarding name students (finding 1.11) | n/a (discovery run) | `app/auth/signup/page.tsx`; `lib/onboarding.ts` "Student in a class" | - | kept |  |
| G149 | Guided mode says where the setting is kept, with no COMING SOON (finding 1.12) | n/a (discovery run) | `app/auth/onboarding/page.tsx`; sidebar | - | kept |  |
| G150 | Screen readers get names for the onboarding radios and New project's start choice and dropdowns (finding 1.13) | n/a (discovery run) | `components/lcapix/project/new-project-form.tsx`; onboarding | - | kept |  |

### Needs only UI

The API already serves or accepts the data.

- Home: G02 onboarding gate; G06 to G09 KPI tiles, which were the only library entry points (G32, G45, G123, G124); G10 chips except "Active", G11 description search, G12 grid/list, G15 to G22 card and list fields (description, component_count, updated_at, last_run_at already sent); G15 description field on the new project form; G27 and G30 empty-state info.
- Hidden controls: G24 pin control and G144 AI switch (both APIs exist).
- Activity and tour: G31 and G117 activity feed and bell (client-only store; the workspace would also need to push events); G04 and G115 Tour trigger (or retire GlobalTour).
- Profile and onboarding: G61, G64, G66 (institution optional, new use-case values); G103 and G105 if role and country are wanted at onboarding.
- Navigation: G116 search hint; G118 email in the account menu; G121 put /guide and /about inside SignedIn; G126 saved comparisons list (GET /api/comparisons exists); G125 and G127 orphan pages: relink or delete.
- Palette: G137 should read useShellStore; G138 needs dark and high-contrast tokens in ds.css.
- Magic Insights: G142 initialCategory and G140 pulse.
- Optional: G88 and G96 toasts; G38 and G41 factor category filter and DQ column (absent in classic too).

### Needs API or schema

- G10 "Active" filter and G16 archive: no archived column anywhere.
- G70 change password, G91 reset by email (route plus mail), G71 delete account, G73 API tokens (table plus routes). All absent in classic too.
- G44 edit factor and G56 edit substance: no write routes. Absent in classic too.
- G11 case search across all projects: workable client-side today (N requests), but a search endpoint would scale. Inferred.
- Run-vs-run diff that the docs promise (below): neither version implements it. Inferred.

### Guide and docs pages that describe screens that no longer exist

All links in /docs (app/docs/page.tsx:20-80), the guide TOC (app/guide/layout.tsx:8-15) and /findings (:15) resolve to existing routes. "Already stale" means stale at 9227580 too.

- app/guide/page.tsx:59-63 says "click + New Project. Pick a type: base case or comparative study." The form offers From a file or Empty instead (new-project-form.tsx:217-235). Already stale.
- app/guide/page.tsx:77-78 says "Drag to restructure." The tree has no drag; moving is a right-click menu item (tree-tab.tsx:356-361, 397-400). Classic: inferred no drag either.
- is_driver flow: appears at app/guide/page.tsx:80-96, app/guide/faq/page.tsx:10, app/guide/first-assessment/page.tsx:113-125. No is_driver control exists in either version (grep). Already stale.
- app/guide/page.tsx:108-118 says "Press R to run… E to export the PDF." No R or E key handler exists in either version; components/global/shortcut-help.tsx:18-22 lists only ⌘K, ⌘B, ?, Esc. Already stale.
- Historical runs: app/guide/page.tsx:124-125 and app/guide/faq/page.tsx:60-63 mention a "Historical runs" panel and diffing two runs side by side; app/guide/data-model/page.tsx:99 says "you can diff any two without re-running." The workspace has a "Runs" list (results-panel.tsx:275); HistoricalRunsCard is classic results only. No run-vs-run diff found (inferred).
- app/guide/first-assessment/page.tsx:66-69 says "Open the project, click Add Case, choose Base." Main has "+ New case" on Cases (cases-page.tsx:106) with copy, what-if or empty options; "Add case" survives only on the non-sample overview (case-tabs.tsx:343).
- app/guide/first-assessment/page.tsx:81-84 says "Drag nodes… Right-click for clone / remove / import-from-library." The right-click menu offers Rename, Move, Add task, Delete (tree-tab.tsx:397-400). There is no clone, no import-from-library and no drag.
- app/guide/first-assessment/page.tsx:104-107 says substances are "pulled from the Integrations > Library catalog." Integrations is admin-only (sb:264), and the library pages have no link (G123, G124).
- app/guide/first-assessment/page.tsx:133-145 says "hit ▶ Run Assessment. The modal asks for Valuation method… Region." No modal opens from the case header (case-header.tsx:141) or the overview (case-actions.tsx:53); the workspace posts {} and uses the study's method and region (case-workspace.tsx:105-119). RunAssessmentModal exists only on the classic results page (results-page.tsx:302, flag).
- app/guide/first-assessment/page.tsx:161-185 promises a "KPI strip, Category tabs, Component contribution stacked bar, Flow-level detail filterable by direction" and "Export PDF", "Compare Cases" buttons. The Results panel actually has Answer, What builds this number, How sure, other categories toggle, Runs, Try a what-if, Magic Insights (results-panel.tsx:147-307). Export now lives in Reports and Compare in the sidebar.
- Analytics: app/guide/faq/page.tsx:17-20 promises "Analytics overlays every assessed case on the radar chart; the delta panel…"; :28-31 says "Use PDF Export on the Analytics page" and :49-52 "switch to Log scale". Main Analytics is class progress (components/lcapix/project/analytics-page.tsx) with none of these; they exist only in classic analytics, flag only (category-comparison-panel.tsx:114).
- app/findings/page.tsx:13 says "results live on each case's Results page." Results is now a tab of the case; /results redirects to ?tab=results. Minor wording.
