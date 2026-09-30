/**
 * Strict parsing for numeric ids taken from URLs, query strings and bodies.
 *
 * `parseInt` and `Number` both accept more than a plain id: `parseInt('0x1F')`
 * and `Number('0x1F')` are 31, `parseInt('31abc')` is 31, `Number('1e1')` is 10.
 * Routes that used them answered `/api/projects/0x1F` with project 31. An id is
 * only ever plain decimal digits with no sign, leading zero, whitespace or
 * suffix, and fits a signed INT column.
 *
 * Returns NaN for anything else, so existing `Number.isNaN` / falsy checks and
 * "no row found → 404" lookups keep working unchanged.
 */
const MAX_INT_ID = 2147483647

export function parseId(raw: unknown): number {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw > 0 && raw <= MAX_INT_ID ? raw : NaN
  }
  if (typeof raw !== 'string' || !/^[1-9][0-9]{0,9}$/.test(raw)) return NaN
  const n = Number(raw)
  return n <= MAX_INT_ID ? n : NaN
}
