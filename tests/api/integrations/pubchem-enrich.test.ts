import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/integrations/pubchem/enrich/route';
import * as enrich from '@/lib/integrations/pubchem/enrich';
import * as auth from '@/lib/auth';
import * as log from '@/lib/integrations/log';
import { MemoryRateLimitStore, setRateLimitStore } from '@/lib/rate-limit';

vi.mock('@/lib/integrations/pubchem/enrich');
vi.mock('@/lib/auth');
vi.mock('@/lib/integrations/log');

function mkRequest(body: any): Request {
  return new Request('http://test/api/integrations/pubchem/enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer x' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/integrations/pubchem/enrich', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setRateLimitStore(new MemoryRateLimitStore());
  });

  it('stays admin-only after the rate lookups reopened', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(7);
    vi.mocked(auth.requireAdmin).mockRejectedValue(new Error('Admin privileges required'));
    const res = await POST(mkRequest({ substance_id: 5 }) as any);
    expect(res.status).toBe(403);
    expect(enrich.enrichSubstance).not.toHaveBeenCalled();
  });

  it('429 on the 6th enrichment in an hour for one admin, before PubChem is called', async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue(1);
    vi.mocked(enrich.enrichSubstance).mockResolvedValue({ status: 'enriched', cid: 297 });
    vi.mocked(log.logIntegration).mockResolvedValue(1);
    for (let i = 0; i < 5; i++) {
      expect((await POST(mkRequest({ substance_id: 5 }) as any)).status).toBe(200);
    }
    const limited = await POST(mkRequest({ substance_id: 5 }) as any);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBeTruthy();
    expect(enrich.enrichSubstance).toHaveBeenCalledTimes(5);

    vi.mocked(auth.requireAdmin).mockResolvedValue(2);
    expect((await POST(mkRequest({ substance_id: 5 }) as any)).status).toBe(200);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth.requireAdmin).mockRejectedValue(new Error('No authentication token provided'));
    const res = await POST(mkRequest({}) as any);
    expect(res.status).toBe(401);
  });

  it('403 for a non-admin, and nothing is enriched', async () => {
    vi.mocked(auth.requireAdmin).mockRejectedValue(new Error('Admin privileges required'));
    const res = await POST(mkRequest({}) as any);
    expect(res.status).toBe(403);
    expect(enrich.enrichAllSubstances).not.toHaveBeenCalled();
    expect(enrich.enrichSubstance).not.toHaveBeenCalled();
  });


  it('500 hides the internal error from the client (pubchem)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(auth.requireAdmin).mockResolvedValue(1);
    vi.mocked(enrich.enrichSubstance).mockRejectedValue(new Error('connect ETIMEDOUT lca-dev-db.internal:3306'));
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(mkRequest({ substance_id: 5 }) as any);
    expect(res.status).toBe(500);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain('ETIMEDOUT');
    expect(text).not.toContain('lca-dev-db');
    expect(log.logIntegration).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('still answers with a generic 500 when writing the failure log also fails (pubchem)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(auth.requireAdmin).mockResolvedValue(1);
    vi.mocked(enrich.enrichSubstance).mockRejectedValue(new Error('connect ETIMEDOUT lca-dev-db.internal:3306'));
    vi.mocked(log.logIntegration).mockRejectedValue(new Error('log table missing'));

    const res = await POST(mkRequest({ substance_id: 5 }) as any);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/ETIMEDOUT|log table missing/);
  });
  it('enriches a single substance when substance_id provided', async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue(1);
    vi.mocked(enrich.enrichSubstance).mockResolvedValue({ status: 'enriched', cid: 297 });
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(mkRequest({ substance_id: 5 }) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.result.status).toBe('enriched');
  });

  it('passes a bounded default limit when none is given', async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue(1);
    vi.mocked(enrich.enrichAllSubstances).mockResolvedValue({ enriched: 0, notFound: 0, failed: 0, total: 0 });
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    await POST(mkRequest({}) as any);
    expect(enrich.enrichAllSubstances).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }));
  });

  it('400 when limit is over 500', async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue(1);
    const res = await POST(mkRequest({ limit: 501 }) as any);
    expect(res.status).toBe(400);
    expect(enrich.enrichAllSubstances).not.toHaveBeenCalled();
  });

  it('enriches all when no substance_id', async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue(1);
    vi.mocked(enrich.enrichAllSubstances).mockResolvedValue({
      enriched: 40, notFound: 2, failed: 0, total: 42,
    });
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(mkRequest({}) as any);
    const body = await res.json();
    expect(body.summary.enriched).toBe(40);
    expect(body.summary.total).toBe(42);
  });
});
