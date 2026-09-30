import { describe, it, expect, vi, beforeEach } from 'vitest';
import { guardAdmin } from '@/lib/integrations/admin-guard';
import * as auth from '@/lib/auth';

vi.mock('@/lib/auth');

const req = () => new Request('http://t/', { headers: { Authorization: 'Bearer x' } });

describe('guardAdmin', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('passes the admin user id through', async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue(9);
    const g = await guardAdmin(req());
    expect(g.response).toBeUndefined();
    expect(g.userId).toBe(9);
  });

  it('403 for a signed-in non-admin', async () => {
    vi.mocked(auth.requireAdmin).mockRejectedValue(new Error('Admin privileges required'));
    const g = await guardAdmin(req());
    expect(g.response?.status).toBe(403);
  });

  it.each(['No authentication token provided', 'Invalid or expired token', 'User account not found or inactive'])(
    '401 when %s',
    async (msg) => {
      vi.mocked(auth.requireAdmin).mockRejectedValue(new Error(msg));
      const g = await guardAdmin(req());
      expect(g.response?.status).toBe(401);
    },
  );

  it('401 for any AuthError, whatever its message (same rule as isAuthError in lib/route-guard)', async () => {
    // requireAuth throws a typed AuthError; a message added to it later must
    // not turn a sign-in failure into a 500 here.
    vi.mocked(auth.requireAdmin).mockRejectedValue(Object.assign(new Error('Session revoked'), { name: 'AuthError' }));
    const g = await guardAdmin(req());
    expect(g.response?.status).toBe(401);
    expect(await g.response!.json()).toEqual({ error: 'Unauthorized' });
  });

  it('500 with a generic body when the check itself fails (e.g. the DB is down)', async () => {
    vi.mocked(auth.requireAdmin).mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.1:3306'));
    const g = await guardAdmin(req());
    expect(g.response?.status).toBe(500);
    expect(JSON.stringify(await g.response!.json())).not.toContain('ECONNREFUSED');
  });
});
