import { describe, expect, it } from 'vitest'

import { compareStatus, runResults, snapshotDrift } from '@/lib/compare/run-results'
import { LEGACY_RESULTS_SOURCE, ZERO_INVENTORY_WARNING, type RunSnapshot } from '@/lib/run-snapshot'

const noCost = { labor: null, energy: null, material: null, transportation: null, equipment: null, overhead: null, opex: null, capex: null, currency: 'USD' }

// A frozen (v3) run of a two-step case. Step 3 was deleted from the case
// after the run; the run still names it and still carries its cost.
const frozen: RunSnapshot = {
  version: 3,
  method: 'TRACI 2.1',
  region: 'US',
  captured_at: '2026-09-29T10:00:00Z',
  warnings: [],
  flow_detail: [
    { flow_id: 10, component_id: 2, component: 'Weld', substance: 'Aluminum', category_name: 'Global Warming', dir: 'IN', amount: 2, unit: 'kg', factor: 8, scope: 'Global', conversion: null, impact: 16 },
    { flow_id: 11, component_id: 3, component: 'Coat', substance: 'Epoxy resin', category_name: 'Global Warming', dir: 'IN', amount: 1, unit: 'kg', factor: 4, scope: 'Global', conversion: null, impact: 4 },
  ],
  goal_scope: {
    goal_statement: null, functional_unit: '1 bike', system_boundary: 'cradle-to-gate', boundary_notes: null,
    reference_flow: 1, reference_flow_unit: 'unit', modeled_output: 2, per_fu_scale: 0.5,
  },
  totals: [
    { category_id: 1, category_name: 'Global Warming', value: 20, unit: 'kg CO2 eq', flow_count: 2 },
    { category_id: 2, category_name: 'Acidification', value: 0, unit: 'kg SO2 eq', flow_count: 0 },
  ],
  steps: [
    { component_id: 1, name: 'Bike', parent_id: null, type: 'product', process_type: null, hierarchy_level: 1, stage: null, quantity: 1, unit: 'unit', flows_processed: 0, impacts: [], costs: { ...noCost } },
    { component_id: 2, name: 'Weld', parent_id: 1, type: 'operation', process_type: null, hierarchy_level: 4, stage: null, quantity: 1, unit: 'unit', flows_processed: 1,
      impacts: [{ category_id: 1, category_name: 'Global Warming', value: 16, unit: 'kg CO2 eq' }], costs: { ...noCost, labor: 20, material: 6 } },
    { component_id: 3, name: 'Coat', parent_id: 1, type: 'operation', process_type: null, hierarchy_level: 4, stage: null, quantity: 1, unit: 'unit', flows_processed: 1,
      impacts: [{ category_id: 1, category_name: 'Global Warming', value: 4, unit: 'kg CO2 eq' }], costs: { ...noCost, energy: 2 } },
  ],
  inventory: [
    { flow_id: 10, component_id: 2, component: 'Weld', substance: 'Aluminum', direction: 'input', amount: 2, unit: 'kg' },
    { flow_id: 11, component_id: 3, component: 'Coat', substance: 'Epoxy resin', direction: 'input', amount: 1, unit: 'kg' },
  ],
}

const zero = { material: 0, labor: 0, energy: 0, transportation: 0, equipment: 0, overhead: 0, opex: 0, capex: 0 }
// The case today: step 3 is gone, step 2 was renamed and its labor cost changed.
const currentSteps = [
  { id: 1, name: 'Bike', costs: { ...zero } },
  { id: 2, name: 'Weld (renamed)', costs: { ...zero, labor: 99 } },
]

describe('runResults: a frozen run', () => {
  const r = runResults({ snapshot: frozen, scale: 0.5, currentSteps })

  it('reads totals from the snapshot, per functional unit, with their flow counts', () => {
    expect(r.source).toBe('snapshot')
    expect(r.totals).toEqual([
      { category: 'Global Warming', unit: 'kg CO2 eq', value: 10, flowCount: 2 },
      { category: 'Acidification', unit: 'kg SO2 eq', value: 0, flowCount: 0 },
    ])
  })

  it('reads per-step rows from the snapshot: names as they were, a deleted step still named', () => {
    expect(r.byStep).toEqual([
      { step: 'Weld', category: 'Global Warming', value: 8 },
      { step: 'Coat', category: 'Global Warming', value: 2 },
    ])
    expect(JSON.stringify(r.byStep)).not.toMatch(/Removed step/)
  })

  it('reads the costs in force at run time, not the current ones', () => {
    expect(r.costsSource).toBe('run')
    expect(r.costs).toEqual([
      { step: 'Weld', ...zero, labor: 10, material: 3 },
      { step: 'Coat', ...zero, energy: 1 },
    ])
  })

  it('counts the flows the run characterized', () => {
    expect(r.characterizedFlows).toBe(2)
    expect(r.zeroInventory).toBe(false)
  })
})

describe('runResults: a legacy run (no frozen results)', () => {
  const legacy = {
    totals: [{ category: 'Global Warming', unit: 'kg CO2 eq', value: 20 }],
    byStep: [
      { componentId: 2, category: 'Global Warming', value: 16 },
      // migrate-027: deleting a step sets its results' component_id to NULL.
      { componentId: null, category: 'Global Warming', value: 4 },
    ],
  }

  it('falls back to the stored rows, is labelled, and never says "Removed step #null"', () => {
    const r = runResults({ snapshot: null, scale: 1, legacy, currentSteps })
    expect(r.source).toBe(LEGACY_RESULTS_SOURCE)
    expect(r.totals).toEqual([{ category: 'Global Warming', unit: 'kg CO2 eq', value: 20 }])
    expect(r.byStep).toEqual([
      { step: 'Weld (renamed)', category: 'Global Warming', value: 16 },
      { step: 'Removed step', category: 'Global Warming', value: 4 },
    ])
    expect(JSON.stringify(r.byStep)).not.toContain('#null')
  })

  it('names a step that no longer exists by its old id when the id survived', () => {
    const r = runResults({
      snapshot: null, scale: 1, currentSteps,
      legacy: { totals: legacy.totals, byStep: [{ componentId: 7, category: 'Global Warming', value: 1 }] },
    })
    expect(r.byStep[0].step).toBe('Removed step #7')
  })

  it('uses the current costs and says so', () => {
    const r = runResults({ snapshot: null, scale: 2, legacy, currentSteps })
    expect(r.costsSource).toBe('current')
    expect(r.costs).toEqual([{ step: 'Weld (renamed)', ...zero, labor: 198 }])
  })

  it('counts a legacy run with no stored rows as characterizing nothing', () => {
    const r = runResults({ snapshot: null, scale: 1, legacy: { totals: [], byStep: [] }, currentSteps })
    expect(r.characterizedFlows).toBe(0)
  })

  it('a v1/v2 snapshot still supplies the flow detail count', () => {
    const v2 = { ...frozen, version: 2, totals: undefined, steps: undefined, inventory: undefined }
    const r = runResults({ snapshot: v2, scale: 1, legacy, currentSteps })
    expect(r.source).toBe(LEGACY_RESULTS_SOURCE)
    expect(r.characterizedFlows).toBe(2)
  })
})

describe('runResults: a run that computed nothing', () => {
  it('flags the zero-inventory warning', () => {
    const empty: RunSnapshot = { ...frozen, warnings: [ZERO_INVENTORY_WARNING], flow_detail: [], inventory: [],
      totals: [{ category_id: 1, category_name: 'Global Warming', value: 0, unit: 'kg CO2 eq', flow_count: 0 }],
      steps: frozen.steps!.map((s) => ({ ...s, impacts: [], flows_processed: 0 })) }
    const r = runResults({ snapshot: empty, scale: 1, currentSteps })
    expect(r.zeroInventory).toBe(true)
    expect(r.characterizedFlows).toBe(0)
  })
})

describe('compareStatus', () => {
  const ok = { hasRun: true, currentFlows: 3, characterizedFlows: 3, zeroInventory: false, editedSinceRun: false }

  it('ranks a case with flows and a current run', () => {
    expect(compareStatus(ok)).toEqual({ status: 'ok', reason: null })
  })

  it('never ranks a case with no completed run', () => {
    expect(compareStatus({ ...ok, hasRun: false, characterizedFlows: null })).toEqual({ status: 'incomplete', reason: 'Not run yet' })
  })

  it('never ranks a case with 0 flows, even with a completed run', () => {
    expect(compareStatus({ ...ok, currentFlows: 0 })).toMatchObject({ status: 'incomplete', reason: 'No flows yet' })
    expect(compareStatus({ ...ok, currentFlows: 0, hasRun: false })).toMatchObject({ status: 'incomplete' })
  })

  it('never ranks a run that computed nothing', () => {
    expect(compareStatus({ ...ok, zeroInventory: true })).toMatchObject({ status: 'incomplete', reason: 'Its run had no flows' })
    expect(compareStatus({ ...ok, characterizedFlows: 0 })).toMatchObject({
      status: 'incomplete',
      reason: 'No flow in its run had an impact factor',
    })
  })

  it('flags a run older than the last edit as stale', () => {
    expect(compareStatus({ ...ok, editedSinceRun: true })).toEqual({ status: 'stale', reason: 'Edited after this run' })
  })
})

describe('snapshotDrift: was the case edited after a frozen run?', () => {
  const same = { componentIds: [1, 2, 3], flowIds: [10, 11], referenceFlow: 1, modeledOutput: 2 }

  it('is false when the steps, flows and data basis match', () => {
    expect(snapshotDrift(frozen, same)).toBe(false)
    expect(snapshotDrift(frozen, { ...same, flowIds: [11, 10] })).toBe(false)
  })

  it('catches a deleted flow (a delete leaves no updated_at behind)', () => {
    expect(snapshotDrift(frozen, { ...same, flowIds: [10] })).toBe(true)
  })

  it('catches every flow deleted', () => {
    expect(snapshotDrift(frozen, { ...same, flowIds: [] })).toBe(true)
  })

  it('catches an added flow or a deleted step', () => {
    expect(snapshotDrift(frozen, { ...same, flowIds: [10, 11, 12] })).toBe(true)
    expect(snapshotDrift(frozen, { ...same, componentIds: [1, 2] })).toBe(true)
  })

  it('catches a changed reference flow or data basis', () => {
    expect(snapshotDrift(frozen, { ...same, referenceFlow: 2 })).toBe(true)
    expect(snapshotDrift(frozen, { ...same, modeledOutput: 4 })).toBe(true)
  })

  it('reads a blank reference flow as 1, like the run did', () => {
    const fu1 = { ...frozen, goal_scope: { ...frozen.goal_scope!, reference_flow: 1, modeled_output: 1 } }
    expect(snapshotDrift(fu1, { ...same, referenceFlow: null, modeledOutput: null })).toBe(false)
  })

  it('cannot tell for a run without frozen results', () => {
    expect(snapshotDrift(null, same)).toBe(false)
    expect(snapshotDrift({ ...frozen, totals: undefined, steps: undefined }, { ...same, flowIds: [] })).toBe(false)
  })
})
