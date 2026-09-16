// Tolerant value parsing for spreadsheet ingestion. Real exports write the
// same number many ways: "0,5" (European decimal comma), "1,200.5", "1/2",
// "1 1/2", "3-4" (a range), "4861.20 g" (unit in the cell), "20 min", "1:30"
// (h:mm), "2.5 hrs". Everything here returns what the cell SAYS; a range is
// read as its midpoint and flagged as an estimate, never silently.

export interface ParsedNumber {
  value: number
  /** Unit written in the cell itself ("g" in "4861.20 g"). */
  unit?: string
  /** True when the cell held a range and the midpoint was used. */
  estimate?: boolean
}

function toNumber(raw: string, decimalComma: boolean): number {
  let t = raw.replace(/[\s ']/g, '')
  if (decimalComma) {
    t = t.replace(/\./g, '').replace(',', '.') // 1.234,5 -> 1234.5
  } else if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) {
    t = t.replace(/,/g, '') // 1,234.5 -> 1234.5
  } else if (/^[-+]?\d+,\d+$/.test(t)) {
    t = t.replace(',', '.') // a lone decimal comma: 0,5 -> 0.5
  }
  return Number(t)
}

const NUM = String.raw`[-+]?\d[\d.,\s']*`

/** Parse a quantity-like cell. Returns null when the cell holds no number. */
export function parseQuantity(v: unknown, opts: { decimalComma?: boolean } = {}): ParsedNumber | null {
  if (typeof v === 'number') return Number.isFinite(v) ? { value: v } : null
  let s = String(v ?? '').replace(/[$€£]/g, '').trim()
  if (!s) return null
  const dc = !!opts.decimalComma
  let m: RegExpMatchArray | null

  // Mixed fraction "1 1/2 in", plain fraction "1/2".
  if ((m = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)\s*([A-Za-zµ%³²."]*)$/))) {
    const d = Number(m[3])
    if (d) return { value: Number(m[1]) + Number(m[2]) / d, unit: m[4] || undefined }
  }
  if ((m = s.match(/^(\d+)\s*\/\s*(\d+)\s*([A-Za-zµ%³²."]*)$/))) {
    const d = Number(m[2])
    if (d) return { value: Number(m[1]) / d, unit: m[3] || undefined }
  }
  // Range "3-4", "3 – 4", "3 to 4": midpoint, flagged.
  if ((m = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:[.,]\d+)?)\s*([A-Za-zµ%³²."]*)$/i))) {
    const a = toNumber(m[1], dc)
    const b = toNumber(m[2], dc)
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return { value: (a + b) / 2, unit: m[3] || undefined, estimate: true }
    }
  }
  // Number with an optional unit after it.
  if ((m = s.match(new RegExp(`^(${NUM})\\s*([A-Za-zµ%³²."/]*)$`)))) {
    const n = toNumber(m[1], dc)
    if (Number.isFinite(n)) return { value: n, unit: m[2] ? m[2].replace(/\.$/, '') || undefined : undefined }
  }
  s = s.replace(/,/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? { value: n } : null
}

export type TimeUnit = 'h' | 'min' | 'sec'

/** Normalize a time-unit word ("MIN", "hrs", "Minutes", "S") to h / min / sec. */
export function timeUnit(u: unknown): TimeUnit | null {
  const s = String(u ?? '').trim().toLowerCase().replace(/\.$/, '')
  if (!s) return null
  if (/^(h|hr|hrs|hour|hours|std|stunden)$/.test(s)) return 'h'
  if (/^(min|mins|minute|minutes|mn)$/.test(s)) return 'min'
  if (/^(s|sec|secs|second|seconds)$/.test(s)) return 'sec'
  return null
}

const TO_HOURS: Record<TimeUnit, number> = { h: 1, min: 1 / 60, sec: 1 / 3600 }

/**
 * Parse a duration cell into hours. `unitHint` comes from the header
 * ("Time (min)") or a companion unit column; a unit written in the cell
 * ("20 min", "1:30", "2.5 hrs") always wins. Bare numbers with no hint are hours.
 */
export function parseDurationHours(
  v: unknown,
  unitHint?: TimeUnit | null,
  opts: { decimalComma?: boolean } = {},
): number | null {
  if (v === null || v === undefined || v === '') return null
  const s = typeof v === 'number' ? String(v) : String(v).trim()
  const hms = s.match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/)
  if (hms) return Number(hms[1]) + Number(hms[2]) / 60 + (hms[3] ? Number(hms[3]) / 3600 : 0)
  const q = parseQuantity(v, opts)
  if (!q) return null
  const cellUnit = timeUnit(q.unit)
  const u = cellUnit ?? unitHint ?? 'h'
  return q.value * TO_HOURS[u]
}
