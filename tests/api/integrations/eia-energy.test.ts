import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/integrations/eia/fetch-energy-price/route';
import * as auth from '@/lib/auth';
import * as rates from '@/lib/integrations/cost-rates';
import * as log from '@/lib/integrations/log';

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

describe('POST /api/integrations/eia/fetch-energy-price', () => {
  beforeEach(() => vi.resetAllMocks());

  it('401 when unauth', async () => {
    vi.mocked(auth.requireAuth).mockRejectedValue(new Error('No authentication token provided'));
    const res = await POST(req({ fuel: 'electricity', state: 'NY' }) as any);
    expect(res.status).toBe(401);
  });

  it('400 when fuel is invalid', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    const res = await POST(req({ fuel: 'coal', state: 'NY' }) as any);
    expect(res.status).toBe(400);
  });

  it('fetches electricity rate and returns it', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(rates.getOrFetchRate).mockResolvedValue({
      rateValue: 0.128, unit: '$/kWh', source: 'EIA 2026-01', effectiveDate: '2026-01-01',
    });
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

  it('500 on fetch error, logs failure', async () => {
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
