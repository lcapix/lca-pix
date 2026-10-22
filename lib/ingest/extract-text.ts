// Faithful text extraction for the LLM structuring path. PDF via unpdf
// (serverless-friendly pdf.js), HTML by tag-stripping, everything else as UTF-8.
// No interpretation here — just get readable text out.

import { readBodyCapped } from '@/lib/rate-limit';

export type DocKind = 'pdf' | 'html' | 'text';

// ── Upload guards ────────────────────────────────────────────────────────────
// Shared by /api/ingest/preview and /api/cases/[caseId]/documents: a size cap
// the routes check before buffering the body, and a type check on the bytes
// (not just the name) so a .docx, image or zip is refused instead of being
// decoded as UTF-8 and stored as garbage.

/** Largest upload accepted (the file itself; the routes allow a little multipart overhead). */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
/** PDF pages read at most; the rest of a longer PDF is not extracted. */
export const MAX_PDF_PAGES = 200;
/** Wall-clock budget for reading PDF pages. */
export const PDF_TIME_BUDGET_MS = 20_000;

export const UPLOAD_TOO_LARGE_MESSAGE =
  'That file is larger than 12 MB. Split very large workbooks (for example one sheet, ' +
  'plant or year per file) and upload the parts. On the hosted app the practical limit ' +
  'is lower: Vercel refuses request bodies over 4.5 MB.';

/** Room for the multipart boundaries and the small form fields next to the file. */
export const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

/**
 * Parse a multipart upload without ever buffering more than the limit: the
 * declared Content-Length is checked first, then the body is read with a cap
 * (chunked uploads declare no length). Throws PayloadTooLargeError (from
 * lib/rate-limit) when the body is too big.
 */
export async function readUploadForm(request: Request): Promise<FormData> {
  const bytes = await readBodyCapped(request, MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES);
  return new Response(bytes as unknown as BodyInit, {
    headers: { 'content-type': request.headers.get('content-type') ?? '' },
  }).formData();
}

export type UploadKind = 'pdf' | 'xlsx' | 'xls' | 'text';

const EXT_KIND: Record<string, UploadKind> = {
  pdf: 'pdf',
  xlsx: 'xlsx',
  xls: 'xls',
  csv: 'text',
  tsv: 'text',
  txt: 'text',
  md: 'text',
  html: 'text',
  htm: 'text',
};

const startsWith = (buf: Buffer, sig: number[]) =>
  buf.length >= sig.length && sig.every((b, i) => buf[i] === b);
const PDF_SIG = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const ZIP_SIG = [0x50, 0x4b, 0x03, 0x04]; // PK\x03\x04 (xlsx, docx, zip)
const OLE_SIG = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // legacy .xls

/** Plain text: no NUL bytes and almost no other control bytes in the first 8 KB. */
function looksLikeText(buf: Buffer): boolean {
  if (startsWith(buf, PDF_SIG) || startsWith(buf, ZIP_SIG) || startsWith(buf, OLE_SIG)) return false;
  const head = buf.subarray(0, 8192);
  let control = 0;
  for (const b of head) {
    if (b === 0) return false;
    if (b < 0x09 || (b > 0x0d && b < 0x20)) control++;
  }
  return control <= head.length * 0.01;
}

const TYPES_HINT = 'Upload a PDF, an Excel workbook (.xlsx or .xls), or a CSV, TSV, text or HTML file.';

/** Check an upload's extension against the allowlist and its bytes against the extension. */
export function sniffUpload(
  buf: Buffer,
  filename: string,
): { ok: true; kind: UploadKind } | { ok: false; error: string } {
  const ext = /\.([a-z0-9]+)$/i.exec(filename)?.[1]?.toLowerCase() ?? '';
  const kind = EXT_KIND[ext];
  if (!Object.hasOwn(EXT_KIND, ext) || !kind) {
    return { ok: false, error: `Unsupported file type${ext ? ` '.${ext}'` : ''}. ${TYPES_HINT}` };
  }
  if (!buf.length) return { ok: false, error: 'The file is empty.' };
  const fits =
    kind === 'pdf'
      ? startsWith(buf, PDF_SIG)
      : kind === 'xlsx'
        ? startsWith(buf, ZIP_SIG)
        : kind === 'xls'
          ? startsWith(buf, OLE_SIG) || looksLikeText(buf) // HTML/CSV saved as .xls
          : looksLikeText(buf);
  if (!fits) {
    return {
      ok: false,
      error: `The contents of ${filename} do not look like a .${ext} file. ${TYPES_HINT}`,
    };
  }
  return { ok: true, kind };
}

export function detectKind(buf: Buffer, filename: string): DocKind {
  if (buf.slice(0, 5).toString('latin1').startsWith('%PDF')) return 'pdf';
  const lower = filename.toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  const head = buf.slice(0, 512).toString('utf8');
  if (/<html|<!doctype html|<body|<div/i.test(head)) return 'html';
  return 'text';
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract readable text from a document buffer. PDFs are read page by page,
 * at most `maxPages` (default MAX_PDF_PAGES) and within PDF_TIME_BUDGET_MS;
 * `pages` says how many were read out of how many.
 */
export async function extractDocText(
  buf: Buffer,
  filename: string,
  opts: { maxPages?: number; timeBudgetMs?: number } = {},
): Promise<{ kind: DocKind; text: string; pages?: { total: number; read: number } }> {
  const kind = detectKind(buf, filename);
  if (kind === 'pdf') {
    const maxPages = opts.maxPages ?? MAX_PDF_PAGES;
    const deadline = Date.now() + (opts.timeBudgetMs ?? PDF_TIME_BUDGET_MS);
    const { getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const total = pdf.numPages;
    const texts: string[] = [];
    for (let n = 1; n <= Math.min(total, maxPages) && Date.now() < deadline; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      texts.push(
        content.items
          .map((item: any) => (item.str != null ? item.str + (item.hasEOL ? '\n' : '') : ''))
          .join(''),
      );
    }
    // Same shape unpdf's mergePages produced: one line of text.
    return { kind, text: texts.join('\n').replace(/\s+/g, ' '), pages: { total, read: texts.length } };
  }
  if (kind === 'html') {
    return { kind, text: stripHtml(buf.toString('utf8')) };
  }
  return { kind, text: buf.toString('utf8') };
}
