# LCAPIX API permissions matrix

Every `app/api/**/route.ts` handler, by HTTP method and by caller role, with the status the endpoint should return. The machine-readable copy is the `permissions:` section of [`flows.yaml`](flows.yaml). The authz test generator reads that section, so the two files must change together.

- **Baseline read:** branch `v1-hardening-kavish` @ `704a964`. The `fix/authz` branch (commits `2fe3ead`, `4274d9b`) was read to align the intended behaviour; no other fix branch has commits yet.
- **Scope:** 43 route files at `704a964`, **64 route × method pairs** (R01–R62 plus R49b and R50b). Three pairs have mode-dependent rules and get extra rows (R03b, R52b, R53b), so the baseline table has 67 rows.
- **Added after the baseline:** two route files arrived with the fix/auth merge: `POST /api/auth/logout` (R63) and `POST /api/auth/google/session` (R64). With them the table has **66 pairs and 69 rows**. See §6.
- **Sources:** `lib/auth.ts` (`requireAuth`, `requireAdmin`, `checkProjectAccess`), every route handler, `docs/audit-2026-09-29/01-security.md` §3, and `02-features-qa.md`.
- **The branch moved while this was written.** `v1-hardening-kavish` is now at `c4a7200`, with fix/authz, fix/platform, fix/auth and fix/runs merged. The cells here still describe the pre-fix baseline, per the brief. §6 lists what the merges claim to have fixed, so the test generator knows which `now` markers should already flip.

## 1. Roles

| Column | Who | How the test fixture creates it |
|---|---|---|
| **Anon** | No `Authorization` header | none |
| **NonMem** | Signed-in `account_type='user'`, not the owner and no `project_members` row on the target project | signup (or direct insert) |
| **Viewer** | `project_members` row with permission `viewer` | owner calls `POST /api/projects/:id/members {email, role:'viewer'}` |
| **Editor** | member with permission `editor` | same, `role:'editor'` |
| **AdminM** | member with permission `admin` (project-level admin) | same, `role:'admin'` |
| **Owner** | `project.owner_id` = caller | creates the project |
| **PAdmin** | `account.account_type='admin'` (platform admin), **not** a member of the target project | direct insert or update in the test DB. No API creates one. |

Two more callers are tested on every authenticated row. They are not columns:

- **Deactivated:** a valid JWT for an account with `is_active=0`. It must get **401** everywhere. §4 lists the routes that answer 500 today.
- **Tampered token:** a JWT signed with the wrong secret, an expired token, or `alg:none`. It must get **401** everywhere.

### How `checkProjectAccess` decides (`lib/auth.ts:146-188`)
1. If `project.owner_id === userId`, the caller has full access.
2. Otherwise the caller needs a `project_members` row. The row's `permission_name` is ranked `owner 4 > admin 3 > editor 2 > viewer 1` and compared to the required level. With no required level, any member passes (shown as **M** below).
3. `account_type` is never consulted, so a platform admin has **no** implicit access to other people's projects. The matrix keeps it that way (see §5, D1).
4. A member row whose permission is `owner` passes owner-level checks even when `project.owner_id` is someone else. This is the stale-owner-row case in audit L9 (see §5, D2).

### Status conventions
- `200`/`201`/`302`: success (the code the handler actually uses; several creates return 200, noted per row).
- `401`: not signed in, bad or expired token, or deactivated account.
- `403`: signed in, but the role is too low, or the caller is not a member.
- `404`: the resource does not exist. Case-, component-, flow- and run-scoped routes check existence **before** access, so a non-member gets 404 for a missing id and 403 for an existing one (an existence oracle; see D3). Project-scoped routes check access first, so a missing project gives **403**.
- `400`/`409`/`413`/`429`: validation, conflict, payload too large, rate-limited. These are listed under Notes; the role columns assume a valid body.
- **`X (now Y)`**: X is the intended status and the current code returns Y. The Refs column has the reason.
- Tags in Refs: **FIX** = changed by an in-progress security fix (fix/authz, fix/auth, fix/platform). **REC** = an audit recommendation not yet assigned to a branch; confirm before tests assert it. **BUG** = a wrong status code in the current code, no policy change needed.

---

## 2. Matrix

Abbreviations in the Rule column: **P** public, **A** any signed-in user, **M** any project member, **V/E/Ad/O** at least viewer/editor/admin/owner, **PA** platform admin.

### 2.1 Auth and account

| # | Method | Path | Rule | Anon | NonMem | Viewer | Editor | AdminM | Owner | PAdmin | Notes / Refs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R01 | POST | `/api/auth/signup` | P | 201 | 201 | 201 | 201 | 201 | 201 | 201 | Needs no token; a signed-in caller can create another account. 400: missing field, password <8, username taken, email registered (L2 enumeration). **429** after 3/hour/IP (REC H5; no limiter today). Target: email verification before Google linking (FIX H3). |
| R02 | POST | `/api/auth/login` | P | 200/401 | 200/401 | 200/401 | 200/401 | 200/401 | 200/401 | 200/401 | 200 with a valid password, 401 otherwise. The baseline returns the inactive-account message before the password check (AUTH-6/L2). Target, as merged in fix/auth `74f8b25`: a generic 401 for a wrong password or an unknown email (with a dummy bcrypt compare), and **403** "Account is inactive" only **after** a correct password. **429** after 5/min per IP+email (H5). |
| R03 | GET | `/api/auth/google` (no `code`) | P | 302 | 302 | 302 | 302 | 302 | 302 | 302 | Redirects to `accounts.google.com` carrying `client_id`, `redirect_uri=${NEXT_PUBLIC_APP_URL}/api/auth/google`, `scope=openid email profile` and **`state`**. `state` is missing today (FIX H3/AUTH-1). Unconfigured: 302 to `/auth/login?error=google_not_configured`. |
| R03b | GET | `/api/auth/google?code=…&state=…` | P | 302 | 302 | 302 | 302 | 302 | 302 | 302 | Success: 302 to `/auth/callback?next=/home` (or `/auth/onboarding`), with cookies `auth_token` and `user_data`. Target (FIX H3/AUTH-1/AUTH-2/M4): a missing or mismatched `state` redirects to `/auth/login?error=…` and sets no cookie; `verified_email !== true` is refused; no silent link to an unverified password account; `is_active=0` is refused; the cookie is httpOnly (FIX AUTH-3). |
| R04 | GET | `/api/auth/me` | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | No UI caller today. |
| R05 | GET | `/api/auth/profile` | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | Self-scoped. Uses profile columns that no migration creates (AUTH-7), so it returns 500 on a DB built only from repo migrations. |
| R06 | PUT | `/api/auth/profile` | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | 400: `fullName` or `company` missing, `useCase` not in `product/facility/comparative/research/other`. Field lengths are unbounded (the DB enforces them, so long input gives 500). |
| R63 | POST | `/api/auth/logout` *(added at `c4a7200`)* | P | 200 | 200 | 200 | 200 | 200 | 200 | 200 | Needs no token. Always returns 200 with `Set-Cookie` headers that expire `auth_token` and `user_data` (Max-Age=0, httpOnly, SameSite=Lax). JWTs stay valid until they expire; there is no revocation yet (C2). |
| R64 | POST | `/api/auth/google/session` *(added at `c4a7200`)* | hand-off cookie | 401 | 401 | 401 | 401 | 401 | 401 | 401 | Returns **200** `{token, user}` only when the request carries a valid httpOnly `auth_token` hand-off cookie (2-minute life) set by R03b for an active account. Returns 401 without one. Returns **403** when `Sec-Fetch-Site: cross-site`. Every response clears the cookie, so a second call gets 401. The role columns assume no hand-off cookie; a Bearer token is irrelevant to this route. |

### 2.2 Projects, members, class progress

| # | Method | Path | Rule | Anon | NonMem | Viewer | Editor | AdminM | Owner | PAdmin | Notes / Refs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R07 | GET | `/api/projects` | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | The list contains only owned or member projects. Assert that the NonMem and PAdmin lists do **not** contain P. |
| R08 | POST | `/api/projects` | A | 401 | 201 | 201 | 201 | 201 | 201 | 201 | 400 when the name is empty; 409 when the same owner already has the name (case-insensitive). Not transactional (PROJ-2). |
| R09 | GET | `/api/projects/:projectId` | M | 401 | 403 | 200 | 200 | 200 | 200 | 403 | A missing project gives 403, because access is checked first (D3). Returns member emails to viewers, by design. |
| R10 | PUT | `/api/projects/:projectId` | Ad | 401 | 403 | 403 | 403 | 200 | 200 | 403 | Carries name, description, goal & scope (`goal_statement`, `functional_unit`, `system_boundary`, `boundary_notes`) and `lcia_method`/`region_code`. **Editors cannot set the functional unit** (see F5). 400: bad boundary or method. 409: migration missing. The name is written before validation (PROJ-8). |
| R11 | DELETE | `/api/projects/:projectId` | O | 401 | 403 | 403 | 403 | 403 | 200 | 403 | A stale `owner` member row passes this check (L9/D2). |
| R12 | GET | `/api/projects/:projectId/cases` | M | 401 | 403 | 200 | 200 | 200 | 200 | 403 | |
| R13 | POST | `/api/projects/:projectId/cases` | E | 401 | 403 | 403 | 201 | 201 | 201 | 403 | 400: missing name or type, or type not `base`/`comparative`. 409: duplicate name in the project. A second base case is allowed (PROJ-6). |
| R14 | GET | `/api/projects/:projectId/compare?cases=…` | M | 401 | 403 | 200 | 200 | 200 | 200 | 403 | 400: no case ids or a bad project id. 404: none of the cases are in the project. At most 8 cases, the rest silently dropped (CMP-6). |
| R15 | GET | `/api/projects/:projectId/members` | M | 401 | 403 | 200 | 200 | 200 | 200 | 403 | 404 when the project is missing. `canManage` is true only for the owner, which disagrees with the admin-allowed POST and DELETE (PROJ-8). Deactivated: 500 today (BUG X-API-2). |
| R16 | POST | `/api/projects/:projectId/members` | Ad | 401 | 403 | 403 | 403 | 200 | 200 | 403 | Body `{email, role ∈ viewer/editor/admin}`. Returns **200** (not 201); an existing member's role is updated. 404: unknown email (enumeration, L2). 409: target is the owner. REC L9: only the **owner** may grant `role:'admin'`, so AdminM would get 403 for that body. Deactivated: 500 today. |
| R17 | DELETE | `/api/projects/:projectId/members?user_id=` | Ad | 401 | 403 | 403 | 403 | 200 | 200 | 403 | 400 when `user_id` is missing. Returns 200 even when no row matched. REC L9: only the owner removes an admin. Deactivated: 500 today. |
| R18 | GET | `/api/projects/:projectId/progress` | M | 401 | 403 | 200 | 200 | 200 | 200 | 403 | Class-mode progress for every case in the project, including other members' cases (see D4). 404 when the project is missing. Deactivated: 500 today. |

### 2.3 Cases

| # | Method | Path | Rule | Anon | NonMem | Viewer | Editor | AdminM | Owner | PAdmin | Notes / Refs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R19 | GET | `/api/cases/:caseId` | M | 401 | 403 | 200 | 200 | 200 | 200 | 403 | 404 when the case is missing, checked before access (D3). Adds `project_lcia_method` and `project_region_code`. |
| R20 | PUT | `/api/cases/:caseId` | E | 401 | 403 | 403 | 200 | 200 | 200 | 403 | Name, description and type, plus `interpretation`/`assumptions`/`learning_state` (021), `is_final` (022) and `reference_flow`/`reference_flow_unit`/`modeled_output` (014). 400: empty name, or reference flow / modeled output ≤ 0. 409: duplicate name, or migration missing. `case_type` is not validated (L9). Not transactional (WRITE-1). |
| R21 | DELETE | `/api/cases/:caseId` | Ad | 401 | 403 | 403 | 403 | 200 | 200 | 403 | Cascades to components, flows, runs and documents. |
| R22 | GET | `/api/cases/:caseId/assessments` | M | 401 | 403 | 200 | 200 | 200 | 200 | 403 | N+1 per run (RUN-8). |
| R23 | POST | `/api/cases/:caseId/assessments` | E | 401 | 403 | 403 | 201 | 201 | 201 | 403 | Body `{calculation_method?, region_code?, run_name?}`. The method is not whitelisted (RUN-6); target: 400 for an unknown method. The server does not enforce the functional-unit gate; the UI does (see F9). **429** after 30/hour/user (REC H5). Returns `details: error.message` on 500 (L1). |
| R24 | POST | `/api/cases/:caseId/clone-from` | E | 401 | 403 | 403 | 200 | 200 | 200 | 403 | Body `{sourceCaseId}`, which must be in the same project; otherwise 400, sent **before** the access check, so it is an oracle. 409 when the target case is not empty. Returns 200. Copies no flows (CMP-2). |
| R25 | GET | `/api/cases/:caseId/completeness` | M | 401 | 403 | 200 | 200 | 200 | 200 | 403 | 400 for a non-numeric id. Deactivated: 500 today (BUG). |
| R26 | GET | `/api/cases/:caseId/components` | M | 401 | 403 | 200 | 200 | 200 | 200 | 403 | Joins `parent_component_name`; see R27 for the cross-case leak. |
| R27 | POST | `/api/cases/:caseId/components` | E | 401 | 403 | 403 | 201 | 201 | 201 | 403 | 400: missing name or type, or type not in `product, machine_line, subprocess, operation, elemental_task`. **400 when `parent_component_id` is not in this case (now 201, which echoes the other tenant's parent name).** FIX M1/FLOW-1. Target: also reject cycles. |
| R28 | GET | `/api/cases/:caseId/documents[?id=]` | M | 401 | 403 | 200 | 200 | 200 | 200 | 403 | 404 when the document is not in this case. Returns 200 with an empty list when migration 021 is missing. |
| R29 | POST | `/api/cases/:caseId/documents` (multipart `file`, `doc_type`) | E | 401 | 403 | **403 (now 200)** | 200 | 200 | 200 | 403 | FIX M2/DOC-1. Returns 200, not 201. 400: no file, or no readable text. Size: **413 before buffering for bodies over 12 MB (now 400, after the whole body is buffered)**, plus a type allowlist (FIX M6/DOC-2). 503 when migration 021 is missing. |
| R30 | DELETE | `/api/cases/:caseId/documents?id=` | E | 401 | 403 | **403 (now 200)** | 200 | 200 | 200 | 403 | FIX M2/DOC-1. 400 when `id` is missing. Returns 200 for a missing id (DOC-3); target 404. |
| R31 | POST | `/api/cases/:caseId/duplicate` | E | 401 | 403 | 403 | 201 | 201 | 201 | 403 | Body `{case_name?, case_type?}`. 400 when the source has no steps; 409 on a name clash. Returns 500 whenever a step has `drivers` JSON (CMP-1). Deactivated: 500 today. |
| R32 | POST | `/api/cases/:caseId/scale` | E | 401 | 403 | 403 | 200 | 200 | 200 | 403 | Body `{from>0, to>0, mode ∈ scale-inputs/data-covers}`, otherwise 400. It scales by the client's `from`, so it is not idempotent (COST-7). |

### 2.4 Components, flows, costs

| # | Method | Path | Rule | Anon | NonMem | Viewer | Editor | AdminM | Owner | PAdmin | Notes / Refs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R33 | GET | `/api/components/:componentId` | M | 401 | 403 | 200 | 200 | 200 | 200 | 403 | 404 when missing (D3). |
| R34 | PUT | `/api/components/:componentId` | E | 401 | 403 | 403 | 200 | 200 | 200 | 403 | **400 when `parent_component_id` is in another case, is itself, or would form a cycle (now 200, which echoes the other tenant's parent name).** FIX M1/FLOW-1. Cost-column errors are swallowed and success is still returned (FLOW-2). `COALESCE` means a field can't be cleared to NULL (FLOW-3). |
| R35 | DELETE | `/api/components/:componentId` | Ad (REC E) | 401 | 403 | 403 | **200 (now 403)** | 200 | 200 | 403 | REC FLOW-10: create needs editor while delete needs admin. Once EDIT-1 (fix/editor) wires Delete to this route, **editor members get 403 from the editor's Delete button**. Decide (D5) before asserting. Cascades to children, flows and **historical `assessment_results`** (RUN-1). |
| R36 | GET | `/api/components/:componentId/flows` | M | 401 | 403 | 200 | 200 | 200 | 200 | 403 | |
| R37 | POST | `/api/components/:componentId/flows` | E | 401 | 403 | 403 | 201 | 201 | 201 | 403 | 400: missing field, bad `flow_type`, or a unit that won't convert to the substance's unit. Target: 400 for a non-finite or negative quantity (now 201 or 500, FLOW-4/E9). REC L3/FLOW-5: 400 or 404 when `substance_id` is another user's private custom substance (now 201, which echoes its name). |
| R38 | POST | `/api/components/:componentId/auto-costs` | E | 401 | **403 (now 200)** | **403 (now 200)** | 200 | 200 | 200 | **403 (now 200)** | FIX H2/COST-1 (fix/authz `2fe3ead`). Missing component: **404 (now 500 with `err.message`)**. No UI caller. |
| R39 | PUT | `/api/flows/:flowId` | E | 401 | 403 | 403 | 200 | 200 | 200 | 403 | 404 when missing. The unit guard only runs when `unit` is sent (FLOW-10). REC L3: scope `substance_id`. |
| R40 | DELETE | `/api/flows/:flowId` | E | 401 | 403 | 403 | 200 | 200 | 200 | 403 | 404 when missing. |

### 2.5 Runs, exports, comparisons

| # | Method | Path | Rule | Anon | NonMem | Viewer | Editor | AdminM | Owner | PAdmin | Notes / Refs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R41 | GET | `/api/assessments/:runId` | M | 401 | 403 | 200 | 200 | 200 | 200 | 403 | 404 when missing (D3). Totals are read live through `JOIN component` (RUN-1). |
| R42 | GET | `/api/assessments/:runId/export?format=pdf\|pptx\|csv` | V | 401 | 403 | 200 | 200 | 200 | 200 | 403 | Content types: `application/pdf`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`, `text/csv; charset=utf-8`. An unknown format silently returns a PDF (EXP-7); target 400. Returns 404 when the executing account was deleted (EXP-7). Deactivated: 500 today. CSV injection (L5/EXP-3). |
| R43 | POST | `/api/comparisons` (legacy) | M (inline SQL) | **401 (now 500)** | 404 | 200 | 200 | 200 | 200 | 404 | BUG: the catch-all maps auth errors to 500. Saves nothing (CMP-7). 400: missing fields, fewer than 2 or more than 10 cases, or a case outside the project. **REC: delete the legacy comparisons feature.** |
| R44 | GET | `/api/comparisons?project_id=` (legacy) | M | **401 (now 500)** | 404 | 200 | 200 | 200 | 200 | 404 | Same catch-all BUG. 400 when `project_id` is missing. `JSON.parse` on JSON columns gives 500 when rows exist (CMP-7). |
| R45 | GET | `/api/comparisons/:comparisonId` (legacy) | M | **401 (now 500)** | 403 | 200 | 200 | 200 | 200 | 403 | 404 when missing. Same catch-all BUG, and CMP-7. |
| R46 | DELETE | `/api/comparisons/:comparisonId` (legacy) | O, AdminM or creator | **401 (now 500)** | 403 (creator: 200) | 403 (creator: 200) | 403 (creator: 200) | 200 | 200 | 403 | A creator keeps delete rights after being removed from the project (L9). |

### 2.6 Global reference data (no tenant scope)

| # | Method | Path | Rule | Anon | NonMem | Viewer | Editor | AdminM | Owner | PAdmin | Notes / Refs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R47 | GET | `/api/driver-factors` | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | REC L3/FAC-1: exclude other users' private custom rows and QUARANTINE rows. Unpaginated (about 4.3k rows). |
| R48 | GET | `/api/impact-categories` | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | |
| R49 | GET | `/api/substances` | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | Returns the library plus the caller's own custom substances (`is_custom=0 OR created_by=me`). Assert that user B's private substance is absent. |
| R49b | POST | `/api/substances` | A | 401 | 201 | 201 | 201 | 201 | 201 | 201 | Body `{name, kind ∈ input/emission, unit, method, impactCategory, factorValue>0, factorUnit, source, casNumber?}`. 400 when validation fails. 409 on a duplicate name, which today includes **other users' private names** (L3/FAC-4); target: scope the check to the library plus the caller's own rows. Not transactional (FAC-4). |
| R50 | GET | `/api/process-templates` | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | Returns `is_custom=0 OR created_by=me`, and `[]` when migration 022 is missing. |
| R50b | POST | `/api/example-project` | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | Builds the worked example in the **caller's** account. Returns 200, and 200 with `existed:true` on a repeat. PROJ-1: the functional unit is never set. Deactivated: 500 today. |
| R51 | POST | `/api/insights` | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | Returns a streamed `text/plain`, or JSON `{fallback:true}` with 200 when there is no `HF_TOKEN` or upstream fails. Target (REC H5/INS-2): **429** after about 20/hour/user, **413** for bodies over 16 KB or a `question` over 500 chars. The stream stalls today (INS-1). |
| R52 | POST | `/api/ingest/preview` (connector ≠ equipment) | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | Writes nothing. 400: bad connector, no file, or unreadable. 404: ITAC plant id not found. Target (REC M6/H5/ING-3): **413** over the size cap, checked before buffering; a type or magic-byte allowlist; **429** after 10/hour/user. |
| R52b | POST | `/api/ingest/preview` (connector = equipment, `target_case_id`) | E on the target case's project | 401 | 403 | 403 | 200 | 200 | 200 | 403 | 400 without `target_case_id`; 404 when the case is missing. |
| R53 | POST | `/api/ingest/apply` (create: `project_id`, `case_name`, `nodes`…) | E on `project_id` | 401 | 403 | 403 | 201 | 201 | 201 | 403 | Body validation (400) runs **before** the access check. Deactivated: 500 today. L6/L7. |
| R53b | POST | `/api/ingest/apply` (append: `target_case_id`) | E on the target case's project | 401 | 403 | 403 | 200 | 200 | 200 | 403 | 404 when the target case is missing. 400 when the default step is not in the case. |

### 2.7 Integrations (platform-wide data)

After the security fix every mutator is **platform-admin only**, and so is the integration log (fix/authz `4274d9b`, `lib/integrations/admin-guard.ts`: 401 when not signed in, 403 `Admin privileges required` for everyone else). "Owner" and "AdminM" in this table mean an ordinary user who owns or administers a project; project roles do not matter here.

| # | Method | Path | Rule | Anon | NonMem | Viewer | Editor | AdminM | Owner | PAdmin | Notes / Refs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R54 | GET | `/api/integrations/status` | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | Stays open to every signed-in user: `/home` (FACTORS tile) and `/library/factors` call it. It reveals which API keys are configured (INT-6, Info). |
| R55 | GET | `/api/integrations/log` | PA | 401 | **403 (now 200)** | **403 (now 200)** | **403 (now 200)** | **403 (now 200)** | **403 (now 200)** | 200 | FIX H1/L4. `?limit=abc` gives 500 (BUG INT-6); target: clamp to 1..200. |
| R56 | POST | `/api/integrations/openlca/import` | PA | 401 | **403 (now 200)** | **403 (now 200)** | **403 (now 200)** | **403 (now 200)** | **403 (now 200)** | 200 | FIX H1/E2. Body `{method ∈ CML 2001 / ReCiPe Midpoint (H) / TRACI 2.1}`, else 400. It must never re-create a row that has a `QUARANTINE:` twin (FIX). |
| R57 | GET | `/api/integrations/openlca/import` | A | **401 (now 200)** | 200 | 200 | 200 | 200 | 200 | 200 | FIX (fix/authz): requires a login. |
| R58 | POST | `/api/integrations/electricity/sync` | PA | 401 | **403 (now 200)** | **403 (now 200)** | **403 (now 200)** | **403 (now 200)** | **403 (now 200)** | 200 | FIX H1/INT-2. Body `{zone}` or `{zones[1..20]}`, else 400. Returns `success:true` even when every zone failed (INT-2). |
| R59 | POST | `/api/integrations/pubchem/enrich` | PA | 401 | **403 (now 200)** | **403 (now 200)** | **403 (now 200)** | **403 (now 200)** | **403 (now 200)** | 200 | FIX H1. Body `{substance_id?, only_missing?, limit≤500}`. REC INT-4: default limit, skip custom substances. |
| R60 | POST | `/api/integrations/bls/fetch-wage` | PA | 401 | **403 (now 200)** | **403 (now 200)** | **403 (now 200)** | **403 (now 200)** | **403 (now 200)** | 200 | FIX (fix/authz includes it because it upserts the shared `cost_rates` cache). **Side effect:** the inspector's state-wage picker (F8) and the component-form Suggest panel call this route as ordinary users. After the fix they get 403 and quietly keep the static national rate. See D6. |
| R61 | POST | `/api/integrations/eia/fetch-energy-price` | PA | 401 | **403 (now 200)** | **403 (now 200)** | **403 (now 200)** | **403 (now 200)** | **403 (now 200)** | 200 | Same as R60 (component-form Suggest). Body `{fuel, state (2 letters), sector?}`. |
| R62 | POST | `/api/integrations/metals/fetch-price` | PA | 401 | **403 (now 200)** | **403 (now 200)** | **403 (now 200)** | **403 (now 200)** | **403 (now 200)** | 200 | Same as R60. Body `{symbol ∈ ALU, XCU, ZNC, NIK, LEA, TIN, STL}`. |

### 2.8 Pages (not API; client-side guard only)

There is no `middleware.ts`. Every app page is a client component behind `components/auth-guard.tsx`, which reads a Zustand flag stored in localStorage. Page-level tests should assert **redirect to `/auth/login` for Anon**. They cannot assert role-based hiding, because the pages do not check roles. `/admin/integrations` renders for every signed-in user at the baseline (H1). Target: hidden from the nav, and non-admins redirected. fix/authz `7222b48` (merged at `c4a7200`) adds an "admins-only state" to the page; not re-verified here.

### 2.9 Routes a flow needs that do not exist

| Proposed | Needed by | Why |
|---|---|---|
| `POST /api/auth/logout` | F2 | Missing at the baseline: logout cleared localStorage only, the Google-flow `auth_token` and `user_data` cookies survived, and `/auth/callback` signed the previous user back in (M4). **It now exists at `c4a7200` (R63).** |
| Password reset and change | F2, F18 | No route exists (AUTH-8, PROF-1). |
| Email verification | F1, F3 | Needed for the H3 linking rule. No route exists. |

---

## 3. Where current code differs from the intended matrix

| # | Route(s) | Baseline (`704a964`) | Intended | Tag / ID | Branch / status at `c4a7200` (from merge commit subjects, not re-verified) |
|---|---|---|---|---|---|
| 1 | R38 auto-costs | any signed-in user 200 | editor+ on the component's project; 404 for a missing component | FIX H2 COST-1 | fix/authz — merged `10b3903` |
| 2 | R55–R62 integrations mutators and log | any signed-in user 200 | platform admin only (401/403) | FIX H1 E2 INT-1 L4 | fix/authz — merged `10b3903` |
| 3 | R57 GET openlca/import | public 200 | signed-in user | FIX | fix/authz — merged `10b3903` |
| 4 | R29, R30 documents POST/DELETE | any member (viewer too) | editor+ | FIX M2 DOC-1 | fix/auth — merged `8b51f39` (`d56c61f`) |
| 5 | R27, R34 component parent | any id accepted; other tenant's name echoed | same-case parent only; no self-parent or cycles; 400 | FIX M1 FLOW-1 | not in any merged branch (still open at `c4a7200`) |
| 6 | R03/R03b Google OAuth | no `state`; links by unverified email; ignores `is_active`; non-httpOnly 7-day cookies never cleared | `state` + PKCE; verified email; no silent linking; httpOnly cookie cleared on logout | FIX H3 AUTH-1..3 M4 | fix/auth — merged `8b51f39` (`02003dc`, `4b519bd`) |
| 7 | R01, R02, R51, R52, R23, R59 | no rate limit | 429 per the H5 budgets | FIX H5 | fix/auth — merged `8b51f39`: enforced on login, signup, insights, ingest preview. `lib/rate-limit.ts` also defines `assessments` (30/h) and `pubchemEnrich` (5/h) budgets, but **no route calls them yet** (R23, R59 still open) |
| 8 | R29, R52 upload size | size checked after buffering (R29), or not at all (R52) | 413 before parsing; type allowlist | FIX M6 | fix/auth — merged `8b51f39` (`cc71d85`, `d56c61f`, `4f008ee`) |
| 9 | R43–R46 legacy comparisons | anon gets 500; feature is dead | 401; REC: delete the routes | BUG, CMP-7 | none (still open) |
| 10 | Deactivated account on R15–R18, R25, R28–R31, R42, R50, R50b, R53 | 500 (regex misses "User account not found or inactive") | 401 | BUG X-API-2 | none (still open) |
| 11 | R42 export, unknown `format` | PDF | 400 | EXP-7 | fix/runs? — safe export builder merged `c4a7200`; recheck |
| 12 | R23 unknown `calculation_method` | 201 with an all-zero "completed" run | 400 | RUN-6 | fix/runs — merged `c4a7200` (`a9afc51`, `f3cb51a`) |
| 13 | R37, R39 quantity | null, NaN, strings and negatives accepted | 400 | FLOW-4 E9 | fix/editor (not merged) |
| 14 | R37, R39, R47, R49b substance privacy | other users' custom substances usable or visible | library + own only | REC L3 FLOW-5 FAC-1 FAC-4 | partly fix/authz (`dc9f831`, `da7a5ad`); flows `substance_id` still open |
| 15 | R35 component DELETE | admin+ | editor+ (decision D5) | REC FLOW-10 | fix/editor must decide (not merged) |
| 16 | R16, R17 admin grants | project admins can create and remove admins | owner-only for the admin role | REC L9 | none (still open) |
| 17 | R30, R17 delete of a missing id | 200 | 404 | DOC-3 | fix/auth `d56c61f` for documents (DOC-3); members still open |
| 18 | R55 `limit=abc` | 500 | clamped | INT-6 | fix/authz — merged (`157fd25`) |
| 19 | R02 inactive account | distinct message before the password check | uniform 401 | AUTH-6 L2 | fix/auth — merged (`74f8b25`); intended now 401 wrong password / 403 inactive after a correct password |
| 20 | R09–R18 missing project | 403 | 404 (or keep 403 everywhere; decision D3) | D3 | none (decision D3) |

## 4. Deactivated-account behaviour (current)

`requireAuth` throws `"User account not found or inactive"`. Routes that map only token errors to 401 answer **500** instead:
- The regex `/Unauthorized|token/i` misses it: members (R15–R17), progress (R18), documents (R28–R30), process-templates (R50), example-project (R50b).
- The explicit list omits it: completeness (R25), duplicate (R31), export (R42), ingest/apply (R53).
- The catch-all returns 500: legacy comparisons (R43–R46).

Routes whose catch-all returns 401 for any `requireAuth` error handle it correctly: integrations R54–R62 and auto-costs R38.

## 5. Open decisions (tests should not assert these until someone decides)

- **D1 Platform admin and tenant data.** Today a platform admin cannot read or modify projects they are not a member of. The matrix keeps that (403). If support access is wanted, it needs an explicit, audited path, not a change to `checkProjectAccess`.
- **D2 Stale `owner` member rows.** `checkProjectAccess` gives owner level to any member row named `owner`. `POST /api/projects` inserts one for the real owner, which is harmless, but a row left behind after `owner_id` changes keeps delete rights. Proposed: owner level only from `project.owner_id`. A DB test should flag `owner` member rows whose user ≠ `owner_id`.
- **D3 403 vs 404 for resources the caller cannot see.** Case, component, flow and run routes answer 404 for missing ids and 403 for existing ones, so ids can be enumerated. Project routes answer 403 for both. Pick one, preferably 404 for non-members everywhere. Until then, the generated tests accept `{403, 404}` for NonMem and PAdmin and assert `!= 2xx`.
- **D4 Class-mode visibility.** If students work as members of an instructor's project, `GET /cases`, `GET /progress` and editor rights let each student read, and as editor change, every other student's case. See F15 for the model the code implies. Decide whether students should be viewers, get per-case ownership, or each own a project shared with the instructor.
- **D5 Who may delete a component.** Admin (current) or editor (REC FLOW-10). This matters as soon as EDIT-1 makes the editor's Delete call the API.
- **D6 BLS/EIA/Metals rate lookups.** fix/authz makes them admin-only because they write the shared `cost_rates` cache. The labour calculator's state picker and the component-form Suggest panel call them as ordinary users. Options: (a) keep admin-only and accept static national rates for users; (b) split the route into a read-only lookup for any user, with the cache write admin-only or server-internal and upstream values only; (c) keep them open to any user, rate-limited, since the caller controls only the key (occupation/state/symbol, zod-validated) and never the stored value. Tests assert the fix/authz behaviour (403) and mark the F8 state-wage step `expected_change`.

## 6. Baseline drift: what changed at `c4a7200` (read-only note)

While these documents were being written, `v1-hardening-kavish` moved from `704a964` to `c4a7200` (49 commits):

| Merge | Branch | IDs its commits claim to fix |
|---|---|---|
| `10b3903` | fix/authz | H1, H2/COST-1, E2 (insert-only openLCA import that skips QUARANTINE twins), INT-2, INT-4, INT-5, INT-6/L4, FAC-1, FAC-2, FAC-3, FAC-4 (add-substance 409 and atomic insert), L1 on integration routes |
| `f4596ed` | fix/platform | C1, C2 (secrets scrubbed), M5 (lazy env-only DB pool, optional TLS), M3 (headers + report-only CSP, no X-Powered-By), H4 (next 15.5.26, xlsx replaced, single pnpm lockfile), M7 (PR checks; production deploy only on push to main), M8 (root scripts moved behind a run guard), L10 |
| `8b51f39` | fix/auth | AUTH-1…AUTH-6, AUTH-8, H3, M4, L1, L2, L6, L7, L8, I4, H5 (login, signup, insights, ingest preview only), M2/DOC-1…DOC-3, M6, ING-3, ING-10, ING-12, INS-1, INS-2 |
| `c4a7200` | fix/runs | RUN-1, RUN-2 (`migrate-026` stores results as DOUBLE), RUN-3, RUN-4, RUN-5, RUN-6, STAGE-2, EXP-1, EXP-2, EXP-3, EXP-4, RES-1, RES-2, RES-4, RES-5, RES-6, INS-5, ANA-1, ING-1 |

Not merged: fix/editor (EDIT-*, FLOW-*, D5) and fix/factors (E1, E4, E5, E11).

This document did **not** re-verify those fixes. It checked only three things:
- the two new routes (R63, R64);
- the login order (password first, then 403 for an inactive account);
- which routes call the rate limiter.

For the generator:
1. List `fix/authz`, `fix/platform`, `fix/auth` and `fix/runs` in `tests/authz/merged-fixes.json`. Their `now` markers are then asserted as the intended value; a failure there is a regression, not a known bug.
2. Treat items 5, 9, 10, 13, 15, 16 and 20 of §3, the R23/R59 rate limits, and the decisions in §5 as still open.

