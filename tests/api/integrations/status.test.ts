import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/integrations/status/route';
import * as auth from '@/lib/auth';
import * as dbHelpers from '@/lib/db-helpers';

vi.mock('@/lib/auth');
vi.mock('@/lib/db-helpers');

describe('GET /api/integrations/status', () => {
  beforeEach(() => vi.resetAllMocks());

  it('401 when not authenticated', async () => {
    vi.mocked(auth.requireAuth).mockRejectedValue(new Error('No authentication token provided'));
    const res = await GET(new Request('http://t/') as any);
    expect(res.status).toBe(401);
  });

  it('returns coverage counts', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(dbHelpers.queryOne).mockResolvedValueOnce({ total: 42, enriched: 15 } as any);
    vi.mocked(dbHelpers.query).mockResolvedValueOnce([
      { method_name: 'CML 2001', factors: 40 },
    ] as any).mockResolvedValueOnce([
      { rate_type: 'labor', cnt: 12 },
      { rate_type: 'electricity', cnt: 50 },
    ] as any);

    const res = await GET(new Request('http://t/') as any);
    const body = await res.json();
    expect(body.substances.total).toBe(42);
    expect(body.substances.enriched).toBe(15);
    expect(body.factorsByMethod[0].method_name).toBe('CML 2001');
    expect(body.rateCache.find((r: any) => r.rate_type === 'labor').cnt).toBe(12);
  });
});
