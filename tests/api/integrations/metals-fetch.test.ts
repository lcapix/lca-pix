import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/integrations/metals/fetch-price/route';
import * as auth from '@/lib/auth';
import * as rates from '@/lib/integrations/cost-rates';
import * as log from '@/lib/integrations/log';

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

describe('POST /api/integrations/metals/fetch-price', () => {
  beforeEach(() => vi.resetAllMocks());

  it('401 unauth', async () => {
    vi.mocked(auth.requireAuth).mockRejectedValue(new Error('No authentication token provided'));
    const res = await POST(req({ symbol: 'ALU' }) as any);
    expect(res.status).toBe(401);
  });

  it('400 on invalid symbol', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    const res = await POST(req({ symbol: 'nope' }) as any);
    expect(res.status).toBe(400);
  });

  it('returns rate from cache via getOrFetchRate', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(rates.getOrFetchRate).mockResolvedValue({
      rateValue: 2.45, unit: '$/kg',
      source: 'Metals-API 2026-04-13', effectiveDate: '2026-04-13',
    });
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

  it('500 on fetch failure, logs failed', async () => {
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
