/**
 * Upload limits (M6, DOC-2, ING-3) on POST /api/cases/:id/documents and
 * POST /api/ingest/preview:
 *   - over 12 MB: 413 from the declared length before a byte of the body is
 *     read, and 413 from a streamed (chunked) body as soon as it passes the
 *     cap, never after buffering all of it;
 *   - bytes that do not match the extension, or an extension outside the
 *     allowlist: 415, nothing stored;
 *   - a PDF is read to at most 200 pages.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import PDFDocument from 'pdfkit';
import { api } from '../support/api';
import { rowCounts } from '../support/db';
import { buildWorld, type World } from '../support/world';

let w: World;
beforeAll(async () => {
  w = await buildWorld({ runs: false });
});

const MB = 1024 * 1024;
const BOUNDARY = '----lcapixTestBoundary';

/** A multipart body of `total` bytes, served in 64 KB chunks; counts what was pulled. */
function countingBody(total: number) {
  let sent = 0;
  const chunk = new Uint8Array(64 * 1024).fill(0x41);
  const head = new TextEncoder().encode(
    `--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="big.csv"\r\nContent-Type: text/csv\r\n\r\n`,
  );
  const stats = { pulled: 0 };
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= total) return controller.close();
      const piece = sent === 0 ? head : chunk;
      sent += piece.byteLength;
      stats.pulled = sent;
      controller.enqueue(piece);
    },
  });
  return { stream, stats };
}

function upload(file: File, fields: Record<string, string> = {}) {
  const fd = new FormData();
  fd.append('file', file);
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

const targets = () => [
  { name: 'documents', url: `/api/cases/${w.P.base.id}/documents`, fields: { doc_type: 'other' } },
  { name: 'ingest preview', url: '/api/ingest/preview', fields: { connector: 'bom' } },
];

describe('upload size', () => {
  it('13 MB declared: 413 before the body is read', async () => {
    for (const t of targets()) {
      const { stream, stats } = countingBody(13 * MB);
      const res = await api.post(t.url, {
        token: w.users.editor.token,
        body: stream,
        headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}`, 'content-length': String(13 * MB) },
      });
      expect(res.status, t.name).toBe(413);
      expect(res.json.error).toMatch(/larger than 12 MB/);
      // At most what a stream buffers on its own before anyone reads it.
      expect(stats.pulled, `${t.name}: bytes pulled`).toBeLessThanOrEqual(128 * 1024);
    }
  });

  it('13 MB streamed with no length: 413 once past the cap, without reading the rest', async () => {
    for (const t of targets()) {
      const { stream, stats } = countingBody(13 * MB);
      const res = await api.post(t.url, {
        token: w.users.editor.token,
        body: stream,
        headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
      });
      expect(res.status, t.name).toBe(413);
      expect(stats.pulled, t.name).toBeLessThan(12.5 * MB);
    }
  });

  it('a 12 MB + 1 byte file inside a small request is refused too', async () => {
    const res = await api.post(`/api/cases/${w.P.base.id}/documents`, {
      token: w.users.editor.token,
      form: upload(new File([new Uint8Array(12 * MB + 1).fill(0x41)], 'big.csv')),
    });
    expect(res.status).toBe(413);
  });

  it('the size check needs a sign-in first (anon gets 401, not 413)', async () => {
    const { stream } = countingBody(13 * MB);
    const res = await api.post('/api/ingest/preview', {
      body: stream,
      headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}`, 'content-length': String(13 * MB) },
    });
    expect(res.status).toBe(401);
  });
});

describe('upload type', () => {
  const cases: Array<[string, BlobPart, RegExp]> = [
    ['report.pdf', 'this is plain text, not a PDF', /do not look like a \.pdf file/],
    ['sheet.xlsx', 'Part,Material\nBody,Steel\n', /do not look like a \.xlsx file/],
    ['photo.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), /Unsupported file type '\.png'/],
    ['archive.zip', new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0]), /Unsupported file type '\.zip'/],
    ['letter.docx', new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0]), /Unsupported file type '\.docx'/],
    ['notes.csv', new Uint8Array([0x41, 0x00, 0x42, 0x00, 0x43]), /do not look like a \.csv file/],
    ['noextension', 'text', /Unsupported file type/],
    ['empty.csv', '', /The file is empty/],
  ];

  it('documents: 415 for wrong bytes or a type outside the allowlist; nothing stored', async () => {
    const before = await rowCounts();
    for (const [name, body, message] of cases) {
      const res = await api.post(`/api/cases/${w.P.base.id}/documents`, { token: w.users.editor.token, form: upload(new File([body], name)) });
      expect(res.status, name).toBe(415);
      expect(res.json.error, name).toMatch(message);
    }
    expect(await rowCounts()).toEqual(before);
  });

  it('ingest preview: 415 for wrong bytes', async () => {
    for (const [name, body] of cases.slice(0, 6)) {
      const res = await api.post('/api/ingest/preview', { token: w.users.editor.token, form: upload(new File([body], name), { connector: 'bom' }) });
      expect(res.status, name).toBe(415);
    }
  });
});

describe('PDF page cap', () => {
  async function pdfWithPages(n: number): Promise<Uint8Array<ArrayBuffer>> {
    const doc = new PDFDocument({ autoFirstPage: false, compress: false });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<void>((resolve) => doc.on('end', () => resolve()));
    for (let i = 1; i <= n; i++) {
      doc.addPage({ size: [200, 200] });
      doc.fontSize(10).text(`Marker page ${i} end`, 20, 20);
    }
    doc.end();
    await done;
    const buf = Buffer.concat(chunks);
    const out = new Uint8Array(new ArrayBuffer(buf.length));
    out.set(buf);
    return out;
  }

  it('reads the first 200 pages of a 205-page PDF and stops', async () => {
    const pdf = await pdfWithPages(205);
    const res = await api.post(`/api/cases/${w.P.base.id}/documents`, {
      token: w.users.editor.token,
      form: upload(new File([pdf], 'long.pdf', { type: 'application/pdf' }), { doc_type: 'sds' }),
    });
    expect(res.status, res.text).toBe(200);
    const doc = await api.get(`/api/cases/${w.P.base.id}/documents?id=${res.json.document.document_id}`, { token: w.users.editor.token });
    const text: string = doc.json.document.content;
    expect(text).toContain('Marker page 1 end');
    expect(text).toContain('Marker page 200 end');
    expect(text).not.toContain('Marker page 201 end');
    expect(text).not.toContain('Marker page 205 end');
  });
});
