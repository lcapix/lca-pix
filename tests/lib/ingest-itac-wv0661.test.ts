import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { structureItac } from '@/lib/ingest/itac'

const workbook = '/Users/shreyamendi/lca/corpus/itac/ITAC_Database_20260830.xlsx'

describe('ITAC WV0661 from the real workbook', () => {
  it('reads one ASSESS row and keeps electricity at $78,053 and gas at $23,097', async () => {
    expect(existsSync(workbook), workbook).toBe(true)
    const XLSX = await import('xlsx')
    const book = XLSX.read(readFileSync(workbook), { type: 'buffer', sheets: ['ASSESS'] })
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets.ASSESS, { defval: '' })
    const row = rows.find((r) => String(r.ID ?? '').trim() === 'WV0661')
    expect(row).toBeTruthy()
    const model = structureItac([row!], 'WV0661', 'ITAC_Database_20260830.xlsx')
    const total = (prefix: string) =>
      model.costs.filter((c) => c.node.startsWith(prefix)).reduce((sum, c) => sum + c.amount, 0)
    expect(total('Electricity')).toBe(78053)
    expect(total('Natural gas')).toBe(23097)
  })
})
