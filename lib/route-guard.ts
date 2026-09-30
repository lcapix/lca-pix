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
 */
import { NextResponse } from 'next/server';
import { checkProjectAccess, type ProjectPermission } from '@/lib/auth';

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
