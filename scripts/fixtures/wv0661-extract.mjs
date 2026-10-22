#!/usr/bin/env node
/**
 * Extract DOE ITAC assessment WV0661 (FY2024, an electroplating shop in West
 * Virginia) from the ITAC workbook into tests/fixtures/wv0661/itac.json: the
 * plant's annual figures, every resource stream it reports, and its 11
 * recommendations, each value with the sheet, cell and Terms definition it
 * came from. Money is integer cents; a blank cell stays null.
 *
 *   node scripts/fixtures/wv0661-extract.mjs [path/to/ITAC_Database.xlsx]
 *
 * The workbook is public DOE data (https://itac.university/download), 16.8 MB,
 * kept out of the repo; its SHA-256 is recorded so the extract can be checked.
 * Rerunning on the same workbook writes a byte-identical file.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = path.join(ROOT, 'tests', 'fixtures', 'wv0661', 'itac.json')
const WORKBOOK = process.argv[2] ?? path.join(os.homedir(), 'lca', 'corpus', 'itac', 'ITAC_Database_20260830.xlsx')
const ID = 'WV0661'

const cents = (dollars) => (dollars == null ? null : Math.round(Number(dollars) * 100))
const col = (i) => XLSX.utils.encode_col(i)

const bytes = readFileSync(WORKBOOK)
const wb = XLSX.read(bytes, { sheets: ['ASSESS', 'RECC', 'Terms'], dense: true })

/** A sheet as a header row and data rows, so every value keeps its cell. */
function table(name) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null })
  const header = rows[0]
  return { header, rows: rows.slice(1), at: (key) => header.indexOf(key) }
}

// Terms: the code dictionary, ASSESS fields in columns A-B, RECC fields in D-E.
const termsRows = XLSX.utils.sheet_to_json(wb.Sheets.Terms, { header: 1, defval: null })
const terms = { ASSESS: {}, RECC: {} }
for (const r of termsRows.slice(1)) {
  if (r[0]) terms.ASSESS[r[0]] = r[1]
  if (r[3]) terms.RECC[r[3]] = r[4]
}

// ASSESS: the plant's row.
const A = table('ASSESS')
const ai = A.rows.findIndex((r) => r[A.at('ID')] === ID)
if (ai < 0) throw new Error(`${ID} is not in ASSESS`)
const arow = A.rows[ai]
const aCell = (key) => `ASSESS!${col(A.at(key))}${ai + 2}`
const field = (key, unit, kind = 'number') => {
  const v = arow[A.at(key)]
  return { value: v == null ? null : kind === 'money' ? cents(v) : v, unit, cell: aCell(key), term: terms.ASSESS[key] ?? null }
}

const plant = {
  id: ID,
  fiscalYear: field('FY', 'year'),
  naics: field('NAICS', 'code'),
  sic: field('SIC', 'code'),
  state: field('STATE', 'code', 'text'),
  products: field('PRODUCTS', 'text', 'text'),
  salesCents: field('SALES', 'USD cents', 'money'),
  employees: field('EMPLOYEES', 'people'),
  plantAreaSqFt: field('PLANT_AREA', 'sq ft'),
  productionLevel: field('PRODLEVEL', 'units (PRODUNITS code 1; ITAC does not say what a unit is)'),
  productionUnitsCode: field('PRODUNITS', 'code'),
  productionHours: field('PRODHOURS', 'h'),
  recommendationCount: field('RECC_COUNT_recc', 'count'),
}

// Every stream the plant reports a cost or a usage for, with its unit from Terms.
const unitOf = (term) => (term?.match(/\(([^)]+)\)\s*$/)?.[1] ?? null)
const streams = []
for (const key of A.header) {
  const m = /^([A-Z]+\d*)_plant_(cost|usage)$/.exec(key ?? '')
  if (!m || m[2] !== 'cost') continue
  const code = m[1]
  const costKey = `${code}_plant_cost`
  const usageKey = `${code}_plant_usage`
  const cost = arow[A.at(costKey)]
  const usage = A.at(usageKey) >= 0 ? arow[A.at(usageKey)] : null
  if (cost == null && usage == null) continue
  streams.push({
    code,
    label: terms.ASSESS[costKey] ?? null,
    costCents: cents(cost),
    costCell: aCell(costKey),
    usage: usage ?? null,
    usageUnit: A.at(usageKey) >= 0 ? unitOf(terms.ASSESS[usageKey]) : null,
    usageCell: A.at(usageKey) >= 0 ? aCell(usageKey) : null,
  })
}

// RECC: the plant's recommendations, with up to four resources each.
const R = table('RECC')
const recommendations = []
R.rows.forEach((r, i) => {
  if (r[R.at('ID')] !== ID) return
  const get = (k) => r[R.at(k)]
  const resources = []
  for (const p of ['P', 'S', 'T', 'Q']) {
    const code = get(`${p}SOURCCODE`)
    if (!code) continue
    resources.push({
      code,
      conserved: get(`${p}CONSERVED`),
      sourceConserved: get(`${p}SOURCONSV`),
      savedCents: cents(get(`${p}SAVED`)),
    })
  }
  recommendations.push({
    number: get('AR_NUMBER'),
    superId: get('SUPERID'),
    arc: get('ARC2'),
    implemented: get('IMPSTATUS') === 'I',
    status: get('IMPSTATUS'),
    costCents: cents(get('IMPCOST')),
    capitalCents: cents(get('IC_CAPITAL')),
    otherCents: cents(get('IC_OTHER')),
    rebate: get('REBATE'),
    incremental: get('INCREMNTAL'),
    payback: get('PAYBACK'),
    tool: get('BPTOOL'),
    resources,
    row: `RECC!${i + 2}`,
  })
})
recommendations.sort((a, b) => a.number - b.number)

// The resource codes the recommendations use, with their meaning from the ASSESS terms.
const resourceCodes = {}
for (const rec of recommendations) for (const res of rec.resources) {
  resourceCodes[res.code] ??= terms.ASSESS[`${res.code}_plant_usage`] ?? terms.ASSESS[`${res.code}_plant_cost`] ?? null
}

const out = {
  source: {
    name: 'DOE Industrial Training and Assessment Centers (ITAC) database',
    url: 'https://itac.university/download',
    file: path.basename(WORKBOOK),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    extractedBy: 'scripts/fixtures/wv0661-extract.mjs',
  },
  plant,
  streams,
  resourceCodes,
  recommendations,
}

mkdirSync(path.dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
console.log(`wrote ${path.relative(ROOT, OUT)}: ${streams.length} streams, ${recommendations.length} recommendations`)
