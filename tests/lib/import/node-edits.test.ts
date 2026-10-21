import { describe, it, expect } from 'vitest'

import type { IngestPlan, MappedFlow } from '@/lib/ingest/maplca'
import { buildApplyBody, buildApplyFlows } from '@/lib/import/apply-body'
import {
  applyNodeEdits,
  buildNodeActions,
  nodeTreeError,
  parseStepActionValue,
  stepActionValue,
  suggestStepActions,
} from '@/lib/import/node-edits'
import { correctedQuantity } from '@/lib/import/review'

const nodes: IngestPlan['nodes'] = [
  { name: 'Touring bike', tier: 'product', parent: null, quantity: 1, unit: 'unit' },
  { name: '10 Cut', tier: 'operation', parent: 'Touring bike', quantity: 1, unit: 'unit' },
  { name: '20 Weld', tier: 'operation', parent: 'Touring bike' },
]

const flow = (over: Partial<MappedFlow> = {}): MappedFlow => ({
  node: '10 Cut',
  substance_text: 'Aluminum',
  substance_id: 1,
  substance_name: 'Aluminium',
  match_score: 0.95,
  candidates: [],
  direction: 'input',
  quantity: 2,
  unit: 'kg',
  conversion_note: '',
  provenance: 'row 2',
  unit_compatible: true,
  ...over,
})

const plan: IngestPlan = {
  case_name: 'Touring bike',
  nodes,
  flows: [flow()],
  costs: [{ node: '10 Cut', category: 'labor', amount: 3, provenance: { doc: 'r.csv', locator: 'row 2' } }],
  review: [],
  notes: [],
}

describe('applyNodeEdits', () => {
  it('leaves the plan as it is with no edits', () => {
    const { nodes: out, finalName } = applyNodeEdits(nodes, {})
    expect(out).toEqual(nodes)
    expect(finalName('10 Cut')).toBe('10 Cut')
    expect(finalName(null)).toBeNull()
  })

  it('carries a rename to the children that name it as parent', () => {
    const { nodes: out, finalName } = applyNodeEdits(nodes, { 'Touring bike': { name: '  Road bike ' } })
    expect(out.map((n) => [n.name, n.parent])).toEqual([
      ['Road bike', null],
      ['10 Cut', 'Road bike'],
      ['20 Weld', 'Road bike'],
    ])
    expect(finalName('Touring bike')).toBe('Road bike')
  })

  it('applies tier, parent and quantity, and keeps the plan quantity when the typed one is not a number', () => {
    const { nodes: out } = applyNodeEdits(nodes, {
      '20 Weld': { tier: 'subprocess', parent: '10 Cut', quantity: '4' },
      '10 Cut': { quantity: 'abc' },
    })
    expect(out[2]).toMatchObject({ tier: 'subprocess', parent: '10 Cut', quantity: 4 })
    expect(out[1].quantity).toBe(1)
  })

  it('keeps the original name when the rename is blank', () => {
    expect(applyNodeEdits(nodes, { '10 Cut': { name: '   ' } }).nodes[1].name).toBe('10 Cut')
  })
})

describe('nodeTreeError', () => {
  it('accepts a sound tree', () => {
    expect(nodeTreeError(nodes)).toBeNull()
  })

  it('refuses two steps with one name', () => {
    const { nodes: out } = applyNodeEdits(nodes, { '20 Weld': { name: '10 Cut' } })
    expect(nodeTreeError(out)).toBe('Two steps are both called "10 Cut". Names have to be unique in a case.')
  })

  it('refuses a step that ends up inside itself', () => {
    const { nodes: out } = applyNodeEdits(nodes, {
      '10 Cut': { parent: '20 Weld' },
      '20 Weld': { parent: '10 Cut' },
    })
    expect(nodeTreeError(out)).toMatch(/ends up inside itself/)
  })
})

describe('suggestStepActions', () => {
  const caseSteps = [
    { component_id: 1, name: 'Bike', tier: 'product', parent_component_id: null },
    { component_id: 3, name: '10 Cut & miter', tier: 'operation', parent_component_id: 1 },
  ]

  it('attaches the root and a step-number match, and creates the rest for a routing', () => {
    const a = suggestStepActions(nodes, caseSteps, true)
    expect(a['Touring bike']).toMatchObject({ action: 'attach', component_id: 1 })
    expect(a['10 Cut']).toMatchObject({ action: 'attach', component_id: 3, reason: 'same step number: 10 Cut & miter' })
    expect(a['20 Weld']).toEqual({ action: 'create', component_id: null, reason: 'not in this case yet' })
  })

  it('skips an unmatched placeholder step for a BOM, so it never lands in the case unseen', () => {
    const bomNodes: IngestPlan['nodes'] = [
      { name: 'bom', tier: 'product', parent: null },
      { name: 'Purchased materials', tier: 'operation', parent: 'bom' },
    ]
    const a = suggestStepActions(bomNodes, caseSteps, false)
    expect(a['bom'].action).toBe('attach')
    expect(a['Purchased materials']).toMatchObject({ action: 'skip', component_id: null })
  })
})

describe('buildNodeActions', () => {
  it('keys decisions by the final name and skips a step with no decision', () => {
    const { nodes: out } = applyNodeEdits(nodes, { '20 Weld': { name: '20 TIG weld' } })
    const actions = buildNodeActions(out, nodes, {
      'Touring bike': { action: 'attach', component_id: 1, reason: '' },
      '20 Weld': { action: 'create', component_id: null, reason: '' },
    })
    expect(actions).toEqual({
      'Touring bike': { action: 'attach', component_id: 1 },
      '10 Cut': { action: 'skip', component_id: null },
      '20 TIG weld': { action: 'create', component_id: null },
    })
  })
})

describe('step action picker values', () => {
  it('round-trips attach, create and skip', () => {
    expect(stepActionValue({ action: 'attach', component_id: 9, reason: '' })).toBe('attach:9')
    expect(stepActionValue(undefined)).toBe('skip')
    expect(parseStepActionValue('attach:9')).toEqual({ action: 'attach', component_id: 9, reason: 'chosen by you' })
    expect(parseStepActionValue('create').action).toBe('create')
    expect(parseStepActionValue('anything else').action).toBe('skip')
  })
})

describe('correctedQuantity', () => {
  const f = flow()
  it('is null when nothing, a blank, a non-number or the same number was typed', () => {
    expect(correctedQuantity(f, undefined)).toBeNull()
    expect(correctedQuantity(f, { include: true, substance_id: 1, substance_name: 'A', quantity: ' ' })).toBeNull()
    expect(correctedQuantity(f, { include: true, substance_id: 1, substance_name: 'A', quantity: 'x' })).toBeNull()
    expect(correctedQuantity(f, { include: true, substance_id: 1, substance_name: 'A', quantity: '2.0' })).toBeNull()
  })
  it('is the typed number when it differs', () => {
    expect(correctedQuantity(f, { include: true, substance_id: 1, substance_name: 'A', quantity: '20' })).toBe(20)
  })
})

describe('apply body with review edits', () => {
  it('sends a corrected quantity and records what the document said', () => {
    const [out] = buildApplyFlows({
      plan,
      edits: { 0: { include: true, substance_id: 1, substance_name: 'Aluminium', quantity: '20' } },
      appending: false,
      placement: {},
      attachComponentId: null,
    })
    expect(out.quantity).toBe(20)
    expect(out.provenance).toBe('row 2 · quantity corrected at review (document said 2)')
  })

  it('moves flows and costs with a renamed step when creating', () => {
    const { nodes: out, finalName } = applyNodeEdits(nodes, { '10 Cut': { name: '10 Saw' } })
    const flows = buildApplyFlows({
      plan,
      edits: { 0: { include: true, substance_id: 1, substance_name: 'Aluminium' } },
      appending: false,
      placement: {},
      attachComponentId: null,
      finalName,
    })
    expect(flows[0].node).toBe('10 Saw')
    const body: any = buildApplyBody({
      plan,
      projectId: '4',
      caseName: '',
      targetCaseId: null,
      attachComponentId: null,
      placement: {},
      flows,
      notes: [],
      steps: { nodes: out, finalName, nodeActions: {} },
    })
    expect(body.nodes.map((n: any) => n.name)).toEqual(['Touring bike', '10 Saw', '20 Weld'])
    expect(body.costs[0].node).toBe('10 Saw')
    expect(body.node_actions).toBeUndefined()
  })

  it('sends the steps and their decisions when appending', () => {
    const { nodes: out, finalName } = applyNodeEdits(nodes, {})
    const nodeActions = { '20 Weld': { action: 'create' as const, component_id: null } }
    const body: any = buildApplyBody({
      plan,
      projectId: '4',
      caseName: '',
      targetCaseId: 12,
      attachComponentId: null,
      placement: { 'r.csv · row 2': 3 },
      flows: [],
      notes: [],
      steps: { nodes: out, finalName, nodeActions },
    })
    expect(Object.keys(body)).toEqual(['target_case_id', 'attach_component_id', 'nodes', 'node_actions', 'flows', 'costs', 'notes'])
    const withModes: any = buildApplyBody({
      plan, projectId: '4', caseName: '', targetCaseId: 12, attachComponentId: null, placement: {}, flows: [], notes: [],
      steps: { nodes: out, finalName, nodeActions }, costModes: { '3|labor_cost': 'keep' },
    })
    expect(withModes.cost_modes).toEqual({ '3|labor_cost': 'keep' })
    expect(body.node_actions).toEqual(nodeActions)
    expect(body.costs[0].attach_component_id).toBe(3)
  })
})
