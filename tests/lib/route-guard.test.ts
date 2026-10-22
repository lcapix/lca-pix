/**
 * lib/route-guard: the shared access-denied mapping (owner decision: a
 * non-member gets 404 so ids reveal nothing; a member whose role is too low
 * gets 403) and the 401 mapping for requireAuth failures.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as auth from '@/lib/auth';
import * as db from '@/lib/db-helpers';
import { AuthError } from '@/lib/auth';
import { caseAccessDenied, isAuthError, projectAccessDenied } from '@/lib/route-guard';

vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  checkProjectAccess: vi.fn(),
}));
vi.mock('@/lib/db-helpers');

const access = () => vi.mocked(auth.checkProjectAccess);

/** A member with this role (owner counts as a role here for simplicity). */
function memberWithRole(role: 'viewer' | 'editor' | 'admin' | 'owner') {
  const rank = { viewer: 1, editor: 2, admin: 3, owner: 4 } as const;
  access().mockImplementation(async (_u, _p, level) => !level || rank[role] >= rank[level]);
}

beforeEach(() => vi.resetAllMocks());

describe('projectAccessDenied', () => {
  it('returns null when the caller has the required level, asking once with that level', async () => {
    memberWithRole('editor');
    expect(await projectAccessDenied(4, 7, 'editor')).toBeNull();
    expect(access()).toHaveBeenCalledTimes(1);
    expect(access()).toHaveBeenCalledWith(4, 7, 'editor');
  });

  it('returns null for any member when no level is required, asking without a level', async () => {
    memberWithRole('viewer');
    expect(await projectAccessDenied(4, 7)).toBeNull();
    expect(access()).toHaveBeenCalledWith(4, 7);
  });

  it('a non-member gets 404 "Not found" by default', async () => {
    access().mockResolvedValue(false);
    const res = await projectAccessDenied(4, 7, 'editor');
    expect(res?.status).toBe(404);
    expect(await res!.json()).toEqual({ error: 'Not found' });
  });

  it('a non-member gets the same body the route uses for a missing resource', async () => {
    access().mockResolvedValue(false);
    const res = await projectAccessDenied(4, 7, undefined, { notFound: 'Case not found' });
    expect(res?.status).toBe(404);
    expect(await res!.json()).toEqual({ error: 'Case not found' });
  });

  it('a member whose role is too low gets 403 with the route message', async () => {
    memberWithRole('viewer');
    const res = await projectAccessDenied(4, 7, 'editor');
    expect(res?.status).toBe(403);
    expect(await res!.json()).toEqual({ error: 'Access denied' });

    memberWithRole('admin');
    const owner = await projectAccessDenied(4, 7, 'owner', { forbidden: 'Only project owner can delete' });
    expect(owner?.status).toBe(403);
    expect(await owner!.json()).toEqual({ error: 'Only project owner can delete' });
  });

  it('with no level required, a non-member is 404 without a second lookup', async () => {
    access().mockResolvedValue(false);
    expect((await projectAccessDenied(4, 7))?.status).toBe(404);
    expect(access()).toHaveBeenCalledTimes(1);
  });
});

/** Case 3 lives in project 7; `null` = no such case. */
function caseRow(c: { createdBy: number | null } | null) {
  vi.mocked(db.queryOne).mockImplementation(async (sql: string) =>
    /FROM case_table/.test(sql) && c ? ({ case_id: 3, project_id: 7, created_by: c.createdBy } as any) : null,
  );
}

const CALLER = 4;
const OTHER = 5;

describe('caseAccessDenied', () => {
  it('a case that does not exist is 404 with the route body, before any access check', async () => {
    caseRow(null);
    memberWithRole('owner');
    const res = await caseAccessDenied(CALLER, 3, 'editor', { notFound: 'Case not found' });
    expect(res?.status).toBe(404);
    expect(await res!.json()).toEqual({ error: 'Case not found' });
    expect(access()).not.toHaveBeenCalled();
  });

  it('a non-member gets the same 404 as a missing case', async () => {
    caseRow({ createdBy: OTHER });
    access().mockResolvedValue(false);
    const res = await caseAccessDenied(CALLER, 3, undefined, { notFound: 'Component not found' });
    expect(res?.status).toBe(404);
    expect(await res!.json()).toEqual({ error: 'Component not found' });
  });

  it('every member reaches every case: an editor reaches one someone else made, with no extra lookup', async () => {
    caseRow({ createdBy: OTHER });
    memberWithRole('editor');
    expect(await caseAccessDenied(CALLER, 3, 'editor')).toBeNull();
    expect(access().mock.calls).toEqual([[CALLER, 7, 'editor']]);
  });

  it('a viewer reads it, and gets 403 for a write, exactly as projectAccessDenied answers', async () => {
    caseRow({ createdBy: OTHER });
    memberWithRole('viewer');
    expect(await caseAccessDenied(CALLER, 3)).toBeNull();
    const res = await caseAccessDenied(CALLER, 3, 'editor', { notFound: 'Case not found' });
    expect(res?.status).toBe(403);
    expect(await res!.json()).toEqual({ error: 'Access denied' });
  });

  it('reads no classroom column: privacy, hiding and read-only play no part', async () => {
    caseRow({ createdBy: OTHER });
    memberWithRole('editor');
    await caseAccessDenied(CALLER, 3, 'editor');
    const asked = vi.mocked(db.queryOne).mock.calls.map(([sql]) => String(sql)).join('\n');
    expect(asked).not.toMatch(/members_see_own_cases|hidden_from_members|read_only/);
  });
});

describe('isAuthError', () => {
  it('is true for an AuthError', () => {
    expect(isAuthError(new AuthError('User account not found or inactive'))).toBe(true);
    expect(isAuthError(new AuthError('Invalid or expired token'))).toBe(true);
  });

  it('is true for the messages requireAuth has always used (mocks, older throws)', () => {
    for (const m of [
      'Unauthorized',
      'No authentication token provided',
      'Invalid or expired token',
      'User account not found or inactive',
    ]) {
      expect(isAuthError(new Error(m))).toBe(true);
    }
  });

  it('is false for anything else', () => {
    expect(isAuthError(new Error('connect ETIMEDOUT db:3306'))).toBe(false);
    expect(isAuthError(new Error('Admin privileges required'))).toBe(false);
    expect(isAuthError(new Error('Invalid or expired token, and more'))).toBe(false);
    expect(isAuthError(null)).toBe(false);
    expect(isAuthError(undefined)).toBe(false);
    expect(isAuthError('Unauthorized')).toBe(false);
  });
});
