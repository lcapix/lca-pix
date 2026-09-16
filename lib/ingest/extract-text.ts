// Faithful text extraction for the LLM structuring path. PDF via unpdf
// (serverless-friendly pdf.js), HTML by tag-stripping, everything else as UTF-8.
// No interpretation here — just get readable text out.

export type DocKind = 'pdf' | 'html' | 'text';

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

/** Extract readable text from a document buffer. */
export async function extractDocText(buf: Buffer, filename: string): Promise<{ kind: DocKind; text: string }> {
  const kind = detectKind(buf, filename);
  if (kind === 'pdf') {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });
    return { kind, text: Array.isArray(text) ? text.join('\n') : String(text) };
  }
  if (kind === 'html') {
    return { kind, text: stripHtml(buf.toString('utf8')) };
  }
  return { kind, text: buf.toString('utf8') };
}
