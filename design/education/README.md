# LCAPIX for teaching and research: the education screens, ready to build

This folder is the design handoff for the education version of LCAPIX. It holds 35 screens designed in Paper on 16 October 2026, the specs behind them, and a map of what today's code already does. It changes no app code.

Start here, in this order:
1. **Watch the walkthrough film** (about 9 minutes). Kavish sends the MP4 separately. It follows one professor, Dr. Elena Rivera, and one student, Ana Ruiz, through every screen in the order they meet them. The chapter list and script are in `walkthrough/`.
2. **Read the screens row by row** (below). Each row is one sequence, read left to right.
3. **Read `specs/`** before building a screen, and **`build-map.md`** to see what each screen needs from the backend.

## What the product is
LCAPIX is a life-cycle assessment tool for teaching and research. The first users are professors and researchers at environmental schools and labs, and their students. It sits beside Canvas, which keeps the roster, deadlines and grades. LCAPIX does not mark work.

The idea in one line: a researcher starts on a finished sample study, reads it in the order research is done, makes their own copy to try it, then starts their own project and brings people in.

- Education and individual accounts get the same experience for now.
- Enterprise (organisations, company workspaces, SSO, seats) shows only as "In development".
- Guided mode is a beta extra, off by default. When on, a scripted guide walks a person through each part of a study, most of all right after a file import.

## The screens
All PNGs are exported at 2x from Kavish's Paper file, page "04 Education v1". Desktop screens are 1440 wide; phone screens are 390 wide.

### `screens/a-website-to-home/`: from the website to the first Home
| Screen | Shows |
|---|---|
| F1.1 Landing | Kavish's landing page as he designed it, with the wide product shot (the tree, the answer 1.72, the walkthrough card) and the technical-drawing plates. |
| F1.2 Sign-up | "Continue with Google" first, then email. The left panel is a blueprint of the sample bracket (sheet 1 of 2). |
| F1.3 About you | Name, institution (optional), what it will be used for. "A company workspace" is In development. Guided mode with its BETA pill, off unless turned on. Sheet 2 of 2 traces the five tiers. |
| E02 Home, the sample study | Home is the sample's Overview, read in research order: the question, how it is made, what goes in, the answer (1.72 kg CO₂-eq) and what builds it, a what-if, the example write-up, and what next ("Make my own copy"). |
| E12 Home, later | Once a project of her own exists: Continue, Needs attention, her projects. The sample steps aside to a small card. |

### `screens/b-file-to-project/`: a file to a project
| Screen | Shows |
|---|---|
| F2.1 New project | From a file or empty, the research question and the defaults. |
| F2.2 Add a file | Dropping a routing. What a routing can and can't give, and the upload limits. |
| F2.3 Check what we read | Five steps and their labour hours. Nothing is saved until Save. |
| F2.4 Saved | The checklist of what is in and what is missing. Next: add the bill of materials. Guided mode picks up here when it is on. |
| F2.5 Start empty | The five tier lanes and the first step under the product. |

### `screens/c-case-work/`: working in a case
| Screen | Shows |
|---|---|
| E03 Case, Tree | Five labelled tier lanes, two steps that need an amount, and the floating step panel: flows as amount × factor (0.80 kg × 1.900 = 1.520), the source tag, and the Guided mode line. |
| E03b Tree, panel hidden | "Hide panel" gives the tree the full canvas. "Show panel" brings it back. |
| E04 Case, Inventory | Every flow with its status (Counted · Counted, no climate factor · Needs an amount · Left out, unit can't convert), and the machine calculator (0.75 kW × 8 s × 80% = 0.0013 kWh). |
| E05 Case, Results | The answer 1.72, what builds it, how sure, and cost beside impact: $1.75 per bracket, where Weld tab is 31% of cost but 2.4% of impact. |
| E06 Case, Write-up (student) | Ana's answer 1.682 (2.2% lower), her interpretation, and the hand-in tick, which locks nothing. |
| E14 Step costs | The Cost view of the tree. Weld tab is $0.55, built from activities, each one a driver times a rate. A rate can be looked up (for example BLS wages) or entered by hand. |

### `screens/d-project-pages/`: the pages of a project
| Screen | Shows |
|---|---|
| E07 Cases, pipeline | The class's cases in four columns: Not run yet · Run · Written · Ticked as hand-in. No reminders are sent. |
| E08 People | Add people by email or a class CSV (they need an account; no email is sent), Can change or Can read, and the "Students see only their own case" switch. |
| E09 Compare | Base case 1.72 against Shorter cure cycle 1.667, the four comparability checks, and the change by step. |
| E10 Analytics | How far the class got (23 ran, 12 wrote up, 5 ticked) and where the results landed. |
| E11 Reports | Exporting a case report. |
| E18 New case | A what-if copy of the base case. Runs are not copied. |
| E19 Many projects | The project switcher open with ten projects, so the sidebar stays calm. |

### `screens/e-student-and-phone/`: the student's side and phones
| Screen | Shows |
|---|---|
| E13 Student Home | What is shared with Ana, and making her own case. |
| E15 Phone, Home | Home on a phone. |
| E16 Phone, case outline | The case as a read-only outline, with "Open on a larger screen to edit". |
| E17 Phone, Results | Results on a phone. |

### `screens/f-states-and-errors/`: states the build needs
| Screen | Shows |
|---|---|
| F1.2b Log in and its errors | A wrong password, and an email that already has an account at sign-up. |
| F1.4 Building the sample | The few seconds while the sample is built, and what happens if it fails (Try again, or start empty). |
| F2.2b A file that can't be read | A scanned PDF: why, how to fix it, and the upload limits. |
| F2.6 Add the bill of materials | Each line of the bill of materials placed on a step before Save. |
| E03c Keyboard and the step menu | A focused step, the key map, the step menu (Rename, Move to, Add a task below, Delete step), a run in progress and a run that is out of date. |
| E07b Cases, table | The same cases as a table (also the screen-reader view of the pipeline). |
| E08b Privacy switch confirm | The confirm before "Students see only their own case" hides cases, and the result of adding four emails. |
| E09b Compare, a failed check | What Compare says when a comparability check fails. |

## The specs (`specs/`)
| File | What it covers |
|---|---|
| `look.md` | The visual finish: app shell, header bar, filter bar, cards, tables, source tags, inspector, buttons, pills, colours. |
| `canvas.md` | The case Tree tab: canvas, tier lanes, connectors, steps, and the floating step panel (hide, show, dock, keyboard). |
| `sidebar.md` | The sidebar that stays calm with 10 or more projects: switcher card, one open project nested, Recent, All projects, Guided mode row. |
| `rules.md` | The exact words, the facts every screen must agree on, accessibility rules for controls, and the patterns for confirm, busy, error, empty and saved. |
| `behaviour-spec-claude-design.md` | The behaviour and data spec from Kavish's Claude Design handoff: information architecture, every page, the sequence, data objects, AI functions, tokens and the acceptance checks. |

## What changed since the Claude Design handoff
The screens are newer than `specs/behaviour-spec-claude-design.md`. Where they disagree, the screens win:
1. **Sidebar.** Only the open project is nested, inside a switcher card. Other projects are one line each under RECENT (at most 3), then "All projects". See `specs/sidebar.md`.
2. **The finish** comes from Kavish's earlier "App v3": a white app shell on grey, a white sidebar with a mint current item. See `specs/look.md`.
3. **The step panel floats** over the tree and can be hidden, instead of a fixed 55/45 split. See `specs/canvas.md`.
4. **Guided mode** is opt-in (BETA, off by default), with its switch in the sidebar foot. The first sign-in does not start a guided walk unless it is on.
5. **Starting from a file** follows what the importer really reads: a routing gives steps and labour hours, then the bill of materials is added and each line placed on a step (F2.2 to F2.6). See `build-map.md` for the limits the code enforces.
6. **Costs per step** (E14) and cost beside impact (E05) are new screens over the cost data each step already has.
7. **New pages and states:** Analytics, Reports, New case, the many-projects switcher, and the whole states row (`f-states-and-errors/`).
8. **Landing:** F1.1 is Kavish's own landing design, kept as he made it.

## What needs the backend
`build-map.md` checks every screen against the code on `v1-hardening`, element by element, with file paths. Of 275 elements, 113 are built, 131 are new screens over data that already exists, 21 need backend work and 10 are tagged Coming soon on the screen. Its section "Backend work the screens need" lists 12 backend items in one place. The biggest:
- **The sample study.** The screens show it made at sign-up, read-only, with 17 steps, Run #101 and the Shorter cure cycle what-if. Today `POST /api/example-project` builds a smaller one (3 operations, 4 flows, no run) and only from the empty Home.
- **A flow with no amount.** Several screens show flows that "need an amount", but `flows.quantity` is NOT NULL today.
- **Summary fields for lists** (latest run and total per case), so Cases, Analytics and Home do not need one request per case.

Anything the backend does not do today stays tagged COMING SOON on the screen, once at most, until the backend lands.

## Before you build: where a screen should not be copied as drawn
`build-map.md`, section "Where a screen and the code disagree", lists 36 differences. Most mean the code needs the change. These five mean the screen does:
1. **Log in and sign-up errors (F1.2b).** Keep the code's neutral messages. The screen's wording ("That password doesn't match this email", "An account with this email already exists") would tell anyone which emails have an account. Build the layout and the inline placement, with the code's words.
2. **Upload limit (F2.2, F2.2b).** Keep "up to 4.5 MB" on the screen, because that is the real limit on Vercel, and add a size check in the browser so a larger file gets the screen's message instead of a generic "Preview failed". The code's own cap is 12 MB.
3. **Reports (E11).** Confidence is already in the PDF, under "How far to trust it". Show it as included, not "Not in the PDF yet".
4. **Check what we read (F2.3).** Labour is priced at a reference rate while the file is read, not after save. Word it that way.
5. **Landing (F1.1). Kavish decides before these lines ship.** Some lines promise things with no code behind them: in "For teaching", assignments from templates, hand-in and feedback, free for students; in "For teams", a shared organisation library, review and approval, a portfolio across products; "Book a demo" has no action; "viewers never see edit controls" (today they do); "every page carries the run number" (only the first sections of the PDF do).

## Testing
Every screen built from this folder gets an e2e test in `e2e-tester/` before it merges. See `specs/rules.md`, "Testing".
