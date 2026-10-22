// The blank template for each document kind the importer reads: the header
// row it expects, so a person can fill in their own data in that shape.

import { templateFilename } from '@/lib/import/preview'

export const TEMPLATE_HEADERS: Record<string, string> = {
  routing: 'Op No,Operation,Department,Work Center,Setup Hrs,Run Hrs,Base Qty,Tooling',
  bom: 'Item,Description,Material,Qty Per,UOM,Unit Weight (kg),Unit Cost,Op Seq',
  equipment: 'Asset ID,Description,Work Center,Rated power (kW),Typical load (%)',
}

/** Download the blank template for `conn` (no-op for a kind without one). */
export function downloadTemplate(conn: string): void {
  const header = TEMPLATE_HEADERS[conn]
  if (!header) return
  const url = URL.createObjectURL(new Blob([`${header}\n`], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = templateFilename(conn)
  a.click()
  URL.revokeObjectURL(url)
}
