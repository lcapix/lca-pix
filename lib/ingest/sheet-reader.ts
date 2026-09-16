// Tolerant spreadsheet reader for the deterministic connectors. Real routing
// and BOM exports rarely look like a clean template: the data may sit on the
// second sheet behind a READ ME, under a title block, with headers like
// "Operation (Operations)", "QTY.", "Time (min)", repeated "Unit" columns,
// totals rows, blank first cells, decimal commas or accents. This finds the
// sheet and header row that look most like the document type, cleans the
// headers (keeping unit hints such as "(min)"), and returns row objects with
// every column present. Nothing is interpreted here beyond locating the table.

import * as XLSX from 'xlsx'
import { timeUnit, type TimeUnit } from './parse-values'

export interface SheetRead {
  rows: Array<Record<string, unknown>>
  headers: string[]
  /** Time unit named in a header, e.g. "Time (min)" -> { 'Time': 'min' }. */
  timeHints: Record<string, TimeUnit>
  /** Mass unit named in a header, e.g. "Mass (g)" -> { 'Mass': 'g' }. */
  massHints: Record<string, string>
  /** Power unit named in a header, e.g. "Rated power (kW)" -> { 'Rated power': 'kw' }. */
  powerHints: Record<string, string>
  sheetName: string
  headerRow: number // 1-based
  decimalComma: boolean
  notes: string[]
}

const MASS_WORDS = /^(g|kg|lb|lbs|oz|t|tonne|mg)$/i
const POWER_WORDS = /^(kw|w|hp|bhp)$/i

/** "Operation (Operations)" -> "Operation"; "QTY." -> "QTY"; keeps the words. */
export function cleanHeader(raw: unknown): {
  name: string
  time: TimeUnit | null
  mass: string | null
  power: string | null
} {
  let s = String(raw ?? '').replace(/\s+/g, ' ').trim()
  let time: TimeUnit | null = null
  let mass: string | null = null
  let power: string | null = null
  // Parenthetical or bracketed suffixes: keep a unit hint, drop the rest.
  s = s.replace(/[([]\s*([^)\]]*)\s*[)\]]/g, (_, inner: string) => {
    const w = inner.trim().toLowerCase().replace(/\s*(\/|per)\s*(pc|piece|unit|ea)$/, '')
    const t = POWER_WORDS.test(w) ? null : timeUnit(w)
    if (t) time = t
    else if (MASS_WORDS.test(w)) mass = w
    else if (POWER_WORDS.test(w)) power = w
    return ' '
  })
  // Inline unit words: "Time In Mins", "Run Time Min", "Weight kg".
  const tail = s.match(/\b(?:in\s+)?(mins?|minutes|hrs?|hours|secs?|seconds)$/i)
  if (tail && !time) time = timeUnit(tail[1])
  const massTail = s.match(/\b(kg|g|lbs?)$/i)
  if (massTail && !mass && /weight|mass|wt/i.test(s)) mass = massTail[1].toLowerCase()
  s = s.replace(/[.:#]+$/g, '').replace(/\s+/g, ' ').trim()
  return { name: s, time, mass, power }
}

const TOTAL_ROW = /^(sub-?\s*)?totals?\b|^grand\s*total|^sum\b|^end of (routing|bom|list)/i

function decodeText(buf: Buffer): string {
  let text = new TextDecoder('utf-8').decode(buf)
  if (text.includes('�')) text = buf.toString('latin1') // not UTF-8: Windows-1252 export
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/** Workbook from any upload; text files are decoded as UTF-8 and read as raw strings. */
export function readWorkbook(buf: Buffer, filename: string): { wb: XLSX.WorkBook; decimalComma: boolean } {
  if (/\.(csv|tsv|txt)$/i.test(filename)) {
    const text = decodeText(buf)
    const first = text.split(/\r?\n/).find((l) => l.trim()) ?? ''
    const semis = (first.match(/;/g) ?? []).length
    const commas = (first.match(/,/g) ?? []).length
    const decimalComma = semis > 0 && semis >= commas
    // raw: keep every cell as the text written, so "1/2" never becomes a date
    // and "0,5" is not read as 5. Values are parsed later by parse-values.
    return { wb: XLSX.read(text, { type: 'string', raw: true, FS: decimalComma ? ';' : undefined }), decimalComma }
  }
  return { wb: XLSX.read(buf, { type: 'buffer', cellDates: false }), decimalComma: false }
}

/**
 * Locate the table. `isKnownHeader` says whether a cleaned header name is one
 * the connector understands; the sheet + row with the most known headers (at
 * least 2) wins. Returns null when no sheet looks like the document type.
 */
export function readSheet(
  buf: Buffer,
  filename: string,
  isKnownHeader: (cleaned: string) => boolean,
): SheetRead | null {
  const { wb, decimalComma } = readWorkbook(buf, filename)
  let best: { sheet: string; row: number; score: number; aoa: unknown[][] } | null = null
  for (const sheet of wb.SheetNames) {
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], {
      header: 1,
      defval: '',
      raw: true,
      blankrows: true,
    })
    for (let r = 0; r < Math.min(aoa.length, 30); r++) {
      const score = (aoa[r] ?? []).filter((c) => {
        const h = cleanHeader(c).name
        return h && isKnownHeader(h)
      }).length
      if (score >= 2 && (!best || score > best.score)) best = { sheet, row: r, score, aoa }
    }
  }
  if (!best) return null

  const notes: string[] = []
  const rawHeaders = best.aoa[best.row] ?? []
  const timeHints: Record<string, TimeUnit> = {}
  const massHints: Record<string, string> = {}
  const powerHints: Record<string, string> = {}
  const headers: string[] = []
  const unitLike = (h: string) => /^(unit|uom|un|u\/m)$/i.test(h)
  const unitCount = rawHeaders.filter((c) => unitLike(cleanHeader(c).name)).length
  rawHeaders.forEach((c, i) => {
    const { name, time, mass, power } = cleanHeader(c)
    let h = name || `Column ${i + 1}`
    // Several "Unit" columns (SAP: Setup, Unit, Machine, Unit…) each belong to
    // the column before them: name them "Setup unit", "Machine unit".
    if (unitLike(h) && unitCount > 1 && i > 0) h = `${headers[i - 1]} unit`
    let unique = h
    let n = 2
    while (headers.includes(unique)) unique = `${h} (${n++})`
    headers.push(unique)
    if (time) timeHints[unique] = time
    if (mass) massHints[unique] = mass
    if (power) powerHints[unique] = power
  })

  const rows: Array<Record<string, unknown>> = []
  let skippedTotals = 0
  for (let r = best.row + 1; r < best.aoa.length; r++) {
    const cells = best.aoa[r] ?? []
    if (cells.every((c) => String(c ?? '').trim() === '')) continue
    const firstText = String(cells.find((c) => String(c ?? '').trim() !== '') ?? '').trim()
    if (TOTAL_ROW.test(firstText)) {
      skippedTotals++
      continue
    }
    const row: Record<string, unknown> = { __row: r + 1 }
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? ''
    })
    rows.push(row)
  }

  if (wb.SheetNames.length > 1 || best.row > 0) {
    notes.push(`Read sheet "${best.sheet}", header on row ${best.row + 1}.`)
  }
  if (skippedTotals) notes.push(`Skipped ${skippedTotals} total/summary row(s).`)
  if (decimalComma) notes.push('Read as a semicolon-separated file with decimal commas (0,5 = 0.5).')
  return {
    rows,
    headers,
    timeHints,
    massHints,
    powerHints,
    sheetName: best.sheet,
    headerRow: best.row + 1,
    decimalComma,
    notes,
  }
}

/** Plain text of a workbook (every sheet), for the AI fallback. */
export function workbookText(buf: Buffer, filename: string): string {
  const { wb } = readWorkbook(buf, filename)
  return wb.SheetNames.map(
    (s) => `Sheet: ${s}\n${XLSX.utils.sheet_to_csv(wb.Sheets[s], { blankrows: false })}`,
  ).join('\n\n')
}
