import { describe, it, expect } from 'vitest'

import type { IngestPlan, MappedFlow } from '@/lib/ingest/maplca'
import {
  stepChoiceReason,
  stepOptions,
  suggestPlacements,
  targetComponentsFrom,
  toSteps,
  withStepDecisions,
  type TargetComponent,
} from '@/lib/import/placement-suggestions'

const flow = (over: Partial<MappedFlow> = {}): MappedFlow => ({
  node: 'Cut',
  substance_text: 'Aluminum',
  substance_id: 1,
  substance_name: 'Aluminium',
  match_score: 0.95,
  candidates: [],
  direction: 'input',
  quantity: 1,
  unit: 'kg',
  conversion_note: '',
  provenance: '',
  unit_compatible: true,
  ...over,
})

const COMPONENTS: TargetComponent[] = [
  { component_id: 1, name: 'Touring bike', tier: 'product' },
  { component_id: 2, name: 'Fabrication', tier: 'machine_line' },
  { component_id: 3, name: '10 Cut & miter frame tubes', tier: 'operation' },
  { component_id: 4, name: '20 TIG weld main triangle', tier: 'operation' },
  { component_id: 5, name: '70 Final assembly', tier: 'operation' },
]

describe('targetComponentsFrom', () => {
  it('carries the step\'s non-zero cost columns, so a re-import can show what is already there', () => {
    expect(
      targetComponentsFrom({
        components: [{ component_id: 7, component_name: 'Weld', component_type: 'operation', labor_cost: '20.66', material_cost: '0.00', energy_cost: null }],
      }),
    ).toEqual([{ component_id: 7, name: 'Weld', tier: 'operation', parent_component_id: null, costs: { labor_cost: 20.66 } }])
  })

  it('keeps the parent id, so step matching can find the case root', () => {
    expect(
      targetComponentsFrom({ components: [{ component_id: 7, component_name: 'Weld', component_type: 'operation', parent_component_id: 1 }] }),
    ).toEqual([{ component_id: 7, name: 'Weld', tier: 'operation', parent_component_id: 1 }])
  })

  it('reads the components array (component_* fields)', () => {
    expect(
      targetComponentsFrom({
        components: [{ component_id: 3, component_name: 'Cut', component_type: 'operation', extra: 1 }],
      }),
    ).toEqual([{ component_id: 3, name: 'Cut', tier: 'operation', parent_component_id: null }])
  })

  it('falls back to a data array and to id / name / tier, with a blank tier when none', () => {
    expect(targetComponentsFrom({ data: [{ id: 4, name: 'Weld', tier: 'operation' }, { id: 5, name: 'X' }] })).toEqual([
      { component_id: 4, name: 'Weld', tier: 'operation', parent_component_id: null },
      { component_id: 5, name: 'X', tier: '', parent_component_id: null },
    ])
  })

  it('is empty when the answer has neither, and throws on a non-array', () => {
    expect(targetComponentsFrom({})).toEqual([])
    expect(targetComponentsFrom(null)).toEqual([])
    expect(() => targetComponentsFrom({ components: {} })).toThrow()
  })
})

describe('toSteps / stepOptions', () => {
  it('maps components to steps', () => {
    expect(toSteps(COMPONENTS.slice(0, 1))).toEqual([{ id: 1, name: 'Touring bike', tier: 'product' }])
  })

  it('offers operations (and tasks) when there are any', () => {
    expect(stepOptions(COMPONENTS).map((s) => s.id)).toEqual([3, 4, 5])
  })

  it('offers everything but the product when there are no operations', () => {
    expect(stepOptions(COMPONENTS.slice(0, 2)).map((s) => s.id)).toEqual([2])
    expect(stepOptions([])).toEqual([])
  })
})

describe('suggestPlacements', () => {
  const plan: IngestPlan = {
    case_name: 'Bike',
    nodes: [],
    flows: [
      flow({ provenance: 'row 2', label: 'Frame tube set', op_hint: '10' }),
      flow({ provenance: 'row 3', label: 'Front wheel' }),
      flow({ provenance: 'row 4', label: 'Motor', attach_component_id: 4 }),
      flow({ provenance: 'row 5', label: 'Frame tube', substance_text: 'Steel', attach_component_id: 999 }),
      flow({ provenance: '', substance_text: 'Electricity' }),
      flow({ provenance: 'row 2', label: 'Bolt', attach_component_id: 5 }),
    ],
    costs: [
      { node: 'Cut', category: 'material', amount: 85, provenance: { doc: 'bom.csv', locator: 'row 2' }, label: 'Frame tube set', op_hint: '20' },
      { node: 'X', category: 'opex', amount: 3, attach_component_id: 0 },
    ],
    review: [],
    notes: [],
  }

  it('suggests a step with a reason for every flow and cost key', () => {
    const { placement, why } = suggestPlacements(plan, COMPONENTS)
    expect(placement).toEqual({
      'row 2': 3,
      'row 3': 5,
      'row 4': 4,
      'row 5': 3,
      'flow-4': null,
      'bom.csv · row 2': 4,
      'cost-1': null,
    })
    expect(why['row 2']).toEqual({ confidence: 0.95, reason: 'document says step 10' })
    expect(why['row 3']).toEqual({ confidence: 0.4, reason: 'purchased part → assembly step (check)' })
    expect(why['row 4']).toEqual({ confidence: 1, reason: 'same work center as the routing' })
    expect(why['row 5'].reason).toBe('name match: "frame", "tube"')
    expect(why['row 5'].confidence).toBeCloseTo(0.8)
    expect(why['flow-4']).toEqual({ confidence: 0, reason: 'No match: choose a step' })
    expect(why['bom.csv · row 2']).toEqual({ confidence: 0.95, reason: 'document says step 20' })
    expect(why['cost-1']).toEqual({ confidence: 0, reason: 'No match: choose a step' })
  })

  it('keeps the first line for a shared key (a later preset does not override it)', () => {
    const { placement, why } = suggestPlacements(plan, COMPONENTS)
    expect(placement['row 2']).toBe(3)
    expect(why['row 2'].reason).toBe('document says step 10')
  })

  it('ignores a preset that is not a step of this case, and a preset of 0', () => {
    const { why } = suggestPlacements(plan, COMPONENTS)
    expect(why['row 5'].reason).not.toBe('same work center as the routing')
    expect(why['cost-1'].reason).not.toBe('same work center as the routing')
  })

  it('takes a preset on any component of the case, even one not offered in the pickers', () => {
    const p: IngestPlan = { ...plan, flows: [flow({ provenance: 'r', attach_component_id: 2 })], costs: [] }
    expect(suggestPlacements(p, COMPONENTS)).toEqual({
      placement: { r: 2 },
      why: { r: { confidence: 1, reason: 'same work center as the routing' } },
    })
  })

  it('leaves every line unplaced when the case has no steps', () => {
    const p: IngestPlan = { ...plan, flows: [flow({ provenance: 'r', attach_component_id: 4 })], costs: [] }
    expect(suggestPlacements(p, [])).toEqual({
      placement: { r: null },
      why: { r: { confidence: 0, reason: 'no steps in this case yet' } },
    })
  })

  it('is empty for an empty plan', () => {
    expect(suggestPlacements({ ...plan, flows: [], costs: [] }, COMPONENTS)).toEqual({ placement: {}, why: {} })
  })
})

describe('stepChoiceReason', () => {
  it('says chosen when a step is picked, else default step or no step yet', () => {
    expect(stepChoiceReason(5, null)).toBe('chosen by you')
    expect(stepChoiceReason(5, 3)).toBe('chosen by you')
    expect(stepChoiceReason(null, 3)).toBe('default step')
    expect(stepChoiceReason(null, null)).toBe('no step yet')
  })

  it('treats ids of 0 as not set (truthy checks)', () => {
    expect(stepChoiceReason(0, 3)).toBe('default step')
    expect(stepChoiceReason(null, 0)).toBe('no step yet')
  })
})

describe('withStepDecisions', () => {
  const line = (node: string, provenance: string): MappedFlow =>
    ({ node, provenance, substance_text: 'x', substance_id: 1, substance_name: 'x', match_score: 1, candidates: [],
       direction: 'input', quantity: 1, unit: 'h', conversion_note: '', unit_compatible: true }) as MappedFlow
  const plan = {
    case_name: 'R', nodes: [],
    flows: [line('10 Cut', 'r 2'), line('40 Paint', 'r 5'), line('Purchased materials', 'r 6')],
    costs: [{ node: '40 Paint', category: 'labor', amount: 4, provenance: { doc: 'r.csv', locator: 'row 5' } }],
    review: [], notes: [],
  } as unknown as IngestPlan
  const base = { placement: { 'r 2': 7, 'r 5': 3, 'r 6': 9 }, why: {} }
  const actions = {
    '10 Cut': { action: 'attach' as const, component_id: 11 },
    '40 Paint': { action: 'create' as const, component_id: null },
    'Purchased materials': { action: 'skip' as const, component_id: null },
  }

  it('follows an attached step, sends a created step by name, and leaves a skipped step on its suggestion', () => {
    const out = withStepDecisions(plan, base, actions, new Set())
    expect(out.placement['r 2']).toBe(11)
    expect(out.placement['r 5']).toBeNull()
    expect(out.newStep).toEqual({ 'r 5': '40 Paint', 'r.csv · row 5': '40 Paint' })
    expect(out.placement['r 6']).toBe(9)
    expect(out.why['r 5'].reason).toBe('goes to the new step "40 Paint"')
  })

  it('keeps a step the reviewer picked by hand', () => {
    const out = withStepDecisions(plan, base, actions, new Set(['r 5']))
    expect(out.placement['r 5']).toBe(3)
    expect(out.newStep['r 5']).toBeUndefined()
  })

  it('names a created step by its edited name', () => {
    const out = withStepDecisions(plan, base, actions, new Set(), (n) => (n === '40 Paint' ? '40 Powder coat' : n))
    expect(out.newStep['r 5']).toBe('40 Powder coat')
  })

  it('does not change the inputs', () => {
    withStepDecisions(plan, base, actions, new Set())
    expect(base.placement).toEqual({ 'r 2': 7, 'r 5': 3, 'r 6': 9 })
  })
})
