// The case editor's Save, as pure functions: what the inspector form holds
// for a component, which edits are refused (and with which message), and the
// body sent to PUT /api/components/:id. The page's handleSaveComponent calls
// these in this order; the messages are the toasts the user sees.

import type { ComponentNode } from '@/lib/store'
import type { EditFormData } from './types'

/** Component type constants matching the DB enum. */
export const COMPONENT_TYPES = {
  PRODUCT: 'product',
  MACHINE_LINE: 'machine_line',
  SUBPROCESS: 'subprocess',
  OPERATION: 'operation',
  ELEMENTAL_TASK: 'elemental_task',
} as const

// A typed 0 is a real cost ("this operation costs nothing"), distinct from an
// empty field (unknown). `x || null` collapsed both to null, and the component
// PUT's COALESCE then kept the previous number — so editing a cost to 0 silently
// reverted. This preserves 0 and any valid number; only truly-empty inputs → null.
export const costOrNull = (v: unknown): number | null => {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

/** The inspector form for a component, as loaded when it is selected. */
export function formDataFromComponent(c: ComponentNode): EditFormData {
  const row = c as any
  return {
    processName: c.name,
    processType: c.type,
    processDescription: c.description || '',
    driverCategory: c.driverCategory || '',
    selectedDriver: c.selectedDriver || '',
    mass: c.mass ?? undefined,
    massUnit: c.massUnit || '',
    operationalCostUSD: c.operationalCostUSD ?? undefined,
    capitalCostUSD: c.capitalCostUSD ?? undefined,
    parentId: c.parentId || undefined,
    laborCost: row.laborCost ?? undefined,
    laborHours: row.laborHours ?? undefined,
    laborOccupation: row.laborOccupation ?? undefined,
    energyCost: row.energyCost ?? undefined,
    transportationCost: row.transportationCost ?? undefined,
    materialCost: row.materialCost ?? undefined,
    equipmentCost: row.equipmentCost ?? undefined,
    overheadCost: row.overheadCost ?? undefined,
    currency: row.currency || 'USD',
    costAllocationType: row.costAllocationType ?? undefined,
    allocationMethod: c.allocationMethod ?? 'none',
    allocationFactor: c.allocationFactor ?? 1,
    allocationNote: c.allocationNote ?? undefined,
    lifeCycleStage: c.lifeCycleStage ?? null,
  }
}

/**
 * Why a Save is refused, or null when it may go ahead. Checked in this order;
 * the first failing rule wins.
 */
export function validateComponentSave(fd: EditFormData): string | null {
  if (!fd.processType) return 'Please select a process type'
  if (!fd.processName || !fd.processName.trim()) return 'Component name is required'
  if (fd.processType !== COMPONENT_TYPES.PRODUCT && !fd.parentId) {
    return 'Every step needs a parent. Pick one under Placement (only the product has none).'
  }
  if (
    (fd.allocationMethod === 'physical' || fd.allocationMethod === 'economic') &&
    !(Number(fd.allocationFactor) > 0 && Number(fd.allocationFactor) <= 1)
  ) {
    return 'Enter the share (0.1 to 100%) that belongs to this product, or set allocation to None'
  }
  return null
}

/**
 * A Save that changes the product's quantity rescales the case, so it waits
 * for the user to say what the change means. Returns the change, or null when
 * the quantity is unchanged, not above 0, or the component is not the product.
 */
export function pendingRescale(
  current: Pick<ComponentNode, 'type' | 'mass'> | undefined,
  fd: EditFormData,
): { from: number; to: number } | null {
  if (current?.type !== COMPONENT_TYPES.PRODUCT) return null
  const from = Number(current.mass ?? 1) || 1
  const to = Number(fd.mass ?? from)
  return to > 0 && to !== from ? { from, to } : null
}

/** Body of PUT /api/components/:id for a validated form. Key order is the wire order. */
export function buildComponentUpdatePayload(fd: EditFormData) {
  return {
    component_name: fd.processName!.trim(),
    component_type: fd.processType,
    component_description: fd.processDescription || null,
    parent_component_id: fd.parentId ? parseInt(fd.parentId) : null,
    process_type: fd.processType,
    driver_category: fd.driverCategory || null,
    driver_type: fd.selectedDriver || null,
    drivers: fd.drivers && fd.drivers.length > 0 ? JSON.stringify(fd.drivers) : null,
    quantity: fd.mass ?? null,
    unit: fd.massUnit || null,
    opex: costOrNull(fd.operationalCostUSD),
    capex: costOrNull(fd.capitalCostUSD),
    labor_cost: costOrNull(fd.laborCost),
    labor_hours: fd.laborHours ?? null,
    labor_occupation: fd.laborOccupation || null,
    energy_cost: costOrNull(fd.energyCost),
    transportation_cost: costOrNull(fd.transportationCost),
    material_cost: costOrNull(fd.materialCost),
    equipment_cost: costOrNull(fd.equipmentCost),
    overhead_cost: costOrNull(fd.overheadCost),
    currency: fd.currency || 'USD',
    cost_allocation_type: fd.costAllocationType || 'manual',
    allocation_method: fd.allocationMethod ?? null,
    allocation_factor: fd.allocationMethod === 'none' ? 1 : fd.allocationFactor ?? null,
    allocation_note: fd.allocationNote ?? null,
    // A step with no stage reads as production; null keeps it that way.
    life_cycle_stage: fd.lifeCycleStage || null,
  }
}

/** The toast after POST /api/cases/:id/scale succeeds. */
export function scaleSuccessMessage(
  mode: 'scale-inputs' | 'data-covers',
  flowsScaled: number | undefined,
  from: number,
  to: number,
): string {
  return mode === 'scale-inputs'
    ? `Scaled ${flowsScaled ?? 0} inputs/outputs and every per-unit cost ×${Number((to / from).toPrecision(3))} to ${to} units`
    : `Kept the inputs as entered; they now count as ${to} units`
}
