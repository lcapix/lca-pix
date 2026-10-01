import { describe, it, expect } from 'vitest'

import type { IngestPlan, MappedFlow } from '@/lib/ingest/maplca'
import {
  buildApplyBody,
  buildApplyFlows,
  buildOutNotes,
  createdCaseName,
  unplacedError,
  withCreatedCase,
} from '@/lib/import/apply-body'
import type { FlowEdit } from '@/lib/import/review'

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

const plan: IngestPlan = {
  case_name: 'Touring bike',
  nodes: [{ name: 'Touring bike', tier: 'product', parent: null }],
  flows: [
    flow({ provenance: 'row 2', unit: 'kg CO2e' }),
    flow({ provenance: 'row 3', substance_text: 'Rod' }),
    flow({ provenance: 'row 4', substance_text: 'Goo', substance_id: null, substance_name: null }),
    flow({ provenance: '', substance_text: 'Grease' }),
  ],
  costs: [
    { node: 'Cut', category: 'material', amount: 85, provenance: { doc: 'bom.csv', locator: 'row 2' } },
    { node: 'Weld', category: 'labor', amount: 3 },
  ],
  review: [],
  notes: ['a', 'b', 'c'],
}

const edits: Record<number, FlowEdit> = {
  0: { include: true, substance_id: 7, substance_name: 'Steel', unit: '  kg ' },
  1: { include: false, substance_id: 1, substance_name: 'Aluminium' },
  2: { include: true, substance_id: null, substance_name: null },
  3: { include: true, substance_id: 1, substance_name: 'Aluminium', unit: '   ' },
}

describe('unplacedError', () => {
  it('names the count', () => {
    expect(unplacedError(2)).toBe(
      '2 line(s) still need a step: pick one in the STEP column, or set a default step above.',
    )
  })
})

describe('buildApplyFlows', () => {
  it('sends only ticked flows with a substance, with the reviewer’s substance and trimmed unit override', () => {
    const flows = buildApplyFlows({ plan, edits, appending: false, placement: {}, attachComponentId: 9 })
    expect(flows.map((f) => f.substance_text)).toEqual(['Aluminum', 'Grease'])
    expect(flows[0]).toMatchObject({ substance_id: 7, substance_name: 'Steel', unit: 'kg' })
    // A blank override keeps the flow's unit.
    expect(flows[1].unit).toBe('kg')
  })

  it('leaves attach_component_id undefined (but present) when creating', () => {
    const flows = buildApplyFlows({ plan, edits, appending: false, placement: { 'row 2': 3 }, attachComponentId: 9 })
    expect('attach_component_id' in flows[0]).toBe(true)
    expect(flows[0].attach_component_id).toBeUndefined()
  })

  it('puts each flow on its placed step when appending, else the default step', () => {
    const flows = buildApplyFlows({ plan, edits, appending: true, placement: { 'row 2': 3, 'flow-3': null }, attachComponentId: 9 })
    expect(flows.map((f) => f.attach_component_id)).toEqual([3, 9])
    const none = buildApplyFlows({ plan, edits, appending: true, placement: {}, attachComponentId: null })
    expect(none.map((f) => f.attach_component_id)).toEqual([null, null])
  })

  it('skips flows with no edit', () => {
    expect(buildApplyFlows({ plan, edits: {}, appending: false, placement: {}, attachComponentId: null })).toEqual([])
  })
})

describe('buildOutNotes', () => {
  it('keeps undismissed notes, then one note per column given a role other than ignore', () => {
    expect(buildOutNotes(['a', 'b', 'c'], new Set([1]), { Tooling: 'note', Vendor: 'ignore', Qty: '', Part: 'material' })).toEqual([
      'a',
      'c',
      'Column "Tooling" — marked as note by reviewer (pending a connector to map it).',
      'Column "Part" — marked as material by reviewer (pending a connector to map it).',
    ])
  })

  it('is empty when everything is dismissed and no roles are set', () => {
    expect(buildOutNotes(['a'], new Set([0]), {})).toEqual([])
  })
})

describe('buildApplyBody', () => {
  const flows = buildApplyFlows({ plan, edits, appending: false, placement: {}, attachComponentId: null })

  it('creates a case: project id as a number, trimmed name, plan nodes and costs as they are', () => {
    const body = buildApplyBody({
      plan, projectId: '12', caseName: '  My bike ', targetCaseId: null, attachComponentId: 4,
      placement: { 'cost-1': 5 }, flows, notes: ['n'],
    })
    expect(body).toEqual({
      project_id: 12,
      case_name: 'My bike',
      nodes: plan.nodes,
      flows,
      costs: plan.costs,
      notes: ['n'],
    })
    expect(Object.keys(body)).toEqual(['project_id', 'case_name', 'nodes', 'flows', 'costs', 'notes'])
  })

  it('falls back to the plan’s case name when the name is blank', () => {
    const body = buildApplyBody({
      plan, projectId: '12', caseName: '   ', targetCaseId: null, attachComponentId: null, placement: {}, flows, notes: [],
    }) as { case_name: string }
    expect(body.case_name).toBe('Touring bike')
  })

  it('appends: target case, default step, and every cost on its placed step else the default', () => {
    const body = buildApplyBody({
      plan, projectId: '12', caseName: 'ignored', targetCaseId: 7, attachComponentId: 4,
      placement: { 'bom.csv · row 2': 3 }, flows, notes: ['n'],
    })
    expect(Object.keys(body)).toEqual(['target_case_id', 'attach_component_id', 'flows', 'costs', 'notes'])
    expect(body).toMatchObject({ target_case_id: 7, attach_component_id: 4, flows, notes: ['n'] })
    expect((body as any).costs).toEqual([
      { ...plan.costs[0], attach_component_id: 3 },
      { ...plan.costs[1], attach_component_id: 4 },
    ])
  })

  it('appends to case 0 too (a null check, not a truthy one)', () => {
    const body = buildApplyBody({
      plan, projectId: '12', caseName: '', targetCaseId: 0, attachComponentId: null, placement: {}, flows, notes: [],
    })
    expect(body).toMatchObject({ target_case_id: 0 })
  })
})

describe('createdCaseName / withCreatedCase', () => {
  it('names a new case by the typed name, the plan’s, or its id', () => {
    expect(createdCaseName(' Mine ', 'Plan', 5)).toBe('Mine')
    expect(createdCaseName('  ', 'Plan', 5)).toBe('Plan')
    expect(createdCaseName('', '', 5)).toBe('Case 5')
  })

  it('adds a new case at the end, and returns the same list when it is already there', () => {
    const prev = [{ case_id: 1, case_name: 'A' }]
    expect(withCreatedCase(prev, 2, 'B')).toEqual([
      { case_id: 1, case_name: 'A' },
      { case_id: 2, case_name: 'B' },
    ])
    expect(withCreatedCase(prev, 1, 'Again')).toBe(prev)
  })
})
