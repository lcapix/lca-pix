import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/integrations/pubchem/enrich/route';
import * as enrich from '@/lib/integrations/pubchem/enrich';
import * as auth from '@/lib/auth';
import * as log from '@/lib/integrations/log';

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
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth.requireAuth).mockRejectedValue(new Error('No authentication token provided'));
    const res = await POST(mkRequest({}) as any);
    expect(res.status).toBe(401);
  });

  it('enriches a single substance when substance_id provided', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(enrich.enrichSubstance).mockResolvedValue({ status: 'enriched', cid: 297 });
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(mkRequest({ substance_id: 5 }) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.result.status).toBe('enriched');
  });

  it('enriches all when no substance_id', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
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
