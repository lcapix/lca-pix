/**
 * Home's rules (behaviour spec "Sequence", E12): which Home a person sees, the
 * Continue card's four parts and its one next step, and the Needs attention
 * list. Pure, so every phrase is tested without a browser.
 */

export interface HomeProject {
  project_id: number
  project_name: string
  owner_id: number
  /** The owner's full name (else username). */
  owner_name?: string | null
  permission_name?: string | null
  case_count: number
  member_count: number
  /** The owner once plus every other member. */
  people: number
  held_lines: number
  held_case: { case_id: number; case_name: string | null } | null
  member_cases_without_run: number
  base_case_id: number | null
  base_run: { run_id: number; run_date: string; headline: { category: string; value: number; unit: string } | null } | null
  base_changed_after_run: boolean | null
}

/** A project from GET /api/projects as Home reads it (numbers coerced, summaries defaulted). */
export function toHomeProject(p: Record<string, any>): HomeProject {
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  return {
    project_id: n(p.project_id),
    project_name: String(p.project_name ?? ''),
    owner_id: n(p.owner_id),
    owner_name: p.owner_name ?? null,
    permission_name: p.permission_name ?? null,
    case_count: n(p.case_count),
    member_count: n(p.member_count),
    people: Math.max(1, n(p.people)),
    held_lines: n(p.held_lines),
    held_case: p.held_case ?? null,
    member_cases_without_run: n(p.member_cases_without_run),
    base_case_id: p.base_case_id == null ? null : n(p.base_case_id),
    base_run: p.base_run ?? null,
    base_changed_after_run: p.base_changed_after_run ?? null,
  }
}

/**
 * 'empty': no project yet: the two ways in.
 * 'later': an own project or a shared one exists: Continue, Needs attention, the list (E12).
 */
export function homeMode(projects: unknown[]): 'empty' | 'later' {
  return projects.length ? 'later' : 'empty'
}

/** "2 projects of yours · 1 shared with you". */
export function countsLine(projects: HomeProject[], userId: number): string {
  const own = projects.filter((p) => Number(p.owner_id) === userId).length
  const shared = projects.length - own
  const parts: string[] = []
  if (own) parts.push(`${own} ${own === 1 ? 'project' : 'projects'} of yours`)
  if (shared) parts.push(`${shared} shared with you`)
  return parts.join(' · ')
}

/** Whether the person runs the project (owner or admin): only they are told about its people. */
export const runsProject = (p: Pick<HomeProject, 'owner_id' | 'permission_name'>, userId: number) =>
  Number(p.owner_id) === userId || p.permission_name === 'owner' || p.permission_name === 'admin'

export interface AttentionItem {
  key: string
  kind: 'held' | 'changed' | 'no_run'
  title: string
  where: string
  action: string
  href: string
}

/**
 * Needs attention (E12), in the order a person would act: lines held from a
 * file, a base case changed after its run, members' cases with no run.
 */
export function needsAttention(projects: HomeProject[], userId: number): AttentionItem[] {
  const out: AttentionItem[] = []
  for (const p of projects) {
    if (p.held_lines > 0 && p.held_case) {
      out.push({
        key: `held-${p.project_id}`,
        kind: 'held',
        title: `${p.held_lines} ${p.held_lines === 1 ? 'line' : 'lines'} held`,
        where: `${p.project_name} · ${p.held_case.case_name ?? 'a case'}`,
        action: 'Fix',
        href: `/project/${p.project_id}/case/${p.held_case.case_id}?tab=inventory`,
      })
    }
  }
  for (const p of projects) {
    if (!p.base_changed_after_run || !p.base_run || !p.base_case_id) continue
    out.push({
      key: `changed-${p.project_id}`,
      kind: 'changed',
      title: `Base case changed after Run #${p.base_run.run_id}`,
      where: p.project_name,
      action: 'Run again',
      href: `/project/${p.project_id}/case/${p.base_case_id}`,
    })
  }
  for (const p of projects) {
    if (!runsProject(p, userId) || p.member_cases_without_run <= 0) continue
    const n = p.member_cases_without_run
    out.push({
      key: `norun-${p.project_id}`,
      kind: 'no_run',
      title: `${n} member ${n === 1 ? 'case has' : 'cases have'} no run yet`,
      where: p.project_name,
      action: 'See cases',
      href: `/project/${p.project_id}/cases`,
    })
  }
  return out
}

/** "34 cases · 31 people" / "1 case · just you". */
export function projectMeta(p: HomeProject): string {
  return [`${p.case_count} ${p.case_count === 1 ? 'case' : 'cases'}`, p.people <= 1 ? 'just you' : `${p.people} people`].join(' · ')
}

export interface ContinueInput {
  steps: number
  /** Flows counted in a run (not needing an amount, not left out). */
  flowsIn: number
  flowsTotal: number
  held: number
  needsAmount: number
  leftOut: number
  latestRunId: number | null
  changedAfterRun: boolean
  hasWriteUp: boolean
}

export interface ContinuePart {
  label: string
  /** 0..1 for the bar. */
  fill: number
  done: boolean
}

/** The four parts: Tree · 5 steps, Inventory · 15 of 18, Results · no run, Write-up · not started. */
export function continueParts(c: ContinueInput): ContinuePart[] {
  const lines = c.flowsTotal + c.held
  return [
    { label: `Tree · ${c.steps} ${c.steps === 1 ? 'step' : 'steps'}`, fill: c.steps > 0 ? 1 : 0, done: c.steps > 0 },
    {
      label: lines ? `Inventory · ${c.flowsIn} of ${lines}` : 'Inventory · empty',
      fill: lines ? c.flowsIn / lines : 0,
      done: lines > 0 && c.flowsIn === lines,
    },
    {
      label: c.latestRunId ? `Results · Run #${c.latestRunId}` : 'Results · no run',
      fill: c.latestRunId ? (c.changedAfterRun ? 0.5 : 1) : 0,
      done: !!c.latestRunId && !c.changedAfterRun,
    },
    {
      label: c.hasWriteUp ? 'Write-up · written' : 'Write-up · not started',
      fill: c.hasWriteUp ? 1 : 0,
      done: c.hasWriteUp,
    },
  ]
}

/** The one next step, and where its button goes. */
export function continueNext(c: ContinueInput): { line: string; tab: 'tree' | 'inventory' | 'results' | 'writeup'; button: string } {
  if (!c.steps) return { line: 'Next: add the first step.', tab: 'tree', button: 'Open the tree' }
  if (c.held) {
    const n = c.held
    return { line: `Next: give the ${n} held ${n === 1 ? 'line' : 'lines'} a value, then run it.`, tab: 'inventory', button: 'Open Inventory' }
  }
  if (c.needsAmount) {
    const n = c.needsAmount
    return { line: `Next: give ${n === 1 ? 'the flow' : `the ${n} flows`} an amount, then run it.`, tab: 'inventory', button: 'Open Inventory' }
  }
  if (c.leftOut) {
    const n = c.leftOut
    return { line: `Next: pick a unit that converts for the ${n === 1 ? 'flow' : `${n} flows`} left out, then run it.`, tab: 'inventory', button: 'Open Inventory' }
  }
  if (!c.flowsTotal) return { line: 'Next: add the flows each step uses.', tab: 'tree', button: 'Open the tree' }
  if (!c.latestRunId) return { line: 'Next: run it.', tab: 'tree', button: 'Open the tree' }
  if (c.changedAfterRun) return { line: `Next: run it again. It changed after Run #${c.latestRunId}.`, tab: 'tree', button: 'Open the tree' }
  if (!c.hasWriteUp) return { line: 'Next: write up what the result means.', tab: 'writeup', button: 'Open the write-up' }
  return { line: 'Next: compare it with another case, or export the report.', tab: 'results', button: 'Open Results' }
}
