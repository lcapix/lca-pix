import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/integrations/log/route';
import * as auth from '@/lib/auth';
import * as db from '@/lib/db-helpers';

vi.mock('@/lib/auth');
vi.mock('@/lib/db-helpers');

describe('GET /api/integrations/log', () => {
  beforeEach(() => vi.resetAllMocks());

  it('401 when unauth', async () => {
    vi.mocked(auth.requireAuth).mockRejectedValue(new Error('No authentication token provided'));
    const res = await GET(new Request('http://t/') as any);
    expect(res.status).toBe(401);
  });

  it('returns logs with limit and source filter', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(db.query).mockResolvedValue([
      { log_id: 1, source: 'pubchem', action: 'enrich_all', records_affected: 40, status: 'success', executed_at: '2026-04-13', details: null },
    ] as any);

    const res = await GET(new Request('http://t/?source=pubchem&limit=10') as any);
    const body = await res.json();
    expect(body.logs.length).toBe(1);
    expect(body.logs[0].source).toBe('pubchem');

    const sql = vi.mocked(db.query).mock.calls[0][0];
    expect(sql).toContain('WHERE source = ?');
  });

  it('returns logs without source filter', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(db.query).mockResolvedValue([
      { log_id: 2, source: 'openlca', action: 'import_method', records_affected: 48, status: 'success', executed_at: '2026-04-13', details: null },
      { log_id: 1, source: 'pubchem', action: 'enrich_substance', records_affected: 1, status: 'success', executed_at: '2026-04-13', details: null },
    ] as any);

    const res = await GET(new Request('http://t/?limit=20') as any);
    const body = await res.json();
    expect(body.logs.length).toBe(2);
    const sql = vi.mocked(db.query).mock.calls[0][0];
    expect(sql).not.toContain('WHERE');  // no filter when source omitted
  });
});
