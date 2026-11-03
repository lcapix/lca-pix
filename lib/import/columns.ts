/**
 * Which column is which, on the import screen (F2.3). The server sends each
 * column with its first value, the fields this kind of file has, and what it
 * read each column as; the person changes any of them and the file is read
 * again with their choice. Pure, so it runs in the browser.
 */

export interface ColumnInfo {
  /** Set when the server could not read the file until the person says which column is which. */
  message: string | null
  headers: Array<{ name: string; sample: string }>
  fields: Array<{ id: string; label: string }>
  /** "a work center column and a rated power column" */
  needed: string
  /** 'header': found by header; 'yours': the person's choice; 'saved': chosen earlier for this layout. */
  source: 'header' | 'yours' | 'saved'
}

/** Column → field id, or 'ignore'. */
export type ColumnChoice = Record<string, string>

/** The column info in a preview reply, or null for a kind of file read another way. */
export function columnInfoFrom(d: any): ColumnInfo | null {
  if (!Array.isArray(d?.column_headers) || !Array.isArray(d?.column_fields)) return null
  return {
    message: d.needs_columns ? String(d.message ?? '') : null,
    headers: d.column_headers,
    fields: d.column_fields,
    needed: String(d.columns_needed ?? ''),
    source: d.columns_source === 'yours' || d.columns_source === 'saved' ? d.columns_source : 'header',
  }
}

/** Give a column a field. A field holds one column, so the column that had it is left out. */
export function chooseColumn(choice: ColumnChoice, header: string, field: string): ColumnChoice {
  const next: ColumnChoice = {}
  for (const [h, f] of Object.entries(choice)) next[h] = field !== 'ignore' && f === field ? 'ignore' : f
  next[header] = field
  return next
}

/** "6 columns read, 2 not used" */
export function columnsSummary(info: ColumnInfo, choice: ColumnChoice): string {
  const used = info.headers.filter((h) => (choice[h.name] ?? 'ignore') !== 'ignore').length
  const left = info.headers.length - used
  return `${used} column${used === 1 ? '' : 's'} read${left ? `, ${left} not used` : ''}`
}
