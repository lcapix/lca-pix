/**
 * The student's Home (E13, E15): someone whose projects are shared with them
 * and who runs none. Each shared project shows who it is from and what they
 * may do, the owner's cases with their answers, and their own case (or the
 * way to make it). Pure; the cards read the project and progress routes.
 */

import { caseTotal, fixed } from '@/lib/ui/format'
import type { HomeProject } from './home-view'

/** No project of their own to run (owner or admin), and at least one shared with them. */
export function isStudentHome(projects: HomeProject[], userId: number): boolean {
  const real = projects.filter((p) => !p.is_sample)
  if (!real.length) return false
  const runs = real.some((p) => p.owner_id === userId || p.permission_name === 'owner' || p.permission_name === 'admin')
  return !runs
}

/** "1 project shared with you · deadlines and grades stay in Canvas". */
export function sharedLine(n: number, lms: string | null): string {
  const head = `${n} ${n === 1 ? 'project' : 'projects'} shared with you`
  return lms ? `${head} · deadlines and grades stay in ${lms}` : head
}

/** "From Dr. Elena Rivera · you can change · 1 bracket · TRACI 2.1 · US". */
export function fromLine(p: { owner: string | null; role: string | null; fu: string | null; method: string | null; region: string | null }): string {
  const can = p.role === 'viewer' ? 'you can read' : 'you can change'
  return [p.owner ? `From ${p.owner}` : null, can, p.fu, p.method, p.region].filter(Boolean).join(' · ')
}

/** "Dr. Rivera's" from "Dr. Elena Rivera"; "Elena's" for a plain name. */
export function ownerPossessive(name: string | null | undefined): string {
  const t = (name ?? '').trim()
  if (!t) return "The owner's"
  const parts = t.split(/\s+/)
  const titled = /^(dr|prof|professor|mr|mrs|ms|mx)\.?$/i.test(parts[0])
  return `${titled && parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0]}'s`
}

/** The case name a student starts with: "Noah's case". */
export function defaultCaseName(fullName: string | null | undefined): string {
  const first = (fullName ?? '').trim().split(/\s+/)[0]
  return first ? `${first}'s case` : 'My case'
}

interface ListedCase {
  case_id: number
  case_name: string
  case_type: string
  created_by: number | null
  is_final?: boolean
  latest_run: { run_id: number; headline: { value: number; unit: string } | null } | null
}

/** The owner's (and admins') cases, base cases first, each with its answer and a copy's change against the base. */
export function staffCases<C extends ListedCase>(cases: C[], staff: Set<number>): Array<C & { answer: string | null; change: string | null }> {
  const theirs = cases.filter((c) => c.created_by != null && staff.has(c.created_by))
  theirs.sort((a, b) => (a.case_type === b.case_type ? a.case_id - b.case_id : a.case_type === 'base' ? -1 : 1))
  const base = theirs.find((c) => c.case_type === 'base')?.latest_run?.headline?.value ?? null
  return theirs.map((c) => {
    const v = c.latest_run?.headline?.value
    const answer = v == null ? null : caseTotal(v, c.case_type)
    let change: string | null = null
    if (v != null && base != null && c.case_type !== 'base' && base !== 0) {
      const a = Number(fixed(v, 3))
      const b = Number(fixed(base, 3))
      change = a === b ? 'same as the base' : `${fixed((Math.abs(a - b) / Math.abs(b)) * 100, 1)}% ${a < b ? 'lower' : 'higher'}`
    }
    return { ...c, answer, change }
  })
}

/** Their own case: the one ticked as hand-in, else the newest. */
export function ownCase<C extends ListedCase>(cases: C[], userId: number): C | null {
  const mine = cases.filter((c) => c.created_by === userId).sort((a, b) => b.case_id - a.case_id)
  return mine.find((c) => c.is_final) ?? mine[0] ?? null
}
