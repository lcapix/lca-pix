import { describe, it, expect } from 'vitest'
import {
  COMPONENT_TYPES,
  buildComponentUpdatePayload,
  costOrNull,
  formDataFromComponent,
  pendingRescale,
  scaleSuccessMessage,
  validateComponentSave,
} from '@/lib/case-editor/component-payload'
import { transformComponentFromDB } from '@/lib/data-transformers'

describe('costOrNull (FLOW-3)', () => {
  it('keeps 0 and numbers, maps blank to null', () => {
    expect(costOrNull(0)).toBe(0)
    expect(costOrNull('0')).toBe(0)
    expect(costOrNull(12.5)).toBe(12.5)
    expect(costOrNull('')).toBeNull()
    expect(costOrNull(null)).toBeNull()
    expect(costOrNull(undefined)).toBeNull()
    expect(costOrNull('abc')).toBeNull()
  })
})

describe('validateComponentSave', () => {
  const ok = { processType: 'operation', processName: 'Cut', parentId: '1' }

  it('accepts a named step with a parent', () => {
    expect(validateComponentSave(ok)).toBeNull()
    expect(validateComponentSave({ processType: 'product', processName: 'Bracket' })).toBeNull()
  })

  it('checks type, then name, then parent, then allocation share', () => {
    expect(validateComponentSave({ processName: '' })).toBe('Please select a process type')
    expect(validateComponentSave({ ...ok, processName: '  ' })).toBe('Component name is required')
    expect(validateComponentSave({ ...ok, parentId: undefined })).toBe(
      'Every step needs a parent. Pick one under Placement (only the product has none).',
    )
    expect(validateComponentSave({ ...ok, allocationMethod: 'physical', allocationFactor: undefined })).toBe(
      'Enter the share (0.1 to 100%) that belongs to this product, or set allocation to None',
    )
    expect(validateComponentSave({ ...ok, allocationMethod: 'economic', allocationFactor: 1.5 })).not.toBeNull()
    expect(validateComponentSave({ ...ok, allocationMethod: 'economic', allocationFactor: 0.4 })).toBeNull()
    expect(validateComponentSave({ ...ok, allocationMethod: 'none', allocationFactor: undefined })).toBeNull()
  })
})

describe('pendingRescale', () => {
  const product = { type: COMPONENT_TYPES.PRODUCT as any, mass: 1 }
  it('asks only when the product quantity changes to a number above 0', () => {
    expect(pendingRescale(product, { mass: 4 })).toEqual({ from: 1, to: 4 })
    expect(pendingRescale(product, { mass: 1 })).toBeNull()
    expect(pendingRescale(product, { mass: 0 })).toBeNull()
    expect(pendingRescale(product, {})).toBeNull()
    expect(pendingRescale({ type: 'operation' as any, mass: 1 }, { mass: 4 })).toBeNull()
    expect(pendingRescale(undefined, { mass: 4 })).toBeNull()
  })
  it('treats a missing or zero stored quantity as 1', () => {
    expect(pendingRescale({ type: 'product' as any, mass: undefined }, { mass: 3 })).toEqual({ from: 1, to: 3 })
    expect(pendingRescale({ type: 'product' as any, mass: 0 }, { mass: 3 })).toEqual({ from: 1, to: 3 })
  })
})

describe('formDataFromComponent → buildComponentUpdatePayload', () => {
  const row = transformComponentFromDB({
    component_id: 2,
    case_id: 10,
    parent_component_id: 1,
    component_type: 'operation',
    component_name: 'Cut',
    quantity: '1.000000',
    unit: 'unit',
    labor_cost: '5.00',
    labor_hours: '0.25',
    life_cycle_stage: 'use',
    allocation_method: 'physical',
    allocation_factor: '0.8',
  })

  it('loads the inspector form from a component', () => {
    expect(formDataFromComponent(row)).toMatchObject({
      processName: 'Cut',
      processType: 'operation',
      processDescription: '',
      parentId: '1',
      mass: 1,
      massUnit: 'unit',
      laborCost: 5,
      laborHours: 0.25,
      currency: 'USD',
      allocationMethod: 'physical',
      allocationFactor: 0.8,
      lifeCycleStage: 'use',
    })
  })

  it('round-trips into the PUT body, in wire order', () => {
    const body = buildComponentUpdatePayload(formDataFromComponent(row))
    expect(Object.keys(body)).toEqual([
      'component_name', 'component_type', 'component_description', 'parent_component_id',
      'process_type', 'driver_category', 'driver_type', 'drivers', 'quantity', 'unit',
      'opex', 'capex', 'labor_cost', 'labor_hours', 'labor_occupation', 'energy_cost',
      'transportation_cost', 'material_cost', 'equipment_cost', 'overhead_cost', 'currency',
      'cost_allocation_type', 'allocation_method', 'allocation_factor', 'allocation_note',
      'life_cycle_stage',
    ])
    expect(body).toMatchObject({
      component_name: 'Cut',
      component_type: 'operation',
      component_description: null,
      parent_component_id: 1,
      quantity: 1,
      unit: 'unit',
      labor_cost: 5,
      labor_hours: 0.25,
      energy_cost: null,
      currency: 'USD',
      cost_allocation_type: 'manual',
      allocation_method: 'physical',
      allocation_factor: 0.8,
      life_cycle_stage: 'use',
    })
  })

  it('sends a typed 0 cost, a trimmed name, drivers as JSON, and factor 1 for no allocation', () => {
    const body = buildComponentUpdatePayload({
      processName: '  Paint  ',
      processType: 'operation',
      parentId: '1',
      laborCost: 0,
      drivers: ['Electricity (kWh)'],
      allocationMethod: 'none',
      allocationFactor: 0.3,
      lifeCycleStage: '',
    })
    expect(body.component_name).toBe('Paint')
    expect(body.labor_cost).toBe(0)
    expect(body.drivers).toBe('["Electricity (kWh)"]')
    expect(body.allocation_factor).toBe(1)
    expect(body.life_cycle_stage).toBeNull()
  })
})

describe('scaleSuccessMessage', () => {
  it('names the factor and the new count', () => {
    expect(scaleSuccessMessage('scale-inputs', 7, 1, 4)).toBe(
      'Scaled 7 inputs/outputs and every per-unit cost ×4 to 4 units',
    )
    expect(scaleSuccessMessage('scale-inputs', undefined, 3, 1)).toBe(
      'Scaled 0 inputs/outputs and every per-unit cost ×0.333 to 1 units',
    )
    expect(scaleSuccessMessage('data-covers', 7, 1, 4)).toBe('Kept the inputs as entered; they now count as 4 units')
  })
})
