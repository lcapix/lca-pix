import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/cases/[caseId]/assessments/route';
import * as auth from '@/lib/auth';
import * as db from '@/lib/db-helpers';
import * as engine from '@/lib/lca-engine';
import { MemoryRateLimitStore, setRateLimitStore } from '@/lib/rate-limit';

vi.mock('@/lib/auth');
vi.mock('@/lib/db-helpers');
vi.mock('@/lib/lca-engine');

function req() {
  return new Request('http://t/api/cases/3/assessments', {
    method: 'POST',
    headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
    body: JSON.stringify({ calculation_method: 'CML 2001', region_code: 'Global' }),
  });
}
const params = { params: Promise.resolve({ caseId: '3' }) };

// REC H5: one run holds a DB transaction for the whole engine pass, so a user
// gets 30 runs an hour (RATE_LIMITS.assessments).
describe('POST /api/cases/:id/assessments rate limit', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setRateLimitStore(new MemoryRateLimitStore());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(auth.checkProjectAccess).mockResolvedValue(true);
    vi.mocked(db.queryOne).mockResolvedValue({ project_id: 5, case_name: 'Case' } as any);
    // Each allowed run fails fast inside the transaction; what matters is
    // whether the engine was reached at all.
    vi.mocked(db.transaction).mockImplementation(async (cb: any) =>
      cb({ query: vi.fn(async () => [{ insertId: 77 }]) }),
    );
    vi.mocked(engine.calculateCaseImpacts).mockRejectedValue(new Error('engine stub'));
    vi.mocked(db.insert).mockResolvedValue(78);
  });

  it('answers 429 with Retry-After on the 31st run in an hour, before any run is written', async () => {
    for (let i = 0; i < 30; i++) {
      const res = await POST(req() as any, params as any);
      expect(res.status).toBe(500);
    }
    expect(db.transaction).toHaveBeenCalledTimes(30);

    const limited = await POST(req() as any, params as any);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBeTruthy();
    expect(db.transaction).toHaveBeenCalledTimes(30);
  });

  it('counts per user: another user can still run', async () => {
    for (let i = 0; i < 30; i++) await POST(req() as any, params as any);
    expect((await POST(req() as any, params as any)).status).toBe(429);

    vi.mocked(auth.requireAuth).mockResolvedValue(2);
    expect((await POST(req() as any, params as any)).status).toBe(500);
  });

  it('does not spend the budget on a caller without editor access', async () => {
    vi.mocked(auth.checkProjectAccess).mockResolvedValue(false);
    for (let i = 0; i < 35; i++) {
      const res = await POST(req() as any, params as any);
      expect([403, 404]).toContain(res.status);
    }
    vi.mocked(auth.checkProjectAccess).mockResolvedValue(true);
    expect((await POST(req() as any, params as any)).status).toBe(500);
  });
});
