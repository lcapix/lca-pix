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
 * Case ownership (B-A1, student privacy in class projects): a project with
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
 * Whose cases a restricted member also reaches, read-only (default D2): an
 * editor ("Can change") reads the cases the owner and admins made (the
 * instructor's base case, the sample); a viewer ("Can read") reads the
 * owner's. Never the caller themselves (their own cases are theirs to edit).
 */
async function staffCreators(userId: number, projectId: number): Promise<number[]> {
  const me = await queryOne<any>(
    `SELECT pr.permission_name FROM project_members pm
       JOIN permissions pr ON pr.permission_id = pm.permission_id
      WHERE pm.project_id = ? AND pm.user_id = ?`,
    [projectId, userId]
  );
  const roles = me?.permission_name === 'editor' ? ['owner', 'admin'] : ['owner'];
  const rows = await query<any>(
    `SELECT owner_id AS id FROM project WHERE project_id = ?
     UNION
     SELECT pm.user_id AS id FROM project_members pm
       JOIN permissions pr ON pr.permission_id = pm.permission_id
      WHERE pm.project_id = ? AND pr.permission_name IN (${roles.map(() => '?').join(', ')})`,
    [projectId, projectId, ...roles]
  );
  return rows.map((r: any) => Number(r.id)).filter((id: number) => Number.isInteger(id) && id !== userId);
}

/** The 403 body for a change to a read-only case (the sample's base case). */
export const READ_ONLY_CASE = "This case is read-only. Make your own copy to change it.";

/**
 * The fields the case guard reads. hidden_from_members (037) and read_only
 * (038) may be missing on a database the code reached first: no such case can
 * exist there, so they read as 0.
 */
async function caseGuardRow(caseId: number): Promise<any> {
  const sql = (cols: string) =>
    `SELECT case_id, project_id, created_by${cols},
            (SELECT members_see_own_cases FROM project WHERE project.project_id = case_table.project_id) AS members_see_own_cases
       FROM case_table WHERE case_id = ?`;
  try {
    return await queryOne<any>(sql(', hidden_from_members, read_only'), [caseId]);
  } catch (err: any) {
    if (err?.code !== 'ER_BAD_FIELD_ERROR') throw err;
    try {
      return await queryOne<any>(sql(', hidden_from_members'), [caseId]);
    } catch (err2: any) {
      if (err2?.code !== 'ER_BAD_FIELD_ERROR') throw err2;
      return await queryOne<any>(sql(''), [caseId]);
    }
  }
}

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
  const row = await caseGuardRow(caseId);
  if (!row) return notFoundResponse(messages);

  const denied = await projectAccessDenied(userId, row.project_id, level, messages);
  if (denied?.status === 404) return denied; // not a member

  // A member: the ownership rule decides before the role does (404, not 403).
  if (
    ownCasesOnly(row.members_see_own_cases) &&
    (row.created_by == null || Number(row.created_by) !== userId) &&
    !(await seesEveryCase(userId, row.project_id))
  ) {
    // A case the owner or an admin made is reached read-only (D2), unless it
    // is kept from members (migrate-037); any other member's case is as good
    // as missing.
    if (Number(row.hidden_from_members) === 1) return notFoundResponse(messages);
    const staff = row.created_by == null ? [] : await staffCreators(userId, row.project_id);
    if (!staff.includes(Number(row.created_by))) return notFoundResponse(messages);
    if (level && level !== 'viewer') {
      return NextResponse.json({ error: messages.forbidden ?? 'Access denied' }, { status: 403 });
    }
    return null;
  }
  // The sample's base case (migrate-038): nobody changes it, its owner
  // included; reading and copying stay open. After the ownership rule, so a
  // hidden case still answers 404.
  if (!denied && level && level !== 'viewer' && Number(row.read_only) === 1) {
    return NextResponse.json({ error: READ_ONLY_CASE }, { status: 403 });
  }
  return denied;
}

/**
 * True when a member who sees only their own cases could still read `caseRow`
 * (D2): it is not kept from members and the owner or an admin made it. A
 * staff copy of a case that fails this is kept from members too (migrate-037).
 */
export async function caseReadableByClass(caseRow: { project_id: number; created_by: unknown; hidden_from_members?: unknown }): Promise<boolean> {
  if (Number(caseRow.hidden_from_members) === 1 || caseRow.created_by == null) return false;
  const creator = Number(caseRow.created_by);
  const row = await queryOne<any>(
    `SELECT 1 AS ok FROM project p
      WHERE p.project_id = ?
        AND (p.owner_id = ?
             OR EXISTS (SELECT 1 FROM project_members pm JOIN permissions pr ON pr.permission_id = pm.permission_id
                         WHERE pm.project_id = p.project_id AND pm.user_id = ? AND pr.permission_name IN ('owner', 'admin')))`,
    [caseRow.project_id, creator, creator]
  );
  return !!row;
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
 * '' when the caller reaches every case, else ` AND <alias>.created_by IN (…)`
 * over the caller and the members whose cases they read (D2).
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
  const staff = await staffCreators(userId, projectId);
  if (!staff.length) return { sql: ` AND ${alias}.created_by = ?`, params: [userId] };
  return {
    sql: ` AND (${alias}.created_by = ? OR (${alias}.hidden_from_members = 0 AND ${alias}.created_by IN (${staff.map(() => '?').join(', ')})))`,
    params: [userId, ...staff],
  };
}

/**
 * The ids among `caseIds` (cases of `projectId`) that `userId` cannot reach:
 * [] when nothing is hidden from them. For records that name several cases
 * at once (legacy saved comparisons): hide the record if any id is returned.
 */
export async function unreachableCaseIds(userId: number, projectId: number, caseIds: number[]): Promise<number[]> {
  const ids = [...new Set(caseIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length || !(await casesRestrictedFor(userId, projectId))) return [];
  const only = await reachableCasesFilter(userId, projectId, 'case_table');
  const own = await query<any>(
    `SELECT case_id FROM case_table WHERE project_id = ?${only.sql} AND case_id IN (${ids.map(() => '?').join(',')})`,
    [projectId, ...only.params, ...ids]
  );
  const reachable = new Set(own.map((r: any) => Number(r.case_id)));
  return ids.filter((id) => !reachable.has(id));
}

/**
 * The same rule in SQL, for a query over many projects (the home project
 * list): true for a case row `<alias>` of project `p` that the caller reaches,
 * where `perm` is the caller's own permissions row for `p` (NULL when they only
 * own it). Their own cases, and (D2) the cases the owner made, plus the cases
 * admins made when the caller is an editor. Bind the caller's id twice:
 * [userId, userId].
 */
export function reachableCaseSql(alias = 'c'): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias)) throw new Error(`reachableCaseSql: bad alias ${alias}`);
  return `(p.members_see_own_cases <> 1 OR p.owner_id = ? OR perm.permission_name IN ('owner', 'admin') OR ${alias}.created_by = ?
    OR (${alias}.hidden_from_members = 0
        AND (${alias}.created_by = p.owner_id
             OR ${alias}.created_by IN (SELECT sm.user_id FROM project_members sm
                                          JOIN permissions sp ON sp.permission_id = sm.permission_id
                                         WHERE sm.project_id = p.project_id
                                           AND (sp.permission_name = 'owner'
                                                OR (sp.permission_name = 'admin' AND perm.permission_name = 'editor'))))))`;
}
export const REACHABLE_CASE_SQL = reachableCaseSql('c');
