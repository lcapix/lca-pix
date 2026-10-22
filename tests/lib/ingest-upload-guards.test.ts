import { describe, it, expect } from 'vitest';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import { sniffUpload, extractDocText, MAX_PDF_PAGES, MAX_UPLOAD_BYTES, UPLOAD_TOO_LARGE_MESSAGE } from '@/lib/ingest/extract-text';

function pdf(pages: number): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ autoFirstPage: false });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    for (let i = 1; i <= pages; i++) {
      doc.addPage();
      doc.text(`Page marker ${i}`);
    }
    doc.end();
  });
}

function xlsx(): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Part', 'Mass (kg)'], ['Frame', 2]]), 'BOM');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);

describe('sniffUpload (M6, DOC-2)', () => {
  it('accepts files whose bytes match their extension', async () => {
    expect(sniffUpload(await pdf(1), 'epd.pdf')).toEqual({ ok: true, kind: 'pdf' });
    expect(sniffUpload(xlsx(), 'bom.xlsx')).toEqual({ ok: true, kind: 'xlsx' });
    expect(sniffUpload(OLE, 'old.xls')).toEqual({ ok: true, kind: 'xls' });
    expect(sniffUpload(Buffer.from('Part,Mass\nFrame,2\n'), 'bom.csv')).toEqual({ ok: true, kind: 'text' });
    expect(sniffUpload(Buffer.from('<html><body>SDS</body></html>'), 'sds.html')).toEqual({ ok: true, kind: 'text' });
    // Windows-1252 export: not UTF-8, still text.
    expect(sniffUpload(Buffer.from([0x50, 0x69, 0xe8, 0x63, 0x65, 0x2c, 0x31, 0x0a]), 'bom.csv').ok).toBe(true);
  });

  it('rejects extensions outside the allowlist', () => {
    for (const name of ['report.docx', 'photo.png', 'archive.zip', 'run.exe', 'noext']) {
      const r = sniffUpload(Buffer.from('hello world'), name);
      expect(r.ok, name).toBe(false);
    }
  });

  it('rejects content that does not match the extension', async () => {
    expect(sniffUpload(Buffer.from('just text'), 'fake.pdf').ok).toBe(false);
    expect(sniffUpload(Buffer.from('just text'), 'fake.xlsx').ok).toBe(false);
    expect(sniffUpload(await pdf(1), 'renamed.csv').ok).toBe(false);
    expect(sniffUpload(xlsx(), 'renamed.csv').ok).toBe(false);
    expect(sniffUpload(PNG, 'image.csv').ok).toBe(false);
    // UTF-16 text is full of NUL bytes.
    expect(sniffUpload(Buffer.from('Part,Mass\n', 'utf16le'), 'bom.csv').ok).toBe(false);
  });

  it('rejects an empty file', () => {
    expect(sniffUpload(Buffer.alloc(0), 'bom.csv').ok).toBe(false);
  });

  it('exposes the limits and a size message that names the hosted limit', () => {
    expect(MAX_UPLOAD_BYTES).toBe(12 * 1024 * 1024);
    expect(MAX_PDF_PAGES).toBe(200);
    expect(UPLOAD_TOO_LARGE_MESSAGE).toMatch(/12 MB/);
    expect(UPLOAD_TOO_LARGE_MESSAGE).toMatch(/split/i);
    expect(UPLOAD_TOO_LARGE_MESSAGE).toMatch(/4\.5 MB/);
  });
});

describe('extractDocText PDF page cap', () => {
  it('reads every page of a short PDF', async () => {
    const { kind, text, pages } = await extractDocText(await pdf(3), 'a.pdf');
    expect(kind).toBe('pdf');
    expect(text).toContain('Page marker 1');
    expect(text).toContain('Page marker 3');
    expect(pages).toEqual({ total: 3, read: 3 });
  });

  it('stops after maxPages and says how many it read', async () => {
    const { text, pages } = await extractDocText(await pdf(5), 'a.pdf', { maxPages: 2 });
    expect(text).toContain('Page marker 2');
    expect(text).not.toContain('Page marker 3');
    expect(pages).toEqual({ total: 5, read: 2 });
  });
});
