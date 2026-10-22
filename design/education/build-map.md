# LCAPIX education: build map

For a developer building the 35 screens in `screens/` on this branch. Every path below is relative to the repo root. The behaviour spec is `specs/behaviour-spec-claude-design.md`. Checked on 2026-10-16 against `origin/v1-hardening` (commit 09723e5) by reading the code; nothing was run.

## Legend

- **Built**: the code does it today. The row names the route, page or component. A Built row can still differ from the screen in wording, layout or limits. Every such difference is in the last section.
- **New screen**: the data exists, the UI does not. The row names where the data comes from.
- **Needs backend**: a field, table or route is missing. The row names it.
- **Coming soon**: the screen itself tags it as not built.

Five facts that hold on almost every screen:

1. **No sidebar.** `app/project/layout.tsx` renders `components/lcapix/app-top-bar.tsx` (Projects, Integrations for platform admins, Docs). `components/ui/sidebar.tsx` exists but nothing imports it. The sidebar rows below say "see E02".
2. **No case tabs.** A case is a three-pane editor at `app/project/[projectId]/case/[caseId]/page.tsx` (outline, canvas, inspector). Results is its own page, `app/project/[projectId]/case/[caseId]/results/page.tsx`. The write-up lives on Results. Compare is `app/project/[projectId]/comparison/page.tsx`.
3. **No sample flag.** The worked example is found by its name, `Example: painted steel bracket` (`lib/example-case.ts`). `project.is_template` exists in `db/baseline/000-schema.sql` but no code uses it.
4. **No student or professor role.** Project roles are owner, admin, editor, viewer (`lib/auth.ts`, `db/baseline/001-reference.sql`). "Can change" is editor, "Can read" is viewer. A "student" is any editor or viewer who is not the owner.
5. **Run numbers are global.** "Run #214" is `assessment_runs.run_id`, an auto-increment across all users. There is no per-case run number.

---

## Row A: website to first Home

### F1.1 · Landing

The public page: a hero with the app framed around Elena's case, six use-case drawings, six feature cards, the four ISO phases with the 1.72 answer, three methods and data sources, "For teaching" and "For teams", the changelog, "Built to be checked", and a dark "Start with the worked example" band.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Nav: Product, Methods, Pricing, Docs, Changelog, Log in, Get started | Built | `app/page.tsx` builds its own nav: Product, Pricing, Docs, Changelog, Log in, Sign up. There is no Methods link. |
| Hero copy, Get started, Book a demo | New screen | Today's hero in `app/page.tsx` is a different message aimed at engineers. Its "Book a demo" is a button with no action. |
| App frame of Elena's case in the hero | New screen | `components/lcapix/landing/hero-mockup.tsx` shows a different mockup. Reuse the new case screens. |
| Six use-case drawings | New screen | Not in `app/page.tsx`. Static art. |
| "What it does": six cards | New screen | Static. Each card points at code that exists: import (`app/api/ingest/preview/route.ts`), Magic Insights (`app/api/insights/route.ts`), lessons (`lib/lessons.ts`). |
| Four phases with the 1.72 answer | New screen | Static. The phase names match `lib/case-journey.ts`, minus its fifth phase "Report". |
| Three methods and the data sources strip | Built | `components/lcapix/landing/interactive-method-cards.tsx` (CML 2001, ReCiPe Midpoint (H), TRACI 2.1). The sources are integrations under `app/api/integrations/`. |
| "For teaching" and "For teams" | New screen | No education path on the landing today. Several bullets describe things the code does not do (see the last section). |
| Changelog v3.4, v3.3, v3.2 | Built | `app/changelog/page.tsx` has the same entries. |
| "Built to be checked" and the dark band | New screen | Static copy. Two of its four claims do not match the code (see the last section). |

### F1.2 · Sign-up

A two-pane sign-up for teaching and research: Continue with Google first, then name, email and password, a Terms line, and a note that company workspaces are in development.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Continue with Google | Built | `app/api/auth/google/route.ts`. In `app/auth/signup/page.tsx` the button sits second, under the email form. |
| Your name, Email, Password with eye toggle | Built | `app/auth/signup/page.tsx`, `POST /api/auth/signup` (`app/api/auth/signup/route.ts`). 3 sign-ups per IP per hour. |
| "At least 8 characters with one number." | Built | Same helper text in the page. The server checks length only (8 characters, 72 bytes at most). |
| Create account, then the next step | Built | Goes to `/auth/onboarding`. |
| "By creating an account you agree to the Terms and Privacy" | New screen | Pages exist: `app/legal/terms/page.tsx`, `app/legal/privacy/page.tsx`. No line on sign-up today. |
| Already have an account? Log in | Built | Link in `app/auth/signup/page.tsx`. |
| Left pane: the sample drawing and three numbered lines | New screen | `components/lcapix/auth/auth-shell.tsx` cycles a different montage. |
| "Team and company workspaces are in development." | Coming soon | Text only. The server sets `account_type = 'user'` for everyone. |

### F1.3 · About you

One quick-setup step: full name, institution, what LCAPIX is for (four cards, one disabled), a Guided mode toggle saved on this device, and "Open the sample study".

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Full name | Built | `app/auth/onboarding/page.tsx`, saved to `account.full_name` by `PUT /api/auth/profile` (`app/api/auth/profile/route.ts`). |
| Institution, optional | Built | Saved as `account.company`. The code makes it required ("Company / organization"). |
| "What will you use LCAPIX for?" four cards | Needs backend | `account.use_case` exists (`migrate-031-account-profile.sql`), but the route accepts only product, facility, comparative, research, other. Add teaching, lab and own study. |
| "Every account gets the same tools for now." | Built | True: there are no feature flags. Only config env vars such as `HF_TOKEN`. |
| Guided mode BETA toggle | New screen | No toggle today. Keep it in localStorage, as the screen says. |
| "Saving it to your account is coming soon." | Coming soon | Needs an account column later. |
| Open the sample study | New screen | Calls `POST /api/example-project` (`app/api/example-project/route.ts`). Today only the empty Home calls it (`lib/home/use-home.ts`). |
| Skip for now | Needs backend | `needsOnboarding` in `app/api/auth/profile/route.ts` is true until `full_name` and `company` are saved, and `lib/home/use-home.ts` sends the user back. Relax that gate. |
| Left pane FIG. 02 | New screen | Static. |

### E02 · Home, the sample study

The first Home is the sample study's Overview: seven numbered sections in research order, a read-only SAMPLE header with Make my own copy, the sidebar holding the sample project, and the Guided mode card on section 1 of 7.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Sidebar: Home, Findings, Reports, project switcher with counts, Cases, Compare, All projects, New project, Guided mode, Help, profile | New screen | No sidebar (fact 1). Data: `GET /api/projects` (`app/api/projects/route.ts`) returns `case_count`, `permission_name`, `owner_username`. Findings has no backend (see E12). Help is `app/guide/page.tsx`. Profile is `app/profile/page.tsx`. |
| Header: SAMPLE STUDY, "Read-only · made for you when you signed up", facts line with Run #101 | Needs backend | No sample flag and no read-only mode (fact 3). Method and region exist on the project (`project.lcia_method`, `project.region_code`). |
| Search ⌘K and Make my own copy | Built | ⌘K is `components/global/command-palette.tsx` (projects and pages only). Copy is `POST /api/cases/[caseId]/duplicate`: steps, flows and costs, no runs. Name it after the person in the client. |
| 01 The question: question, unit, boundary, method and region | New screen | `goal_statement`, `functional_unit`, `system_boundary`, `lcia_method`, `region_code` from `GET /api/projects/[projectId]`. |
| 02 How it is made: 17 steps in five tiers with shares | Needs backend | The example builds a product and 3 operations only (`lib/example-case.ts`). Rewrite `app/api/example-project/route.ts`. Shares need a run. |
| 03 What goes in: amount × factor = impact, source and scope tag | Needs backend | The shape exists in the run snapshot (`flow_detail` in `lib/run-snapshot.ts`), but the example has no run. Argon, Powder coating, Packaging tape and a scrap steel output are not in the substance library (the Argon gap is noted in `lib/example-case.ts`). |
| 04 The answer 1.72, What builds this number, How sure 88% | Needs backend | Needs a run of the sample. After that: totals and steps from `GET /api/cases/[caseId]/assessments`, confidence from the snapshot `data_quality`. |
| 05 A what-if: Shorter cure cycle 1.667, What changed | Needs backend | The example has no comparative case and no runs. Seed run, duplicate, change one flow, run. Diff logic exists in `lib/compare/diff.ts`. |
| 06 Example write-up and 07 next steps (copy, new project, Add people locked) | New screen | 06 is static text, not saved to `case_table.interpretation`. 07: duplicate route, `app/project/new/page.tsx`, and a client rule that unlocks Add people once the person owns a non-sample project. |
| Guided mode card: Section 1 of 7, Next section, Skip the walk | New screen | Scripted. `components/global/global-tour.tsx` exists, but most of its case anchors are missing. |

### E12 · Home, later

Once a project of her own exists, Home shows Continue, Needs attention, Your projects with results, the sample as a small dashed row with Remove, and Recent findings as Coming soon.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| "Welcome back, Elena." and the counts line | Built | `app/home/_components/home-greeting.tsx`. "Last open" is New (see Continue). |
| Find a project or case | New screen | Home search filters projects only (`lib/home/projects.ts`). Cases come from `GET /api/projects/[projectId]/cases`. |
| Continue: last case, four progress parts, next step, Open the tree, Open Inventory | New screen | No record of the last case opened; keep it per browser. Counts from `GET /api/cases/[caseId]/completeness`. Write-up from `case_table.interpretation`. |
| Needs attention: "3 lines held" | Needs backend | Held import lines come back once from `POST /api/ingest/apply` (`held_details`) and are then lost. Store them. |
| Needs attention: "Base case changed after Run #301" | New screen | Stale check exists: `editedSinceRun` in `app/api/projects/[projectId]/compare/route.ts`, logic in `lib/compare/run-results.ts`. |
| Needs attention: "9 student cases have no run yet" | New screen | `runs` per case from `GET /api/projects/[projectId]/progress`. |
| Your projects with latest result, "5 ticked as hand-in" | New screen | `GET /api/projects` has no latest run. Today: one `GET /api/cases/[caseId]/assessments` per base case. Hand-ins: `is_final` from the progress route. |
| Sample row: Open, Remove the sample, confirm | Built | `DELETE /api/projects/[projectId]` (owner only). Today the confirm is a native `confirm()` in `lib/project/use-project-actions.ts`. |
| + New project | Built | `app/project/new/page.tsx`. |
| Recent findings | Coming soon | No findings table, route or UI. |

---

## Row B: a file to a project

### F2.1 · New project

One form: project name, the question (functional unit, boundary, method, region), then "From a file" or "Empty", then Continue.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Project name, required | Built | `app/project/new/page.tsx`, `POST /api/projects`. Same name for the same owner is refused (409). |
| Functional unit and System boundary | Built | Saved by a second request, `PUT /api/projects/[projectId]`, to `project.functional_unit` and `project.system_boundary`. |
| Method and Region | Built | Options: CML 2001, ReCiPe Midpoint (H), TRACI 2.1; Global, United States, Europe (EU-27). Defaults are CML 2001 and Global. |
| "Same method and region as the sample study" | New screen | Read the sample project's `lcia_method` and `region_code`. |
| How do you want to start: From a file or Empty | Built | Today a separate page after create: `app/project/[projectId]/start/page.tsx` ("Start from documents", "Start an empty case"). |
| "No case is made until you check it and save." | Built | Preview writes nothing (`app/api/ingest/preview/route.ts`). The case is made in `POST /api/ingest/apply`. |
| Breadcrumb and sidebar with New project active | New screen | See E02. |

### F2.2 · Add a file

Pick the kind of file, drop it, see its size and pages, and press Check what we read. One read of ten this hour.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Kind chips: Bill of materials, Routing, Equipment list, EPD, Safety data sheet, ITAC | Built | Types in `lib/ingest/doc-types.ts`. Today a select in `app/project/[projectId]/import/_components/pick-form.tsx`. |
| Routing explainer line | Built | Copy in `lib/import/display.ts`. |
| Equipment list locked: "Needs a case with steps first" | Built | The server refuses an equipment list without a case (`app/api/ingest/preview/route.ts`). Show it as a lock. |
| ITAC adds an Assessment ID field | Built | `pick-form.tsx`. |
| Utility bills, permits, transport records, cost sheets | Coming soon | Listed as `planned` in `lib/ingest/doc-types.ts`. |
| Drop zone: "XLSX, CSV, TXT or a text PDF · up to 4.5 MB · no scanned PDFs or Word files" | Built | Allowed types in `lib/ingest/extract-text.ts` (pdf, xlsx, xls, csv, tsv, txt, md, html). The code cap is 12 MB. No size check in the browser. |
| Try it with a sample file, Download a blank template | Built | `lib/ingest/sample-docs.ts`, links in `pick-form.tsx`. The samples are a touring bike. |
| File line: name, 220 KB, 3 pages, "Not read yet" | New screen | Size from the File object. Page count needs a client read. |
| "Uses 1 of your 10 reads this hour" | Needs backend | The limit is 10 per user per hour (`ingestPreview` in `lib/rate-limit.ts`), but the route does not return the remaining count when a read succeeds. |
| Check what we read | Built | "Preview extraction" in `pick-form.tsx`, `POST /api/ingest/preview`. |

### F2.3 · Check what we read

The review of an AI-read routing PDF: case name, a read-only draft tree, a steps-and-hours table with ticks, notes from the read, and Save 5 steps to a new case.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Case name field | Built | `app/project/[projectId]/import/_components/case-name-card.tsx`. |
| "Nothing is saved until you press Save." | Built | True: preview writes nothing. |
| "Read by AI" notice | Built | A PDF routing goes through `lib/ingest/llm-structure.ts` (Hugging Face router, needs `HF_TOKEN`). |
| Draft tree, read only | Built | `import/_components/hierarchy-card.tsx`. |
| Steps and hours table: tick, step with page and line, tier, hours, "Labour cost: After save" | New screen | `lib/ingest/routing.ts` gives operations with hours as labour costs. Today's review shows flows and costs cards (`flows-table.tsx`, `costs-card.tsx`), and only flows can be unticked. Dropping a step means removing its node and costs from the plan sent to apply (not tested). |
| Total: "0.052 h per enclosure" | New screen | Sum of the plan's hours. |
| Notes from the read, Dismiss | Built | `import/_components/notes-list.tsx`, `needs-review-card.tsx`. |
| Info: a routing gives steps and hours; add the BOM and equipment list next | Built | Same message in `lib/import/display.ts`. |
| Save 5 steps to a new case | Built | `POST /api/ingest/apply`. |

### F2.4 · Saved

After saving: a confirmation that names the file, "Where this case stands" (six rows), Add the bill of materials as the next action, and a Guided mode card.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| "Saved. 5 steps and their hours are in Base case." and "the file is kept with the case" | Built | `import/_components/done-card.tsx`. The file text is saved to `case_documents` by `POST /api/cases/[caseId]/documents` (called from `lib/import/use-import.ts`). |
| Where this case stands: Goal and scope, Tree, Labour hours, Materials, Energy, Run | Built | Layers from `GET /api/cases/[caseId]/completeness` (`lib/ingest/completeness.ts`). The done card has a similar checklist. The "5 of 5" labour count and the Run row are New. |
| Add the bill of materials, Open the tree | Built | Done card "Add another document to this case" picks BOM next; "Open case". |
| Guided mode card: Walk me through this case | New screen | Scripted. |
| Sidebar: Aluminium enclosure, Cases 1 | New screen | See E02. |

### F2.5 · Start empty

An empty case on its Tree tab: the product node, five labelled tier lanes, an "Add the first step" card with tier chips, and a Start here panel.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Case header, "no steps yet", Case switcher | New screen | No case header (fact 2). Cases from `GET /api/projects/[projectId]/cases`. |
| Run Assessment disabled with "Add a step first" | Built | `runButtonTitle` in `lib/case-editor/run-assessment.ts`, button in `components/lcapix/case/editor/case-toolbar.tsx`. |
| Tabs: Tree 0, Inventory no flows yet, Results not run yet, Write-up, Compare | New screen | Fact 2. |
| Five labelled tier lanes | New screen | `lib/case-editor/tree-layout.ts` lays rows by depth. No lane labels. |
| "Add the first step under the product": pick a tier, then a name | Built | "Add Component" in `components/lcapix/case/editor/case-outline.tsx`, form at `app/project/[projectId]/case/[caseId]/component/new/page.tsx` with `components/component-form/type-segmented-control.tsx`. |
| Zoom −, 100%, +, Fit | Built | `components/lcapix/case/canvas/zoom-controls.tsx` (it also has Reset). |
| Process tiers legend | Built | `components/lcapix/case/canvas/canvas-legend.tsx`. |
| Start here panel and "Or add a file instead" | New screen | Import page exists: `app/project/[projectId]/import/page.tsx`. |

---

## Row C: case work

### E03 · Case, Tree

Elena's copy of the sample on its Tree tab: the header with a warning that 2 flows have no amount, the tree in tier lanes, and the step panel for 10. Cut blank with "Keep the Global average · Use my own number".

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Header: case name, "Copy of the Base case · 1 bracket · TRACI 2.1 · US · not run yet", Case switcher | New screen | Today a breadcrumb plus `components/lcapix/case/goal-scope-card.tsx`. Method and region from the project. Cases from `GET /api/projects/[projectId]/cases`. |
| "2 flows have no amount. They are left out of a run." | Needs backend | `flows.quantity` is `DOUBLE NOT NULL` (`migrate-030-flow-quantity-double.sql`) and `app/api/components/[componentId]/flows/route.ts` requires a quantity. A flow with no amount cannot exist. |
| Run Assessment | Built | `case-toolbar.tsx`, `lib/case-editor/use-run-assessment.ts`, `POST /api/cases/[caseId]/assessments`. |
| Tabs, Hide panel, Compare | New screen | Today: a Tree / List / Plot switch in `case-toolbar.tsx`. See fact 2. |
| Tree in tier lanes; nodes with icon, name and one fact | New screen | `components/lcapix/case/tree-canvas.tsx` lays rows by depth; node cards (`canvas/tree-node-card.tsx`) show cost and flow count. Nodes are 220×72. |
| Step panel: tier, parent, name, "2 flows in" | Built | `components/lcapix/case/inspector-panel.tsx` with header, Properties and Placement sections. |
| Flow row: IN, amount, unit, "0.80 × 1.900 = 1.520 kg CO₂-eq", Global average tag | New screen | `components/lcapix/case/flows/flow-row.tsx` shows amount and a source line built from all of a substance's factors (`lib/substance-source.ts`). The single factor for the project's method and region is in `GET /api/driver-factors?substance_id=`; pick it with the engine's rule in `lib/lca-engine.ts`. |
| "No US factor for steel": Keep the Global average, Use my own number | Needs backend | No per-flow factor override. The closest is a user substance with its own factor (`components/lcapix/case/flows/add-substance-form.tsx`, `POST /api/substances`). |
| "✓ Saved · Steel 0.80 kg on 10. Cut blank" on the line | New screen | Flow saves show toasts today. |
| Guided card "Exercise 2 of 6 · Materials" and Magic Insights on the tree | New screen | Six lessons exist in `lib/lessons.ts` (Learn panel, `components/lcapix/case/lesson-rail.tsx`), but their text is about a bike. Magic Insights opens from Results only. |

### E03b · Tree with the panel hidden

The same Tree with the step panel hidden: the tree takes the full width and Show panel brings the panel back.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Hide panel / Show panel | New screen | No control. The inspector is hidden only by CSS below 1024px (`app/lcapix.css`). |
| Tree at full width | New screen | The `.case-panes` grid in `app/project/[projectId]/case/[caseId]/page.tsx` has fixed columns (220px, canvas, 340px). |
| "Needs an amount" marks on Deburr edges and Fold and tape | Needs backend | Same gap as E03: no flow without an amount. |
| Header, tabs, Add step, zoom | New screen | See E03 and F2.5. |
| Magic Insights button | Built | `components/lcapix/magic-insights-modal.tsx`. It needs a run and today opens from Results. |

### E04 · Case, Inventory

The Inventory tab: a slim tree on the left that filters by step, status tabs with counts, and one table of all 10 flows with amount, unit, factor and source, and status. The Deburr row opens the machine calculator.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Tab badge "1 needs an amount · 1 left out" | New screen | Left out: count flows whose unit cannot convert (`convertQuantity` in `lib/units.ts`). The "needs an amount" part needs the backend change in E03. |
| Slim tree with flow counts and warning marks, filters the table | New screen | Components from `GET /api/cases/[caseId]/components`. `components/lcapix/case/editor/case-outline.tsx` is the nearest (no counts). |
| Status tabs: All, Needs an amount | Needs backend | See E03. |
| Status tabs: Left out, unit can't convert; Counted; Counted, no climate factor | New screen | Derive per flow: unit conversion from `lib/units.ts`, factor presence for the method from `GET /api/driver-factors`. No such labels exist today. |
| Table: flow with step and IN/OUT, amount, unit, factor, source, scope tag, status | New screen | Flows from `GET /api/components/[componentId]/flows`. The only flat flow table today is per run on Results (`components/lcapix/results/flow-table.tsx`). |
| Machine calculator: Power kW × Time s × Load % = kWh, Use 0.0013 kWh | Built | `components/lcapix/case/inspector/machine-energy.tsx` (Run hours × Power kW × Load %, "Add kWh as electricity input"). It takes hours, not seconds, and sits in the step panel, not in a row. |
| "Pick kg or g" on a unit that can't convert | New screen | The engine leaves such a flow out with a warning (`lib/lca-engine.ts`). |
| Guided card "Exercise 3 of 6 · Energy" | New screen | Lesson 3 exists in `lib/lessons.ts` with a different machine (5.6 kW, 0.8 h, 8%). |
| Add a flow | Built | `components/lcapix/case/flows/add-flow-form.tsx`. |

### E05 · Case, Results

The Results tab beside the tree: Run #102 shares on each node, the answer 1.72, "Same as the Base case", the step bars, the prediction reveal, Cost beside impact, and a panel menu with Dock right, Dock left and Reset position.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Header "Run #102, 2 min ago" and tab label | New screen | `run_id` and `run_date` from `GET /api/cases/[caseId]/assessments`. Today shown in `components/lcapix/results/results-header.tsx`. |
| Impact and share on each node | New screen | Per-step results are frozen in the snapshot `steps` (`lib/run-snapshot.ts`). Node cards show cost today. |
| Results as a panel beside the tree, with Dock right, Dock left, Reset position | New screen | Results is its own page (fact 2). No dock menu. |
| Guided card: your prediction against the run | Built | Lesson 4 prediction and reveal in `components/lcapix/case/lesson-rail.tsx`, stored in `case_table.learning_state`. |
| Answer 1.72 kg CO₂-eq per bracket | Built | `components/lcapix/results/dashboard-hero.tsx`. The sentence "89% comes from 10. Cut blank" is new. |
| "Same as the Base case, Run #101 · Nothing in your copy differs yet" | New screen | Today only "x% vs last run" for the same case (`lib/results/run-math.ts`). Base-case diff: `lib/compare/diff.ts` through `GET /api/projects/[projectId]/compare`. |
| What builds this number: bars with value and share | Built | Bars in `dashboard-hero.tsx` (top 5). The share is computed in `run-math.ts` but not shown. |
| Cost beside impact: $1.75 per bracket, "Frozen with this run · 4 steps", step table | New screen | Costs per step are frozen in the snapshot `steps[].costs` (`lib/run-snapshot.ts`). The sample writes no costs today (see E02). |

### E06 · Case, Write-up (student)

Ana's comparative case on the Write-up tab: 1.682 with "2.2% vs the Base case", her change marked on the tree, Interpretation and Assumptions, "This is my hand-in" ticked, and Export as PDF, PowerPoint or CSV.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Header: "Comparative case · copied from Dr. Rivera's Base case · Run #214" | Needs backend | `case_type` exists. The duplicate route writes a "duplicated from" note in the description but no `parent_case_id` (`lib/case-copy.ts`). |
| Student sidebar: no Analytics, People or New project; "LCA 301 · student" | New screen | No student role (fact 4). Use `permission_name` from `GET /api/projects`. |
| "Your change" mark on 10. Cut blank | New screen | Changed exchanges from `lib/compare/diff.ts`. |
| 1.682 with "▼ 2.2% vs the Base case" | New screen | Compare route, see E09. |
| Interpretation and Assumptions | Built | `components/lcapix/case/write-up-card.tsx` on the Results page, saved by `PUT /api/cases/[caseId]` to `case_table.interpretation` and `assumptions`. |
| This is my hand-in, "Ticked · 2:14 pm", locks nothing | Built | `case_table.is_final` and `finalized_at`. One hand-in per author per project (`app/api/cases/[caseId]/route.ts`). Nothing locks the case. |
| Export the report: PDF, PowerPoint, CSV | Built | `GET /api/assessments/[runId]/export?format=pdf`, `pptx` or `csv`. Buttons today in `results-header.tsx`. |
| Guided card "Exercise 6 of 6 · Write it up" | Built | Lesson 6 "Hand-in" in `lib/lessons.ts`. |

### E14 · Step costs

The Tree in Cost view: a dollar roll-up on every node, and the Cost panel for 20. Weld tab with labour as hours × rate, a labour rate lookup (reference, live BLS by state, or your own rate) and energy below.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Impact / Cost switch on the tree | New screen | Node cards always show cost today (`components/lcapix/case/canvas/tree-node-card.tsx`). |
| Cost on each node with Σ roll-up in cents | Built | `rollupLine` in `lib/case-editor/tree-layout.ts`. It rounds to whole dollars. |
| Panel header "20. Weld tab · $0.55 USD per bracket", Flows / Cost switch, "4 of 6 set" | New screen | Six cost columns on `component`: labor, energy, material, transportation, equipment, overhead. |
| Labor: 0.015 h × $25.83/h · Welders/cutters · Reference 2026-06 | Built | `components/lcapix/case/inspector/labor-breakdown.tsx`. Rate from `LABOR_RATES` in `lib/integrations/reference-rates.ts` (welder 25.83, `REFERENCE_VINTAGE = '2026-06'`). Stored: `labor_hours`, `labor_occupation`, `labor_cost`. |
| Look up a labor rate: search "welder", list of occupations | New screen | Five reference occupations in `LABOR_RATES`. No search box today; the rate follows the stored occupation. |
| Welders/cutters · Michigan · BLS OEWS 2025 · live | Built | State select in `labor-breakdown.tsx` calls `POST /api/integrations/bls/fetch-wage` (`lib/case-editor/use-labor-rate.ts`). Open to any signed-in user, 60 lookups per hour. |
| "In use", "Reference" and "live" tags kept with the cost | Needs backend | No source column per cost on `component`. The live state and rate are not stored. |
| Or enter your own rate | New screen | Rate is read-only in `labor-breakdown.tsx`. The labour cost itself is editable in `components/lcapix/case/inspector/costs-section.tsx`. Labelling it "own rate" later needs the source column above. |
| "Live from BLS when it answers. If not, the dated reference rate is used and tagged Reference." | Built | `app/api/integrations/bls/fetch-wage/route.ts` falls back to the `LABOR_RATES` reference when BLS has no data. |
| Energy row | Built | `components/lcapix/case/inspector/machine-energy.tsx`, EIA price from `reference-rates.ts`. |

---

## Row D: project pages

### E07 · Cases, pipeline

The professor's Cases page: her two cases with results, then 32 student cases on a board in four columns (Not run yet, Run, Written, Ticked as hand-in), each card showing the next missing thing.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Header "34 cases · 2 yours, 32 from students · TRACI 2.1 · US" | New screen | No Cases page. Owner of each case: `case_table.created_by` (`migrate-032-case-ownership.sql`). Cases from `GET /api/projects/[projectId]/progress`. |
| Find a student or case | New screen | Filter the progress route's `author` and `case_name`. |
| Pipeline / Table switch | New screen | Today a flat table on `app/project/[projectId]/class/page.tsx`. |
| + New case | Built | `app/project/[projectId]/case/comparative/new/page.tsx` and `base/new/page.tsx`. |
| Your cases: Base case 1.72, Shorter cure cycle 1.667 with change | New screen | One `GET /api/cases/[caseId]/assessments` per case. |
| Four columns with counts | New screen | The progress route gives `runs`, `has_interpretation`, `is_final` per case. |
| Card: initials, name, case, Run #, answer, 4 segments, "No write-up yet" | New screen | The progress route has `author` and `runs` but no latest run id and no total. Today that means one assessments call per case (backend item 7 adds both fields). |
| "copied 2 days ago", Show 7 more | New screen | The progress route selects `created_at` but returns only `updated_at`. |
| "1 person has no case yet · See People" | New screen | Members from `GET /api/projects/[projectId]/members` minus case authors. |
| "No reminders go out, and grades stay in Canvas." | Built | True: nothing sends email. Notifications are a client store (`lib/notifications-store.ts`). |

### E08 · People

Who is in the project: a table of people with access and case counts, Add people by email or a class CSV, and the "Students see only their own case" switch with both modes described.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Header "31 people · You own it · 29 can change · 1 can read" | New screen | `GET /api/projects/[projectId]/members` returns owner and members with `permission_name`. |
| Table: person, email, access select, "..." menu | Built | People section of `app/project/[projectId]/class/page.tsx` (Name, Email, Access, Remove). Names are `username`, not `full_name`. Remove has no confirm. |
| Their cases column | New screen | Count `created_by` from the progress route. |
| Access: Can change, Can read | Built | Roles editor and viewer (`ROLES` in `app/api/projects/[projectId]/members/route.ts`). An admin role also exists. |
| Add people: one or many emails, or a CSV of the class | New screen | The route takes one email per request and no CSV. The client can loop and parse the file. |
| "They need an account first. No email is sent from here." | Built | 404 for an unknown email. No mail code anywhere. |
| Students see only their own case, OFF and ON text | Built | `project.members_see_own_cases`, enforced in `lib/route-guard.ts`, switch in `class/page.tsx`. |
| Find a person, Showing 8 of 31, Show all | New screen | Client side. |
| Invite by email, requests to join, comments | Coming soon | No mail, join requests or comments. |

### E09 · Compare

Base case against Shorter cure cycle: four passing checks, both totals with "3.1% lower", change by step, and What changed (0.40 to 0.25 kWh at 30. Powder coat and cure).

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Case chips A and B with run numbers, + Add a case | Built | `app/project/[projectId]/comparison/page.tsx`. Up to 8 cases (`MAX_CASES` in `app/api/projects/[projectId]/compare/route.ts`). |
| Category select "Global warming" | Built | Category picker in `app/project/[projectId]/comparison/page.tsx`. |
| Four checks: same method, region, functional unit, both runs current | Built | The compare route returns method, region, unit and `editedSinceRun`. The page shows chips and warnings, not four tiles. |
| Totals side by side, "3.1% lower" | Built | Per-case cards with "% vs base" in `comparison/page.tsx`. |
| Change by step: A, B, change | Built | `components/lcapix/compare/change-panel.tsx`. |
| What changed: 0.40 to 0.25 kWh, factor, "Nothing else changed", one-line summary | Built | `components/lcapix/compare/what-differs.tsx` with `lib/compare/diff.ts`. The one-line summary is new. |
| Open in each case's Results | New screen | Links to `/project/[projectId]/case/[caseId]/results`. |
| Pin as a finding, compare across projects | Coming soon | No findings. The compare route is per project. |

### E10 · Analytics

Class analytics: how far the class got (ran, wrote up, ticked), where 23 results landed on one axis, the flows most often left empty, and what each count means.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| How far the class got: 32, 23 ran, 12 wrote up, 5 ticked | New screen | Counts from `GET /api/projects/[projectId]/progress`. Today's `app/project/[projectId]/analytics/page.tsx` loads one case only (`lib/analytics/load.ts`) and has no class counts. |
| Where the results landed: one dot per run, base case marked | New screen | Latest total per case: one assessments call per case today (backend item 7). |
| Show as a table | New screen | Same data. |
| Flows most often left empty | Needs backend | No "needs an amount" state (see E03) and no route that counts it across cases. |
| What each count means | New screen | Static. |
| "9 student cases have no run yet", Open Cases | New screen | Progress route `runs`. |
| "No scores and no grades." | Built | Nothing grades. |
| Analytics as a sidebar place | New screen | Today reached from the project header (`components/lcapix/project/project-header.tsx`). |

### E11 · Reports

Build a report: pick a case and its run, see the fixed sections, pick PDF, PowerPoint or CSV, export, and preview page one.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Reports page | New screen | No reports page. Export lives on Results (`components/lcapix/results/results-header.tsx`). |
| Case picker with its run | New screen | `GET /api/projects/[projectId]/cases` and `GET /api/cases/[caseId]/assessments`. |
| Fixed sections: answer, by step, write-up | Built | `lib/pdf-generator.ts` sections 1 to 9, General information to Sources. |
| Confidence: "Not in the PDF yet" | Built | The PDF already prints the run's data-quality statement under "How far to trust it" (`lib/pdf-generator.ts`). |
| Comparison: "Not in the PDF yet" | Coming soon | No comparison section in the PDF. |
| Format PDF, PowerPoint, CSV and Export PDF | Built | `app/api/assessments/[runId]/export/route.ts`, `lib/pptx-generator.ts`. |
| "Prints Run #301 as it was when it ran. The write-up prints as it is now." | Built | Export reads the frozen snapshot and the live `interpretation` and `assumptions`. |
| Preview of page one | New screen | Data from `GET /api/assessments/[runId]` (`app/api/assessments/[runId]/route.ts`). |
| Export disabled when a case has no run | New screen | Export needs a run id. |
| Choose sections, add a comparison, saved reports with versions | Coming soon | No report table. |

### E18 · New case

One New case form: a what-if copy (recommended) or a new base case, case name and "What will you change?", and a preview of what is copied.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| What kind of case: what-if copy or new base case | Built | Two pages today: `app/project/[projectId]/case/comparative/new/page.tsx` and `base/new/page.tsx`. |
| Copy from "Base case · Run #301" | Built | The comparative page lists base cases only, then calls `POST /api/cases/[caseId]/clone-from`. |
| "Runs are not copied." | Built | `lib/case-copy.ts`. Clone-from returns `clonedRunId: null`. |
| Case name, "What will you change?" kept as the description | Built | `case_name` and `description` fields. |
| What you copy: tree preview, 17 steps, 10 flows | New screen | Counts from `GET /api/projects/[projectId]/cases` (`component_count`, `driver_count`). |
| "Steps, flows and step costs come along" | Built | `lib/case-copy.ts` copies costs, labour hours and allocation. |
| New base case "starts from a file or empty" | Built | `app/project/[projectId]/start/page.tsx`. |
| Make the case, opens on its Tree | Built | Both pages open the case editor. |
| Link from the copy to its source | Needs backend | `POST /api/projects/[projectId]/cases` reads `parent_case_id` but never writes it. |

### E19 · Many projects

The project switcher opened from the sidebar over the Cases board: search across 10 projects, Pinned, Your projects, Shared with you (with the owner), and Sample.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Switcher opened from the sidebar | New screen | `GET /api/projects` returns owned and member projects, newest first. |
| Find a project, with the count | New screen | Home has client search (`lib/home/projects.ts`). |
| Pinned | Needs backend | No pin column. |
| Your projects with case counts | Built | `case_count` from `GET /api/projects`. |
| Shared with you with the owner's name | New screen | `permission_name` and `owner_username` are returned. The owner's `full_name` is not. |
| Sample group | New screen | Found by name today (fact 3). |
| New project, All projects | Built | `app/project/new/page.tsx`, `/home`. |

---

## Row E: student and phone

### E13 · Student Home

Noah's Home: the shared project with Dr. Rivera's cases, "You have no case here yet" with a name field and Make your own case, and the sample as a small row.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| "Hi, Noah. 1 project shared with you" | New screen | Shared projects are in `GET /api/projects` (`permission_name` editor or viewer). Home shows one mixed list today. |
| Shared card: "From Dr. Elena Rivera · you can change · 1 bracket · TRACI 2.1 · US" | New screen | Owner, permission, `lcia_method`, `region_code`. |
| Dr. Rivera's cases with run and value | New screen | Cases where `created_by` is the owner. Values from assessments. With the privacy switch on, the student cannot see them (`lib/route-guard.ts`). |
| Your case: name "Noah's case", Make your own case | Built | `POST /api/cases/[caseId]/duplicate`, open to editors. The default name today is "{name} (copy)". |
| Sample row: Open, Start your own project | New screen | Sample found by name (fact 3). New project page exists. |
| Student sidebar | New screen | See E06. |

### E15 · Phone, Home

Ana's Home on a phone: her case with its result and hand-in tick, Open your case, Dr. Rivera's cases, the sample, and a "Read only on a phone" bar.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Phone top bar with menu | New screen | Below 820px the CSS only hides panes (`app/lcapix.css`). No phone layout. |
| Shared project card | New screen | See E13. |
| Your case: "Comparative case · Run #214", 1.682 | New screen | Case and latest run from assessments. |
| "Ticked as hand-in · A tick only. It locks nothing." | Built | `is_final` from the progress route. |
| Open your case | Built | Route `/project/[projectId]/case/[caseId]`. |
| Dr. Rivera's cases, sample row | New screen | See E13. |
| "Read only on a phone. Open on a larger screen to edit." | New screen | Not found. |

### E16 · Phone, case outline

Ana's case on a phone as a read-only outline: 17 steps with tier swatches, each operation's share of 1.682, task values, and the read-only bar.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Header with project, case, "Comparative case · Run #214", tabs | New screen | Fact 2. |
| Outline of 17 steps with tier legend | New screen | Today the outline is the editable left pane `components/lcapix/case/editor/case-outline.tsx`, hidden below 820px. |
| Share of 1.682 per step | New screen | Snapshot `steps` (`lib/run-snapshot.ts`). |
| Task values: 12 s, 0.0013 kWh, 200 °C, 0.002 kg | New screen | Flows per component. Values like 12 s and 200 °C are not flows; they would come from `component.description`. |
| "No counted climate flow" under 40. Pack and ship | New screen | Engine lists flows with no factor (`lib/lca-engine.ts`). |
| Read-only bar | New screen | See E15. |

### E17 · Phone, Results

Ana's Results on a phone: 1.682 with "2.2% lower than the Base case", What changed, the step bars with shares, How sure with a Regional and Global average bar, and Sources.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Answer 1.682 kg CO₂-eq per bracket | Built | `components/lcapix/results/dashboard-hero.tsx`. The results page has no phone layout. |
| "2.2% lower than the Base case 1.72" and "What changed: steel 0.80 to 0.78 kg" | New screen | `lib/compare/diff.ts` through the compare route. |
| What builds this number with kg and share | New screen | Snapshot `steps`. Shares are not shown today. |
| "40. Pack and ship adds 0. It has no counted climate flow." | New screen | Engine statement in `lib/lca-engine.ts`. |
| How sure: sentence and Regional 11.9% / Global average 88.1% bar | New screen | Scope per flow in snapshot `flow_detail`. The engine already writes "rests p% on ..." lines in `data_quality`. |
| Sources with factor per unit | New screen | Snapshot `flow_detail` source and factor. |
| Read-only bar | New screen | See E15. |

---

## Row F: states and errors

### F1.2b · Log in and its errors

Log in with Google first, Forgot password, an inline wrong-password error, and the sign-up "email already used" error.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Log in form and Continue with Google | Built | `app/auth/login/page.tsx`, `POST /api/auth/login`. Google sits under the form. 5 tries per minute per IP and email. |
| Forgot password? | Needs backend | No reset route and no email sending anywhere. |
| "That password doesn't match this email. Try again or reset it." | Built | The route returns "Invalid email or password" for a wrong password and for an unknown email alike (`app/api/auth/login/route.ts`). |
| No account yet? Create one | Built | Link to `/auth/signup`. |
| Sign-up: "An account with this email already exists. Log in instead." | Built | 409 with a neutral message: "We could not create an account with those details. If you already have an account, log in instead." (`app/api/auth/signup/route.ts`). |
| Left pane | New screen | See F1.2. |

### F1.4 · Building the sample

The About-you step after Open the sample study: a busy state ("About 5 seconds") and a failed state with Try again and "Start with an empty project instead".

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Answers kept on the form | Built | Saved first by `PUT /api/auth/profile`. |
| Busy: "Building your sample study... About 5 seconds" | New screen | `POST /api/example-project` is one synchronous transaction. Today's button on the empty Home shows "Building…" (`app/home/_components/project-states.tsx`). |
| Failed: "We couldn't build the sample study. Nothing was lost." | New screen | The route returns 500 "Could not build the example" and rolls back. |
| Try again | Built | Same POST. Safe to repeat: one example per account, checked by name. |
| Start with an empty project instead | Built | `app/project/new/page.tsx`, then `app/project/[projectId]/start/page.tsx`. |
| What gets built: the full sample with runs and a what-if | Needs backend | See E02. |

### F2.2b · A file that can't be read

A scanned PDF that has no text: an error with "Upload the spreadsheet version", "Try the sample file" and "Start empty instead", plus the hourly read limit reached.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| "We couldn't read enclosure-routing.pdf. It looks scanned, so there is no text to read." | Built | Preview returns "Could not extract readable text (a scanned PDF may need OCR)." when a PDF has under 40 characters of text (`app/api/ingest/preview/route.ts`). Shown by `import/_components/error-card.tsx`. |
| Upload the spreadsheet version, Try the sample file, Start empty instead | New screen | The actions exist: file input, sample loader (`lib/ingest/sample-docs.ts`), start page. Not offered in the error card. |
| "You've used 10 reads this hour. Try again in 18 minutes." | Built | 429 with `retry_after` in seconds (`lib/rate-limit.ts`). Message today: "Too many requests. Try again in N seconds." |
| Check what we read locked: "choose another file first" | New screen | Client state. |
| Word files refused | Built | "Unsupported file type '.docx'..." in `lib/ingest/extract-text.ts`. |

### F2.6 · Add the bill of materials

A BOM added to the routing's Base case: lines matched to library materials with a match score, lines at 90% or more ticked, each line placed on a step, and Save blocked until every line has a step.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Append to Base case, "read from the spreadsheet", Save 3 lines to Base case | Built | Append mode in `app/project/[projectId]/import/page.tsx`. BOM read without AI by `lib/ingest/bom.ts`. |
| Filter tabs: All lines, Need a step, Need a match | New screen | Client filter on the plan. |
| "Lines at 90% or more are ticked." | Built | Pre-tick at 0.9 in `lib/import/review.ts`. A match below 0.7 is not a match (`MATCH_ACCEPT` in `lib/ingest/maplca.ts`). |
| Matched to, with a coloured score and a picker | Built | `import/_components/flow-row.tsx`. Colours in `lib/import/display.ts`: green at 90 and up, amber at 55 and up, red below. |
| Place on step, with suggestions | Built | `lib/ingest/placement.ts`, `import/_components/append-banner.tsx`. Suggestions have no threshold: any suggestion fills the select. |
| Save blocked: "Place every line on a step first (3 left)" | Built | `unplacedError` in `lib/import/apply-body.ts`. |
| Status column: Counted, Check the match, Pick a match, Counted no climate factor | New screen | Derive from the score and factor presence. |
| "Unticked lines are not saved as materials, only their cost." | Built | Apply writes costs separately from flows (`app/api/ingest/apply/route.ts`). |
| Base case 5 steps with line counts | New screen | Client count of placements. |
| Notes from the read, Dismiss | Built | `notes-list.tsx`. |

### E03c · Keyboard and the step menu

The Tree mid-run: Running... 3 s, an Out of date banner on the step panel, the step menu (Rename, Move to..., Add a task below, Delete step) with "Move under", and a keyboard hint bar.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| "Running... 3 s" | Built | "Running…" in `case-toolbar.tsx`. The seconds counter is new. |
| Out of date: "You changed 1 flow after Run #102. Run again to update." | New screen | Stale rule in `lib/compare/run-results.ts`. The changed-flow count: snapshot `inventory` against current flows. |
| Step menu: Rename, Move to..., Add a task below, Delete step | New screen | No context menu. Today: Name in Properties, Parent in Placement (`inspector/placement-section.tsx`), Delete in `inspector/inspector-footer.tsx` with a confirm, Add Component in the outline. |
| Move under list with the current parent ticked | New screen | `parentOptions` already feeds the Placement select. |
| Keyboard: Tab into the tree, arrows, Enter, M for the menu | New screen | Canvas nodes are `div`s with `onClick` only (`canvas/tree-node-card.tsx`). No tabindex, arrows or live region. |
| Argon row: no factor, "None in TRACI 2.1 · Counted, no climate factor" | Needs backend | Argon is not in the substance library (`lib/example-case.ts`). |
| Electricity row: 0.12 × 0.350 = 0.042, EPA eGRID 2023 · US · Regional | New screen | The eGRID 2023 US factor 0.350 exists (`migrate-009-factor-basis-audit.sql`). Read it with `GET /api/driver-factors`. |

### E07b · Cases, table

The same Cases page in its Table view: Student, Case, Stage (sorted), Run, Answer, Hand-in, eight rows of 32.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Table: Student, Case, Stage, Run, Answer, Hand-in | New screen | Progress route. Run id and answer need one assessments call per case today. The class page table has different columns: Case, Author, Steps, Flows, Runs, Lessons, Write-up, Hand-in. |
| Sorted by stage | New screen | Client sort. |
| Showing 8 of 32, Show all 32, "1 person has no case yet" | New screen | See E07. |
| A real table for screen readers | New screen | The class page uses a CSS grid of `div`s. |
| Your cases cards | New screen | See E07. |

### E08b · Privacy switch confirm

A confirm before turning on "Students see only their own case", naming who loses access, over the People page with the result of the last add of 4 emails.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Confirm dialog naming who is affected, Cancel, Turn on | New screen | Today the switch saves at once (`app/project/[projectId]/class/page.tsx`). Names: members without a case, and viewers. |
| The consequence text | Built | With the switch on, a student cannot read or copy the base case, and a viewer sees no cases (`lib/route-guard.ts`; creating a case needs editor). |
| Last add · 4 emails: 2 added, 1 already here and changed, 1 has no account | Built | The route returns `updated: true` for an existing member and 404 for no account. The summary across several emails is new. |
| "added just now" | Built | `project_members.added_at`. |
| "33 people · 28 can change · 4 can read" | New screen | Members route. |
| Invite by email, requests to join, comments | Coming soon | As E08. |

### E09b · Compare, a failed check

Base case against Lighter blank whose run is out of date and used region Global: "Not comparable yet, 2 of 4 checks fail", totals greyed, change by step hidden, and Run Lighter blank again.

| Element | Status | Where in the code, or what is missing |
|---|---|---|
| Chip "Lighter blank · run out of date" | Built | `editedSinceRun` from the compare route. The page shows "Re-run to compare". |
| "Not comparable yet · 2 of 4 checks fail" | Built | The page shows "Not a valid comparison yet" for a method or unit mismatch only. A region mismatch is a warning. |
| "Region differs: US vs Global · Choose US when you run it" | Built | Region is picked in `components/assessments/run-assessment-modal.tsx`. |
| "Run is older than the last change · Run Lighter blank again" | Built | Stale rule in `lib/compare/run-results.ts`. Run: `POST /api/cases/[caseId]/assessments`. Today the stale card links to the case. |
| Totals greyed, "Last run out of date" | New screen | Today the totals render, and a stale case is only left out of the ranking. |
| Change by step hidden until both checks pass, with the reason | New screen | Today the panels still render. |
| Pin as a finding, compare across projects | Coming soon | As E09. |

---

## Backend work the screens need

1. **Sample study builder** (E02, F1.3, F1.4, E12, E13, E15, E03c). Rewrite `app/api/example-project/route.ts` and `lib/example-case.ts`: 17 steps over five tiers and 10 flows; seed the missing substances (Argon, Powder coating, Packaging tape, a scrap steel output) with no climate factor; write the labour hours that `lib/example-case.ts` already defines; then run the base case, duplicate it, change cure electricity to 0.25 kWh and run again. Call it after sign-up or onboarding, not only from the empty Home.
2. **Sample flag and read-only** (E02, E12, E13, E15, E19). A `project.is_sample` column (or use the unused `is_template`). Refuse edits to the sample's base case for everyone; allow duplicate. Let "add the sample again" work while other projects exist.
3. **A flow with no amount** (E03, E03b, E04, E10). Make `flows.quantity` nullable (now `DOUBLE NOT NULL`), accept it in `app/api/components/[componentId]/flows/route.ts`, and have `lib/lca-engine.ts` leave it out and count it. Add a route that counts empty flows across a project's cases for E10.
4. **Own number for a factor** (E03). A per-flow override with its own source, or a decision that "Use my own number" creates a user substance through `POST /api/substances`.
5. **Source per cost** (E14, E05). Rate, source and vintage per cost on `component` (for example `labor_rate`, `labor_rate_source`), frozen in the run snapshot.
6. **Held import lines** (E12). Store `held_details` from `POST /api/ingest/apply`.
7. **Summary fields for lists** (E07, E07b, E10, E12, E13, E15, E19). Add latest run id, latest Global Warming total and `created_at` to `GET /api/projects/[projectId]/progress`; add the latest run to `GET /api/projects`; return `full_name` for owners and members in `GET /api/projects` and `GET /api/projects/[projectId]/members`. Without this, lists need one call per case.
8. **Copy link** (E06, E18). Write `parent_case_id` in the duplicate route and in `POST /api/projects/[projectId]/cases` (it reads the field and drops it).
9. **Reads left this hour** (F2.2). Return the remaining count from `POST /api/ingest/preview`, and set a shared store (Upstash or Vercel KV) so the count holds across server instances.
10. **Onboarding rules** (F1.3, F1.4). Add teaching, lab and own study to the allowed `use_case` values; make `company` optional and allow skipping in `app/api/auth/profile/route.ts`.
11. **Password reset** (F1.2b). A reset route and an email sender. Neither exists.
12. **Pinned projects** (E19). A per-user pin table.
13. **Later, tagged Coming soon on the screens**: findings (E02, E09, E12), saved reports with versions (E11), invite by email, join requests and comments (E08, E08b), compare across projects (E09), Guided mode saved to the account (F1.3).

---

## Where a screen and the code disagree

**The sample study**
1. **When it is made.** E02 says "made for you when you signed up", and F1.3 and F1.4 build it from onboarding. The code builds it only when someone presses "Open the worked example" on an empty Home (`app/home/_components/project-states.tsx`), and that button shows only when the person has zero projects. The route says so in its own comment (`app/api/example-project/route.ts`).
2. **What it holds.** The screens show 17 steps in five tiers, 10 flows, Run #101 at 1.72, a comparative case "Shorter cure cycle" at 1.667 and an example write-up. The code makes a project "Example: painted steel bracket" with one case, a product node and three operations, and 4 flows: Steel 0.8 kg, Electricity 0.05, 0.12 and 0.4 kWh. It has no run, no comparative case and no costs (`laborHours` is defined but never written). With those 4 flows a run would give 1.7195 (1.72), so the headline number holds, but 0.0005 from deburring and every zero-factor flow are missing.
3. **Read-only.** E02 and E03 call the sample read-only. In the code the person owns the example and can edit or delete anything in it.
4. **Adding it back.** E12's confirm says "You can add the sample again from All projects." The code offers the button only on an empty Home.
5. **Substances.** E03c and E04 show Argon, Powder coating, Packaging tape and Scrap steel as flows. Argon is not in the library (stated in `lib/example-case.ts`), and I found no rows for the other three. Steel is called "Steel" in the library, not "Steel, cold-rolled". Its factor matches: 1.9, "worldsteel 2022 global average crude steel", scope Global (`migrate-016-embodied-materials.sql`).

**Files and import**
6. **Upload limit.** F2.2 says "up to 4.5 MB". The code cap is 12 MB (`MAX_UPLOAD_BYTES` in `lib/ingest/extract-text.ts`), and the spec README also says 12 MB. 4.5 MB is Vercel's request-body limit; the code only names it in the 413 message. There is no check in the browser, so on Vercel a file between 4.5 and 12 MB is refused by the platform and the user sees a generic "Preview failed".
7. **Reads per hour.** "10 reads this hour" matches the policy (10 per user per hour). The default store is in memory per server instance, so two instances each allow 10. The route never reports the remaining count.
8. **Labour cost timing.** F2.3 says labour is "costed at a labour rate after save". `lib/ingest/routing.ts` prices hours at a BLS reference rate while reading, so the cost is already in the plan before save.
9. **Equipment list.** F2.2 shows it locked. The code lets you pick it and the server then refuses it without a case.

**Sign-up and log-in**
10. **Google first.** F1.2 and F1.2b put Continue with Google first, and the spec makes it the first Tab stop. In both pages the email form comes first and Google second.
11. **Password rule.** The page and the screen say "8 characters with one number". The server checks only length (8 characters, at most 72 bytes).
12. **Error wording.** F1.2b says "That password doesn't match this email" and "An account with this email already exists". The code gives one message for a wrong password and an unknown email, and a neutral message for a used email, on purpose so the app does not reveal who has an account. Building the screen's wording would undo that.
13. **Forgot password.** The screen has the link. No reset route exists.
14. **About you.** F1.3 has Institution as optional and four use cards. The code requires "Company / organization", offers a select of product, facility, comparative, research, other, and has no Guided mode toggle. "Skip for now" loops back, because Home sends an un-onboarded user to onboarding.

**The case**
15. **Flows with no amount.** E03, E03b, E04 and E10 rest on flows that "need an amount". `flows.quantity` is NOT NULL and the route requires it, so such a flow cannot be saved.
16. **Use my own number.** E03 offers it per flow. The code has no per-flow factor, only a new user substance.
17. **Node costs.** E14 shows cents (Σ $0.55, $0.09, $0.05). `rollupLine` in `lib/case-editor/tree-layout.ts` uses `Math.round`, so $0.55 shows as "$1" and $0.05 as "$0".
18. **Tree layout.** The screens draw labelled tier lanes. The code places rows by depth, so a step that skips a tier lands in the wrong row. Nodes are 220×72 (spec 128×72). Zoom goes down to 25% (spec floor 86%). A plain mouse wheel does not zoom; Ctrl or ⌘ is needed, while the strip says "scroll to zoom".
19. **Panel and narrow screens.** E03b hides the panel with a button; the code has no button. Below 1024px the CSS hides the inspector entirely, so no step can be edited (the spec wants it to narrow to 320px below 1280px). Below 820px only the canvas is left. There is no phone layout or "Open on a larger screen" message (E15 to E17).
20. **Machine calculator.** E04 uses Power × Time in seconds × Load, in the flow row. `machine-energy.tsx` takes run hours and sits in the step panel.
21. **Lessons.** The screens show six bracket exercises. `lib/lessons.ts` has six lessons, but they are about a touring bike (2.2 kg aluminium tube, a 5.6 kW machine), and the Learn button's tooltip says "Five short lessons".
22. **Results against the Base case.** E05, E06 and E17 compare against the Base case. The code only shows "x% vs last run" for the same case with the same method and region.
23. **Shares.** E05 and E17 print a share next to each step. The code computes it and does not show it.
24. **Older runs.** The spec says older runs open read-only. The code cannot open an older run; export uses the latest.
25. **Rounding.** The spec rounds a base case to 2 decimals and a comparative case to 3. The code shows 4 significant figures everywhere (`fmtSig` in `components/lcapix/formatters.ts`). For 1.72, 1.667 and 1.682 the results happen to match. A base total of 1.7234 would show 1.723.
26. **Magic Insights.** The spec requires every AI number to be checked against the run and the reply cached by run. The code relies on prompt rules only, checks nothing, caches nothing, and its footer says "Generated locally · not stored" even when the text comes from the Hugging Face model.

**Project pages**
27. **Compare, region.** E09b counts "Region differs" as a failed check, greys the totals and hides change by step. The code treats a region difference as a warning only, and shows "Not a valid comparison yet" only for a different method or functional unit. Even then, the panels still render.
28. **Compare, case count.** E09 shows "+ Add a case" with no stated limit. The compare route keeps the first 8 cases and drops the rest without saying so.
29. **Privacy switch.** E08b asks for confirmation. The code saves the switch at once. (The screen's account of what happens is right.)
30. **Add people.** E08 takes many emails or a CSV. The route takes one email per request. The member list returns usernames, not full names.
31. **Reports and confidence.** E11 marks Confidence "Not in the PDF yet". The PDF already prints the run's data-quality statement under "How far to trust it". The preview's footer shows the author and institution; the real footer prints the page number, "Generated by LCAPIX v3" and the export date.
32. **New project defaults.** F2.1 defaults to TRACI 2.1 and United States. The code defaults to CML 2001 and Global. The code also asks for "Goal of the study", which F2.1 does not show.
33. **Copied from.** E06 and E15 say "copied from Dr. Rivera's Base case". The duplicate route does not set `parent_case_id`, so the only trace is a note in the description.

**The landing page**
34. **Roles claim.** "Owner, admin, editor and viewer; viewers never see edit controls." Viewers get the full editor UI (the case editor has no read-only branch) and the project header shows Delete to everyone. The server refuses their edits with 403.
35. **Exports claim.** "Every page carries the run number and snapshot time." The PDF footer carries the page number and the export date. The run number appears only in the first sections.
36. **Audience claims.** "Assignments from templates", "Hand-in and feedback", "Free for students", "Shared organisation library", "Review and approval, published versions" and "Portfolio across products" have no code behind them: no templates (`is_template` unused), no comments or feedback, no approval or versions, and the pricing page has no student tier.

---

## Claims from earlier research, checked

| Claim | Verdict | Evidence |
|---|---|---|
| A routing gives steps and labour hours, not materials or energy | True | `lib/ingest/routing.ts` writes `flows: []` and labour costs only. Machine time goes into the step description, not an energy flow. Copy in `lib/import/display.ts`. |
| Matches accepted at 70%, pre-ticked at 90% | True | `MATCH_ACCEPT = 0.7` (`lib/ingest/maplca.ts`); pre-tick `>= 0.9` (`lib/import/review.ts`). Step placement has no threshold. |
| The privacy switch hides even the professor's base case | True | `lib/route-guard.ts` shows editors and viewers only cases they created. Viewers, who cannot create cases, see none. |
| There are no feature flags | True | Only config env vars (`HF_TOKEN`, API keys, rate-limit store). |
| The hosted upload limit is 4.5 MB | Partly wrong | The code cap is 12 MB. 4.5 MB is Vercel's platform limit, named only in the error text. No browser check. |
| Cost columns on each node, no source per cost | True | Cost columns on `component`; no source column. Import basis text is dropped in `app/api/ingest/apply/route.ts`. |
| BLS, EIA and metals lookups sit behind an allowlist | Wrong | Open to any signed-in user, 60 lookups per user per hour (`lib/integrations/rate-lookup.ts`). Only the inputs are allow-listed (state codes, SOC code pattern, metal symbols). |
| Runs freeze costs | True | Snapshot v3 freezes per-step costs (`lib/run-snapshot.ts`). Not frozen: labour hours, occupation, write-up, hand-in. |
| The sample is created by POST /api/example-project | True, with a gap | The route builds it, but it is called only from the empty Home, never at sign-up, and it makes no run. |
| Adding a member needs an existing account and sends no email | True | 404 for an unknown email; no mail code. One email per request, no CSV. |
| A copy of a case carries no runs | True | `app/api/cases/[caseId]/duplicate/route.ts` and `lib/case-copy.ts`. The write-up, lessons, hand-in and documents are not copied either. |
