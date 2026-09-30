import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/integrations/log/route';
import * as auth from '@/lib/auth';
import * as db from '@/lib/db-helpers';

vi.mock('@/lib/auth');
vi.mock('@/lib/db-helpers');

describe('GET /api/integrations/log', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('401 when unauth', async () => {
    vi.mocked(auth.requireAdmin).mockRejectedValue(new Error('No authentication token provided'));
    const res = await GET(new Request('http://t/') as any);
    expect(res.status).toBe(401);
  });

  it('403 for a non-admin, and the log is not read', async () => {
    vi.mocked(auth.requireAdmin).mockRejectedValue(new Error('Admin privileges required'));
    const res = await GET(new Request('http://t/') as any);
    expect(res.status).toBe(403);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('returns logs with limit and source filter', async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue(1);
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
    vi.mocked(auth.requireAdmin).mockResolvedValue(1);
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

  it.each([
    ['x', '20'],
    ['1.5', '20'],
    ['-5', '20'],
    ['0', '20'],
    ['100000', '200'],
    ['1e3', '20'],
    ['7', '7'],
  ])('limit=%s is clamped to a safe integer (%s) and bound as a placeholder', async (raw, expected) => {
    vi.mocked(auth.requireAdmin).mockResolvedValue(1);
    vi.mocked(db.query).mockResolvedValue([] as any);

    const res = await GET(new Request(`http://t/?limit=${raw}`) as any);
    expect(res.status).toBe(200);
    const [sql, params] = vi.mocked(db.query).mock.calls[0];
    expect(sql).toMatch(/LIMIT \?/);
    expect(sql).not.toMatch(/NaN/);
    expect(params![params!.length - 1]).toBe(expected);
  });

  it('500 with a generic message when the query fails', async () => {
    vi.mocked(auth.requireAdmin).mockResolvedValue(1);
    vi.mocked(db.query).mockRejectedValue(new Error("Unknown column 'details' in 'field list'"));

    const res = await GET(new Request('http://t/?limit=10') as any);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('Unknown column');
  });
});
