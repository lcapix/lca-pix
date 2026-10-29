// Read a DOE ITAC workbook in the browser and keep only the chosen plant's
// ASSESS row, so the upload is the row and not the 16 MB workbook.

import type { WorkBook } from 'xlsx'

export async function itacPlantWorkbook(file: File, plantId: string): Promise<File> {
  const XLSX = await import('xlsx')
  const book = XLSX.read(await file.arrayBuffer(), { type: 'array' }) as WorkBook
  const sheet = book.Sheets.ASSESS
  if (!sheet) throw new Error('No ASSESS sheet found.')
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  const row = rows.find((r) => String(r.ID ?? '').trim() === plantId)
  if (!row) throw new Error(`assessment ${plantId} not found`)
  const small = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(small, XLSX.utils.json_to_sheet([row]), 'ASSESS')
  const bytes = XLSX.write(small, { type: 'array', bookType: 'xlsx' }) as Uint8Array
  return new File([new Uint8Array(bytes)], file.name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
