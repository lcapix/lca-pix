import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/assessments/[runId]/export/route';
import * as auth from '@/lib/auth';
import * as db from '@/lib/db-helpers';

vi.mock('@/lib/auth');
vi.mock('@/lib/db-helpers');

const ctx = { params: Promise.resolve({ runId: '8' }) } as any;
const get = (query: string) =>
  GET(new Request(`http://t/api/assessments/8/export${query}`, { headers: { Authorization: 'Bearer x' } }) as any, ctx);

// EXP-7: an unknown format used to come back as a PDF.
describe('GET /api/assessments/:runId/export format', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
  });

  it.each(['xlsx', 'docx', 'pdf2', '<script>'])('400 for format=%s, before the run is read', async (format) => {
    const res = await get(`?format=${encodeURIComponent(format)}`);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/use pdf, pptx or csv/);
    expect(db.queryOne).not.toHaveBeenCalled();
  });

  it('accepts the known formats in any case (they reach the run lookup)', async () => {
    vi.mocked(db.queryOne).mockResolvedValue(null);
    for (const format of ['pdf', 'PPTX', 'csv', 'ppt']) {
      const res = await get(`?format=${format}`);
      expect(res.status).toBe(404);
    }
    // No format means PDF.
    expect((await get('')).status).toBe(404);
  });
});
