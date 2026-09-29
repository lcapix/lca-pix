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
    vi.mocked(auth.requireAdmin).mockRejectedValue(new Error('No authentication token provided'));
    const res = await POST(req({ zones: ['FR'] }) as any);
    expect(res.status).toBe(401);
  });

  it('403 for a non-admin, and no zone is synced', async () => {
    vi.mocked(auth.requireAdmin).mockRejectedValue(new Error('Admin privileges required'));
    const res = await POST(req({ zones: ['FR'] }) as any);
    expect(res.status).toBe(403);
    expect(sync.syncZoneFactor).not.toHaveBeenCalled();
  });

  it('400 on empty zones', async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue(1);
    const res = await POST(req({ zones: [] }) as any);
    expect(res.status).toBe(400);
  });

  it.each([['XX'], ['US-NY; DROP TABLE x'], ['Mars']])('400 on zone %s that is not on the allowlist', async (zone) => {
    vi.mocked(auth.requireAdmin).mockResolvedValue(1);
    const res = await POST(req({ zones: [zone] }) as any);
    expect(res.status).toBe(400);
    expect(sync.syncZoneFactor).not.toHaveBeenCalled();
  });

  it('400 on a single `zone` that is not on the allowlist', async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue(1);
    const res = await POST(req({ zone: 'Global; x' }) as any);
    expect(res.status).toBe(400);
    expect(sync.syncZoneFactor).not.toHaveBeenCalled();
  });

  it('400 on an unsupported method', async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue(1);
    const res = await POST(req({ zones: ['FR'], method: 'QUARANTINE: CML 2001' }) as any);
    expect(res.status).toBe(400);
    expect(sync.syncZoneFactor).not.toHaveBeenCalled();
  });

  it('success:false when every zone fails', async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue(1);
    vi.mocked(sync.syncZoneFactor).mockRejectedValue(new Error('ER_LOCK_WAIT_TIMEOUT'));
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(req({ zones: ['FR', 'DE'] }) as any);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(log.logIntegration).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('syncs zones and returns results', async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue(1);
    vi.mocked(sync.syncZoneFactor).mockResolvedValue({
      zone: 'FR', factorValue: 0.056, inserted: true,
      source: 'live', sourceRef: 'Electricity Maps API 2026-09-11',
    });
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(req({ zones: ['FR'] }) as any);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.results.length).toBe(1);
    expect(body.results[0].zone).toBe('FR');
    expect(log.logIntegration).toHaveBeenCalled();
  });

  it('reports errors in per-zone results without aborting the whole call', async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue(1);
    vi.mocked(sync.syncZoneFactor)
      .mockResolvedValueOnce({ zone: 'DE', factorValue: 0.38, inserted: true, source: 'live', sourceRef: 'Electricity Maps API 2026-09-11' })
      .mockRejectedValueOnce(new Error('fetch failed'));
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(req({ zones: ['DE', 'FR'] }) as any);
    const body = await res.json();
    expect(body.results.length).toBe(2);
    expect(body.success).toBe(true);
    expect(body.results[0].zone).toBe('DE');
    expect(body.results[1].error).toBeTruthy();
  });
});
