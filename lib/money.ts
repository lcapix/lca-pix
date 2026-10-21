/**
 * Money for the user's locale: cents below 1,000 (so a $0.55 step never reads
 * as $1), whole units from 1,000 up, judged on the size of the amount so a
 * credit of -2,500 prints like 2,500. An unknown currency code falls back to a
 * "$" prefix.
 */
export function fmtMoney(v: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: Math.abs(v) >= 1000 ? 0 : 2,
    }).format(v)
  } catch {
    return `$${v.toLocaleString()}`
  }
}
