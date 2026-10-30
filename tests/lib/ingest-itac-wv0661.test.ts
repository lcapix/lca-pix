// Finding 3.2: DOE's ITAC workbook as downloaded (16.8 MB). The workbook is not
// in the repo; ITAC_WORKBOOK names it (default: the corpus copy on this
// machine). Without it the test is skipped and says why. The sha256 is the
// source workbook's in tests/fixtures/itac/assess-rows.json.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { structureItac } from '@/lib/ingest/itac'

const workbook = process.env.ITAC_WORKBOOK || path.join(homedir(), 'lca', 'corpus', 'itac', 'ITAC_Database_20260830.xlsx')
const fixture = JSON.parse(readFileSync('tests/fixtures/itac/assess-rows.json', 'utf8'))
const present = existsSync(workbook)

describe('ITAC WV0661 from the real workbook', () => {
  it.skipIf(!present)(`reads one ASSESS row and keeps electricity at $78,053 and gas at $23,097 (skipped: no workbook at ${workbook}; set ITAC_WORKBOOK)`, async () => {
    const bytes = readFileSync(workbook)
    expect(createHash('sha256').update(bytes).digest('hex'), 'the workbook is the cited download').toBe(fixture.source.sha256)
    const XLSX = await import('xlsx')
    const book = XLSX.read(bytes, { type: 'buffer', sheets: ['ASSESS'] })
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
