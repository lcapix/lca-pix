import { describe, it, expect } from 'vitest'

import type { IngestPlan, MappedFlow } from '@/lib/ingest/maplca'
import {
  stepChoiceReason,
  stepOptions,
  suggestPlacements,
  targetComponentsFrom,
  toSteps,
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
  it('reads the components array (component_* fields)', () => {
    expect(
      targetComponentsFrom({
        components: [{ component_id: 3, component_name: 'Cut', component_type: 'operation', extra: 1 }],
      }),
    ).toEqual([{ component_id: 3, name: 'Cut', tier: 'operation' }])
  })

  it('falls back to a data array and to id / name / tier, with a blank tier when none', () => {
    expect(targetComponentsFrom({ data: [{ id: 4, name: 'Weld', tier: 'operation' }, { id: 5, name: 'X' }] })).toEqual([
      { component_id: 4, name: 'Weld', tier: 'operation' },
      { component_id: 5, name: 'X', tier: '' },
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
    expect(why['flow-4']).toEqual({ confidence: 0, reason: 'no match — choose a step' })
    expect(why['bom.csv · row 2']).toEqual({ confidence: 0.95, reason: 'document says step 20' })
    expect(why['cost-1']).toEqual({ confidence: 0, reason: 'no match — choose a step' })
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
