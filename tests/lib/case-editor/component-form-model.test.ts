import { describe, it, expect } from 'vitest'
import {
  buildComponentSubmission,
  defaultParentCandidates,
  disabledTypesFor,
  eligibleParentsFor,
  formDescendantIds,
  formatCostSummary,
  initialFormValues,
  isFormSubmittable,
  toDbType,
  toFormType,
  toProcessNodes,
  validateComponentForm,
} from '@/lib/case-editor/component-form-model'
import { integrationWantsFor, metalSymbolFor } from '@/lib/case-editor/integration-suggest'

const node = (id: string, type: string, parentId?: string, name = `n${id}`) => ({ id, type, parentId, name }) as any
// 1 product ─ 2 machine_line ─ 3 subprocess ─ 4 operation ─ 5 elemental_task
const NODES = [node('1', 'product', undefined, 'Bracket'), node('2', 'machine_line', '1', 'Line'), node('3', 'subprocess', '2', 'Cell'), node('4', 'operation', '3', 'Cut'), node('5', 'elemental_task', '4', 'Deburr')]

describe('type mapping', () => {
  it('bridges the segmented control and the API', () => {
    expect(toFormType('machine_line')).toBe('machine')
    expect(toFormType('elemental_task')).toBe('elemental')
    expect(toFormType('operation')).toBe('operation')
    expect(toFormType(null)).toBe('')
    expect(toDbType('machine')).toBe('machine_line')
    expect(toDbType('elemental')).toBe('elemental_task')
    expect(toDbType('weird')).toBe('weird')
  })
})

describe('initialFormValues', () => {
  it('pre-fills from the component being edited, else the suggestion', () => {
    expect(initialFormValues({ type: 'machine_line', name: 'Line', parentId: '1', laborCost: 0 })).toMatchObject({
      processType: 'machine',
      processName: 'Line',
      parentId: '1',
      laborCost: 0,
      energyCost: undefined,
      mass: 0,
      currency: 'USD',
    })
    expect(initialFormValues(undefined, '4', 'elemental_task')).toMatchObject({ processType: 'elemental', parentId: '4', drivers: [] })
  })
})

describe('parents', () => {
  it('maps API rows to nodes', () => {
    expect(toProcessNodes([{ component_id: 2, component_name: 'Line', component_type: 'machine_line', parent_component_id: 1 }])).toEqual([
      { id: '2', name: 'Line', type: 'machine_line', description: undefined, parentId: '1' },
    ])
  })
  it('never offers the node itself or its descendants; any coarser tier is fine', () => {
    const below = formDescendantIds(NODES, '2')
    expect([...below].sort()).toEqual(['3', '4', '5'])
    expect(formDescendantIds(NODES, undefined).size).toBe(0)
    expect(eligibleParentsFor('operation', NODES, undefined, new Set()).map((n) => n.id)).toEqual(['1', '2', '3'])
    expect(eligibleParentsFor('subprocess', NODES, '3', formDescendantIds(NODES, '3')).map((n) => n.id)).toEqual(['1', '2'])
    expect(eligibleParentsFor('product', NODES, undefined, new Set())).toEqual([])
    expect(eligibleParentsFor('', NODES, undefined, new Set())).toEqual([])
  })
  it('auto-attach candidates are the tier directly above', () => {
    expect(defaultParentCandidates('operation', NODES, undefined, new Set()).map((n) => n.id)).toEqual(['3'])
    expect(defaultParentCandidates('product', NODES, undefined, new Set())).toEqual([])
  })
  it('greys out a second Product, and tiers not finer than the parent when adding a child', () => {
    expect(disabledTypesFor({ mode: 'create', processNodes: NODES, isAddChildMode: false, suggestedParent: null })).toEqual(['product'])
    expect(disabledTypesFor({ mode: 'edit', processNodes: NODES, isAddChildMode: false, suggestedParent: null })).toBeUndefined()
    expect(disabledTypesFor({ mode: 'create', processNodes: NODES, isAddChildMode: true, suggestedParent: NODES[2] })).toEqual([
      'product',
      'machine',
      'subprocess',
    ])
  })
})

describe('validateComponentForm', () => {
  const ctx = { processNodes: NODES, editingId: undefined, descendantIds: new Set<string>() }
  it('needs a type, a name and (for a step) a parent', () => {
    expect(validateComponentForm({ processType: '', processName: ' ', parentId: '' }, ctx)).toEqual({
      processType: 'Select a process type',
      processName: 'Enter a process name',
    })
    expect(validateComponentForm({ processType: 'operation', processName: 'Paint', parentId: '' }, ctx)).toEqual({
      parentId: 'Pick the step this belongs under. Every step needs a parent; only the product has none.',
    })
    expect(validateComponentForm({ processType: 'operation', processName: 'Paint', parentId: '3' }, ctx)).toEqual({})
  })
  it('refuses a duplicate name at the same level, a second product, and cycles', () => {
    expect(validateComponentForm({ processType: 'operation', processName: ' cut ', parentId: '3' }, ctx).processName).toBe(
      'A component with this name already exists at this level.',
    )
    expect(validateComponentForm({ processType: 'product', processName: 'Other', parentId: '' }, ctx).processType).toBe(
      'A Product already exists. Each case can only have one root Product.',
    )
    expect(validateComponentForm({ processType: 'product', processName: 'bracket', parentId: '' }, ctx).processName).toBe(
      'A Product with this name already exists.',
    )
    const editing = { processNodes: NODES, editingId: '2', descendantIds: formDescendantIds(NODES, '2') }
    expect(validateComponentForm({ processType: 'machine', processName: 'Line', parentId: '2' }, editing).parentId).toBe(
      'A component cannot be its own parent.',
    )
    expect(validateComponentForm({ processType: 'machine', processName: 'Line', parentId: '4' }, editing).parentId).toBe(
      'Cannot move a component under one of its own descendants.',
    )
  })
  it('name + type make it submittable', () => {
    expect(isFormSubmittable({ processType: 'operation', processName: 'x' })).toBe(true)
    expect(isFormSubmittable({ processType: '', processName: 'x' })).toBe(false)
  })
})

describe('buildComponentSubmission (FLOW-7)', () => {
  const values = (over = {}) => ({ ...initialFormValues(undefined, '3', 'operation'), processName: ' Paint ', ...over })

  it('sends the canonical type, the parent as a number and defaults for quantity and unit', () => {
    const { payload, dbBody } = buildComponentSubmission(values(), { caseId: '10', isEditMode: false })
    expect(payload).toMatchObject({ caseId: '10', type: 'operation', name: 'Paint', parentId: '3' })
    expect(dbBody).toMatchObject({
      component_name: 'Paint',
      component_type: 'operation',
      parent_component_id: 3,
      description: null,
      quantity: 1,
      unit: 'unit',
      currency: 'USD',
    })
  })

  it('on create: 0 is a cost and blank is null', () => {
    const { dbBody } = buildComponentSubmission(values({ laborCost: 0, energyCost: 4.5 }), { caseId: '10', isEditMode: false })
    expect(dbBody).toMatchObject({ labor_cost: 0, energy_cost: 4.5, material_cost: null, opex: null })
  })

  it('on edit: a loaded cost cleared is null; a cost never loaded is not sent', () => {
    const initial = { id: '4', type: 'product', name: 'Bracket', laborCost: 12, energyCost: 3 }
    const { dbBody } = buildComponentSubmission(
      { ...initialFormValues(initial), laborCost: 0, energyCost: undefined },
      { caseId: '10', isEditMode: true, initial },
    )
    expect((dbBody as any).labor_cost).toBe(0)
    expect((dbBody as any).energy_cost).toBeNull()
    expect('material_cost' in dbBody).toBe(false)
    expect(dbBody.parent_component_id).toBeNull()
  })

  it('a product has no parent; machine and elemental map to the API names', () => {
    expect(buildComponentSubmission(values({ processType: 'product' }), { caseId: '10', isEditMode: false }).payload.parentId).toBeNull()
    expect(buildComponentSubmission(values({ processType: 'machine' }), { caseId: '10', isEditMode: false }).dbBody.component_type).toBe('machine_line')
  })
})

describe('form helpers', () => {
  it('sums the costs for the header', () => {
    expect(formatCostSummary({})).toBe('0.00')
    expect(formatCostSummary({ laborCost: 1.234, energyCost: 2, overheadCost: undefined })).toBe('3.23')
  })
  it('asks the integrations for what fits the tier, and names the metal', () => {
    expect(integrationWantsFor('operation')).toEqual({ labor: true, energy: true, material: false })
    expect(integrationWantsFor('elemental')).toEqual({ labor: false, energy: true, material: true })
    expect(integrationWantsFor('product')).toEqual({ labor: false, energy: false, material: false })
    expect(metalSymbolFor('Galvanized sheet')).toBe('ZNC')
    expect(metalSymbolFor('Steel bracket')).toBe('STL')
    expect(metalSymbolFor('Tin can')).toBe('TIN')
    expect(metalSymbolFor('Glass')).toBeUndefined()
  })
})
