import { describe, it, expect } from 'vitest'

import type { IngestPlan, MappedFlow } from '@/lib/ingest/maplca'
import { flowConflicts } from '@/lib/import/flow-conflicts'
import type { TargetComponent } from '@/lib/import/placement-suggestions'

// Re-importing a BOM used to insert its flows again, doubling the materials
// and the step's carbon (stage-0 gate E2b).

const flow = (over: Partial<MappedFlow>): MappedFlow =>
  ({ node: 'Purchased materials', substance_text: 'Aluminum', substance_id: 5, substance_name: 'Aluminium',
     match_score: 1, candidates: [], direction: 'input', quantity: 2.2, unit: 'kg', conversion_note: '',
     provenance: 'bom.csv · row 2', unit_compatible: true, ...over }) as MappedFlow

const plan = {
  case_name: 'B', nodes: [],
  flows: [
    flow({}),
    flow({ provenance: 'bom.csv · row 3', substance_text: 'Box', substance_id: 9, substance_name: 'Cardboard', quantity: 0.5 }),
    flow({ provenance: 'bom.csv · row 4', substance_id: 5, direction: 'output', quantity: 0.1 }),
  ],
  costs: [], review: [], notes: [],
} as unknown as IngestPlan

const edits = {
  0: { include: true, substance_id: 5, substance_name: 'Aluminium' },
  1: { include: true, substance_id: 9, substance_name: 'Cardboard' },
  2: { include: true, substance_id: 5, substance_name: 'Aluminium' },
}
const components: TargetComponent[] = [
  { component_id: 1, name: '10. Cut tube', tier: 'operation', flow_count: 1 },
  { component_id: 2, name: '30. Pack', tier: 'operation' },
]
const existingFlows = { 1: [{ substance_id: 5, substance_name: 'Aluminium', flow_type: 'input', quantity: '2.200000', unit: 'kg' }] }
const placement = { 'bom.csv · row 2': 1, 'bom.csv · row 3': 2, 'bom.csv · row 4': 1 }

describe('flowConflicts', () => {
  it('lists a step that already has the substance in the same direction', () => {
    const out = flowConflicts({ plan, edits, placement, newStep: {}, attachComponentId: null, components, existingFlows })
    expect(out).toEqual([
      { key: '1|5|input', stepName: '10. Cut tube', substanceName: 'Aluminium', direction: 'input', existing: '2.2 kg', incoming: '2.2 kg' },
    ])
  })

  it('uses the corrected quantity and unit, and sums per unit', () => {
    const two = { ...plan, flows: [flow({}), flow({ provenance: 'bom.csv · row 5', quantity: 1, unit: 'ea' })] } as IngestPlan
    const out = flowConflicts({
      plan: two,
      edits: { 0: { include: true, substance_id: 5, substance_name: 'Aluminium', quantity: '3' }, 1: { include: true, substance_id: 5, substance_name: 'Aluminium' } },
      placement: { 'bom.csv · row 2': 1, 'bom.csv · row 5': 1 },
      newStep: {}, attachComponentId: null, components, existingFlows,
    })
    expect(out[0].incoming).toBe('3 kg + 1 ea')
  })

  it('ignores unticked lines, lines with no substance, and lines going to a new step', () => {
    const none = flowConflicts({
      plan, placement, attachComponentId: null, components, existingFlows,
      edits: { 0: { include: false, substance_id: 5, substance_name: 'A' }, 1: edits[1], 2: { include: true, substance_id: null, substance_name: null } },
      newStep: {},
    })
    expect(none).toEqual([])
    const newer = flowConflicts({ plan, edits, placement, newStep: { 'bom.csv · row 2': 'x' }, attachComponentId: null, components, existingFlows })
    expect(newer).toEqual([])
  })

  it('finds nothing when the existing flows are unknown (the card then says they could not be read)', () => {
    expect(flowConflicts({ plan, edits, placement, newStep: {}, attachComponentId: null, components, existingFlows: {} })).toEqual([])
  })
})
