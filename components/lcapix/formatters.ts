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

export function fmtInt(n: number): string {
  return Number(n).toLocaleString('en-US')
}
