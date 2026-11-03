/**
 * Number display for the education screens. JavaScript's toFixed rounds the
 * binary value (0.0175 → "0.017", 0.0525 → "0.052"); the screens round the
 * decimal a person reads half away from zero (0.018, 0.053), as the design's
 * figures do. Shifting through the exponent in a string keeps it exact.
 */

/** `x` to `d` decimals, half away from zero, as a string ("0.018"). */
export function fixed(x: number, d: number): string {
  if (!Number.isFinite(x)) return '–'
  const sign = x < 0 ? -1 : 1
  // Float noise first: 0.05 × 0.35 is 0.017499999999999998 in binary, and a
  // person reads 0.0175. Twelve significant digits is far past anything shown.
  // Shift through the exponent of the exponential form, which also holds for
  // 1e-7 (whose plain string "1e-7" cannot take another "e3").
  const [mantissa, exp] = Number(Math.abs(x).toPrecision(12)).toExponential().split('e')
  const shifted = Math.round(Number(`${mantissa}e${Number(exp) + d}`))
  const v = sign * Number(`${shifted}e-${d}`)
  return (Object.is(v, -0) ? 0 : v).toFixed(d)
}

const SUPERSCRIPT: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }

/**
 * UX 7: `x` to 3 significant figures, the way a student is taught to report a
 * result: trailing zeros kept (1.70), half away from zero like fixed(), no
 * thousands separator (grouped() adds one). Below 0.000001 it reads
 * "1.30 × 10⁻⁷". Exports keep every digit; this is for reading only.
 */
export function sig3(x: number): string {
  if (!Number.isFinite(x)) return '–'
  if (x === 0) return '0'
  const mag = Math.floor(Math.log10(Math.abs(Number(Math.abs(x).toPrecision(12)))))
  if (mag < -6) {
    const [m, e] = x.toExponential(2).split('e')
    return `${m} × 10${String(Number(e)).replace(/./g, (c) => SUPERSCRIPT[c] ?? c)}`
  }
  const d = 2 - mag
  if (d >= 0) return fixed(x, d)
  const unit = 10 ** -d
  return String(Number(fixed(x / unit, 0)) * unit)
}

/** A total as the screens show it, to 3 significant figures (UX 7); no thousands separator, so Number() reads it back. */
export function caseTotal(x: number, _caseType?: 'base' | 'comparative' | string): string {
  // Below 0.000001 sig3 writes "× 10⁻⁷", which Number() cannot read; "1.30e-7" it can.
  return x !== 0 && Number.isFinite(x) && Math.abs(x) < 1e-6 ? x.toPrecision(3) : sig3(x)
}

/** A share of a total, 1 decimal ("89.4%"); the total rounded as shown first (rules.md). */
export function share(part: number, total: number): string {
  if (!total) return '–'
  return `${fixed((part / total) * 100, 1)}%`
}

/** An amount as entered: no trailing zeros forced, at most 4 decimals ("0.8", "0.0013", "12"). */
export function amount(x: number | null | undefined): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '–'
  const a = Math.abs(x)
  if (a !== 0 && a < 0.0001) return x.toExponential(2)
  return String(Number(fixed(x, 4)))
}

/** An amount box value with the design's two places when short ("0.80", "0.12", "0.0013", "1"). */
export function amountBox(x: number | null | undefined): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return ''
  const s = amount(x)
  const decimals = s.includes('.') ? s.split('.')[1].length : 0
  return decimals === 1 ? fixed(x, 2) : s
}

/** "kg CO2 eq" → "kg CO₂-eq" for display. */
export function co2Unit(unit: string | null | undefined): string {
  return String(unit ?? 'kg CO2 eq').replace(/CO2(\s*eq)?/i, 'CO₂-eq').replace(/CO₂-eq\.?/, 'CO₂-eq')
}

/** Money in cents with thousands grouped ("$0.55", "$1.75", "$101,150.00"): one format on every screen. */
export function money(x: number | null | undefined, currency = 'USD'): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '–'
  const symbol = currency === 'USD' ? '$' : `${currency} `
  return `${x < 0 ? '−' : ''}${symbol}${grouped(fixed(Math.abs(x), 2))}`
}

/** Thousands grouped for reading ("1,520.158"). Display only: Number() cannot read it back. */
export function grouped(s: string): string {
  const [int, dec] = s.split('.')
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${dec !== undefined ? `.${dec}` : ''}`
}

/** A case's answer as the screens print it: 3 significant figures with thousands grouped. */
export function answer(x: number, caseType?: 'base' | 'comparative' | string): string {
  return grouped(caseTotal(x, caseType))
}

/**
 * A result to 3 significant figures (UX 7), grouped. A small value still
 * shows its digits ("0.000130"), so it never reads as nothing (RUN-2).
 */
export function result3(x: number): string {
  return grouped(sig3(x))
}
