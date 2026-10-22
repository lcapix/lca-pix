# LCAPIX API permissions matrix

Every `app/api/**/route.ts` handler, by HTTP method and by caller role, with the status the endpoint returns. The machine-readable copy is the `permissions:` section of [`flows.yaml`](flows.yaml). The generated authorization tests (`tests/api-real/authz/matrix.test.ts`, run with `pnpm test:api`) read that section and call every handler against a real MySQL database, so the two files must change together.

- **State described:** branch `v1-hardening-kavish` @ `2009f63`, with every fix branch merged (fix/authz, fix/platform, fix/auth, fix/runs, fix/editor, fix/factors, fix/int-auth, fix/int-client, fix/int-routes), plus fix/isolation (B-A1 student isolation, migrate-032: §1 "Case ownership", §2.10).
- **Verified:** 2026-09-30, by running every row × role in `tests/api-real/authz/matrix.test.ts` against a database built from nothing (`scripts/db/fresh.mjs`). Every cell below is what the code returned; §3 lists where the code and the earlier documents disagreed and how each was resolved.
- **Scope:** 45 route files, **66 route × method pairs**. Three pairs have mode-dependent rules and get extra rows (R03b, R52b, R53b), so §2.1–§2.7 have **69 rows**. §2.10 adds the student-isolation rule (B-A1): R10b for the setting and 36 *own-cases* rows (suffix `o`) that run the case-scoped and list routes with the setting on, **106 rows** in all.
- **Supersedes:** the baseline matrix written against `704a964` (in git history) and `docs/flows-updates/permissions-404.md` (merged here and removed).
- **Sources:** `lib/auth.ts` (`requireAuth`, `requireAdmin`, `checkProjectAccess`), `lib/route-guard.ts` (`projectAccessDenied`, `caseAccessDenied`, `reachableCasesFilter`, `REACHABLE_CASE_SQL`, `unreachableCaseIds`, `isAuthError`), `lib/integrations/admin-guard.ts`, `lib/integrations/rate-lookup.ts`, `lib/rate-limit.ts`, and every route handler.

## 1. Roles and conventions

| Column | Who | How the test fixture creates it |
|---|---|---|
| **Anon** | No `Authorization` header | none |
| **NonMem** | Signed-in `account_type='user'`, not the owner and no `project_members` row on the target project | `POST /api/auth/signup` |
| **Viewer** | `project_members` row with permission `viewer` | owner calls `POST /api/projects/:id/members {email, role:'viewer'}` |
| **Editor** | member with permission `editor` | same, `role:'editor'` |
| **AdminM** | member with permission `admin` (project-level admin) | same, `role:'admin'` (only the owner may grant it) |
| **Owner** | `project.owner_id` = caller | creates the project |
| **PAdmin** | `account.account_type='admin'` (platform admin), **not** a member of the target project | signup, then `UPDATE account SET account_type='admin'` in the test database; no API creates one |

Three more callers run on every row that needs a sign-in. They are not columns; each must get **401**:

- **Deactivated:** a token minted while the account was active, then `is_active=0`. The fixture account is an *editor member* of the project, so the 401 can only come from authentication.
- **Revoked:** a token minted, then the account's `password_hash` changed (as a password change or a Google takeover would). Also an editor member.
- **Tampered:** a token for the owner signed with the wrong secret. (Expired, `alg:none`, HS512 and missing-`pv` tokens are in `tests/api-real/security/jwt.test.ts`.)

### How access is decided
- `requireAuth` (`lib/auth.ts`) throws a typed `AuthError` (401) for no token, a bad, expired or revoked token, or an unknown or deactivated account. Every route maps it to **401**, never 500, through `isAuthError` (`lib/route-guard.ts`) or the integration guards.
- `checkProjectAccess` gives full access to `project.owner_id`, otherwise ranks the caller's `project_members.permission_name` (`owner 4 > admin 3 > editor 2 > viewer 1`) against the required level. `account_type` is never consulted, so a platform admin has no implicit access to tenant data (D1).
- `projectAccessDenied` (`lib/route-guard.ts`) turns a refusal into **404** for a non-member (with the route's own "X not found" body) and **403** for a member whose role is too low.
- **Case ownership (B-A1, student isolation).** Every case records `case_table.created_by` (migrate-032; existing cases were backfilled to the project owner). When `project.members_see_own_cases = 1`, a member whose role is **editor or viewer** reaches only the cases they created, and everything under them (steps, flows, runs, exports, documents, completeness, duplicate/clone/scale, import into a case). The **owner and admin** members reach every case. `caseAccessDenied` (`lib/route-guard.ts`) resolves the case to its project, applies `projectAccessDenied`, then the ownership rule: a hidden case answers **404 with the missing-id body, whatever the action and role** (a viewer never gets a 403 that would confirm it exists). Component, flow and run routes check through their case. Lists (`GET …/cases`, `…/progress`, `…/compare`, the home project counts, legacy saved comparisons) leave hidden cases out (`reachableCasesFilter`, `REACHABLE_CASE_SQL`, `unreachableCaseIds`). A case name clashes only with cases the caller reaches. With the setting at 0 (the default) every answer is what §2.1–§2.7 say.

### Status conventions
- `200`/`201`/`307`: success, with the code the handler actually uses. Several creates return 200; the Google redirects are 307 (`NextResponse.redirect`).
- `401`: not signed in; a bad, expired or **revoked** token; or an unknown or deactivated account. Every route, never 500.
- `403`: signed in and a **member** of the project, but the role is too low for the action; or signed in but not a platform admin on an integrations writer.
- `404`: the resource does not exist, **or the caller is not a member of its project** (owner decision D3). The body is **byte-identical** to the missing-id body for that route (`Project not found`, `Case not found`, `Component not found`, `Flow not found`, `Assessment not found`, `Comparison not found`, `Target case not found`), so an id reveals nothing. The generated test compares the two bodies for every such cell.
- `400`/`409`/`413`/`415`/`429`: validation, conflict, payload too large, wrong file type, rate-limited. Listed under Notes; the role columns assume a valid body.

> **Token revocation.** Every JWT carries `pv` = the first 16 hex characters of HMAC-SHA256(JWT_SECRET, password_hash) at issue time. `requireAuth` reads `password_hash` with the account row it already loads, and rejects a token whose `pv` differs or is missing. Login, signup and Google sign-in issue `pv`, and `POST /api/auth/google/session` checks it. Changing the hash (a password change, or a Google takeover) ends every earlier session. Tokens issued before `pv` existed are rejected, so every user signs in again after the deploy.

> **How to read the columns.** NonMem and PAdmin (not a member): **404**. Viewer / Editor / AdminM below the rule: **403**. Deactivated, revoked and tampered tokens: **401** on every row that needs a sign-in.

## 2. Matrix

Abbreviations in the Rule column: **P** public, **A** any signed-in user, **M** any project member, **V/E/Ad/O** at least viewer/editor/admin/owner, **PA** platform admin.

### 2.1 Auth and account

| # | Method | Path | Rule | Anon | NonMem | Viewer | Editor | AdminM | Owner | PAdmin | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R01 | POST | `/api/auth/signup` | P | 201 | 201 | 201 | 201 | 201 | 201 | 201 | Body `{email, password, full_name?}`. The username is derived on the server (a client `username` is ignored). 400: missing or badly formed email, password under 8 characters or over 72 bytes. **409** for a registered email, with a generic message. **429** on the 4th signup per IP per hour. |
| R02 | POST | `/api/auth/login` | P | 401 | 200 | 200 | 200 | 200 | 200 | 200 | Anon = a wrong password; the roles use their own credentials. A wrong password and an unknown email get the same 401 body (`Invalid email or password`), after the same bcrypt work. **403** `Account is inactive…` only after a **correct** password on a deactivated account. **429** with `Retry-After` on the 6th attempt per IP + email per minute. |
| R03 | GET | `/api/auth/google` | P | 307 | 307 | 307 | 307 | 307 | 307 | 307 | Redirects to `accounts.google.com` with `client_id`, `redirect_uri=${NEXT_PUBLIC_APP_URL}/api/auth/google`, `scope=openid email profile`, a random `state` and an S256 `code_challenge`; no `access_type=offline` or `prompt=consent`. Sets the `google_oauth` state cookie: httpOnly, SameSite=Lax, Path=/api/auth/google, Max-Age=600. Unconfigured: 307 to `/auth/login?error=google_not_configured`. |
| R03b | GET | `/api/auth/google?code=…&state=…` | P | 307 | 307 | 307 | 307 | 307 | 307 | 307 | Success: 307 to `/auth/callback?next=/home` (or `/auth/onboarding`) with an httpOnly 2-minute `auth_token` hand-off cookie carrying a `pv` token; the state cookie is cleared on every outcome. A missing or mismatched `state` gives `error=oauth_state_mismatch` and no `auth_token`; `verified_email !== true` gives `google_email_unverified`; an `is_active=0` account gives `account_inactive` and is left unchanged. **Takeover (owner decision):** a verified email that matches an active account with a password hash sets `password_hash='!oauth-only'`, so the password stops working and every earlier token is revoked. |
| R04 | GET | `/api/auth/me` | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | No UI caller. |
| R05 | GET | `/api/auth/profile` | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | Self-scoped; `needsOnboarding` until `full_name`, `company` and `onboarded_at` are set. |
| R06 | PUT | `/api/auth/profile` | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | 400: `fullName` or `company` missing, `useCase` not in `product/facility/comparative/research/other`. Field lengths are not checked before the UPDATE (PROF-1; see §3.2). |
| R63 | POST | `/api/auth/logout` | P | 200 | 200 | 200 | 200 | 200 | 200 | 200 | Needs no token. Always 200, and expires `auth_token` and `user_data` (Max-Age=0, httpOnly, SameSite=Lax, Path=/). The bearer JWT stays valid until it expires or the password hash changes; there is no per-session logout. |
| R64 | POST | `/api/auth/google/session` | hand-off cookie | 401 | 401 | 401 | 401 | 401 | 401 | 401 | 200 `{token, user}` only with a valid hand-off cookie for an active account whose `password_hash` still matches the token's `pv`; otherwise 401. 403 for `Sec-Fetch-Site: cross-site`. Every response clears the cookie, so a second call gets 401. A Bearer token is irrelevant here. |

### 2.2 Projects, members, class progress

| # | Method | Path | Rule | Anon | NonMem | Viewer | Editor | AdminM | Owner | PAdmin | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R07 | GET | `/api/projects` | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | Only owned or member projects: the NonMem and PAdmin lists do not contain P. |
| R08 | POST | `/api/projects` | A | 401 | 201 | 201 | 201 | 201 | 201 | 201 | 400 empty name; 409 when the owner already has the name (case-insensitive, trimmed). |
| R09 | GET | `/api/projects/:projectId` | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | 404 `Project not found`, the same for a missing project. Returns member emails to viewers, by design, and `members_see_own_cases` as a boolean. |
| R10 | PUT | `/api/projects/:projectId` | Ad | 401 | 404 | 403 | 403 | 200 | 200 | 404 | Name, description, goal & scope (`goal_statement`, `functional_unit`, `system_boundary`, `boundary_notes`), `lcia_method`, `region_code`, `members_see_own_cases` (R10b). 400: bad boundary or method. Editors cannot set the functional unit (see F5). |
| R11 | DELETE | `/api/projects/:projectId` | O | 401 | 404 | 403 | 403 | 403 | 200 | 404 | 403 body `Only project owner can delete`. A stale `owner` member row still passes (D2). |
| R12 | GET | `/api/projects/:projectId/cases` | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | |
| R13 | POST | `/api/projects/:projectId/cases` | E | 401 | 404 | 403 | 201 | 201 | 201 | 404 | 400: missing name or type, type not `base`/`comparative`. 409: duplicate name. A second base case is allowed (PROJ-6). |
| R14 | GET | `/api/projects/:projectId/compare?cases=…` | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | 400: no case ids or a non-numeric project id. 404 `No such cases in this project`. At most 8 cases. A `runs=` override only picks among the case's own completed runs. A case with no flows (or no run) has `status:'incomplete'` and is never ranked. |
| R15 | GET | `/api/projects/:projectId/members` | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | `canManage` for the owner and admin members; `canManageAdmins` for the owner only. |
| R16 | POST | `/api/projects/:projectId/members` | Ad | 401 | 404 | 403 | 403 | 200 | 200 | 404 | Body `{email, role ∈ viewer/editor/admin}`. Returns 200; an existing member's role is updated (`updated:true`). **Granting or changing the admin role is owner-only**: an admin member gets 403 `Only the project owner can grant the admin role`. 404 unknown email; 409 target is the owner. |
| R17 | DELETE | `/api/projects/:projectId/members?user_id=` | Ad | 401 | 404 | 403 | 403 | 200 | 200 | 404 | 400 without a numeric `user_id`; **404 `Member not found`** when that user is not a member. Removing an admin is owner-only (403 for an admin member). |
| R18 | GET | `/api/projects/:projectId/progress` | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | Class-mode progress for every case the caller reaches (all of them unless the project keeps members' cases apart, R18o), with each case's `created_by` and `author`, and the project's `members_see_own_cases`. |

### 2.3 Cases

| # | Method | Path | Rule | Anon | NonMem | Viewer | Editor | AdminM | Owner | PAdmin | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R19 | GET | `/api/cases/:caseId` | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | Adds `project_lcia_method` and `project_region_code`. |
| R20 | PUT | `/api/cases/:caseId` | E | 401 | 404 | 403 | 200 | 200 | 200 | 404 | Name, description, type, `interpretation`/`assumptions`/`learning_state`, `is_final`, `reference_flow`/`reference_flow_unit`/`modeled_output`. 400: empty name, reference flow or data basis ≤ 0. 409: duplicate name. |
| R21 | DELETE | `/api/cases/:caseId` | Ad | 401 | 404 | 403 | 403 | 200 | 200 | 404 | Cascades to steps, flows, runs and documents. |
| R22 | GET | `/api/cases/:caseId/assessments` | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | Frozen runs answer from their snapshot. |
| R23 | POST | `/api/cases/:caseId/assessments` | E | 401 | 404 | 403 | 201 | 201 | 201 | 404 | 400 for an unknown `calculation_method` or a non-string field. **429** on the 31st run per user per hour. |
| R24 | POST | `/api/cases/:caseId/clone-from` | E | 401 | 404 | 403 | 200 | 200 | 200 | 404 | Body `{sourceCaseId}`. Access to the target is checked first, so a non-member gets 404. A member gets 400 `Cases must belong to the same project` for a source in another project. 409 when the target is not empty. |
| R25 | GET | `/api/cases/:caseId/completeness` | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | 400 for a non-numeric id. |
| R26 | GET | `/api/cases/:caseId/components` | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | The parent name is joined only within the case. |
| R27 | POST | `/api/cases/:caseId/components` | E | 401 | 404 | 403 | 201 | 201 | 201 | 404 | 400: missing name or type, bad type, a name over 200 characters, a negative or non-numeric quantity or cost, a `parent_component_id` that is not a step of this case (no name echoed). |
| R28 | GET | `/api/cases/:caseId/documents[?id=]` | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | 404 `Document not found` for an id not in this case. |
| R29 | POST | `/api/cases/:caseId/documents` | E | 401 | 404 | 403 | 200 | 200 | 200 | 404 | Multipart `file`, `doc_type`. Returns 200. **413** above 12 MB, from the declared length or while reading, before the form is parsed. **415** for an extension outside the allowlist or bytes that do not match it. PDFs are read to at most 200 pages. |
| R30 | DELETE | `/api/cases/:caseId/documents?id=` | E | 401 | 404 | 403 | 200 | 200 | 200 | 404 | 400 without a numeric `id`; 404 `Document not found` for an id not in this case. |
| R31 | POST | `/api/cases/:caseId/duplicate` | E | 401 | 404 | 403 | 201 | 201 | 201 | 404 | 400 when the source has no steps; 409 on a name clash. |
| R32 | POST | `/api/cases/:caseId/scale` | E | 401 | 404 | 403 | 200 | 200 | 200 | 404 | Body `{from>0, to>0, mode ∈ scale-inputs/data-covers}`, else 400. |

### 2.4 Components, flows, costs

| # | Method | Path | Rule | Anon | NonMem | Viewer | Editor | AdminM | Owner | PAdmin | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R33 | GET | `/api/components/:componentId` | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | |
| R34 | PUT | `/api/components/:componentId` | E | 401 | 404 | 403 | 200 | 200 | 200 | 404 | A parent in another case, the step itself or one of its descendants → 400; re-parenting updates `hierarchy_level` for the whole subtree. A cost or description sent as `null` is cleared. |
| R35 | DELETE | `/api/components/:componentId` | E | 401 | 404 | 403 | 200 | 200 | 200 | 404 | Editor since D5 (fix/editor). `?children=delete` (default) removes the subtree; `?children=reparent` moves the children up; anything else → 400. Frozen runs keep their per-step results. |
| R36 | GET | `/api/components/:componentId/flows` | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | |
| R37 | POST | `/api/components/:componentId/flows` | E | 401 | 404 | 403 | 201 | 201 | 201 | 404 | 400: missing field, bad `flow_type`, quantity null/non-numeric/negative, a unit that will not convert to the substance's unit, or a `substance_id` that is not a library row or the caller's own (`Unknown substance…`, the name never echoed). |
| R38 | POST | `/api/components/:componentId/auto-costs` | E | 401 | 404 | 403 | 200 | 200 | 200 | 404 | 404 `Component not found` for a missing, non-numeric or invisible id. No UI caller. |
| R39 | PUT | `/api/flows/:flowId` | E | 401 | 404 | 403 | 200 | 200 | 200 | 404 | Same quantity, unit and substance checks as R37. |
| R40 | DELETE | `/api/flows/:flowId` | E | 401 | 404 | 403 | 200 | 200 | 200 | 404 | |

### 2.5 Runs, exports, comparisons

| # | Method | Path | Rule | Anon | NonMem | Viewer | Editor | AdminM | Owner | PAdmin | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R41 | GET | `/api/assessments/:runId` | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | A frozen run answers from its snapshot, unchanged by later edits. |
| R42 | GET | `/api/assessments/:runId/export?format=pdf\|pptx\|csv` | V | 401 | 404 | 200 | 200 | 200 | 200 | 404 | `application/pdf`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`, `text/csv; charset=utf-8`. 400 for an unknown format. CSV cells that start with `= + - @ TAB CR` are prefixed with `'`. |
| R43 | POST | `/api/comparisons` (legacy) | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | Validates and saves nothing (CMP-7). 400: missing fields, fewer than 2 or more than 10 cases, a case outside the project. REC: delete the legacy feature. |
| R44 | GET | `/api/comparisons?project_id=` (legacy) | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | 400 without a numeric `project_id`. |
| R45 | GET | `/api/comparisons/:comparisonId` (legacy) | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | 404 `Comparison not found`. |
| R46 | DELETE | `/api/comparisons/:comparisonId` (legacy) | Ad, or the creator while still a member | 401 | 404 | 403 | 403 | 200 | 200 | 404 | A creator who was removed from the project gets 404 like any non-member (closes L9). |

### 2.6 Global reference data, AI and ingestion

| # | Method | Path | Rule | Anon | NonMem | Viewer | Editor | AdminM | Owner | PAdmin | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R47 | GET | `/api/driver-factors` | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | Excludes other users' private factors and every `QUARANTINE%` row. |
| R48 | GET | `/api/impact-categories` | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | |
| R49 | GET | `/api/substances` | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | The library plus the caller's own custom substances. |
| R49b | POST | `/api/substances` | A | 401 | 201 | 201 | 201 | 201 | 201 | 201 | 400 when validation fails. 409 naming the row for a library or own name; another user's private name gives a 409 that names nothing. The insert is atomic. |
| R50 | GET | `/api/process-templates` | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | Library plus own templates. |
| R50b | POST | `/api/example-project` | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | Builds the worked example in the caller's account (with its functional unit, so Run works). Returns 200; a repeat returns `existed:true`. |
| R51 | POST | `/api/insights` | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | No `HF_TOKEN`: 200 `{fallback:true}`. With one: a `text/plain` stream. **413** over 16 KB (declared or read), 400 for a question over 500 characters, **429** on the 21st call per user per hour. |
| R52 | POST | `/api/ingest/preview` (connector ≠ equipment) | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | Writes nothing. **413** over 12 MB before parsing, **415** for bytes that do not match the extension, **429** on the 11th preview per user per hour. Known bug ING-9: private substances of other users are match candidates (§3.2). |
| R52b | POST | `/api/ingest/preview` (connector = equipment, `target_case_id`) | E on the target case's project | 401 | 404 | 403 | 200 | 200 | 200 | 404 | 404 `Case not found`, identical for a missing case. 400 without `target_case_id`. |
| R53 | POST | `/api/ingest/apply` (create: `project_id`, `case_name`, `nodes`…) | E on `project_id` | 401 | 404 | 403 | 201 | 201 | 201 | 404 | 404 `Project not found`. Body validation (zod, 400) runs before the access check and reveals nothing about ids. One transaction. Known bug: another user's private `substance_id` is written (§3.2). |
| R53b | POST | `/api/ingest/apply` (append: `target_case_id`) | E on the target case's project | 401 | 404 | 403 | 200 | 200 | 200 | 404 | 404 `Target case not found`. 400 when the default step, or a line's step, is not in the case. |

### 2.7 Integrations

The integrations that write platform-wide data (factor library, substances) and the integration log are **platform-admin only**: `lib/integrations/admin-guard.ts` answers 401 when not signed in and 403 `Admin privileges required` for everyone else. The BLS / EIA / Metals cost lookups are **open to any signed-in user** with a shared budget of 60 lookups per user per hour (owner decision D6, option c: `lib/integrations/rate-lookup.ts`): the caller only picks an allowlisted key, and the stored value always comes from the upstream API. "Owner" and "AdminM" here mean an ordinary user who owns or administers a project; project roles do not matter.

| # | Method | Path | Rule | Anon | NonMem | Viewer | Editor | AdminM | Owner | PAdmin | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R54 | GET | `/api/integrations/status` | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | `/home` and `/library/factors` call it. Reveals which API keys are configured (Info). |
| R55 | GET | `/api/integrations/log` | PA | 401 | 403 | 403 | 403 | 403 | 403 | 200 | `limit` clamped to 1..200; `limit=abc` gives the default 20. |
| R56 | POST | `/api/integrations/openlca/import` | PA | 401 | 403 | 403 | 403 | 403 | 403 | 200 | Body `{method ∈ CML 2001 / ReCiPe Midpoint (H) / TRACI 2.1}`, else 400. Insert-only; never re-creates a row that has a `QUARANTINE:` twin. |
| R57 | GET | `/api/integrations/openlca/import` | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | Lists the methods and seed counts. |
| R58 | POST | `/api/integrations/electricity/sync` | PA | 401 | 403 | 403 | 403 | 403 | 403 | 200 | Body `{zone}` or `{zones[1..20]}` from the zone allowlist, else 400. **502** when every zone failed. |
| R59 | POST | `/api/integrations/pubchem/enrich` | PA | 401 | 403 | 403 | 403 | 403 | 403 | 200 | Body `{substance_id?, only_missing?, limit ≤ 500}`; default limit 50. **429** on the 6th call per admin per hour. |
| R60 | POST | `/api/integrations/bls/fetch-wage` | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | Body `{occupation: 'NN-NNNN', state: US state or 'US'}` (strict), else 400. **429** on the 61st lookup per user per hour, shared by R60–R62. |
| R61 | POST | `/api/integrations/eia/fetch-energy-price` | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | Body `{fuel ∈ electricity/natural_gas, state, sector?}` (strict). |
| R62 | POST | `/api/integrations/metals/fetch-price` | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | Body `{symbol ∈ ALU, XCU, ZNC, NIK, LEA, TIN, STL}` (strict). |

### 2.8 Pages (not API; client-side guard only)

There is no `middleware.ts`. Every app page is a client component behind `components/auth-guard.tsx`. Page tests assert the redirect to `/auth/login` for Anon; role-based hiding is cosmetic, because the API enforces every rule above. `/admin/integrations` shows an admins-only state to non-admins (fix/authz; a UI behaviour this suite does not cover). On `/project/:id/class` the Add form appears for `canManage`, and the **Admin** role option only for `canManageAdmins`, the owner (`tests/app/class-page.test.tsx`).

### 2.9 Routes a flow needs that do not exist

| Proposed | Needed by | Why |
|---|---|---|
| Password reset and change | F2, F18 | No route exists (AUTH-8, PROF-1). A password change would revoke every earlier token through `pv`. |
| Email verification | F1, F3 | Not needed for Google linking any more (a verified Google email takes the account over), but signup still never verifies an address. |

### 2.10 Student isolation: the setting and own-cases mode (B-A1)

`R10b` is the setting itself. The `o` rows are the rows above run on a project with `members_see_own_cases = 1` (`own_cases: true` in `flows.yaml`: the generated test switches it on for the call and off after). The target cases were made by the owner, so an editor or viewer reaches none of them. The exhaustive version, with two students' own cases, a TA and the switch back off, is `tests/api-real/authz/isolation.test.ts`.

**O** = the owner or an admin member, or the member who created the case (editors and viewers reach only their own).

| # | Method | Path | Rule | Anon | NonMem | Viewer | Editor | AdminM | Owner | PAdmin | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R10b | PUT | `/api/projects/:projectId` `{members_see_own_cases}` | Ad | 401 | 404 | 403 | 403 | 200 | 200 | 404 | `true`/`false`/`1`/`0`, else 400 before anything is written. Default off: nothing changes for a project until its owner or an admin turns it on. |
| R07o | GET | `/api/projects` | A | 401 | 200 | 200 | 200 | 200 | 200 | 200 | `case_count` and `component_count` count only the cases the caller reaches. |
| R12o | GET | `/api/projects/:projectId/cases` | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | Editors and viewers list only cases they created; owner and admins all. |
| R13o | POST | `/api/projects/:projectId/cases` | E | 401 | 404 | 403 | 201 | 201 | 201 | 404 | Students create their own submission. Every new case (here, duplicate, example project, import) records `created_by` = the caller. A name clashes (409) only with cases the caller reaches. |
| R14o | GET | `/api/projects/:projectId/compare?cases=…` | M, cases O | 401 | 404 | 404 | 404 | 200 | 200 | 404 | Hidden cases are dropped like missing ids; with none left, 404 `No such cases in this project` (the missing-id body). |
| R18o | GET | `/api/projects/:projectId/progress` | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | Editors and viewers see only their own cases. |
| R19o–R32o | all | `/api/cases/:caseId…` (R19–R32) | O, then the base rule | 401 | 404 | 404 | 404 | 200/201 | 200/201 | 404 | 404 `Case not found`, byte-identical to a missing case, for every method: also where the base row gives a viewer or editor 403 (PUT, DELETE, runs, clone-from, documents, duplicate, scale). Clone-from also needs the **source** case to be reachable. |
| R33o–R40o | all | `/api/components/:componentId…`, `/api/flows/:flowId` (R33–R40) | O (through the case), then the base rule | 401 | 404 | 404 | 404 | 200/201 | 200/201 | 404 | 404 `Component not found` / `Flow not found`. |
| R41o, R42o | GET | `/api/assessments/:runId`, `…/export` | O (through the case) | 401 | 404 | 404 | 404 | 200 | 200 | 404 | 404 `Assessment not found`. |
| R43o | POST | `/api/comparisons` (legacy) | M, cases O | 401 | 404 | 400 | 400 | 200 | 200 | 404 | A hidden case counts as not in the project (the missing-id 400). |
| R44o | GET | `/api/comparisons?project_id=` (legacy) | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | A saved comparison that names a hidden case is left out. |
| R45o, R46o | GET, DELETE | `/api/comparisons/:comparisonId` (legacy) | M/Ad, cases O | 401 | 404 | 404 | 404 | 200 | 200 | 404 | 404 `Comparison not found` when it names a hidden case. |
| R52bo | POST | `/api/ingest/preview` (equipment) | E, case O | 401 | 404 | 404 | 404 | 200 | 200 | 404 | 404 `Case not found`. |
| R53o | POST | `/api/ingest/apply` (create) | E | 401 | 404 | 403 | 201 | 201 | 201 | 404 | The imported case belongs to the caller. |
| R53bo | POST | `/api/ingest/apply` (append) | E, case O | 401 | 404 | 404 | 404 | 200 | 200 | 404 | 404 `Target case not found`. |

What the rule does not cover (unchanged, see §5 D4): `GET /api/projects/:id/members` still lists every member's username and email to every member, and the project itself (name, goal and scope) is shared.

---

## 3. Where the code and the earlier documents disagreed

### 3.1 Resolved on 2026-09-30

Each row was checked by the generated test against the code. The code is the source of truth, except where an owner decision says otherwise (non-members 404, low role 403, editors delete components, cost lookups open to signed-in users with limits, integrations writers admin-only, only the owner grants admin): then the code was checked against the decision.

| Row(s) | Earlier document said | Code does | Resolution |
|---|---|---|---|
| R03, R03b | 302 | 307 (`NextResponse.redirect` default) | **Doc fixed**: 307 is correct for a GET redirect. |
| R09–R46, R52b, R53, R53b | NonMem/PAdmin `{403, 404}`; several rows "404 (pending; now 403)" | 404 everywhere, byte-identical to the missing-id body | **Doc fixed** (D3 decided; the pending one-line changes have landed). |
| R15–R17, R28–R30, R43–R46 | Deactivated: 500 (pending) | 401 | **Doc fixed** (X-API-2 closed). |
| R16, R17 | Admin members can grant and remove admins (REC L9 open) | Owner-only for the admin role (403 for an admin member) | Matches the owner decision; **doc fixed**. |
| R17 | 200 even when no row matched | 404 `Member not found` | **Doc fixed**. |
| R35 | Admin (decision D5 open) | Editor | Matches the owner decision (editors delete components); **doc fixed**. |
| R60–R62 | Platform admin only (fix/authz) | Any signed-in user, 60/hour/user, strict allowlisted body | Matches the owner decision (D6 option c); **doc fixed**. |
| R01 | 400 for a registered email; the client username is stored | 409 with a generic message; the username is derived on the server | **Doc fixed** (AUTH-4 and L2 were closed by fix/auth). |
| R23, R59 | Rate limits defined but not enforced | 30/hour/user (runs) and 5/hour/admin (PubChem) enforced | **Doc fixed**; `lib/rate-limit.ts`'s header comment said the same stale thing and was corrected. |
| R30 | 200 for a missing document | 404 `Document not found` | **Doc fixed** (DOC-3). |
| R38 | Missing component → 500 | 404 `Component not found` | **Doc fixed** (H2 follow-up). |
| R42 | Unknown format → PDF | 400 | **Doc fixed** (EXP-7). |
| R46 | Creator keeps delete rights after removal; handler read `params` without awaiting (404 for every id) | Creator must still be a member; params awaited | **Doc fixed**. |
| R55 | `limit=abc` → 500 | Default 20 | **Doc fixed** (INT-6). |
| R57 | Public | Requires a sign-in | **Doc fixed**. |
| R64, R03b | `error=use_password_login` for a password account | Takeover: `!oauth-only` hash, earlier tokens revoked | **Doc fixed** (owner decision, fix/int-auth). |

No row needed a code change: after these doc fixes every one of the 674 generated cells passes.

### 3.2 Bugs the real-database suite found that touch this matrix

These are kept as `it.fails` tests (the suite goes red when they are fixed, so the marker can flip):

| Bug | Row | Test | Cause |
|---|---|---|---|
| Another user's private `substance_id` is accepted by ingest apply and written to the caller's case; its name then shows in `GET /api/components/:id/flows` (L3, ingest twin of FLOW-5) | R53, R53b | `tests/api-real/authz/cross-tenant.test.ts` › ingest/apply | `app/api/ingest/apply/route.ts:169` and `:301` look substances up with `SELECT unit FROM substances WHERE substance_id = ?`, with no `is_custom = 0 OR created_by = ?` scope |
| Ingest preview offers other users' private substances as matches and review candidates (ING-9, L3) | R52 | same file › ingest/preview | `app/api/ingest/preview/route.ts:285-294` builds the match catalog from every substance |

Other defects the suite found (500s on oversized fields and on non-finite numbers, and so on) are listed under "API suite" in `docs/testing/DATABASE_TESTS.md`; they are validation bugs, not permission rules.

## 4. Deactivated, unknown and revoked accounts

`requireAuth` throws a typed `AuthError` (status 401) for every failure. Every route maps it to **401**: project routes through `isAuthError` (`lib/route-guard.ts`), the integration writers through `guardAdmin` (`lib/integrations/admin-guard.ts`), the cost lookups through `guardRateLookup`, and `auto-costs`, `status` and `openlca` GET with their own catch. The generated test runs a deactivated account and a revoked token on every row that needs a sign-in.

## 5. Decisions

- **D1 Platform admin and tenant data:** unchanged. A platform admin who is not a member gets 404, like any non-member. Support access would need an explicit, audited path.
- **D2 Stale `owner` member rows:** open. `checkProjectAccess` still gives owner level to any member row named `owner`, even when `project.owner_id` is someone else. `POST /api/projects` inserts one for the real owner, which is harmless; a row left behind after an ownership change keeps delete rights.
- **D3 403 vs 404:** decided (owner, 2026-09-30). 404 for non-members everywhere with the missing-id body; 403 only for members whose role is too low.
- **D4 Class-mode visibility:** decided and built (B-A1, migrate-032). A project setting, `members_see_own_cases` (default off), keeps each editor's and viewer's cases to that member; the owner and admins see all (§1, §2.10). The class page has the switch ("Students see only their own case") and shows each case's author. Still open: whether students in such a project should see each other's names and emails in the members list (R15).
- **D5 Who may delete a component:** decided. Editor and above.
- **D6 BLS/EIA/Metals rate lookups:** decided, option (c). Any signed-in user, 60 lookups per user per hour across the three, strict allowlisted bodies; the stored value always comes from upstream (a static fallback is returned but never cached).

## 6. History

The first version of this matrix described `704a964`, before any fix branch. It is in git history (`docs/flows/PERMISSIONS_MATRIX.md` in the first commit that added it). `docs/flows-updates/permissions-404.md` (fix/int-auth: pv revocation `bf10230`, Google takeover `9d72783`, 404 policy `1514f04`, 401 mapping `299722e`) is merged into §1–§5 and removed.
