import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/integrations/eia/fetch-energy-price/route';
import * as auth from '@/lib/auth';
import * as rates from '@/lib/integrations/cost-rates';
import * as log from '@/lib/integrations/log';
import { MemoryRateLimitStore, setRateLimitStore } from '@/lib/rate-limit';

vi.mock('@/lib/auth');
vi.mock('@/lib/integrations/cost-rates');
vi.mock('@/lib/integrations/log');

function req(body: any) {
  return new Request('http://t/api/integrations/eia/fetch-energy-price', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer x' },
    body: JSON.stringify(body),
  });
}

const RATE = { rateValue: 0.128, unit: '$/kWh', source: 'EIA 2026-01', effectiveDate: '2026-01-01' };

describe('POST /api/integrations/eia/fetch-energy-price', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setRateLimitStore(new MemoryRateLimitStore());
  });

  it('401 when unauth', async () => {
    vi.mocked(auth.requireAuth).mockRejectedValue(new Error('No authentication token provided'));
    const res = await POST(req({ fuel: 'electricity', state: 'NY' }) as any);
    expect(res.status).toBe(401);
    expect(rates.getOrFetchRate).not.toHaveBeenCalled();
  });

  it('200 for any signed-in user (not only admins)', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(7);
    vi.mocked(auth.requireAdmin).mockRejectedValue(new Error('Admin privileges required'));
    vi.mocked(rates.getOrFetchRate).mockResolvedValue(RATE);
    const res = await POST(req({ fuel: 'electricity', state: 'NY' }) as any);
    expect(res.status).toBe(200);
    expect(auth.requireAdmin).not.toHaveBeenCalled();
  });

  it('accepts the national code US (the component form sends it)', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(7);
    vi.mocked(rates.getOrFetchRate).mockResolvedValue(RATE);
    const res = await POST(req({ fuel: 'electricity', state: 'US' }) as any);
    expect(res.status).toBe(200);
  });

  it.each([
    ['fuel not in the list', { fuel: 'coal', state: 'NY' }],
    ['state not a US state', { fuel: 'electricity', state: 'ZZ' }],
    ['state too long', { fuel: 'electricity', state: 'NYC' }],
    ['sector not in the list', { fuel: 'electricity', state: 'NY', sector: 'TRA' }],
    ['sector in lower case', { fuel: 'electricity', state: 'NY', sector: 'ind' }],
    ['extra keys', { fuel: 'electricity', state: 'NY', rateValue: 9 }],
  ])('400 for %s, and nothing is fetched', async (_label, body) => {
    vi.mocked(auth.requireAuth).mockResolvedValue(7);
    const res = await POST(req(body) as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid/i);
    expect(json.issues).toBeUndefined();
    expect(rates.getOrFetchRate).not.toHaveBeenCalled();
  });

  it('429 on the 61st lookup in an hour', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(7);
    vi.mocked(rates.getOrFetchRate).mockResolvedValue(RATE);
    for (let i = 0; i < 60; i++) {
      expect((await POST(req({ fuel: 'electricity', state: 'NY' }) as any)).status).toBe(200);
    }
    const limited = await POST(req({ fuel: 'electricity', state: 'NY' }) as any);
    expect(limited.status).toBe(429);
    expect(rates.getOrFetchRate).toHaveBeenCalledTimes(60);
  });

  it('fetches electricity rate and returns it', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(rates.getOrFetchRate).mockResolvedValue(RATE);
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(req({ fuel: 'electricity', state: 'NY' }) as any);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.rate.rateValue).toBe(0.128);

    const arg = vi.mocked(rates.getOrFetchRate).mock.calls[0][0];
    expect(arg.type).toBe('electricity');
    expect(arg.region).toBe('NY');
  });

  it('fetches natural gas rate and returns it', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(rates.getOrFetchRate).mockResolvedValue({
      rateValue: 10.50, unit: '$/MCF', source: 'EIA 2026-01', effectiveDate: '2026-01-01',
    });
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(req({ fuel: 'natural_gas', state: 'NY' }) as any);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.rate.unit).toBe('$/MCF');
    const arg = vi.mocked(rates.getOrFetchRate).mock.calls[0][0];
    expect(arg.type).toBe('natural_gas');
  });

  it('500 hides the internal error from the client (eia)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(rates.getOrFetchRate).mockRejectedValue(new Error('connect ETIMEDOUT lca-dev-db.internal:3306'));
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(req({ fuel: 'electricity', state: 'NY' }) as any);
    expect(res.status).toBe(500);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain('ETIMEDOUT');
    expect(text).not.toContain('lca-dev-db');
    expect(log.logIntegration).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('still answers with a generic 500 when writing the failure log also fails (eia)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(rates.getOrFetchRate).mockRejectedValue(new Error('connect ETIMEDOUT lca-dev-db.internal:3306'));
    vi.mocked(log.logIntegration).mockRejectedValue(new Error('log table missing'));

    const res = await POST(req({ fuel: 'electricity', state: 'NY' }) as any);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/ETIMEDOUT|log table missing/);
  });

  it('500 on fetch error, logs failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(rates.getOrFetchRate).mockRejectedValue(new Error('EIA down'));
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(req({ fuel: 'electricity', state: 'NY' }) as any);
    expect(res.status).toBe(500);
    expect(log.logIntegration).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'eia', status: 'failed' })
    );
  });
});
