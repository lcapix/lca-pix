import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/ingest/preview/route';
import * as auth from '@/lib/auth';
import * as db from '@/lib/db-helpers';
import { MemoryRateLimitStore, setRateLimitStore } from '@/lib/rate-limit';

vi.mock('@/lib/auth');
vi.mock('@/lib/db-helpers');

const BOM = 'Part,Material,Mass (kg)\nFrame,Aluminum,2.1\nFork,Steel,0.9\n';

function upload(file: File, fields: Record<string, string> = { connector: 'bom' }, headers: Record<string, string> = {}) {
  const fd = new FormData();
  fd.append('file', file);
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return new NextRequest('http://t/api/ingest/preview', {
    method: 'POST',
    body: fd,
    headers: { authorization: 'Bearer x', ...headers },
  });
}

describe('POST /api/ingest/preview limits (M6, ING-3, H5)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(auth.requireAuth).mockResolvedValue(3);
    vi.mocked(db.query).mockResolvedValue([] as any);
    setRateLimitStore(new MemoryRateLimitStore());
  });

  it('previews a small BOM', async () => {
    const res = await POST(upload(new File([BOM], 'bom.csv')));
    expect(res.status).toBe(200);
    expect((await res.json()).plan).toBeDefined();
  });

  it('413 from Content-Length before the body is parsed, with a clear message', async () => {
    const res = await POST(upload(new File([BOM], 'bom.csv'), undefined, { 'content-length': String(40 * 1024 * 1024) }));
    expect(res.status).toBe(413);
    const { error } = await res.json();
    expect(error).toMatch(/12 MB/);
    expect(error).toMatch(/split/i);
    expect(error).toMatch(/4\.5 MB/);
  });

  it('413 for an oversized body without a usable Content-Length', async () => {
    const big = new File([new Uint8Array(12 * 1024 * 1024 + 100).fill(0x41)], 'bom.csv');
    expect((await POST(upload(big))).status).toBe(413);
  });

  it('415 for a disallowed type or bytes that do not match the extension', async () => {
    const docx = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0])], 'routing.docx');
    expect((await POST(upload(docx, { connector: 'routing' }))).status).toBe(415);
    const fakePdf = new File(['not really a pdf, just some text here'], 'sds.pdf');
    expect((await POST(upload(fakePdf, { connector: 'sds' }))).status).toBe(415);
  });

  it('allows 10 previews per user per hour, then 429 with Retry-After', async () => {
    for (let i = 0; i < 10; i++) {
      const r = await POST(upload(new File([BOM], 'bom.csv')));
      expect(r.status).toBe(200);
    }
    const res = await POST(upload(new File([BOM], 'bom.csv')));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
    vi.mocked(auth.requireAuth).mockResolvedValue(4);
    expect((await POST(upload(new File([BOM], 'bom.csv')))).status).toBe(200);
  });
});
