/**
 * The Cases page (E07 pipeline, E07b table): your cases and the class's, the
 * four columns with each card's words, the header line, who has no case yet,
 * search, and the table's order. Pure; the page reads the progress route.
 */

import { PIPELINE_LABEL as STAGE_WORDS, type PipelineStage } from '@/lib/summary/case-summary'
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
  latest_run: { run_id: number; case_run_number?: number | null; method?: string | null; region?: string | null; headline: { value: number; unit: string } | null } | null
  /** Progress, as the progress route reads it from the case (C03, P38 to P41). */
  steps?: number
  flows?: number
  runs?: number
  lessons_total?: number
  lessons_answered?: string[]
  prediction_made?: boolean
  has_interpretation?: boolean
  has_assumptions?: boolean
  /** The assignment a working case or a hand-in belongs to (migrate-043). */
  assignment_id?: number | null
  read_only?: boolean
  /** D3: a read-only copy made by Hand in: the hand-in itself, with the run it was handed in with. */
  handed_in?: boolean
  handed_in_at?: string | null
  /** The working case a hand-in froze, when the caller reaches it. */
  working_case_id?: number | null
}

/** The lessons answered, as "Lessons 3 of 6, predicted", and their titles for a hover (P40). */
export function lessonsOf(c: ProgressCase, titles: Record<string, string>): { text: string; title: string } | null {
  const done = c.lessons_answered ?? []
  // G4: "Lessons 0 of 6" says nothing on a case where no lesson was taken.
  if (!c.lessons_total || (!done.length && !c.prediction_made)) return null
  return {
    text: `Lessons ${done.length} of ${c.lessons_total}${c.prediction_made ? ', predicted' : ''}`,
    title: done.length ? `Answered: ${done.map((id) => titles[id] ?? id).join(', ')}` : 'No lesson answered yet',
  }
}

/** The write-up as it stands (P41): written with its assumptions, written, or not yet. */
export function writeUpOf(c: ProgressCase): string {
  if (c.has_interpretation && c.has_assumptions) return 'Write-up with assumptions'
  if (c.has_interpretation) return 'Write-up'
  if (c.has_assumptions) return 'Assumptions only'
  return 'No write-up yet'
}

export const STAGES: PipelineStage[] = ['not_run', 'run', 'written', 'handed_in']

/** The card's one tag: what is missing next (or that it is ticked). */
export const CARD_TAG: Record<PipelineStage, { text: string; tone: 'warn' | 'info' | 'plain' | 'good' }> = {
  not_run: { text: 'No run yet', tone: 'warn' },
  run: { text: 'No write-up yet', tone: 'info' },
  written: { text: 'Not handed in', tone: 'plain' },
  handed_in: { text: '✓ Handed in', tone: 'good' },
}

/** The board's column names: one hand-in, the one Assignments makes (D4). */
export const PIPELINE_LABEL: Record<PipelineStage, string> = { ...STAGE_WORDS, handed_in: 'Handed in' }

/** A hand-in's frozen copy (D3): shown as the hand-in, never counted as another case. */
export const isHandIn = (c: object) => !!(c as Pick<ProgressCase, 'handed_in'>).handed_in

/** The cases a project counts: its own and its copies, not the frozen hand-ins (D3). */
export const countedCases = <C extends object>(cases: C[]): C[] => cases.filter((c) => !isHandIn(c))

/** The four segments under a card: one filled per stage reached (copied is the first). */
export const segmentsFilled = (stage: PipelineStage) => STAGES.indexOf(stage) + 1

export function splitCases<C extends ProgressCase>(cases: C[], userId: number): { mine: C[]; others: C[] } {
  return { mine: cases.filter((c) => c.created_by === userId), others: cases.filter((c) => c.created_by !== userId) }
}

/** "34 cases · 2 yours, 32 from students · TRACI 2.1 · US". */
export function casesHeader(n: { all: number; mine: number; others: number; handIns?: number }, word: 'student' | 'member', scope: string | null): string {
  const parts = [`${n.all} ${n.all === 1 ? 'case' : 'cases'}`]
  if (n.others) parts.push(`${n.mine} yours, ${n.others} from ${word}s`)
  if (n.handIns) parts.push(`${n.handIns} handed in`)
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
  // Someone who can only read, or who owns the project, is not waiting on a case of their own.
  return members.filter((m) => m.permission_name !== 'viewer' && m.permission_name !== 'owner' && !authors.has(Number(m.user_id))).length
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

