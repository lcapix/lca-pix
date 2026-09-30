# PERMISSIONS_MATRIX.md: updates from fix/int-auth

Merge these into `docs/flows/PERMISSIONS_MATRIX.md` (and the `permissions:` section of `flows.yaml`). Each block below says which part of the matrix it replaces. Row text is complete, so it can be pasted over the old row.

Branch `fix/int-auth` (from `v1-hardening-kavish` with the six fix branches merged). Commits: `bf10230` (pv revocation), `9d72783` (Google takeover), `1514f04` (404 policy), `299722e` (401 mapping), `a9c6531` (local-DB e2e).

**Pending (other agent):** files another agent is editing were not changed on this branch. Their rows below carry **(pending)** until the one-line change listed in the fix/int-auth report lands. The files are members, documents, cases/:id/assessments, compare, export and the legacy comparisons routes. Until then, `tests/api/authz/*.test.ts` runs them as `it.fails`. To flip a route, remove `pending404` / `pending401` from its entry in `tests/api/authz/route-table.ts`.

---

## §1 Status conventions (replace the 401, 403 and 404 bullets)

- `401`: not signed in; a bad, expired or **revoked** token; or an unknown or deactivated account. A token is revoked when the account's `password_hash` has changed since it was issued (see "Token revocation" below). Every route answers 401 for these, never 500.
- `403`: signed in and a **member** of the project, but the role is too low for the action.
- `404`: the resource does not exist, **or the caller is not a member of its project** (owner decision D3, 2026-09-30). The body is byte-identical to the missing-id body for that route (`Project not found`, `Case not found`, `Component not found`, `Flow not found`, `Assessment not found`, `Comparison not found`, `Target case not found`), so an id reveals nothing. This applies to project-scoped routes too: a missing project and a project the caller cannot see both give 404.

Add under §1:

> **Token revocation.** Every JWT carries `pv` = the first 16 hex characters of HMAC-SHA256(JWT_SECRET, password_hash) at issue time. `requireAuth` reads `password_hash` with the account row it already loads, and rejects a token whose `pv` differs or is missing. Login, signup and Google sign-in issue `pv`, and `POST /api/auth/google/session` checks it. Changing the hash (a password change, or a Google takeover) ends every earlier session. Tokens issued before this change have no `pv` and are rejected, so every user signs in again after deploy. That happens whether or not JWT_SECRET is rotated.

> **How to test the columns.** NonMem and PAdmin (not a member): **404**. Viewer / Editor / AdminM below the rule: **403**. Deactivated, unknown and revoked tokens: **401** on every row.

## §2.1 Auth and account (replace R03b, R63, R64)

| # | Method | Path | Rule | Anon | NonMem | Viewer | Editor | AdminM | Owner | PAdmin | Notes / Refs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R03b | GET | `/api/auth/google?code=…&state=…` | P | 302 | 302 | 302 | 302 | 302 | 302 | 302 | Success: 302 to `/auth/callback?next=/home` (or `/auth/onboarding`), with an httpOnly 2-minute `auth_token` hand-off cookie carrying a `pv` token. A missing or mismatched `state` gives `error=oauth_state_mismatch`; `verified_email !== true` gives `google_email_unverified`; an `is_active=0` account gives `account_inactive` and is left unchanged. **Takeover (owner decision, fix/int-auth `9d72783`):** when the verified email matches an active account that still has a password hash (a pre-registered password, or the random bcrypt hash the old Google flow stored), `password_hash` becomes `!oauth-only`. The password stops working and every earlier token is revoked (pv). `error=use_password_login` is no longer produced. |
| R63 | POST | `/api/auth/logout` | P | 200 | 200 | 200 | 200 | 200 | 200 | 200 | Needs no token. Always 200, and expires `auth_token`/`user_data` (Max-Age=0, httpOnly, SameSite=Lax). The bearer JWT stays valid until it expires or the account's password hash changes (pv revocation). There is no per-session logout. |
| R64 | POST | `/api/auth/google/session` | hand-off cookie | 401 | 401 | 401 | 401 | 401 | 401 | 401 | 200 `{token, user}` only with a valid hand-off cookie for an active account whose `password_hash` still matches the token's `pv`. Otherwise 401. 403 for `Sec-Fetch-Site: cross-site`. Every response clears the cookie. |

## §2.2 Projects, members, class progress (replace R09–R18)

| # | Method | Path | Rule | Anon | NonMem | Viewer | Editor | AdminM | Owner | PAdmin | Notes / Refs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R09 | GET | `/api/projects/:projectId` | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | 404 `Project not found`, the same for a missing project. Returns member emails to viewers, by design. |
| R10 | PUT | `/api/projects/:projectId` | Ad | 401 | 404 | 403 | 403 | 200 | 200 | 404 | Carries name, description, goal & scope and `lcia_method`/`region_code`. Editors cannot set the functional unit (see F5). 400: bad boundary or method. 409: migration missing. The name is written before validation (PROJ-8). |
| R11 | DELETE | `/api/projects/:projectId` | O | 401 | 404 | 403 | 403 | 403 | 200 | 404 | 403 body: `Only project owner can delete`. A stale `owner` member row passes (L9/D2). |
| R12 | GET | `/api/projects/:projectId/cases` | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | |
| R13 | POST | `/api/projects/:projectId/cases` | E | 401 | 404 | 403 | 201 | 201 | 201 | 404 | 400: missing name or type, or type not `base`/`comparative`. 409: duplicate name. A second base case is allowed (PROJ-6). |
| R14 | GET | `/api/projects/:projectId/compare?cases=…` | M | 401 | **404 (pending; now 403)** | 200 | 200 | 200 | 200 | **404 (pending; now 403)** | 400: no case ids or a bad project id. 404: none of the cases are in the project. At most 8 cases (CMP-6). Deactivated: 401. |
| R15 | GET | `/api/projects/:projectId/members` | M | 401 | **404 (pending; now 403)** | 200 | 200 | 200 | 200 | **404 (pending; now 403)** | 404 when the project is missing. `canManage` is owner-only (PROJ-8). **Deactivated/unknown: 401 (pending; now 500)** X-API-2. |
| R16 | POST | `/api/projects/:projectId/members` | Ad | 401 | **404 (pending; now 403)** | 403 | 403 | 200 | 200 | **404 (pending; now 403)** | Body `{email, role}`. Returns 200. 404: unknown email (L2). 409: target is the owner. REC L9: only the owner grants admin. **Deactivated/unknown: 401 (pending; now 500).** |
| R17 | DELETE | `/api/projects/:projectId/members?user_id=` | Ad | 401 | **404 (pending; now 403)** | 403 | 403 | 200 | 200 | **404 (pending; now 403)** | 400 without `user_id`. 200 even when no row matched. **Deactivated/unknown: 401 (pending; now 500).** |
| R18 | GET | `/api/projects/:projectId/progress` | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | Class-mode progress (D4). 404 `Project not found`, identical for a missing project. Deactivated: **401** (was 500; fixed `299722e`). |

## §2.3 Cases (replace R19–R32)

All case-scoped rows: NonMem and PAdmin get **404 `Case not found`**, the same as a missing case id. The existence oracle noted in D3 is closed.

| # | Method | Path | Rule | Anon | NonMem | Viewer | Editor | AdminM | Owner | PAdmin | Notes / Refs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R19 | GET | `/api/cases/:caseId` | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | Adds `project_lcia_method` and `project_region_code`. |
| R20 | PUT | `/api/cases/:caseId` | E | 401 | 404 | 403 | 200 | 200 | 200 | 404 | 400: empty name, reference flow / modeled output ≤ 0. 409: duplicate name or migration missing. `case_type` not validated (L9). |
| R21 | DELETE | `/api/cases/:caseId` | Ad | 401 | 404 | 403 | 403 | 200 | 200 | 404 | Cascades to components, flows, runs and documents. |
| R22 | GET | `/api/cases/:caseId/assessments` | M | 401 | **404 (pending; now 403)** | 200 | 200 | 200 | 200 | **404 (pending; now 403)** | N+1 per run (RUN-8). |
| R23 | POST | `/api/cases/:caseId/assessments` | E | 401 | **404 (pending; now 403)** | 403 | 201 | 201 | 201 | **404 (pending; now 403)** | Rate limit 30/hour/user (other agent, item 10). |
| R24 | POST | `/api/cases/:caseId/clone-from` | E | 401 | 404 | 403 | 200 | 200 | 200 | 404 | Body `{sourceCaseId}`. Access to the target case is now checked **before** the same-project comparison, so a non-member gets 404 and no longer the 400 oracle. A member still gets 400 `Cases must belong to the same project` for a source case in another project. That tells a member that the id exists somewhere, which is minor. 409 when the target is not empty. |
| R25 | GET | `/api/cases/:caseId/completeness` | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | 400 for a non-numeric id. Deactivated: **401** (was 500; `299722e`). |
| R26 | GET | `/api/cases/:caseId/components` | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | |
| R27 | POST | `/api/cases/:caseId/components` | E | 401 | 404 | 403 | 201 | 201 | 201 | 404 | 400 when `parent_component_id` is not in this case (fix/editor). |
| R28 | GET | `/api/cases/:caseId/documents[?id=]` | M | 401 | **404 (pending; now 403)** | 200 | 200 | 200 | 200 | **404 (pending; now 403)** | 404 when the document is not in this case. **Deactivated/unknown: 401 (pending; now 500).** |
| R29 | POST | `/api/cases/:caseId/documents` | E | 401 | **404 (pending; now 403)** | 403 | 200 | 200 | 200 | **404 (pending; now 403)** | Same pending notes as R28. |
| R30 | DELETE | `/api/cases/:caseId/documents?id=` | E | 401 | **404 (pending; now 403)** | 403 | 200 | 200 | 200 | **404 (pending; now 403)** | Same pending notes as R28. |
| R31 | POST | `/api/cases/:caseId/duplicate` | E | 401 | 404 | 403 | 201 | 201 | 201 | 404 | Deactivated: 401. |
| R32 | POST | `/api/cases/:caseId/scale` | E | 401 | 404 | 403 | 200 | 200 | 200 | 404 | |

## §2.4 Components, flows, costs (replace R33–R40)

NonMem and PAdmin: **404 `Component not found`** / **`Flow not found`**, identical to a missing id.

| # | Method | Path | Rule | Anon | NonMem | Viewer | Editor | AdminM | Owner | PAdmin | Notes / Refs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R33 | GET | `/api/components/:componentId` | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | |
| R34 | PUT | `/api/components/:componentId` | E | 401 | 404 | 403 | 200 | 200 | 200 | 404 | Parent must be in the same case, not itself, no cycle (fix/editor). |
| R35 | DELETE | `/api/components/:componentId` | E | 401 | 404 | 403 | 200 | 200 | 200 | 404 | Editor since fix/editor (D5). `?children=delete|reparent`, else 400. |
| R36 | GET | `/api/components/:componentId/flows` | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | |
| R37 | POST | `/api/components/:componentId/flows` | E | 401 | 404 | 403 | 201 | 201 | 201 | 404 | |
| R38 | POST | `/api/components/:componentId/auto-costs` | E | 401 | 404 | 403 | 200 | 200 | 200 | 404 | 404 `Component not found` for a missing, non-numeric or invisible id. |
| R39 | PUT | `/api/flows/:flowId` | E | 401 | 404 | 403 | 200 | 200 | 200 | 404 | |
| R40 | DELETE | `/api/flows/:flowId` | E | 401 | 404 | 403 | 200 | 200 | 200 | 404 | |

## §2.5 Runs, exports, comparisons (replace R41–R46)

| # | Method | Path | Rule | Anon | NonMem | Viewer | Editor | AdminM | Owner | PAdmin | Notes / Refs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R41 | GET | `/api/assessments/:runId` | M | 401 | 404 | 200 | 200 | 200 | 200 | 404 | 404 `Assessment not found`, identical for a missing run. |
| R42 | GET | `/api/assessments/:runId/export?format=…` | V | 401 | **404 (pending; now 403)** | 200 | 200 | 200 | 200 | **404 (pending; now 403)** | Deactivated: 401 (its list already includes the inactive message). |
| R43 | POST | `/api/comparisons` (legacy) | M | **401 (pending; now 500)** | 404 | 200 | 200 | 200 | 200 | 404 | The catch-all maps auth errors to 500. REC: delete the legacy feature. |
| R44 | GET | `/api/comparisons?project_id=` (legacy) | M | **401 (pending; now 500)** | 404 | 200 | 200 | 200 | 200 | 404 | Same. |
| R45 | GET | `/api/comparisons/:comparisonId` (legacy) | M | **401 (pending; now 500)** | **404 (pending; now 403)** | 200 | 200 | 200 | 200 | **404 (pending; now 403)** | 404 `Comparison not found`. |
| R46 | DELETE | `/api/comparisons/:comparisonId` (legacy) | Ad or creator | **401 (pending; now 500)** | **404 (pending; now 403)** | 403 (creator: 200) | 403 (creator: 200) | 200 | 200 | **404 (pending; now 403)** | The suggested change also requires the creator to still be a member (closes L9). The handler reads `params.comparisonId` without awaiting the Promise (Next 15), so the id is NaN and it answers 404 for every id. That is a separate bug. |

## §2.6 (replace R52b, R53, R53b)

| # | Method | Path | Rule | Anon | NonMem | Viewer | Editor | AdminM | Owner | PAdmin | Notes / Refs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R52b | POST | `/api/ingest/preview` (connector = equipment, `target_case_id`) | E on the target case's project | 401 | 404 | 403 | 200 | 200 | 200 | 404 | 404 `Case not found`, identical for a missing case. 400 without `target_case_id`. |
| R53 | POST | `/api/ingest/apply` (create) | E on `project_id` | 401 | 404 | 403 | 201 | 201 | 201 | 404 | 404 `Project not found`. Body validation (400) still runs before the access check, but it reveals nothing about ids. Deactivated: **401** (was 500; `299722e`). |
| R53b | POST | `/api/ingest/apply` (append) | E on the target case's project | 401 | 404 | 403 | 200 | 200 | 200 | 404 | 404 `Target case not found`, identical for a missing case. Deactivated: 401. |

Also in §2.6, R50 (`/api/process-templates`) and R50b (`/api/example-project`): **Deactivated: 401** (was 500 for R50; `299722e`).

## §3 Differences table: status of the items fix/int-auth touches

| # | Change |
|---|---|
| 10 | Deactivated account → 401: **fixed** for every route this branch owns (`299722e`). Still pending: members (R15–R17), documents (R28–R30), legacy comparisons (R43–R46). |
| 20 | R09–R18 missing project → **404 for missing and for non-members** (D3 decided). Pending: R14, R15–R17. |
| new | Token revocation (C2/F2): `pv` claim, checked by `requireAuth` and the Google hand-off (`bf10230`). |
| new | Google linking (follow-up 9): a verified email takes over the matching active account (`9d72783`). |

## §4 Deactivated-account behaviour (replace the section)

`requireAuth` throws a typed `AuthError` (status 401) for every failure, with the same messages as before. Routes map it with `isAuthError` from `lib/route-guard.ts`, which matches the type or any of the four messages. A deactivated, unknown or revoked account gets **401** on every route except these (still **500** until the other agent's one-line change):

- members (R15–R17) and documents (R28–R30): their regex `/Unauthorized|token/i` misses "User account not found or inactive". A revoked token does get 401 there.
- legacy comparisons (R43–R46): the catch-all returns 500 for every auth failure.

## §5 Open decisions (update)

- **D3 decided (owner, 2026-09-30):** 404 for non-members everywhere, with the missing-id body; 403 only for members with too low a role. Tests assert exactly 404 for NonMem and PAdmin (not `{403, 404}`).
- **D1 unchanged:** a platform admin who is not a member gets 404, like any non-member.

## USER_FLOWS.md (F2, F3, F14): lines to change

- **F2 failure cases:** "Deactivated account with a still-valid token: 401 on every route (500 only on the pending routes listed in PERMISSIONS_MATRIX §4)". Add: "Changing the password hash revokes every earlier token (pv)."
- **F3 linking rules:** replace rule 3 and its "As merged" note with: "An active account exists with a password hash (a pre-registered password or an old-Google-flow random hash) and Google reports `verified_email: true`: **take over** the account. Set `password_hash='!oauth-only'`, so the password stops working and every earlier session is revoked, then sign in. Rule 4 (inactive → refused, account unchanged) is checked first." Remove `use_password_login` from the error list.
- **F14 table:** the Non-member column reads **404** (not ✗/403) for every row. Success criteria: "Removed members get **404** on their next request."
