import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/integrations/bls/fetch-wage/route';
import * as auth from '@/lib/auth';
import * as rates from '@/lib/integrations/cost-rates';
import * as log from '@/lib/integrations/log';

vi.mock('@/lib/auth');
vi.mock('@/lib/integrations/cost-rates');
vi.mock('@/lib/integrations/log');

function req(body: any) {
  return new Request('http://t/api/integrations/bls/fetch-wage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer x' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/integrations/bls/fetch-wage', () => {
  beforeEach(() => vi.resetAllMocks());

  it('401 when unauth', async () => {
    vi.mocked(auth.requireAuth).mockRejectedValue(new Error('No authentication token provided'));
    const res = await POST(req({ occupation: '51-4121', state: 'NY' }) as any);
    expect(res.status).toBe(401);
  });

  it('400 when occupation is not the right shape', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    const res = await POST(req({ occupation: 'invalid', state: 'NY' }) as any);
    expect(res.status).toBe(400);
  });

  it('400 when state is not 2 letters or US', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    const res = await POST(req({ occupation: '51-4121', state: 'LONGSTATE' }) as any);
    expect(res.status).toBe(400);
  });

  it('returns rate from getOrFetchRate on success', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(rates.getOrFetchRate).mockResolvedValue({
      rateValue: 28.15, unit: '$/hr', source: 'BLS 2024', effectiveDate: '2024-05-01',
    });
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(req({ occupation: '51-4121', state: 'NY' }) as any);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.rate.rateValue).toBe(28.15);

    // Confirm the fetcher was wired with type='labor', key=occupation, region=state
    const arg = vi.mocked(rates.getOrFetchRate).mock.calls[0][0];
    expect(arg.type).toBe('labor');
    expect(arg.key).toBe('51-4121');
    expect(arg.region).toBe('NY');
    expect(typeof arg.fetcher).toBe('function');
  });

  it('logs + returns 500 when fetch throws', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(rates.getOrFetchRate).mockRejectedValue(new Error('BLS error 500'));
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(req({ occupation: '51-4121', state: 'NY' }) as any);
    expect(res.status).toBe(500);
    expect(log.logIntegration).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'bls', status: 'failed' })
    );
  });
});
