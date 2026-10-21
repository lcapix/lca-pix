/**
 * A case on a phone (E16, E17), read only: the outline of the tree with
 * each step's share of the answer (a task shows its flow's amount), the
 * sources behind the climate answer, and the steps that add nothing.
 * Pure; read from the case's steps and flows and its run.
 */

import { amount, caseTotal, fixed, share as shareOf } from '@/lib/ui/format'
import type { SourceKind } from '@/lib/ui/words'
import { isClimate, sourceKindOf, type InventoryRow } from './inventory'
import type { Tier } from './tier-layout'

export function caseKind(caseType: string): string {
  return caseType === 'base' ? 'Base case' : 'Comparative case'
}

export interface OutlineStep {
  id: number
  parentId: number | null
  name: string
  tier: Tier
}

export interface OutlineRow {
  id: number
  name: string
  tier: Tier
  depth: number
  /** "89.2%", or a task's own amount ("0.0013 kWh"), or null. */
  right: string | null
  strong: boolean
  note: string | null
}

/**
 * The tree top down (each step after its parent, siblings in the order they
 * were made), with its share of the run's total. A task shows the amount of
 * its first flow, as the design's outline does; a step whose share is zero
 * says it has no counted climate flow.
 */
export function outlineRows(
  steps: OutlineStep[],
  sums: Map<number, number> | null,
  total: number | null,
  flows: InventoryRow[],
  caseType = 'comparative',
): OutlineRow[] {
  // Shares as Results shows them: of the total rounded as shown (rules.md).
  const shown = total == null ? null : Number(caseTotal(total, caseType))
  const kids = new Map<number | null, OutlineStep[]>()
  const ids = new Set(steps.map((s) => s.id))
  for (const s of steps) {
    const p = s.parentId != null && ids.has(s.parentId) ? s.parentId : null
    kids.set(p, [...(kids.get(p) ?? []), s])
  }
  for (const list of kids.values()) list.sort((a, b) => a.id - b.id)
  const firstFlow = new Map<number, InventoryRow>()
  for (const f of flows) if (!firstFlow.has(f.component_id)) firstFlow.set(f.component_id, f)
  const out: OutlineRow[] = []
  const seen = new Set<number>()
  const walk = (parent: number | null, depth: number) => {
    for (const s of kids.get(parent) ?? []) {
      if (seen.has(s.id)) continue
      seen.add(s.id)
      const v = sums?.get(s.id) ?? 0
      const pct = shown ? shareOf(Number(fixed(v, 3)), shown) : null
      const share = pct === '100.0%' ? '100%' : pct === '0.0%' ? '0%' : pct
      const f = firstFlow.get(s.id)
      const task = s.tier === 'elemental_task'
      out.push({
        id: s.id,
        name: s.name,
        tier: s.tier,
        depth,
        // A task shows its own flow's amount (or nothing); the steps above it, their share.
        right: task ? (f ? (f.amount == null ? 'no amount' : `${amount(f.amount)} ${f.unit}`) : null) : share,
        strong: s.tier === 'product' || s.tier === 'operation',
        note: s.tier === 'operation' && total && Math.abs(v) < 1e-12 ? 'No counted climate flow' : null,
      })
      walk(s.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

export interface SourceRow {
  substance: string
  source: string | null
  scope: string | null
  tag: SourceKind
  factor: number
  /** "per kg". */
  per: string
  impact: number
}

/** The factors behind the climate answer, one per substance and source, largest share first. */
export function sourcesOf(
  rows: Array<{ substance: string; category_name: string; factor: number; impact: number; unit: string; scope?: string | null; source?: string | null; conversion?: string | null }>,
): SourceRow[] {
  const by = new Map<string, SourceRow>()
  for (const r of rows) {
    if (!isClimate(r.category_name) || !r.factor) continue
    // A converted amount's factor is per the substance's own unit, which the conversion names last ("1 g = 0.001 kg").
    const per = r.conversion ? r.conversion.split(' ').pop() ?? r.unit : r.unit
    const key = `${r.substance}\u0000${r.source ?? ''}\u0000${r.scope ?? ''}`
    const row = by.get(key) ?? { substance: r.substance, source: sourceName(r.source), scope: r.scope ?? null, tag: sourceKindOf({ scope: r.scope, source: r.source }), factor: r.factor, per: `per ${per}`, impact: 0 }
    row.impact += r.impact
    by.set(key, row)
  }
  return [...by.values()].sort((a, b) => b.impact - a.impact)
}

/** "40. Pack and ship adds 0. It has no counted climate flow." for each operation with nothing counted. */
export function zeroLines(builds: Array<{ name: string; value: number }>): string[] {
  return builds.filter((b) => Math.abs(b.value) < 1e-12).map((b) => `${b.name} adds 0. It has no counted climate flow.`)
}

/** A factor's source as a reader names it: the citation up to its first note ("EPA eGRID 2023 US national average"). */
export function sourceName(source: string | null | undefined): string | null {
  const t = (source ?? '').split(/\s\(|;|\s\[/)[0].trim()
  return t || null
}
