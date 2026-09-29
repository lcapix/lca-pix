import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from '@/app/api/integrations/openlca/import/route';
import * as imp from '@/lib/integrations/openlca/import';
import * as auth from '@/lib/auth';
import * as log from '@/lib/integrations/log';

vi.mock('@/lib/integrations/openlca/import');
vi.mock('@/lib/auth');
vi.mock('@/lib/integrations/log');

function req(body: any) {
  return new Request('http://t/api/integrations/openlca/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer x' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/integrations/openlca/import', () => {
  beforeEach(() => vi.resetAllMocks());

  it('401 when not authenticated', async () => {
    vi.mocked(auth.requireAdmin).mockRejectedValue(new Error('No authentication token provided'));
    const res = await POST(req({ method: 'CML 2001' }) as any);
    expect(res.status).toBe(401);
  });

  it('403 for a non-admin, and nothing is imported', async () => {
    vi.mocked(auth.requireAdmin).mockRejectedValue(new Error('Admin privileges required'));
    const res = await POST(req({ method: 'TRACI 2.1' }) as any);
    expect(res.status).toBe(403);
    expect(imp.importFactorMethod).not.toHaveBeenCalled();
  });

  it('imports CML 2001 seeds when method is CML 2001', async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue(1);
    vi.mocked(imp.importFactorMethod).mockResolvedValue({
      method: 'CML 2001', inserted: 40, substancesMatched: 15,
      skippedNoSubstance: 2, skippedNoCategory: 0, errors: [],
    });
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(req({ method: 'CML 2001' }) as any);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.inserted).toBe(40);
    expect(log.logIntegration).toHaveBeenCalled();
  });

  it.each(['constructor', '__proto__', 'QUARANTINE: TRACI 2.1'])('400 on method %s, without importing', async (m) => {
    vi.mocked(auth.requireAdmin).mockResolvedValue(1);
    const res = await POST(req({ method: m }) as any);
    expect(res.status).toBe(400);
    expect(imp.importFactorMethod).not.toHaveBeenCalled();
  });

  it('400 on unknown method', async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue(1);
    const res = await POST(req({ method: 'NotARealMethod' }) as any);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/integrations/openlca/import', () => {
  beforeEach(() => vi.resetAllMocks());

  it('401 when not authenticated', async () => {
    vi.mocked(auth.requireAuth).mockRejectedValue(new Error('No authentication token provided'));
    const res = await GET(new Request('http://t/api/integrations/openlca/import') as any);
    expect(res.status).toBe(401);
  });

  it('returns list of supported methods with seed counts', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    const res = await GET(new Request('http://t/api/integrations/openlca/import', {
      headers: { Authorization: 'Bearer x' },
    }) as any);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.methods).toBeInstanceOf(Array);
    expect(body.methods.find((m: any) => m.name === 'CML 2001')).toBeTruthy();
    expect(body.methods.find((m: any) => m.name === 'ReCiPe Midpoint (H)')).toBeTruthy();
    expect(body.methods.find((m: any) => m.name === 'TRACI 2.1')).toBeTruthy();
    expect(body.methods.length).toBeGreaterThanOrEqual(3);
  });
});
