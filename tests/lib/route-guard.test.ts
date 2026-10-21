/**
 * lib/route-guard: the shared access-denied mapping (owner decision: a
 * non-member gets 404 so ids reveal nothing; a member whose role is too low
 * gets 403) and the 401 mapping for requireAuth failures.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as auth from '@/lib/auth';
import * as db from '@/lib/db-helpers';
import { AuthError } from '@/lib/auth';
import {
  caseAccessDenied,
  casesRestrictedFor,
  isAuthError,
  projectAccessDenied,
  reachableCasesFilter,
  READ_ONLY_CASE,
  unreachableCaseIds,
} from '@/lib/route-guard';

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

/**
 * Case 3 lives in project 7. `createdBy` made it; `ownOnly` is the project's
 * members_see_own_cases setting; `hidden` keeps it from members (migrate-037);
 * `readOnly` is the sample's base case (migrate-038). `null` case = no such
 * case. Project 7's owner is OWNER and its admin member ADMIN (the staff whose
 * cases members read under D2); the caller's member row has `callerRole`.
 */
function caseRow(
  c: { createdBy: number | null; ownOnly: boolean; hidden?: boolean; readOnly?: boolean } | null,
  callerRole: 'viewer' | 'editor' | 'admin' | 'owner' = 'editor',
) {
  vi.mocked(db.queryOne).mockImplementation(async (sql: string) => {
    if (/FROM case_table/.test(sql)) {
      return (
        c &&
        ({
          case_id: 3,
          project_id: 7,
          created_by: c.createdBy,
          hidden_from_members: c.hidden ? 1 : 0,
          read_only: c.readOnly ? 1 : 0,
          members_see_own_cases: c.ownOnly ? 1 : 0,
        } as any)
      );
    }
    if (/FROM project_members pm/.test(sql)) return { permission_name: callerRole } as any;
    if (/FROM project/.test(sql)) return c && ({ members_see_own_cases: c.ownOnly ? 1 : 0 } as any);
    return null;
  });
  // The staff list: the owner, and admins when the SQL asks for them.
  vi.mocked(db.query).mockImplementation(async (sql: string, params?: any[]) => {
    if (/SELECT owner_id AS id FROM project/.test(sql)) {
      return [{ id: OWNER }, ...((params ?? []).includes('admin') ? [{ id: ADMIN }] : [])] as any;
    }
    return [] as any;
  });
}

const CALLER = 4;
const OTHER_STUDENT = 5;
const OWNER = 9;
const ADMIN = 8;

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
    caseRow({ createdBy: OTHER_STUDENT, ownOnly: false });
    access().mockResolvedValue(false);
    const res = await caseAccessDenied(CALLER, 3, undefined, { notFound: 'Component not found' });
    expect(res?.status).toBe(404);
    expect(await res!.json()).toEqual({ error: 'Component not found' });
  });

  describe('setting off (the default): unchanged, every member reaches every case', () => {
    it('an editor reaches a case someone else made, with no extra role lookup', async () => {
      caseRow({ createdBy: OTHER_STUDENT, ownOnly: false });
      memberWithRole('editor');
      expect(await caseAccessDenied(CALLER, 3, 'editor')).toBeNull();
      expect(access().mock.calls).toEqual([[CALLER, 7, 'editor']]);
    });

    it('a viewer reads it, and gets 403 for a write, exactly as projectAccessDenied answers', async () => {
      caseRow({ createdBy: OTHER_STUDENT, ownOnly: false });
      memberWithRole('viewer');
      expect(await caseAccessDenied(CALLER, 3)).toBeNull();
      const res = await caseAccessDenied(CALLER, 3, 'editor', { notFound: 'Case not found' });
      expect(res?.status).toBe(403);
      expect(await res!.json()).toEqual({ error: 'Access denied' });
    });
  });

  describe('setting on: editors and viewers reach only the cases they made', () => {
    it('an editor reaches their own case', async () => {
      caseRow({ createdBy: CALLER, ownOnly: true });
      memberWithRole('editor');
      expect(await caseAccessDenied(CALLER, 3)).toBeNull();
      expect(await caseAccessDenied(CALLER, 3, 'editor')).toBeNull();
    });

    for (const role of ['editor', 'viewer'] as const) {
      for (const level of [undefined, 'viewer', 'editor', 'admin'] as const) {
        it(`${role}, another member's case, ${level ?? 'no'} level: 404 with the missing-case body (never 403)`, async () => {
          caseRow({ createdBy: OTHER_STUDENT, ownOnly: true });
          memberWithRole(role);
          const hidden = await caseAccessDenied(CALLER, 3, level, { notFound: 'Case not found', forbidden: 'Nope' });
          caseRow(null);
          const missing = await caseAccessDenied(CALLER, 3, level, { notFound: 'Case not found', forbidden: 'Nope' });
          expect(hidden?.status).toBe(404);
          expect(await hidden!.json()).toEqual(await missing!.json());
        });
      }
    }

    it('a case whose creator was deleted (created_by NULL) is hidden from editors', async () => {
      caseRow({ createdBy: null, ownOnly: true });
      memberWithRole('editor');
      expect((await caseAccessDenied(CALLER, 3))?.status).toBe(404);
    });

    for (const role of ['owner', 'admin'] as const) {
      it(`the ${role} reaches every case, including one with no creator`, async () => {
        memberWithRole(role);
        caseRow({ createdBy: OTHER_STUDENT, ownOnly: true });
        expect(await caseAccessDenied(CALLER, 3, 'editor')).toBeNull();
        caseRow({ createdBy: null, ownOnly: true });
        expect(await caseAccessDenied(CALLER, 3, 'admin')).toBeNull();
      });
    }

    it('a viewer on their own case still needs the role to write (403)', async () => {
      caseRow({ createdBy: CALLER, ownOnly: true });
      memberWithRole('viewer');
      expect(await caseAccessDenied(CALLER, 3)).toBeNull();
      expect((await caseAccessDenied(CALLER, 3, 'editor'))?.status).toBe(403);
    });
  });

  describe("setting on, D2: members read the staff's cases, never change them", () => {
    it("an editor reads the owner's and an admin's case; any write is 403", async () => {
      for (const creator of [OWNER, ADMIN]) {
        caseRow({ createdBy: creator, ownOnly: true }, 'editor');
        memberWithRole('editor');
        expect(await caseAccessDenied(CALLER, 3)).toBeNull();
        expect(await caseAccessDenied(CALLER, 3, 'viewer')).toBeNull();
        const write = await caseAccessDenied(CALLER, 3, 'editor', { forbidden: 'Nope' });
        expect(write?.status).toBe(403);
        expect(await write!.json()).toEqual({ error: 'Nope' });
      }
    });

    it("a viewer reads the owner's case, not an admin's", async () => {
      memberWithRole('viewer');
      caseRow({ createdBy: OWNER, ownOnly: true }, 'viewer');
      expect(await caseAccessDenied(CALLER, 3)).toBeNull();
      caseRow({ createdBy: ADMIN, ownOnly: true }, 'viewer');
      expect((await caseAccessDenied(CALLER, 3))?.status).toBe(404);
    });

    it('a staff case kept from members is as good as missing (migrate-037)', async () => {
      caseRow({ createdBy: OWNER, ownOnly: true, hidden: true }, 'editor');
      memberWithRole('editor');
      const hidden = await caseAccessDenied(CALLER, 3, undefined, { notFound: 'Case not found' });
      expect(hidden?.status).toBe(404);
      expect(await hidden!.json()).toEqual({ error: 'Case not found' });
    });
  });

  describe('a read-only case (the sample, migrate-038)', () => {
    it('nobody changes it, the owner included; reading stays open', async () => {
      caseRow({ createdBy: CALLER, ownOnly: false, readOnly: true }, 'owner');
      memberWithRole('owner');
      expect(await caseAccessDenied(CALLER, 3)).toBeNull();
      const write = await caseAccessDenied(CALLER, 3, 'editor');
      expect(write?.status).toBe(403);
      expect(await write!.json()).toEqual({ error: READ_ONLY_CASE });
    });

    it('a classmate gets 404 for a read-only case they cannot reach, never the read-only 403', async () => {
      caseRow({ createdBy: OTHER_STUDENT, ownOnly: true, readOnly: true }, 'editor');
      memberWithRole('editor');
      expect((await caseAccessDenied(CALLER, 3, 'editor'))?.status).toBe(404);
    });
  });
});

describe('list filtering: casesRestrictedFor / reachableCasesFilter', () => {
  it('setting off: nobody is restricted and the filter adds nothing', async () => {
    caseRow({ createdBy: null, ownOnly: false });
    for (const role of ['viewer', 'editor', 'admin', 'owner'] as const) {
      memberWithRole(role);
      expect(await casesRestrictedFor(CALLER, 7)).toBe(false);
      expect(await reachableCasesFilter(CALLER, 7)).toEqual({ sql: '', params: [] });
    }
  });

  it("setting on: an editor's list is their own cases plus the staff's not kept from members (D2)", async () => {
    caseRow({ createdBy: null, ownOnly: true }, 'editor');
    memberWithRole('editor');
    expect(await casesRestrictedFor(CALLER, 7)).toBe(true);
    expect(await reachableCasesFilter(CALLER, 7)).toEqual({
      sql: ' AND (c.created_by = ? OR (c.hidden_from_members = 0 AND c.created_by IN (?, ?)))',
      params: [CALLER, OWNER, ADMIN],
    });
    expect((await reachableCasesFilter(CALLER, 7, 'ct')).sql).toMatch(/^ AND \(ct\.created_by = \?/);
  });

  it("setting on: a viewer's list adds the owner's cases only", async () => {
    caseRow({ createdBy: null, ownOnly: true }, 'viewer');
    memberWithRole('viewer');
    expect(await reachableCasesFilter(CALLER, 7)).toEqual({
      sql: ' AND (c.created_by = ? OR (c.hidden_from_members = 0 AND c.created_by IN (?)))',
      params: [CALLER, OWNER],
    });
  });

  it('setting on: the owner and admins see every case', async () => {
    caseRow({ createdBy: null, ownOnly: true });
    for (const role of ['admin', 'owner'] as const) {
      memberWithRole(role);
      expect(await casesRestrictedFor(CALLER, 7)).toBe(false);
      expect(await reachableCasesFilter(CALLER, 7)).toEqual({ sql: '', params: [] });
    }
  });

  it('refuses an alias that is not a plain identifier', async () => {
    caseRow({ createdBy: null, ownOnly: true });
    memberWithRole('editor');
    await expect(reachableCasesFilter(CALLER, 7, 'c; DROP TABLE x')).rejects.toThrow();
  });
});

describe('unreachableCaseIds (saved comparisons that name several cases)', () => {
  it('setting off: nothing is hidden, without asking which cases the caller made', async () => {
    caseRow({ createdBy: null, ownOnly: false });
    memberWithRole('editor');
    expect(await unreachableCaseIds(CALLER, 7, [3, 4])).toEqual([]);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('setting on: the ids an editor cannot reach (not theirs, not a visible staff case)', async () => {
    caseRow({ createdBy: null, ownOnly: true }, 'editor');
    memberWithRole('editor');
    const staffQuery = vi.mocked(db.query).getMockImplementation()!;
    vi.mocked(db.query).mockImplementation(async (sql: string, params?: any[]) =>
      /FROM case_table WHERE project_id/.test(sql) ? ([{ case_id: 3 }] as any) : staffQuery(sql, params),
    );
    expect(await unreachableCaseIds(CALLER, 7, [3, 4, 4, 9])).toEqual([4, 9]);
    const [sql, params] = vi.mocked(db.query).mock.calls.find(([q]) => /FROM case_table WHERE project_id/.test(String(q)))!;
    expect(sql).toMatch(/created_by = \? OR \(case_table\.hidden_from_members = 0/);
    expect(params).toEqual([7, CALLER, OWNER, ADMIN, 3, 4, 9]);
  });

  it('setting on: nothing is hidden from an admin', async () => {
    caseRow({ createdBy: null, ownOnly: true });
    memberWithRole('admin');
    expect(await unreachableCaseIds(CALLER, 7, [3, 4])).toEqual([]);
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
