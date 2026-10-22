import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import { GET, POST, DELETE } from '@/app/api/cases/[caseId]/documents/route';
import * as auth from '@/lib/auth';
import * as db from '@/lib/db-helpers';

vi.mock('@/lib/auth');
vi.mock('@/lib/db-helpers');

const ctx = { params: Promise.resolve({ caseId: '5' }) };
const URL_ = 'http://t/api/cases/5/documents';

function upload(file: File, fields: Record<string, string> = {}, headers: Record<string, string> = {}) {
  const fd = new FormData();
  fd.append('file', file);
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return new NextRequest(URL_, { method: 'POST', body: fd, headers: { authorization: 'Bearer x', ...headers } });
}

const csv = () => new File(['Part,Mass (kg)\nFrame,2.1\nFork,0.9\n'], 'bom.csv', { type: 'text/csv' });

/** A member whose role is `viewer`: passes member-level checks, fails editor. */
function asViewer() {
  vi.mocked(auth.checkProjectAccess).mockImplementation(async (_u, _p, level) => !level || level === 'viewer');
}
function asEditor() {
  vi.mocked(auth.checkProjectAccess).mockResolvedValue(true);
}

describe('/api/cases/:caseId/documents', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(db.queryOne).mockResolvedValue({ project_id: 9 } as any);
    vi.mocked(db.query).mockResolvedValue([] as any);
    vi.mocked(db.insert).mockResolvedValue(77);
  });

  describe('permissions (M2, DOC-1)', () => {
    it('viewers can list documents', async () => {
      asViewer();
      const res = await GET(new NextRequest(URL_, { headers: { authorization: 'Bearer x' } }), ctx);
      expect(res.status).toBe(200);
    });

    it('viewers cannot attach documents', async () => {
      asViewer();
      const res = await POST(upload(csv()), ctx);
      expect(res.status).toBe(403);
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('viewers cannot delete documents', async () => {
      asViewer();
      const res = await DELETE(new NextRequest(`${URL_}?id=3`, { method: 'DELETE' }), ctx);
      expect(res.status).toBe(403);
      expect(db.execute).not.toHaveBeenCalled();
    });

    it('checks editor level for writes', async () => {
      asEditor();
      await POST(upload(csv()), ctx);
      expect(auth.checkProjectAccess).toHaveBeenCalledWith(1, 9, 'editor');
    });
  });

  describe('upload limits (M6, DOC-2)', () => {
    beforeEach(asEditor);

    it('413 from Content-Length alone, with a message about splitting and the hosted limit', async () => {
      const res = await POST(upload(csv(), {}, { 'content-length': String(13 * 1024 * 1024) }), ctx);
      expect(res.status).toBe(413);
      const { error } = await res.json();
      expect(error).toMatch(/12 MB/);
      expect(error).toMatch(/4\.5 MB/);
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('413 for an oversized file even without a usable Content-Length', async () => {
      const big = new File([new Uint8Array(12 * 1024 * 1024 + 10).fill(0x41)], 'big.csv');
      const res = await POST(upload(big), ctx);
      expect(res.status).toBe(413);
    });

    it('415 for a type outside the allowlist', async () => {
      const docx = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])], 'notes.docx');
      const res = await POST(upload(docx), ctx);
      expect(res.status).toBe(415);
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('415 when the bytes do not match the extension', async () => {
      const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])], 'image.csv');
      const res = await POST(upload(png), ctx);
      expect(res.status).toBe(415);
    });

    it('400 for a doc_type longer than the column', async () => {
      const res = await POST(upload(csv(), { doc_type: 'x'.repeat(65) }), ctx);
      expect(res.status).toBe(400);
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('stores a CSV as text', async () => {
      const res = await POST(upload(csv(), { doc_type: 'bom' }), ctx);
      expect(res.status).toBe(200);
      const [, params] = vi.mocked(db.insert).mock.calls[0];
      expect(params![1]).toBe('bom.csv');
      expect(params![2]).toBe('bom');
      expect(String(params![3])).toContain('Frame');
    });

    it('stores an xlsx workbook as rows', async () => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Part', 'Mass (kg)'], ['Frame', 2]]), 'BOM');
      const buf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const res = await POST(upload(new File([new Uint8Array(buf)], 'bom.xlsx')), ctx);
      expect(res.status).toBe(200);
      expect(String(vi.mocked(db.insert).mock.calls[0][1]![3])).toContain('Frame');
    });
  });

  describe('DELETE', () => {
    beforeEach(asEditor);

    it('404 when the document does not exist in this case', async () => {
      vi.mocked(db.execute).mockResolvedValue(0);
      const res = await DELETE(new NextRequest(`${URL_}?id=999`, { method: 'DELETE' }), ctx);
      expect(res.status).toBe(404);
    });

    it('deletes an existing document', async () => {
      vi.mocked(db.execute).mockResolvedValue(1);
      const res = await DELETE(new NextRequest(`${URL_}?id=3`, { method: 'DELETE' }), ctx);
      expect(res.status).toBe(200);
      expect(vi.mocked(db.execute).mock.calls[0][1]).toEqual([3, 5]);
    });

    it('400 for a non-numeric id', async () => {
      const res = await DELETE(new NextRequest(`${URL_}?id=abc`, { method: 'DELETE' }), ctx);
      expect(res.status).toBe(400);
    });
  });
});
