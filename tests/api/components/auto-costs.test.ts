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

const ctx = (componentId = '42') => ({ params: Promise.resolve({ componentId }) }) as any;

describe('POST /api/components/:id/auto-costs', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('401 unauth', async () => {
    vi.mocked(auth.requireAuth).mockRejectedValue(new Error('No authentication token provided'));
    const res = await POST(req() as any, ctx());
    expect(res.status).toBe(401);
    expect(ap.autoPopulateCosts).not.toHaveBeenCalled();
  });

  it('403 when the caller is a viewer on the component\'s project, and writes nothing', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(2);
    vi.mocked(db.queryOne).mockResolvedValue({ project_id: 7 } as any);
    // A viewer: a member, but below editor.
    vi.mocked(auth.checkProjectAccess).mockImplementation(async (_u, _p, level) => !level || level === 'viewer');

    const res = await POST(req() as any, ctx());
    expect(res.status).toBe(403);
    expect(auth.checkProjectAccess).toHaveBeenCalledWith(2, 7, 'editor');
    expect(ap.autoPopulateCosts).not.toHaveBeenCalled();
  });

  it('404 "Component not found" for a non-member, the same as an unknown id, and writes nothing', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(2);
    vi.mocked(db.queryOne).mockResolvedValue({ project_id: 7 } as any);
    vi.mocked(auth.checkProjectAccess).mockResolvedValue(false);

    const res = await POST(req() as any, ctx());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Component not found' });
    expect(ap.autoPopulateCosts).not.toHaveBeenCalled();
  });

  it('resolves the project through component -> case_table', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(2);
    vi.mocked(db.queryOne).mockResolvedValue({ project_id: 7 } as any);
    vi.mocked(auth.checkProjectAccess).mockResolvedValue(false);

    await POST(req() as any, ctx());
    const [sql, params] = vi.mocked(db.queryOne).mock.calls[0];
    expect(sql).toMatch(/case_table/);
    expect(sql).toMatch(/component_id = \?/);
    expect(params).toEqual([42]);
  });

  it('generic 404 for an unknown component, without calling autoPopulate', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(2);
    vi.mocked(db.queryOne).mockResolvedValue(null);

    const res = await POST(req() as any, ctx('999'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Component not found');
    expect(ap.autoPopulateCosts).not.toHaveBeenCalled();
    expect(auth.checkProjectAccess).not.toHaveBeenCalled();
  });

  it('404 for a non-numeric component id, without touching the database', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(2);
    const res = await POST(req() as any, ctx('abc'));
    expect(res.status).toBe(404);
    expect(db.queryOne).not.toHaveBeenCalled();
    expect(ap.autoPopulateCosts).not.toHaveBeenCalled();
  });

  it('runs autoPopulate and returns result for an editor', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(db.queryOne).mockResolvedValue({ project_id: 7 } as any);
    vi.mocked(auth.checkProjectAccess).mockResolvedValue(true);
    vi.mocked(ap.autoPopulateCosts).mockResolvedValue({ laborSet: true, energySet: true, totalsSet: 2 });
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(req() as any, ctx());
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.totalsSet).toBe(2);
    expect(ap.autoPopulateCosts).toHaveBeenCalledWith(42);
  });

  it('500 on failure with a generic message (no raw err.message), logs failed', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(db.queryOne).mockResolvedValue({ project_id: 7 } as any);
    vi.mocked(auth.checkProjectAccess).mockResolvedValue(true);
    vi.mocked(ap.autoPopulateCosts).mockRejectedValue(new Error('connect ETIMEDOUT secret-host'));
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(req() as any, ctx());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain('ETIMEDOUT');
    expect(log.logIntegration).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });
});
