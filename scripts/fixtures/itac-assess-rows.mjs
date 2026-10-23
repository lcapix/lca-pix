#!/usr/bin/env node
/**
 * Extract real ASSESS rows from the DOE ITAC workbook into
 * tests/fixtures/itac/assess-rows.json, for the ITAC importer's tests. Each
 * row is kept exactly as the import preview reads it (SheetJS sheet_to_json:
 * a key for every non-empty cell), with its sheet row number. The plants are
 * chosen by the rules below, not by hand, so a rerun picks the same ones from
 * the same workbook:
 *
 *   1. WV0661, the V2 worked plant (electricity in energy, demand and fees).
 *   2. The plant reporting the most of E10, E11, E12, W3 and W6 with both a
 *      usage and a cost; the first by sheet row on a tie.
 *   3. The first plant by sheet row reporting W6 with both a usage and a cost.
 *   4. The first plant by sheet row with a W4 cost and no W4 usage.
 *
 *   node scripts/fixtures/itac-assess-rows.mjs [path/to/ITAC_Database.xlsx]
 *
 * The workbook is public DOE data (https://itac.university/download), kept out
 * of the repo; its SHA-256 is recorded. Rerunning on the same workbook writes a
 * byte-identical file.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = path.join(ROOT, 'tests', 'fixtures', 'itac', 'assess-rows.json')
const WORKBOOK = process.argv[2] ?? path.join(os.homedir(), 'lca', 'corpus', 'itac', 'ITAC_Database_20260830.xlsx')

const bytes = readFileSync(WORKBOOK)
const wb = XLSX.read(bytes, { sheets: ['ASSESS'], dense: true })
// Row arrays with blank rows kept, so index i is sheet row i + 1.
const grid = XLSX.utils.sheet_to_json(wb.Sheets.ASSESS, { header: 1, defval: null, blankrows: true })
const header = grid[0]
const at = (key) => header.indexOf(key)
const value = (r, key) => (at(key) >= 0 ? r[at(key)] : null)
const nonZero = (v) => v !== null && v !== '' && Number(v) !== 0 && Number.isFinite(Number(v))
const both = (r, code) => nonZero(value(r, `${code}_plant_usage`)) && nonZero(value(r, `${code}_plant_cost`))

/** The row as the preview sees it: a key for every non-empty cell. */
const asRead = (r) => Object.fromEntries(header.map((k, i) => [k, r[i]]).filter(([k, v]) => k && v !== null && v !== ''))

const data = grid.map((r, i) => ({ r, sheetRow: i + 1 })).slice(1).filter(({ r }) => value(r, 'ID'))
const first = (test, why) => {
  const hit = data.find(({ r }) => test(r))
  if (!hit) throw new Error(`no plant for: ${why}`)
  return { why, sheet_row: hit.sheetRow, row: asRead(hit.r) }
}

const NEW = ['E10', 'E11', 'E12', 'W3', 'W6']
const most = Math.max(...data.map(({ r }) => NEW.filter((c) => both(r, c)).length))

const rows = [
  first((r) => value(r, 'ID') === 'WV0661', 'WV0661, the V2 worked plant'),
  first((r) => NEW.filter((c) => both(r, c)).length === most, `the most of ${NEW.join(', ')} with a usage and a cost (${most})`),
  first((r) => both(r, 'W6'), 'the first plant reporting W6 with a usage and a cost'),
  first((r) => nonZero(value(r, 'W4_plant_cost')) && !nonZero(value(r, 'W4_plant_usage')), 'the first plant with a W4 cost and no W4 usage'),
]

const out = {
  source: {
    name: 'DOE Industrial Training and Assessment Centers (ITAC) database, sheet ASSESS',
    url: 'https://itac.university/download',
    file: path.basename(WORKBOOK),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    extractedBy: 'scripts/fixtures/itac-assess-rows.mjs',
  },
  rows,
}

mkdirSync(path.dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
console.log(`wrote ${path.relative(ROOT, OUT)}: ${rows.map((x) => `${x.row.ID} (row ${x.sheet_row})`).join(', ')}`)
