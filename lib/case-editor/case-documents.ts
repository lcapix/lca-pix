// The case's own documents, read beside the tree (E21): the kinds a document
// can be, the lines of one that match a search, and the parts of a line to
// mark. Pure, so the Documents panel and its tests share one definition.

/** What a kept document is. The value is stored in case_documents.doc_type. */
export const DOC_TYPES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'routing', label: 'Routing' },
  { value: 'bom', label: 'Bill of materials' },
  { value: 'equipment', label: 'Equipment list' },
  { value: 'epd', label: 'EPD or datasheet' },
  { value: 'sds', label: 'Safety data sheet' },
  { value: 'itac', label: 'ITAC report' },
  { value: 'other', label: 'Other' },
]

/** "Bill of materials" for 'bom'; a type the app does not know reads as itself; none reads "Document". */
export function docTypeLabel(value: string | null | undefined): string {
  const v = value?.trim()
  if (!v) return 'Document'
  return DOC_TYPES.find((t) => t.value === v)?.label ?? v
}

export type DocumentLine = { n: number; text: string; hit: boolean }

/**
 * The lines that match, each with its line number kept, so a value can be
 * traced back to the line it came from. A blank search shows every line.
 * Case does not matter; Windows line ends are read as plain ones.
 */
export function matchingLines(content: string, needle: string): DocumentLine[] {
  const q = needle.trim().toLowerCase()
  const rows = content.split(/\r?\n/).map((text, i) => ({ n: i + 1, text, hit: !!q && text.toLowerCase().includes(q) }))
  return q ? rows.filter((r) => r.hit) : rows
}

/** What a search found, said in words: "No line matches", "1 line", "4 lines". Null with no search. */
export function hitSummary(needle: string, count: number): string | null {
  if (!needle.trim()) return null
  if (count === 0) return 'No line matches'
  return count === 1 ? '1 line matches' : `${count} lines match`
}

/** A line cut into plain and matched parts, so the match can be marked where it sits. */
export function highlightParts(text: string, needle: string): Array<{ text: string; hit: boolean }> {
  const q = needle.trim().toLowerCase()
  if (!q) return [{ text, hit: false }]
  const lower = text.toLowerCase()
  const parts: Array<{ text: string; hit: boolean }> = []
  let at = 0
  for (let i = lower.indexOf(q); i !== -1; i = lower.indexOf(q, at)) {
    if (i > at) parts.push({ text: text.slice(at, i), hit: false })
    parts.push({ text: text.slice(i, i + q.length), hit: true })
    at = i + q.length
  }
  if (at < text.length) parts.push({ text: text.slice(at), hit: false })
  return parts
}

/**
 * The reason to show when a documents request did not work: the route's own
 * error text when it sent one, else the status it answered with.
 */
export function documentsError(status: number, body: unknown): string {
  const said = (body as { error?: unknown } | null)?.error
  if (typeof said === 'string' && said.trim()) return said.trim()
  return `The server answered ${status}.`
}

/** The import a stored document can go through (routing, BOM, equipment list), or null. */
export function importableKind(docType: string | null | undefined): 'routing' | 'bom' | 'equipment' | null {
  return docType === 'routing' || docType === 'bom' || docType === 'equipment' ? docType : null
}

/** One cell as CSV: quoted when it holds a comma, a quote or a line break. */
function csvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/**
 * A stored document as the file the importer reads. A spreadsheet is kept as
 * tab-separated rows, so it goes back to a CSV of the same rows; anything
 * else (a PDF's or a page's text) goes as plain text under its own name.
 */
export function documentAsFile(filename: string, content: string): { name: string; text: string; type: string } {
  const base = filename.replace(/\.[^./]+$/, '') || 'document'
  const sheet = /\.(csv|tsv|xlsx|xls)$/i.test(filename) || (content.split('\n')[0] ?? '').includes('\t')
  if (sheet) {
    const text = content
      .split(/\r?\n/)
      .map((line) => line.split('\t').map(csvCell).join(','))
      .join('\n')
    return { name: `${base}.csv`, text, type: 'text/csv' }
  }
  return { name: /\.txt$/i.test(filename) ? filename : `${base}.txt`, text: content, type: 'text/plain' }
}
