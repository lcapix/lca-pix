// Number formatting helpers mirrored from LCAPIX/shared.jsx lines 95-99

export function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function fmtInt(n: number): string {
  return Number(n).toLocaleString('en-US')
}
