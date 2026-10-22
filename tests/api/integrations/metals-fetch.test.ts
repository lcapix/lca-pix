import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/integrations/metals/fetch-price/route';
import * as auth from '@/lib/auth';
import * as rates from '@/lib/integrations/cost-rates';
import * as log from '@/lib/integrations/log';
import { MemoryRateLimitStore, setRateLimitStore } from '@/lib/rate-limit';

vi.mock('@/lib/auth');
vi.mock('@/lib/integrations/cost-rates');
vi.mock('@/lib/integrations/log');

function req(body: any) {
  return new Request('http://t/api/integrations/metals/fetch-price', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer x' },
    body: JSON.stringify(body),
  });
}

const RATE = { rateValue: 2.45, unit: '$/kg', source: 'Metals-API 2026-04-13', effectiveDate: '2026-04-13' };

describe('POST /api/integrations/metals/fetch-price', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setRateLimitStore(new MemoryRateLimitStore());
  });

  it('401 unauth', async () => {
    vi.mocked(auth.requireAuth).mockRejectedValue(new Error('No authentication token provided'));
    const res = await POST(req({ symbol: 'ALU' }) as any);
    expect(res.status).toBe(401);
    expect(rates.getOrFetchRate).not.toHaveBeenCalled();
  });

  it('200 for any signed-in user (not only admins)', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(7);
    vi.mocked(auth.requireAdmin).mockRejectedValue(new Error('Admin privileges required'));
    vi.mocked(rates.getOrFetchRate).mockResolvedValue(RATE);
    const res = await POST(req({ symbol: 'XCU' }) as any);
    expect(res.status).toBe(200);
    expect(auth.requireAdmin).not.toHaveBeenCalled();
  });

  it.each([
    ['unknown symbol', { symbol: 'nope' }],
    ['a precious metal outside the list', { symbol: 'XAU' }],
    ['lower-case symbol', { symbol: 'alu' }],
    ['missing symbol', {}],
    ['extra keys', { symbol: 'ALU', rateValue: 1 }],
  ])('400 for %s, and nothing is fetched', async (_label, body) => {
    vi.mocked(auth.requireAuth).mockResolvedValue(7);
    const res = await POST(req(body) as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid/i);
    expect(JSON.stringify(json)).not.toContain('nope');
    expect(rates.getOrFetchRate).not.toHaveBeenCalled();
  });

  it('429 on the 61st lookup in an hour', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(7);
    vi.mocked(rates.getOrFetchRate).mockResolvedValue(RATE);
    for (let i = 0; i < 60; i++) {
      expect((await POST(req({ symbol: 'ALU' }) as any)).status).toBe(200);
    }
    const limited = await POST(req({ symbol: 'ALU' }) as any);
    expect(limited.status).toBe(429);
    expect(rates.getOrFetchRate).toHaveBeenCalledTimes(60);
  });

  it('returns rate from cache via getOrFetchRate', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(rates.getOrFetchRate).mockResolvedValue(RATE);
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(req({ symbol: 'ALU' }) as any);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.rate.rateValue).toBe(2.45);

    const arg = vi.mocked(rates.getOrFetchRate).mock.calls[0][0];
    expect(arg.type).toBe('material');
    expect(arg.key).toBe('ALU');
    expect(arg.region).toBe('Global');
  });

  it('500 hides the internal error from the client (metals)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(rates.getOrFetchRate).mockRejectedValue(new Error('connect ETIMEDOUT lca-dev-db.internal:3306'));
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(req({ symbol: 'ALU' }) as any);
    expect(res.status).toBe(500);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain('ETIMEDOUT');
    expect(text).not.toContain('lca-dev-db');
    expect(log.logIntegration).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('still answers with a generic 500 when writing the failure log also fails (metals)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(rates.getOrFetchRate).mockRejectedValue(new Error('connect ETIMEDOUT lca-dev-db.internal:3306'));
    vi.mocked(log.logIntegration).mockRejectedValue(new Error('log table missing'));

    const res = await POST(req({ symbol: 'ALU' }) as any);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/ETIMEDOUT|log table missing/);
  });

  it('500 on fetch failure, logs failed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(rates.getOrFetchRate).mockRejectedValue(new Error('metals api down'));
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(req({ symbol: 'ALU' }) as any);
    expect(res.status).toBe(500);
    expect(log.logIntegration).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'metals', status: 'failed' })
    );
  });
});
