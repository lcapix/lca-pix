import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/components/[componentId]/auto-costs/route';
import * as auth from '@/lib/auth';
import * as ap from '@/lib/costs/auto-populate';
import * as log from '@/lib/integrations/log';
import * as db from '@/lib/db-helpers';

vi.mock('@/lib/auth');
vi.mock('@/lib/costs/auto-populate');
vi.mock('@/lib/integrations/log');
vi.mock('@/lib/db-helpers');

function req() {
  return new Request('http://t/api/components/42/auto-costs', {
    method: 'POST',
    headers: { Authorization: 'Bearer x' },
  });
}

describe('POST /api/components/:id/auto-costs', () => {
  beforeEach(() => vi.resetAllMocks());

  it('401 unauth', async () => {
    vi.mocked(auth.requireAuth).mockRejectedValue(new Error('No authentication token provided'));
    const res = await POST(req() as any, { params: Promise.resolve({ componentId: '42' }) } as any);
    expect(res.status).toBe(401);
  });

  it('runs autoPopulate and returns result', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(ap.autoPopulateCosts).mockResolvedValue({ laborSet: true, energySet: true, totalsSet: 2 });
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(req() as any, { params: Promise.resolve({ componentId: '42' }) } as any);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.totalsSet).toBe(2);
  });

  it('500 on failure, logs failed', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(ap.autoPopulateCosts).mockRejectedValue(new Error('boom'));
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(req() as any, { params: Promise.resolve({ componentId: '42' }) } as any);
    expect(res.status).toBe(500);
  });
});
