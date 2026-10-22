# Integration assessment: the education screens on v1-hardening

Written 2026-10-20 in answer to `design/education/INTEGRATION_PROMPT.md` (PR #4, branch
`v1-hardening-education-integration` at 9227580). That commit's app code is identical to
`v1-hardening` (b5bed3d), which is what production runs. Nothing here is committed or pushed.
**Verified** means read in code (file and line) or run on this Mac. **Inferred** means judgement.

How it was checked:
- Read all 35 screens, the README, the build map, the five specs, the deploy checklist, and the code
  files the prompt lists.
- The build map's code claims were checked one by one on 2026-10-16 against 09723e5 (code unchanged
  since): 36 of 36 disagreements and 13 of 13 backend items hold, 9 with nuances (§2.2).
- Ran the branch on this Mac: Next.js on port 3100 against a copy of our real local data. 8 pages,
  116 requests, no errors.
- Built a database from nothing with `scripts/db/fresh.mjs` on MySQL 8.0.46 under Node 22.23.3:
  baseline, seed and all 24 migrations (009 to 032) in 7 s. Its 23 tables match our real local
  database except one backup table made on 2026-09-15.
- GitHub ran all 9 checks green on b5bed3d on 2026-10-17.

## 1. Verdict

**Integrate in phases.** Nothing blocks starting: 113 of 275 elements exist, and 131 more are new
screens over data the API already serves. Three things gate parts of it: twelve backend items plus
three the screens need that the build map does not list (§3); a privacy rule the product purpose
needs and the code lacks (item P); and four of our own already-gated fixes that must go in first,
one of which stops the designed sample from printing three double-count warnings (§4.1).

## 2. Every screen

Counts are the build map's (built / new screen / needs backend / coming soon). "Now" means buildable
over today's API. Item numbers refer to §3; Q numbers to §6.

| Screen | Counts | Status | Waits on |
|---|---|---|---|
| F1.1 Landing | 3/7/0/0 | Decision | Q1: several lines promise things with no code |
| F1.2 Sign-up | 5/2/0/1 | Now | |
| F1.3 About you | 3/3/2/1 | Backend | items 10, 1 |
| E02 Home, the sample study | 1/4/5/0 | Backend | items 1, 2 |
| E12 Home, later | 3/5/1/1 | Backend | items 6, 7 |
| F2.1 New project | 5/2/0/0 | Now | default method and region: Q5 |
| F2.2 Add a file | 7/1/1/1 | Now | "reads left" needs item 9 |
| F2.3 Check what we read | 7/2/0/0 | Now | keep our editable review (§4.1) |
| F2.4 Saved | 3/2/0/0 | Now | |
| F2.5 Start empty | 4/4/0/0 | Now | |
| F2.6 Add the bill of materials | 7/3/0/0 | Now | |
| F2.2b A file that can't be read | 3/2/0/0 | Now | |
| E03 Case, Tree | 2/6/2/0 | Backend | items 3, 4; stage 0 engine fix |
| E03b Panel hidden | 1/3/1/0 | Backend | item 3 |
| E03c Keyboard and step menu | 1/5/1/0 | Now | its Argon row needs item 1's substances |
| E04 Case, Inventory | 2/6/1/0 | Backend | item 3 |
| E05 Case, Results | 3/5/0/0 | Now | the run snapshot already holds steps and costs |
| E06 Write-up (student) | 4/3/1/0 | Backend | item 8 ("copied from") |
| E14 Step costs | 5/4/1/0 | Backend | item 5 |
| E07 Cases, pipeline | 2/8/0/0 | Now | one request per case until item 7 |
| E07b Cases, table | 0/5/0/0 | Now | same |
| E08 People | 4/4/0/1 | Now | the client loops emails and parses the CSV; full names need item 7 |
| E08b Privacy switch confirm | 3/2/0/1 | Now | the rule it describes needs item P |
| E09 Compare | 6/1/0/1 | Now | |
| E09b Compare, a failed check | 4/2/0/1 | Small backend | region mismatch becomes a failed check |
| E10 Analytics | 1/6/1/0 | Backend | items 3, 7 |
| E11 Reports | 4/4/0/2 | Now | confidence is already in the PDF |
| E18 New case | 7/1/1/0 | Backend | item 8 |
| E19 Many projects | 2/4/1/0 | Backend | items 12, 7 |
| E13 Student Home | 1/5/0/0 | Backend | items P, 7 |
| E15 Phone, Home | 2/5/0/0 | Now | read-only; item 7 |
| E16 Phone, case outline | 0/6/0/0 | Now | |
| E17 Phone, Results | 1/6/0/0 | Now | |
| F1.2b Log in and its errors | 4/1/1/0 | Backend | item 11 for "Forgot password?"; neutral wording stays |
| F1.4 Building the sample | 3/2/1/0 | Backend | item 1 |

### 2.2 Where the build map is wrong or nuanced (verified)
- Equipment list (#9): the browser refuses it first (`lib/import/preview.ts:38-40`), the server second.
- Shared rate-limit store (#7, item 9): already written (`lib/rate-limit.ts:160-207`), switched on by
  `UPSTASH_REDIS_REST_URL` or `KV_REST_API_URL`. Item 9 is mostly configuration.
- Shares (#23): hidden only on the Results headline. The stage panel and the project page print them.
- Item 5: the run snapshot exists. What is missing is rate, source and vintage per cost.
- Item 7: the progress route already returns full names. Only `/api/projects` and `/members` return
  usernames.
- "Skip for now" (#14) and "Forgot password?" (#13) do not exist on today's pages.
- Privacy (#29): the only switch is `members_see_own_cases`. There is no public or private field.
- Templates (#36): process-library templates exist; assignment templates do not.

## 3. Backend items

Sizes are working days, inferred. Migration numbers are provisional: they run in order through
`scripts/db/migrate.mjs`, and reach production before the code that reads them.

| # | Item | First release | Approach | Migration | Tests | Size | Risk | Depends on |
|---|---|---|---|---|---|---|---|---|
| 1 | Sample study builder | yes | Rewrite `lib/example-case.ts` and `app/api/example-project/route.ts`: 17 steps over five tiers, 10 flows, labour hours, run the base, duplicate, cure electricity 0.25 kWh, run again. Called after onboarding; one per account; safe to repeat. | 033: seed Argon, Powder coating, Packaging tape, Scrap steel with no climate factor | golden totals 1.72 and 1.667; idempotent; rolls back on failure; under 5 s | 2-3 | medium | stage 0 engine fix; item 2 |
| 2 | Sample flag and read-only | yes | `project.is_sample`; every write to the sample's base case refused with a clear message; duplicate allowed; add the sample again from anywhere | 034 | every write route against the sample | 1-1.5 | medium | |
| 3 | Flow with no amount | yes | `flows.quantity` nullable; API accepts blank; engine skips and counts; the count reaches the snapshot, the data-quality statement and the PDF | 035 | engine, API, export; every reader of quantity audited | 2-3 | high: nulls reach code that assumes numbers | |
| 4 | Own number for a factor | yes | `flows.factor_override`, `_source`, `_note`; engine uses it; snapshot tags it "Entered by hand" | 036 | engine, snapshot, units guard | 2 | medium | 3 |
| 5 | Source per cost | yes | rate, source (reference, live, entered) and vintage per cost on `component`, frozen in the snapshot | 037 | API, snapshot | 1.5-2 | low | |
| 6 | Held import lines | yes | `import_held_lines` written by ingest apply; resolve route | 038 | API | 1 | low | |
| 7 | Summary fields for lists | yes | latest run id, Global Warming total and `created_at` on progress; latest run on `/api/projects`; full names on projects and members | none | API contracts; one query per list | 1 | low | |
| 8 | Copy link | yes | write `parent_case_id` in duplicate and in cases POST (column exists) | none | API | 0.5 | low | |
| 9 | Reads left this hour | yes | return the remaining count; set the KV variables | none | API | 0.5 | low | a KV store account |
| 10 | Onboarding rules | yes | add teaching, lab, own study to `ALLOWED_USE_CASES` (`app/api/auth/profile/route.ts:17`); company optional; skip allowed | none (`use_case` is VARCHAR(60)) | API | 0.5 | low | |
| 11 | Password reset | yes, once email exists | hashed single-use tokens, 60-minute expiry, uniform answers, rate limits, sessions revoked on reset (the password fingerprint already exists) | 039 | enumeration, reuse, expiry, revocation | 2 | high | an email provider and DNS |
| 12 | Pinned projects | yes | `project_pins` per account | 040 | API | 0.5 | low | |
| P | Per-case privacy (new) | yes | with the switch on, members reach cases made by the owner or an admin, plus their own; classmates stay hidden | none | 4 roles x case creator x switch on/off x every case route | 1-1.5 | high: privacy | Q4 |
| V | Read-only UI for "Can read" (new) | yes | hide edit controls for viewers; the server already refuses | none | end-to-end as a viewer | 1 | low | |
| I | Magic Insights checks (new) | yes | check every number in a reply against the run and drop the reply on a mismatch; cache by run; honest footer; per-project AI switch | 041 | number checker unit tests | 1.5 | medium | Q9 |
| 13 | Later | no | findings, saved reports, invites, join requests, comments, cross-project compare, guided mode saved to the account | | | | | |

Backend total: about 19-24 days (inferred).

## 4. Risks

**4.1 Our gated fixes come first.** The prompt says `v2-modular`'s three commits overlap seven
hardened files. They were re-homed onto the hardening code as `v2-commercial` (four commits, gate
passed 2026-10-14) and replay onto PR #4's tip with no conflicts (dry run, 2026-10-20). They carry:
- the duplicate detector that replaces the parent-flow warning. The designed sample puts flows on
  10. Cut blank, 30. Powder coat and cure and 40. Pack and ship, which have tasks below them. Today's
  engine warns on each (`lib/lca-engine.ts`, structure warning), so the sample's own run would print
  three double-count warnings.
- the editable import review. The design's F2.3 is read-only; ours lets you fix tier, name, parent
  and quantity before saving. Keep ours.
- Keep / Replace / Add on re-import, typed wage rates, loud cost failures, and the fix for routings
  whose hour columns say "per unit", which today reads labour about 10 times too small.

**4.2 A sidebar on every page.** `app/project/layout.tsx:3,21` renders the top bar;
`components/ui/sidebar.tsx` is unused. Done in one stage, guarded by every existing journey test.

**4.3 Tabs instead of the three-pane editor.** Plan: nested routes under the case (tree, inventory,
results, write-up) sharing one layout and one data cache. Old URLs redirect.

**4.4 Roles.** `owner`, `admin`, `editor`, `viewer` (`lib/auth.ts:27`). "Can change" is editor,
"Can read" is viewer, a student is any member who is not the owner. The lighter student screens are
presentation only; the server keeps enforcing access (404 for outsiders, 403 for low roles).

**4.5 Per-case privacy.** `lib/route-guard.ts:19-23` and `:103-125`: with the switch on, editors and
viewers reach only cases they created. The professor's base case is hidden too, and viewers see
nothing. The product purpose needs the owner's cases visible. That is item P.

**4.6 Global run numbers.** `run_id` counts across all users. Keep it and label it "Run #n" unless Q3
says otherwise.

**4.7 Upload size.** The code accepts 12 MB (`lib/ingest/extract-text.ts:16`). Vercel refuses request
bodies over about 4.5 MB before the route runs (inferred from Vercel's documented limit and the
code's own 413 text). Check size in the browser now; upload straight to storage later if files grow.

**4.8 No email.** No code sends email (verified, 0 files). Password reset needs a provider account and
SPF and DKIM records on the domain.

**4.9 Rate limits per server.** Without a KV store, each server instance counts separately.

**4.10 Public claims with no code behind them.** The live Security page says enterprise customers
can "configure SAML / SCIM" (`app/legal/security/page.tsx:34-35`), promises "short access tokens and
refresh rotation" (`:37`; tokens last 7 days by default, `lib/auth.ts:17`, and no refresh code exists)
and "HSTS preloaded" (`:26`; the header has no preload directive, `next.config.mjs:25`, and the live
header matches). Pricing lists SSO (SAML, OIDC). University security reviews check exactly these.
Fix the wording before any review.

**4.11 Accessibility.** `tests/e2e/a11y/baseline.json` accepts existing violations on 47 screens,
including 73 colour-contrast, 15 missing labels, 10 unnamed selects and 9 small targets. The test
fails only when a count rises. New screens must start at zero, and old ones need fixing (§7).

**4.12 Two routes to production.** Vercel deploys production from pushes to `v1-hardening`; the
workflow deploys from pushes to `main` with `vercel --prod`. Keep one, `main`, before release.

**4.13 Deploy checklist.** Written before the 8 October deploy. Done: migrations 026 to 032 on
production (14 October), the gitleaks finding (b5bed3d). Open: required checks on `main` (unprotected,
verified), a demo account in production (found in the 14 October dump; the checklist says none),
secret rotation and the history purge decision (not verifiable here).

## 5. Build order

Each stage ends in a gate. No stage starts until the previous gate has passed and is logged.

| Stage | What ships | Backend first | Stays Coming soon | Gate | Days (inferred) |
|---|---|---|---|---|---|
| 0 Base | PR #4's tip plus our four gated commits, on a local branch | | | replay clean; every suite on Node 22 and MySQL 8.0; sample engine golden test | 1 |
| 1 Fixes the screens rely on | read-only for "Can read", cents in roll-ups, Compare's case cap stated, region mismatch fails the check, insights checks and footer, upload size check, older runs read-only, Security page wording | V, I | | a test per fix; suites green | 3-4 |
| 2 Backend for the first release | items 3, 4, 5, 7, 8, P, 10, 2, 1, 6, 9, 12; 11 once email exists | as listed | 13 | migrations on a fresh database and on the real-data copy; API, access matrix and edge cases | 14-18 |
| 3 App shell | sidebar, project switcher, header, look tokens, case header and tabs | 7, 12 | | every existing journey passes; no new accessibility failures | 3-4 |
| 4 Case work | E03, E03b, E03c, E04, E05, E06, E14 | 3, 4, 5, 8 | | the video's chapter 3 as a journey test; edge cases; side by side with the designs | 8-10 |
| 5 Arrive and first Home | F1.2, F1.2b, F1.3, F1.4, E02, E12 | 1, 2, 6, 10, 11 | guided mode saved to the account | chapters 1 and 2 | 4-5 |
| 6 File to project | F2.1 to F2.6, F2.2b | 9 | utility bills, permits, transport records, cost sheets | chapter 4; file edge cases | 3-4 |
| 7 Project pages | E07, E07b, E08, E08b, E09, E09b, E10, E11, E18, E19 | 7, 8, 12, P | findings, saved reports, invites, cross-project compare | chapter 5 | 6-8 |
| 8 Student side and phone | E13, the lighter student screens, E15 to E17 | P, 7 | comments | chapter 6; role matrix | 3-4 |
| 9 Landing | F1.1 with approved wording | | | no claim without code | 1-2 |
| 10 University hardening | WCAG 2.1 AA on every screen; Chromium, WebKit and Firefox; load test for a class; security pass (access matrix, headers, enforced CSP, dependency audit); error monitoring hook; migration gate in CI | | | zero critical or serious accessibility failures; three browsers green; load target met | 5-7 |
| 11 Release candidate | full regression on a fresh database and the real-data copy; every screen checked against its design; release runbook with migrations first | | | every screen signed off; one push away | 2-3 |

Total: about 53-70 working days, roughly 10-14 weeks (inferred). Earlier estimates of 4-6 weeks
counted the screens only; this adds the backend items, the shell, hardening and release.

## 6. Questions for the product owner

| # | Question | What the answer unlocks |
|---|---|---|
| Q1 | Landing and the live Security and Pricing pages: remove the lines with no code, or build them? | stage 9; the Security page fix in stage 1 |
| Q2 | Release scope: this design only, or with single sign-on, LMS launch and institutions (§7)? | whether Release 2 folds into this push (+4-6 weeks, inferred) |
| Q3 | Run numbers: keep global ids, or number runs per case? | per case needs a migration |
| Q4 | Privacy with the switch on: members see the owner's and admins' cases plus their own, classmates hidden. Right? And what does a "Can read" member see? | item P |
| Q5 | Default method and region for new projects: the sample's (TRACI 2.1, US), or set per institution? | F2.1; not hard-coding one country |
| Q6 | Delete: our typed-name confirm, or confirm plus Undo (needs soft delete)? | a backend item or none |
| Q7 | Costs on any node, parents as sums? | the cost view and the engine rule |
| Q8 | "Make my own copy" for the exercises blanks two amounts (Deburr edges, Fold and tape). Confirm that copy rule. | item 1 |
| Q9 | Magic Insights for students: a per-project switch the professor controls? | item I |
| Q10 | Email provider: AWS SES (already on AWS), Postmark or Resend? Someone with the accounts must create it. | item 11 |

## 7. University and enterprise readiness

"Client agnostic" is read two ways, and the plan covers both. Nothing is hard-coded to one
university, one learning platform, one sign-in provider or one country. And it works in every
mainstream browser and on Chromebooks, with phones read-only.

| Area | Today (verified) | What universities expect | When |
|---|---|---|---|
| Sign-in | email and Google only | SAML 2.0 (Shibboleth, InCommon), Microsoft Entra and Okta; MFA for staff | Release 2 |
| Learning platform | none; framing is blocked (`X-Frame-Options: DENY`, `frame-ancestors 'none'`) | LTI 1.3 launch from Canvas, Blackboard, Moodle and D2L; rosters through NRPS; grades stay in the LMS | Release 2 |
| Institutions | no institution model (0 files) | institution accounts, domains, IT admins, per-institution settings (AI on or off, defaults, terms) | Release 2 |
| Accessibility | known failures accepted on 47 screens | WCAG 2.1 AA and an Accessibility Conformance Report (VPAT). The 2024 Department of Justice rule under ADA Title II requires WCAG 2.1 AA from US public universities (inferred from that rule; confirm dates with each accessibility office) | Release 1, stage 10 |
| Student privacy | no account export or deletion route; the `audit_log` table exists but nothing writes to it | FERPA terms (vendor as "school official"), a data processing agreement, export and deletion on request, an audit trail, a sub-processor list (Vercel, AWS, Hugging Face for AI narration) | Release 1 for the features; documents alongside |
| Security review | public claims that do not match (§4.10); CSP report-only; `main` unprotected | answers to the EDUCAUSE HECVAT questionnaire; enforced CSP; required checks; rotated secrets; a penetration test; SOC 2 later | Release 1 fixes; documents alongside |
| Operations | no error monitoring; two deploy routes; migrations not gated | staging, monitoring and alerts, backups with a restore drill, an uptime target, an incident process, a migration gate in CI | Release 1, stage 10 |
| Email | none | transactional email with SPF, DKIM and DMARC | Release 1 (password reset) |
| Scale | never load-tested; rate limits per instance | a class of about 300 running assessments in the same hour | Release 1, stage 10 |
| Browsers | end-to-end tests on Chromium only | Chrome, Edge, Safari, Firefox; Chromebooks | Release 1, stage 10 |

## 8. How each stage is checked

- Unit tests for every pure rule: engine, units, statuses, privacy decisions, the number checker.
- API tests on a throwaway database: every route against owner, admin, editor, viewer, non-member and
  signed-out, plus edge cases (blank, zero, negative and huge numbers; wrong units; long and
  non-Latin names; deleted parents; two edits at once; exhausted rate limits).
- File edge cases: scanned PDF, wrong file type behind a right extension, over 4.5 MB, empty sheet,
  10,000 rows.
- Journey tests that follow the video chapter by chapter.
- Accessibility scans: no new failures from stage 3; zero critical or serious by stage 10.
- Screenshots of each built screen beside its design, kept in the log.
- Migrations on a fresh database and on the copy of our real data.
- A manual pass on the real-data copy after each stage.
- Cross-browser runs, a load test and a security pass in stage 10.
- Every finding and change goes in `~/lca/research/education-build-log.md`.

## 9. Corrections to the prompt's STATE

- Migrations 026 to 032 have been on production since 2026-10-14 (applied with the ops script; both
  new columns present, 24 ledger rows).
- `v2-modular` is superseded by `v2-commercial` (four commits, local, unpushed, gate passed
  2026-10-14).
- Production also deploys from pushes to `v1-hardening`, not only from `main`.
