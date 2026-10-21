/**
 * Check what we read, Steps and hours (F2.3): the steps a routing gave, each
 * with its hours per unit and where in the file it was read; the total of the
 * ticked steps; and leaving a step out. An unticked step leaves with every
 * step under it and their lines and costs, so nothing is saved onto a step
 * that does not exist. Pure, so each rule is tested.
 */

import type { IngestPlan } from '@/lib/ingest/maplca'

export interface StepHoursRow {
  /** The step's name as the plan has it (edits are keyed by it). */
  name: string
  tier: string
  /** Labour hours per unit, summed over the step's labour costs; null when none. */
  hours: number | null
  /** "p.1 · line 3", from the provenance locator. */
  where: string | null
}

/** The steps that carry the work: operations, else the plan's leaf steps, in plan order. */
export function stepsAndHours(plan: Pick<IngestPlan, 'nodes' | 'costs'>): StepHoursRow[] {
  const parents = new Set(plan.nodes.map((n) => n.parent).filter(Boolean) as string[])
  const ops = plan.nodes.filter((n) => n.tier === 'operation')
  const pick = ops.length ? ops : plan.nodes.filter((n) => !parents.has(n.name) && n.parent !== null)
  return pick.map((n) => {
    const labour = plan.costs.filter((c) => c.node === n.name && c.category === 'labor' && Number.isFinite(Number(c.hours)))
    return {
      name: n.name,
      tier: n.tier,
      hours: labour.length ? labour.reduce((t, c) => t + Number(c.hours), 0) : null,
      where: shortLocator(n.provenance?.locator ?? null),
    }
  })
}

/** "page 1, line 3" → "p.1 · line 3"; "Routing x.csv, row 2" → "row 2"; anything else as written. */
export function shortLocator(locator: string | null): string | null {
  if (!locator) return null
  const m = locator.match(/page\s*(\d+)[^\d]+(?:line|row)\s*(\d+)/i)
  if (m) return `p.${m[1]} · line ${m[2]}`
  const r = locator.match(/\b(row|line)\s*(\d+)\b/i)
  return r ? `${r[1].toLowerCase()} ${r[2]}` : locator
}

/** The total hours of the ticked steps. */
export function tickedHours(rows: StepHoursRow[], dropped: ReadonlySet<string>): number {
  return rows.filter((r) => !dropped.has(r.name)).reduce((t, r) => t + (r.hours ?? 0), 0)
}

/** The dropped steps and every step under them (names as `nodes` has them). */
export function droppedWithChildren(nodes: Array<{ name: string; parent: string | null }>, dropped: ReadonlySet<string>): Set<string> {
  const out = new Set([...dropped].filter((d) => nodes.some((n) => n.name === d)))
  let grew = true
  while (grew) {
    grew = false
    for (const n of nodes) {
      if (n.parent && out.has(n.parent) && !out.has(n.name)) {
        out.add(n.name)
        grew = true
      }
    }
  }
  return out
}

/** An apply body for a new case without the dropped steps, their lines and their costs. */
export function withoutSteps<B extends { nodes?: Array<{ name: string; parent: string | null }>; flows: Array<{ node: string }>; costs: Array<{ node: string }> }>(
  body: B,
  dropped: ReadonlySet<string>,
): B {
  if (!dropped.size || !body.nodes) return body
  const gone = droppedWithChildren(body.nodes, dropped)
  return {
    ...body,
    nodes: body.nodes.filter((n) => !gone.has(n.name)),
    flows: body.flows.filter((f) => !gone.has(f.node)),
    costs: body.costs.filter((c) => !gone.has(c.node)),
  }
}
