/**
 * One way to print a run's numbers on the Results tab and on the full results
 * page (A8), so the same number never reads two ways (0.0066 against 0.007).
 *
 * The climate answer uses the case total's decimals (rules.md: 2 for a Base
 * case, 3 for a comparative case); every other category and every step value
 * uses three decimals, and a value too small for three says "< 0.001".
 */

import { answer, result3 } from '@/lib/ui/format'

const CLIMATE = /global\s*warming|climate/i

/** The headline of a run in one category, as both result screens print it. */
export function headlineNumber(value: number, category: string, caseType: string): string {
  return CLIMATE.test(category) ? answer(value, caseType) : result3(value)
}

/** A category or step value anywhere else on the two screens. */
export function categoryNumber(value: number): string {
  return result3(value)
}
