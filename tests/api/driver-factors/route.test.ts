import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/driver-factors/route';
import * as auth from '@/lib/auth';
import * as db from '@/lib/db-helpers';

vi.mock('@/lib/auth');
vi.mock('@/lib/db-helpers');

const get = (qs = '') =>
  GET(new Request(`http://t/api/driver-factors${qs}`, { headers: { Authorization: 'Bearer x' } }) as any);

describe('GET /api/driver-factors', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('401 when unauth', async () => {
    vi.mocked(auth.requireAuth).mockRejectedValue(new Error('No authentication token provided'));
    const res = await get();
    expect(res.status).toBe(401);
  });

  it("hides other users' private custom substances (library + caller's own only)", async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(42);
    vi.mocked(db.query).mockResolvedValue([] as any);

    await get();
    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toMatch(/s\.is_custom = 0 OR s\.created_by = \?/);
    expect(params).toContain(42);
  });

  it('excludes quarantined factor rows', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(42);
    vi.mocked(db.query).mockResolvedValue([] as any);

    await get();
    const [sql] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toMatch(/dif\.method_name NOT LIKE 'QUARANTINE%'/);
  });

  it('?substance_id= filters by the substance id, not by name', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(42);
    vi.mocked(db.query).mockResolvedValue([] as any);

    await get('?substance_id=17');
    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toMatch(/dif\.substance_id = \?/);
    expect(sql).not.toMatch(/s\.substance_name = \?/);
    expect(params).toContain(17);
  });

  it('?driver_name= still filters by name', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(42);
    vi.mocked(db.query).mockResolvedValue([] as any);

    await get('?driver_name=Methane');
    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toMatch(/s\.substance_name = \?/);
    expect(params).toContain('Methane');
  });

  it('400 on a non-numeric substance_id', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(42);
    const res = await get('?substance_id=abc');
    expect(res.status).toBe(400);
    expect(db.query).not.toHaveBeenCalled();
  });
});
