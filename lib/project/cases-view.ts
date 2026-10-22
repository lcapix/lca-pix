/**
 * The Cases list (E07): your cases and everyone else's, each with its latest
 * answer, the header line, and search. Pure; the page reads the case
 * summaries route.
 */

import { caseTotal, fixed } from '@/lib/ui/format'

export interface CaseSummary {
  case_id: number
  case_name: string
  case_type: 'base' | 'comparative' | string
  description?: string | null
  created_by: number | null
  author: string | null
  created_at?: string | null
  latest_run: { run_id: number; method?: string | null; region?: string | null; headline: { value: number; unit: string } | null } | null
}

export function splitCases<C extends CaseSummary>(cases: C[], userId: number): { mine: C[]; others: C[] } {
  return { mine: cases.filter((c) => c.created_by === userId), others: cases.filter((c) => c.created_by !== userId) }
}

/** "34 cases · 2 yours, 32 from others · TRACI 2.1 · US". */
export function casesHeader(n: { all: number; mine: number; others: number }, scope: string | null): string {
  const parts = [`${n.all} ${n.all === 1 ? 'case' : 'cases'}`]
  if (n.others) parts.push(`${n.mine} yours, ${n.others} from others`)
  if (scope) parts.push(scope)
  return parts.join(' · ')
}

/** The answer a card or row shows (2 places for a base case, 3 for a copy), or null. */
export function answerOf(c: CaseSummary): string | null {
  const v = c.latest_run?.headline?.value
  return v === undefined || v === null ? null : caseTotal(v, c.case_type)
}

/** Against the Base case: "▼ 3.1%" (at the 3 places shown), or null. */
export function changeVsBase(c: CaseSummary, base: CaseSummary | undefined): string | null {
  const a = c.latest_run?.headline?.value
  const b = base?.latest_run?.headline?.value
  if (a == null || b == null || !b || c.case_id === base?.case_id) return null
  const d = (Number(fixed(a, 3)) - Number(fixed(b, 3))) / Number(fixed(b, 3))
  if (Math.abs(d) < 0.0005) return 'Same'
  return `${d < 0 ? '▼' : '▲'} ${fixed(Math.abs(d) * 100, 1)}%`
}

/** Find a person or case: by the person's name or the case's. */
export function matchesSearch(c: CaseSummary, q: string): boolean {
  const t = q.trim().toLowerCase()
  return !t || (c.author ?? '').toLowerCase().includes(t) || c.case_name.toLowerCase().includes(t)
}
