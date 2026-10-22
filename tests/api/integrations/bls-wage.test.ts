import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/integrations/bls/fetch-wage/route';
import * as auth from '@/lib/auth';
import * as rates from '@/lib/integrations/cost-rates';
import * as log from '@/lib/integrations/log';
import { MemoryRateLimitStore, setRateLimitStore } from '@/lib/rate-limit';

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

const RATE = { rateValue: 28.15, unit: '$/hr', source: 'BLS 2024', effectiveDate: '2024-05-01' };

describe('POST /api/integrations/bls/fetch-wage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setRateLimitStore(new MemoryRateLimitStore());
  });

  it('401 when unauth', async () => {
    vi.mocked(auth.requireAuth).mockRejectedValue(new Error('No authentication token provided'));
    const res = await POST(req({ occupation: '51-4121', state: 'NY' }) as any);
    expect(res.status).toBe(401);
    expect(rates.getOrFetchRate).not.toHaveBeenCalled();
  });

  it('401 for a deactivated account', async () => {
    vi.mocked(auth.requireAuth).mockRejectedValue(new Error('User account not found or inactive'));
    const res = await POST(req({ occupation: '51-4121', state: 'NY' }) as any);
    expect(res.status).toBe(401);
  });

  it('200 for any signed-in user (not only admins): the wage comes from BLS, not the caller', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(7);
    vi.mocked(auth.requireAdmin).mockRejectedValue(new Error('Admin privileges required'));
    vi.mocked(rates.getOrFetchRate).mockResolvedValue(RATE);
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(req({ occupation: '51-4121', state: 'NY' }) as any);
    expect(res.status).toBe(200);
    expect((await res.json()).rate.rateValue).toBe(28.15);
    expect(auth.requireAdmin).not.toHaveBeenCalled();
    expect(log.logIntegration).toHaveBeenCalledWith(expect.objectContaining({ executedBy: 7 }));
  });

  it.each([
    ['occupation not in OEWS format', { occupation: 'invalid', state: 'NY' }],
    ['occupation with extra text', { occupation: '51-4121; DROP', state: 'NY' }],
    ['state longer than 2 letters', { occupation: '51-4121', state: 'LONGSTATE' }],
    ['state that is not a US state', { occupation: '51-4121', state: 'ZZ' }],
    ['lower-case state', { occupation: '51-4121', state: 'ny' }],
    ['missing state', { occupation: '51-4121' }],
    ['extra keys', { occupation: '51-4121', state: 'NY', rateValue: 1 }],
  ])('400 for %s, and nothing is fetched', async (_label, body) => {
    vi.mocked(auth.requireAuth).mockResolvedValue(7);
    const res = await POST(req(body) as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/invalid/i);
    expect(json.issues).toBeUndefined();
    expect(rates.getOrFetchRate).not.toHaveBeenCalled();
  });

  it('accepts the national code US', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(7);
    vi.mocked(rates.getOrFetchRate).mockResolvedValue(RATE);
    const res = await POST(req({ occupation: '51-4121', state: 'US' }) as any);
    expect(res.status).toBe(200);
  });

  it('429 on the 61st lookup in an hour for one user; another user is unaffected', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(7);
    vi.mocked(rates.getOrFetchRate).mockResolvedValue(RATE);
    for (let i = 0; i < 60; i++) {
      const ok = await POST(req({ occupation: '51-4121', state: 'NY' }) as any);
      expect(ok.status).toBe(200);
    }
    const limited = await POST(req({ occupation: '51-4121', state: 'NY' }) as any);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBeTruthy();
    expect(rates.getOrFetchRate).toHaveBeenCalledTimes(60);

    vi.mocked(auth.requireAuth).mockResolvedValue(8);
    const other = await POST(req({ occupation: '51-4121', state: 'NY' }) as any);
    expect(other.status).toBe(200);
  });

  it('returns rate from getOrFetchRate on success', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(rates.getOrFetchRate).mockResolvedValue(RATE);
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

  it('500 hides the internal error from the client (bls)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(rates.getOrFetchRate).mockRejectedValue(new Error('connect ETIMEDOUT lca-dev-db.internal:3306'));
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(req({ occupation: '51-4121', state: 'NY' }) as any);
    expect(res.status).toBe(500);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain('ETIMEDOUT');
    expect(text).not.toContain('lca-dev-db');
    expect(log.logIntegration).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('still answers with a generic 500 when writing the failure log also fails (bls)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(rates.getOrFetchRate).mockRejectedValue(new Error('connect ETIMEDOUT lca-dev-db.internal:3306'));
    vi.mocked(log.logIntegration).mockRejectedValue(new Error('log table missing'));

    const res = await POST(req({ occupation: '51-4121', state: 'NY' }) as any);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/ETIMEDOUT|log table missing/);
  });

  it('logs + returns 500 when fetch throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
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
