// Number formatting helpers mirrored from LCAPIX/shared.jsx lines 95-99

export function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined) return '—'
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  // A real but small contribution used to print as "0.00" (acidification rows
  // sit around 0.002 kg SO2 eq), which reads as "this flow does nothing".
  // Below the requested precision, switch to two significant digits.
  if (v !== 0 && Math.abs(v) < 1 / 10 ** digits) {
    if (Math.abs(v) < 1e-6) return v.toExponential(1)
    return v.toLocaleString('en-US', { maximumSignificantDigits: 2 })
  }
  return v.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/**
 * Significant-figure formatter for impact results, where one screen shows
 * 88,730 kg CO2 eq next to 4.2e-7 kg CFC-11 eq.
 *
 *  - never shows a non-zero value as 0: below 0.001 it switches to scientific
 *    notation ("4.2e-7"), trailing zeros dropped;
 *  - keeps every integer digit and adds thousands separators (1000 → "1,000",
 *    123456.7 → "123,457");
 *  - otherwise rounds to `sig` significant figures (2500.3 → "2,500",
 *    999.96 → "1,000", 0.0123456 → "0.01235");
 *  - keeps the sign, so credits read as credits ("-12.5").
 */
export function fmtSig(n: number | null | undefined, sig = 4): string {
  if (n === null || n === undefined) return '—'
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  if (v === 0) return '0'
  const abs = Math.abs(v)
  if (abs < 1e-3) {
    const [mantissa, exponent] = v.toExponential(Math.max(0, sig - 1)).split('e')
    const m = mantissa.includes('.') ? mantissa.replace(/0+$/, '').replace(/\.$/, '') : mantissa
    return `${m}e${Number(exponent)}`
  }
  if (abs >= 10 ** sig) return v.toLocaleString('en-US', { maximumFractionDigits: 0 })
  return v.toLocaleString('en-US', { maximumSignificantDigits: sig })
}

export function fmtInt(n: number): string {
  return Number(n).toLocaleString('en-US')
}
