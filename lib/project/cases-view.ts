/**
 * The Cases page (E07 pipeline, E07b table): your cases and the class's, the
 * four columns with each card's words, the header line, who has no case yet,
 * search, and the table's order. Pure; the page reads the progress route.
 */

import { PIPELINE_LABEL, type PipelineStage } from '@/lib/summary/case-summary'
import { caseTotal, fixed } from '@/lib/ui/format'

export interface ProgressCase {
  case_id: number
  case_name: string
  case_type: 'base' | 'comparative' | string
  description?: string | null
  created_by: number | null
  author: string | null
  stage: PipelineStage
  created_at?: string | null
  latest_run: { run_id: number; method?: string | null; region?: string | null; headline: { value: number; unit: string } | null } | null
}

export const STAGES: PipelineStage[] = ['not_run', 'run', 'written', 'handed_in']

/** The card's one tag: what is missing next (or that it is ticked). */
export const CARD_TAG: Record<PipelineStage, { text: string; tone: 'warn' | 'info' | 'plain' | 'good' }> = {
  not_run: { text: 'No run yet', tone: 'warn' },
  run: { text: 'No write-up yet', tone: 'info' },
  written: { text: 'Not ticked as hand-in', tone: 'plain' },
  handed_in: { text: '✓ Ticked as hand-in', tone: 'good' },
}

/** The four segments under a card: one filled per stage reached (copied is the first). */
export const segmentsFilled = (stage: PipelineStage) => STAGES.indexOf(stage) + 1

export function splitCases<C extends ProgressCase>(cases: C[], userId: number): { mine: C[]; others: C[] } {
  return { mine: cases.filter((c) => c.created_by === userId), others: cases.filter((c) => c.created_by !== userId) }
}

/** "34 cases · 2 yours, 32 from students · TRACI 2.1 · US". */
export function casesHeader(n: { all: number; mine: number; others: number }, word: 'student' | 'member', scope: string | null): string {
  const parts = [`${n.all} ${n.all === 1 ? 'case' : 'cases'}`]
  if (n.others) parts.push(`${n.mine} yours, ${n.others} from ${word}s`)
  if (scope) parts.push(scope)
  return parts.join(' · ')
}

/** The answer a card or row shows (2 places for a base case, 3 for a copy), or null. */
export function answerOf(c: ProgressCase): string | null {
  const v = c.latest_run?.headline?.value
  return v === undefined || v === null ? null : caseTotal(v, c.case_type)
}

/** Against the Base case: "▼ 3.1%" (at the 3 places shown), or null. */
export function changeVsBase(c: ProgressCase, base: ProgressCase | undefined): string | null {
  const a = c.latest_run?.headline?.value
  const b = base?.latest_run?.headline?.value
  if (a == null || b == null || !b || c.case_id === base?.case_id) return null
  const d = (Number(fixed(a, 3)) - Number(fixed(b, 3))) / Number(fixed(b, 3))
  if (Math.abs(d) < 0.0005) return 'Same'
  return `${d < 0 ? '▼' : '▲'} ${fixed(Math.abs(d) * 100, 1)}%`
}

/** Members who can make a case (not the owner, not readers) and have none yet. */
export function noCaseYet(members: Array<{ user_id: number; permission_name?: string | null }>, cases: ProgressCase[]): number {
  const authors = new Set(cases.map((c) => c.created_by))
  // Someone who can only read cannot make a case, so they are not waiting on one.
  return members.filter((m) => m.permission_name !== 'viewer' && !authors.has(Number(m.user_id))).length
}

/** Find a student or case: by the person's name or the case's. */
export function matchesSearch(c: ProgressCase, q: string): boolean {
  const t = q.trim().toLowerCase()
  return !t || (c.author ?? '').toLowerCase().includes(t) || c.case_name.toLowerCase().includes(t)
}

/** The table's order: furthest along first, then by name. */
export function byStage(a: ProgressCase, b: ProgressCase): number {
  return STAGES.indexOf(b.stage) - STAGES.indexOf(a.stage) || (a.author ?? '').localeCompare(b.author ?? '')
}

export { PIPELINE_LABEL }
