// What differs between two cases, read the way a practitioner reads a
// scenario (openLCA calls these the project variants): the scope each run was
// computed under, the steps, the exchanges on each step (swapped, changed,
// added, removed) and the step costs.
//
// Steps are matched by their path of names from the product down, because a
// duplicate keeps every name. Exchanges on a matched step are matched by
// substance, direction and amount; what is left over pairs up as a swap when
// the direction and unit family agree (aluminum 2.2 kg -> steel 2.34 kg).
//
// Pure module: no DB.

import { convertQuantity, unitFamily } from '@/lib/units'

export const COST_KEYS = [
  'material',
  'labor',
  'energy',
  'transportation',
  'equipment',
  'overhead',
  'opex',
  'capex',
] as const
export type CostKey = (typeof COST_KEYS)[number]

export interface InventoryStep {
  id: string
  /** Names from the product down to this step. */
  path: string[]
  name: string
  type: string
  costs: Record<CostKey, number>
  laborHours: number | null
}

export interface InventoryFlow {
  stepId: string
  substance: string
  dir: 'input' | 'output'
  quantity: number
  unit: string
}

export interface CaseInventory {
  steps: InventoryStep[]
  flows: InventoryFlow[]
}

export interface FlowSide {
  substance: string
  dir: 'input' | 'output'
  quantity: number
  unit: string
}

export type FlowChange =
  | { kind: 'swapped'; step: string; from: FlowSide; to: FlowSide }
  | { kind: 'changed'; step: string; from: FlowSide; to: FlowSide }
  | { kind: 'added'; step: string; to: FlowSide }
  | { kind: 'removed'; step: string; from: FlowSide }

export interface StepChange {
  kind: 'added' | 'removed'
  step: string
  path: string[]
}

export interface CostChange {
  step: string
  kind: CostKey
  from: number
  to: number
}

export interface HoursChange {
  step: string
  from: number | null
  to: number | null
}

export interface CaseDiff {
  steps: StepChange[]
  flows: FlowChange[]
  costs: CostChange[]
  hours: HoursChange[]
  /** Steps whose exchanges changed while none of their costs did. */
  costUnchanged: string[]
  identical: boolean
}

/** Scope a run was computed under, plus the case settings that feed it. */
export interface RunScope {
  method: string | null
  region: string | null
  functionalUnit: string | null
  boundary: string | null
  referenceFlow: number | null
  referenceFlowUnit: string | null
  modeledOutput: number | null
}

export interface ScopeDifference {
  label: string
  base: string
  other: string
}

const CENT = 0.005
const same = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))
const sideOf = (f: InventoryFlow): FlowSide => ({
  substance: f.substance,
  dir: f.dir,
  quantity: f.quantity,
  unit: f.unit,
})
const keyOf = (path: string[]) => path.join(' › ')
const subKey = (f: InventoryFlow) => `${f.substance.trim().toLowerCase()}|${f.dir}`

/**
 * Quantity of b expressed in a's unit, or null when the units do not convert.
 * lib/units decides, as the engine does: 'Mg' is not 'mg', 'm³' is 'm3'.
 */
function inUnitOf(a: InventoryFlow, b: InventoryFlow): number | null {
  return convertQuantity(b.quantity, b.unit, a.unit)?.quantity ?? null
}

/** Relative distance between two amounts in comparable units (Infinity if not comparable). */
function distance(a: InventoryFlow, b: InventoryFlow): number {
  const bq = inUnitOf(a, b)
  if (bq === null) return Infinity
  return Math.abs(a.quantity - bq) / Math.max(Math.abs(a.quantity), Math.abs(bq), 1e-12)
}

/** Greedy closest pairs between two lists, by the given distance; Infinity never pairs. */
function pairClosest<T>(
  left: T[],
  right: T[],
  dist: (a: T, b: T) => number,
): { pairs: Array<[T, T]>; left: T[]; right: T[] } {
  const candidates: Array<{ i: number; j: number; d: number }> = []
  left.forEach((a, i) =>
    right.forEach((b, j) => {
      const d = dist(a, b)
      if (Number.isFinite(d)) candidates.push({ i, j, d })
    }),
  )
  candidates.sort((x, y) => x.d - y.d || x.i - y.i || x.j - y.j)
  const usedL = new Set<number>()
  const usedR = new Set<number>()
  const pairs: Array<[T, T]> = []
  for (const c of candidates) {
    if (usedL.has(c.i) || usedR.has(c.j)) continue
    usedL.add(c.i)
    usedR.add(c.j)
    pairs.push([left[c.i], right[c.j]])
  }
  return {
    pairs,
    left: left.filter((_, i) => !usedL.has(i)),
    right: right.filter((_, j) => !usedR.has(j)),
  }
}

function diffStepFlows(step: string, base: InventoryFlow[], other: InventoryFlow[]): FlowChange[] {
  const changes: FlowChange[] = []

  // 1. Same substance, direction and amount: unchanged.
  let b = [...base]
  let o = [...other]
  const exact = pairClosest(b, o, (x, y) =>
    subKey(x) === subKey(y) && distance(x, y) <= 1e-9 ? 0 : Infinity,
  )
  b = exact.left
  o = exact.right

  // 2. Same substance and direction, different amount: changed.
  const sameSub = pairClosest(b, o, (x, y) => (subKey(x) === subKey(y) ? distance(x, y) : Infinity))
  for (const [x, y] of sameSub.pairs) changes.push({ kind: 'changed', step, from: sideOf(x), to: sideOf(y) })
  b = sameSub.left
  o = sameSub.right

  // 3. Different substance, same direction and unit family: swapped.
  const swaps = pairClosest(b, o, (x, y) => {
    if (x.dir !== y.dir) return Infinity
    const fx = unitFamily(x.unit)
    return fx && fx === unitFamily(y.unit) ? distance(x, y) : Infinity
  })
  for (const [x, y] of swaps.pairs) changes.push({ kind: 'swapped', step, from: sideOf(x), to: sideOf(y) })

  for (const x of swaps.left) changes.push({ kind: 'removed', step, from: sideOf(x) })
  for (const y of swaps.right) changes.push({ kind: 'added', step, to: sideOf(y) })
  return changes
}

/** Inventory differences of `other` against `base`. */
export function diffInventories(base: CaseInventory, other: CaseInventory): CaseDiff {
  const flowsOf = (inv: CaseInventory) => {
    const m = new Map<string, InventoryFlow[]>()
    for (const f of inv.flows) m.set(f.stepId, [...(m.get(f.stepId) ?? []), f])
    return m
  }
  const baseFlows = flowsOf(base)
  const otherFlows = flowsOf(other)

  const byPath = (inv: CaseInventory) => {
    const m = new Map<string, InventoryStep[]>()
    for (const s of inv.steps) m.set(keyOf(s.path), [...(m.get(keyOf(s.path)) ?? []), s])
    return m
  }
  const basePaths = byPath(base)
  const otherPaths = byPath(other)

  const steps: StepChange[] = []
  const flows: FlowChange[] = []
  const costs: CostChange[] = []
  const hours: HoursChange[] = []
  const costUnchanged: string[] = []

  const keys = Array.from(new Set([...basePaths.keys(), ...otherPaths.keys()]))
  for (const key of keys) {
    const bs = basePaths.get(key) ?? []
    const os = otherPaths.get(key) ?? []
    const n = Math.max(bs.length, os.length)
    for (let i = 0; i < n; i++) {
      const b = bs[i]
      const o = os[i]
      if (b && !o) {
        steps.push({ kind: 'removed', step: b.name, path: b.path })
        for (const f of baseFlows.get(b.id) ?? []) flows.push({ kind: 'removed', step: b.name, from: sideOf(f) })
        continue
      }
      if (o && !b) {
        steps.push({ kind: 'added', step: o.name, path: o.path })
        for (const f of otherFlows.get(o.id) ?? []) flows.push({ kind: 'added', step: o.name, to: sideOf(f) })
        continue
      }
      if (!b || !o) continue

      const stepFlowChanges = diffStepFlows(o.name, baseFlows.get(b.id) ?? [], otherFlows.get(o.id) ?? [])
      flows.push(...stepFlowChanges)

      let costChanged = false
      for (const k of COST_KEYS) {
        const from = b.costs[k] || 0
        const to = o.costs[k] || 0
        if (Math.abs(from - to) > CENT) {
          costs.push({ step: o.name, kind: k, from, to })
          costChanged = true
        }
      }
      const hb = b.laborHours
      const ho = o.laborHours
      if ((hb ?? 0) !== (ho ?? 0) && !same(hb ?? 0, ho ?? 0)) hours.push({ step: o.name, from: hb, to: ho })

      if (stepFlowChanges.length && !costChanged) costUnchanged.push(o.name)
    }
  }

  return {
    steps,
    flows,
    costs,
    hours,
    costUnchanged,
    identical: !steps.length && !flows.length && !costs.length && !hours.length,
  }
}

const fmtScopeNumber = (v: number | null, unit?: string | null) =>
  v === null || !Number.isFinite(v) ? '—' : `${Number(v.toPrecision(6))}${unit ? ` ${unit}` : ''}`

/** Scope rows where the two runs differ (method, region, functional unit, ...). */
export function diffScope(base: RunScope, other: RunScope): ScopeDifference[] {
  const rows: ScopeDifference[] = []
  const text = (label: string, a: string | null, b: string | null) => {
    const x = (a ?? '').trim()
    const y = (b ?? '').trim()
    if (x.toLowerCase() !== y.toLowerCase()) rows.push({ label, base: x || '—', other: y || '—' })
  }
  text('LCIA method', base.method, other.method)
  text('Region (electricity grid)', base.region, other.region)
  text('Functional unit', base.functionalUnit, other.functionalUnit)
  text('System boundary', base.boundary, other.boundary)
  const num = (label: string, a: number | null, b: number | null, unitA?: string | null, unitB?: string | null) => {
    if (a === null && b === null) return
    if (a === null || b === null || !same(a, b) || (unitA ?? '') !== (unitB ?? '')) {
      rows.push({ label, base: fmtScopeNumber(a, unitA), other: fmtScopeNumber(b, unitB) })
    }
  }
  num('Reference flow', base.referenceFlow, other.referenceFlow, base.referenceFlowUnit, other.referenceFlowUnit)
  num('Data basis (units the data describe)', base.modeledOutput, other.modeledOutput)
  return rows
}
