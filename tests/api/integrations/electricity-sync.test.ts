import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/integrations/electricity/sync/route';
import * as sync from '@/lib/integrations/electricity-maps/sync';
import * as auth from '@/lib/auth';
import * as log from '@/lib/integrations/log';

vi.mock('@/lib/integrations/electricity-maps/sync');
vi.mock('@/lib/auth');
vi.mock('@/lib/integrations/log');

function req(body: any) {
  return new Request('http://t/api/integrations/electricity/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer x' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/integrations/electricity/sync', () => {
  beforeEach(() => vi.resetAllMocks());

  it('401 when unauth', async () => {
    vi.mocked(auth.requireAuth).mockRejectedValue(new Error('No authentication token provided'));
    const res = await POST(req({ zones: ['US-NY'] }) as any);
    expect(res.status).toBe(401);
  });

  it('400 on empty zones', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    const res = await POST(req({ zones: [] }) as any);
    expect(res.status).toBe(400);
  });

  it('syncs zones and returns results', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(sync.syncZoneFactor).mockResolvedValue({
      zone: 'US-NY', factorValue: 0.283, inserted: true,
    });
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(req({ zones: ['US-NY'] }) as any);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.results.length).toBe(1);
    expect(body.results[0].zone).toBe('US-NY');
    expect(log.logIntegration).toHaveBeenCalled();
  });

  it('reports errors in per-zone results without aborting the whole call', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(sync.syncZoneFactor)
      .mockResolvedValueOnce({ zone: 'US-NY', factorValue: 0.283, inserted: true })
      .mockRejectedValueOnce(new Error('fetch failed'));
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(req({ zones: ['US-NY', 'FR'] }) as any);
    const body = await res.json();
    expect(body.results.length).toBe(2);
    expect(body.results[0].zone).toBe('US-NY');
    expect(body.results[1].error).toBeTruthy();
  });
});
