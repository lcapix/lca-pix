/**
 * Route-side helpers for the auth decisions in lib/auth.ts.
 *
 * Kept out of lib/auth.ts on purpose: route tests replace '@/lib/auth' with
 * mocks (requireAuth, checkProjectAccess). These helpers import
 * checkProjectAccess across the module boundary, so a route test that mocks it
 * still drives the real 404/403 mapping, and `isAuthError` stays real.
 *
 * Policy (owner decision, 2026-09-30):
 *   - a caller who is not a member of the project (or asks for a project,
 *     case, component, flow, run, comparison or document that does not exist)
 *     gets 404, with the same body the route sends for a missing resource, so
 *     an id reveals nothing;
 *   - a member whose role is below the one required gets 403;
 *   - any requireAuth failure (no/bad/revoked token, unknown or deactivated
 *     account) is 401, never 500.
 *
 * Case ownership (B-A1, docs/design-revamp/UX_SPEC.md §2b.2): a project with
 * `members_see_own_cases = 1` keeps each editor's and viewer's cases to that
 * member. They reach only cases whose `created_by` is them, and everything
 * under those cases; the owner and admin members reach every case. A case a
 * member cannot reach answers exactly like a missing case (404, same body),
 * whatever the action, so a viewer never learns from a 403 that it exists.
 * With the setting at 0 (the default) nothing changes. `caseAccessDenied`
 * applies the rule to one case; `reachableCasesFilter` and
 * `REACHABLE_CASE_SQL` apply it to lists.
 */
import { NextResponse } from 'next/server';
import { checkProjectAccess, type ProjectPermission } from '@/lib/auth';
import { query, queryOne } from '@/lib/db-helpers';

// The messages requireAuth has always thrown. Matched as well as the AuthError
// type so a plain Error with one of them (older code, test mocks) is still 401.
const AUTH_ERROR_MESSAGES = new Set([
  'Unauthorized',
  'No authentication token provided',
  'Invalid or expired token',
  'User account not found or inactive',
]);

/** True when `error` means "not authenticated" (map it to 401). */
export function isAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: unknown; message?: unknown };
  return e.name === 'AuthError' || (typeof e.message === 'string' && AUTH_ERROR_MESSAGES.has(e.message));
}

export interface AccessDeniedMessages {
  /** Body for a non-member; use the route's own "X not found" text. Default "Not found". */
  notFound?: string;
  /** Body for a member whose role is too low. Default "Access denied". */
  forbidden?: string;
}

/**
 * null when `userId` may act on `projectId` at `level` (any member when no
 * level is given). Otherwise the response to return: 404 for a non-member
 * (or a project that does not exist), 403 for a member with too low a role.
 *
 *   const denied = await projectAccessDenied(userId, caseRow.project_id, 'editor', { notFound: 'Case not found' });
 *   if (denied) return denied;
 */
export async function projectAccessDenied(
  userId: number,
  projectId: number,
  level?: ProjectPermission,
  messages: AccessDeniedMessages = {}
): Promise<NextResponse | null> {
  const allowed = level
    ? await checkProjectAccess(userId, projectId, level)
    : await checkProjectAccess(userId, projectId);
  if (allowed) return null;

  // Only a member learns that the resource exists and what they lack.
  if (level && (await checkProjectAccess(userId, projectId))) {
    return NextResponse.json({ error: messages.forbidden ?? 'Access denied' }, { status: 403 });
  }
  return NextResponse.json({ error: messages.notFound ?? 'Not found' }, { status: 404 });
}

const notFoundResponse = (messages: AccessDeniedMessages) =>
  NextResponse.json({ error: messages.notFound ?? 'Not found' }, { status: 404 });

/** True when the project keeps members' cases apart (members_see_own_cases = 1). */
const ownCasesOnly = (setting: unknown) => Number(setting) === 1;

/** Owner (project.owner_id or an 'owner' member row) or admin member: reaches every case. */
const seesEveryCase = (userId: number, projectId: number) => checkProjectAccess(userId, projectId, 'admin');

/**
 * null when `userId` may act on case `caseId` at `level` (any member when no
 * level is given). Otherwise the response to return:
 *   - 404 (`messages.notFound`) for a missing case, a non-member, or a case the
 *     ownership rule hides from the caller, whatever `level` is;
 *   - 403 (`messages.forbidden`) for a member who reaches the case but whose
 *     role is below `level`.
 * Component, flow and run routes pass the case their resource belongs to and
 * their own "X not found" body.
 *
 *   const denied = await caseAccessDenied(userId, caseId, 'editor', { notFound: 'Case not found' });
 *   if (denied) return denied;
 */
export async function caseAccessDenied(
  userId: number,
  caseId: number,
  level?: ProjectPermission,
  messages: AccessDeniedMessages = {}
): Promise<NextResponse | null> {
  const row = await queryOne<any>(
    `SELECT case_id, project_id, created_by,
            (SELECT members_see_own_cases FROM project WHERE project.project_id = case_table.project_id) AS members_see_own_cases
       FROM case_table WHERE case_id = ?`,
    [caseId]
  );
  if (!row) return notFoundResponse(messages);

  const denied = await projectAccessDenied(userId, row.project_id, level, messages);
  if (denied?.status === 404) return denied; // not a member

  // A member: the ownership rule decides before the role does (404, not 403).
  if (
    ownCasesOnly(row.members_see_own_cases) &&
    (row.created_by == null || Number(row.created_by) !== userId) &&
    !(await seesEveryCase(userId, row.project_id))
  ) {
    return notFoundResponse(messages);
  }
  return denied;
}

/**
 * True when `userId` (a member of `projectId`) reaches only the project's
 * cases they created. Call after the project access check.
 */
export async function casesRestrictedFor(userId: number, projectId: number): Promise<boolean> {
  const project = await queryOne<any>(`SELECT members_see_own_cases FROM project WHERE project_id = ?`, [projectId]);
  if (!ownCasesOnly(project?.members_see_own_cases)) return false;
  return !(await seesEveryCase(userId, projectId));
}

/**
 * The condition that keeps a list of one project's cases to those `userId`
 * reaches, for a query that already has `WHERE <alias>.project_id = ?`:
 * '' when the caller reaches every case, else ` AND <alias>.created_by = ?`.
 *
 *   const only = await reachableCasesFilter(userId, projectId);
 *   query(`SELECT … FROM case_table c WHERE c.project_id = ?${only.sql}`, [projectId, ...only.params]);
 */
export async function reachableCasesFilter(
  userId: number,
  projectId: number,
  alias = 'c'
): Promise<{ sql: string; params: number[] }> {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias)) throw new Error(`reachableCasesFilter: bad alias ${alias}`);
  if (!(await casesRestrictedFor(userId, projectId))) return { sql: '', params: [] };
  return { sql: ` AND ${alias}.created_by = ?`, params: [userId] };
}

/**
 * The ids among `caseIds` (cases of `projectId`) that `userId` cannot reach:
 * [] when nothing is hidden from them. For records that name several cases
 * at once (legacy saved comparisons): hide the record if any id is returned.
 */
export async function unreachableCaseIds(userId: number, projectId: number, caseIds: number[]): Promise<number[]> {
  const ids = [...new Set(caseIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length || !(await casesRestrictedFor(userId, projectId))) return [];
  const own = await query<any>(
    `SELECT case_id FROM case_table WHERE project_id = ? AND created_by = ? AND case_id IN (${ids.map(() => '?').join(',')})`,
    [projectId, userId, ...ids]
  );
  const reachable = new Set(own.map((r: any) => Number(r.case_id)));
  return ids.filter((id) => !reachable.has(id));
}

/**
 * The same rule in SQL, for a query over many projects (the home project
 * list): true for a case row `c` of project `p` that the caller reaches, where
 * `perm` is the caller's own permissions row for `p` (NULL when they only own
 * it). Bind the caller's id twice: [userId, userId].
 */
export const REACHABLE_CASE_SQL =
  `(p.members_see_own_cases <> 1 OR p.owner_id = ? OR perm.permission_name IN ('owner', 'admin') OR c.created_by = ?)`;
