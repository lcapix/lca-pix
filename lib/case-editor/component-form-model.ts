// <ComponentForm> (the Add / Edit component dialog) as pure functions: the
// form's starting values, the type mapping between the segmented control and
// the API, which parents a node may take, the validation messages, and the
// body sent to POST /api/cases/:id/components or PUT /api/components/:id.

import type { ComponentNode } from '@/lib/store'
import type { ProcessNode } from '@/types/component'
import type { NodeType } from '@/lib/hierarchy'
import { canParent, getRequiredParentType } from '@/lib/hierarchy'
import { descendantIdsOf } from './case-tree'

/** What ComponentForm can be pre-filled with (edit mode, add-child mode). */
export interface ComponentFormInitialValues {
  id?: string
  type?: string
  name?: string
  description?: string
  parentId?: string | null
  driverCategory?: string
  drivers?: string[]
  mass?: number
  massUnit?: string
  operationalCostUSD?: number
  capitalCostUSD?: number
  laborCost?: number
  energyCost?: number
  transportationCost?: number
  materialCost?: number
  equipmentCost?: number
  overheadCost?: number
  currency?: string
}

export const DRIVER_CATEGORIES = [
  'Energy Consumption',
  'Material Usage',
  'Transportation',
  'Water Usage',
  'Waste Generation',
  'Chemical Process',
  'Manufacturing Process',
]

export const DRIVERS_BY_CATEGORY: Record<string, string[]> = {
  'Energy Consumption':    ['Electricity (kWh)', 'Natural Gas (m³)', 'Diesel (L)', 'Coal (kg)', 'Steam (kg)'],
  'Material Usage':        ['Steel (kg)', 'Aluminum (kg)', 'Plastic (kg)', 'Concrete (m³)', 'Wood (m³)'],
  'Transportation':        ['Truck Transport (tkm)', 'Rail Transport (tkm)', 'Sea Transport (tkm)', 'Air Transport (tkm)'],
  'Water Usage':           ['Process Water (L)', 'Cooling Water (L)', 'Steam Generation (L)'],
  'Waste Generation':      ['Solid Waste (kg)', 'Liquid Waste (L)', 'Hazardous Waste (kg)'],
  'Chemical Process':      ['Solvent Usage (L)', 'Catalyst Usage (kg)', 'Chemical Reaction (mol)'],
  'Manufacturing Process': ['Machine Hours (h)', 'Labor Hours (h)', 'Production Rate (units/h)'],
}

/* ------------------------------------------------------------------ */
/* Type mapping — the segmented control uses short form values         */
/* ('machine','elemental'); the DB/API + transformComponentFromDB use  */
/* canonical values ('machine_line','elemental_task'). These two maps   */
/* bridge them so created components are accepted by the API (previously */
/* Machine/Line and Elemental Task always 400'd) and so editing an      */
/* existing component pre-selects the right type.                       */
/* ------------------------------------------------------------------ */
export const FORM_TO_DB_TYPE: Record<string, string> = {
  product: 'product',
  machine: 'machine_line',
  subprocess: 'subprocess',
  operation: 'operation',
  elemental: 'elemental_task',
}
export const DB_TO_FORM_TYPE: Record<string, string> = {
  product: 'product',
  machine_line: 'machine',
  subprocess: 'subprocess',
  operation: 'operation',
  elemental_task: 'elemental',
}
export const toFormType = (t?: string | null): string => (t ? (DB_TO_FORM_TYPE[t] ?? t) : '')
export const toDbType = (t?: string | null): string => (t ? (FORM_TO_DB_TYPE[t] ?? t) : '')

export interface ComponentFormValues {
  processType: string
  processName: string
  processDescription: string
  parentId: string
  driverCategory: string
  drivers: string[]
  mass: number
  massUnit: string
  // Costs: undefined = unknown (blank), 0 = a real zero (FLOW-7).
  operationalCostUSD: number | undefined
  capitalCostUSD: number | undefined
  laborCost: number | undefined
  energyCost: number | undefined
  transportationCost: number | undefined
  materialCost: number | undefined
  equipmentCost: number | undefined
  overheadCost: number | undefined
  currency: string
}

/** The form's starting values: the component being edited, else the suggested type and parent. */
export function initialFormValues(
  initial: ComponentFormInitialValues | undefined,
  suggestedParentId?: string | null,
  suggestedType?: string | null,
): ComponentFormValues {
  return {
    processType:        toFormType(initial?.type ?? suggestedType ?? '') as string,
    processName:        initial?.name ?? '',
    processDescription: initial?.description ?? '',
    parentId:           (initial?.parentId ?? suggestedParentId ?? '') as string,
    driverCategory:     initial?.driverCategory ?? '',
    drivers:            initial?.drivers ?? [],
    mass:               initial?.mass ?? 0,
    massUnit:           initial?.massUnit ?? '',
    operationalCostUSD: initial?.operationalCostUSD as number | undefined,
    capitalCostUSD:     initial?.capitalCostUSD as number | undefined,
    // Advanced ABC costs
    laborCost:          initial?.laborCost as number | undefined,
    energyCost:         initial?.energyCost as number | undefined,
    transportationCost: initial?.transportationCost as number | undefined,
    materialCost:       initial?.materialCost as number | undefined,
    equipmentCost:      initial?.equipmentCost as number | undefined,
    overheadCost:       initial?.overheadCost as number | undefined,
    currency:           initial?.currency ?? 'USD',
  }
}

/** GET /api/cases/:id/components rows as the form's process nodes. */
export function toProcessNodes(components: any[]): ProcessNode[] {
  return components.map((c: any) => ({
    id: String(c.component_id),
    name: c.component_name,
    type: c.component_type,
    description: c.description ?? undefined,
    parentId: c.parent_component_id ? String(c.parent_component_id) : undefined,
  }))
}

/** Everything below the component being edited (none when creating). */
export function formDescendantIds(processNodes: ProcessNode[], editingId: string | undefined): Set<string> {
  if (!editingId) return new Set<string>()
  return descendantIdsOf(processNodes as any, editingId)
}

/**
 * Parents a node of this type may take: ANY coarser node anywhere in the
 * tree (levels may be skipped), never itself or one of its descendants.
 * The product takes none.
 */
export function eligibleParentsFor(
  processType: string,
  processNodes: ProcessNode[],
  editingId: string | undefined,
  descendantIds: Set<string>,
): ProcessNode[] {
  if (!processType || processType === 'product') return []
  return processNodes.filter(
    (n) =>
      n.id !== editingId &&
      !descendantIds.has(n.id) &&
      canParent(
        toFormType(n.type as unknown as string) as unknown as NodeType,
        processType as unknown as NodeType,
      ),
  )
}

/** Nodes of the tier directly above `type` (the auto-attach candidates). */
export function defaultParentCandidates(
  type: string,
  processNodes: ProcessNode[],
  editingId: string | undefined,
  descendantIds: Set<string>,
): ProcessNode[] {
  const requiredForm = getRequiredParentType(type as unknown as NodeType)
  if (!requiredForm) return []
  return processNodes.filter(
    (n) =>
      n.id !== editingId &&
      !descendantIds.has(n.id) &&
      toFormType(n.type as unknown as string) === (requiredForm as unknown as string),
  )
}

/**
 * Tiers the segmented control greys out ahead of time instead of erroring
 * after the click: Product when the case already has one (create only), and
 * when adding a child, every tier not finer than the chosen parent.
 */
export function disabledTypesFor({
  mode,
  processNodes,
  isAddChildMode,
  suggestedParent,
}: {
  mode: 'create' | 'edit'
  processNodes: ProcessNode[]
  isAddChildMode: boolean
  suggestedParent: ProcessNode | null | undefined
}): string[] | undefined {
  const off: string[] = []
  // A case can only have one root Product.
  if (mode === 'create' && processNodes.some((n) => toFormType(n.type as unknown as string) === 'product'))
    off.push('product')
  // Adding a child: only tiers finer than the chosen parent.
  if (isAddChildMode && suggestedParent) {
    const pType = toFormType(suggestedParent.type as unknown as string) as unknown as NodeType
    for (const t of ['product', 'machine', 'subprocess', 'operation', 'elemental'] as NodeType[]) {
      if (!canParent(pType, t) && !off.includes(t as unknown as string)) off.push(t as unknown as string)
    }
  }
  return off.length ? off : undefined
}

/** Field errors for the form (empty when it may be submitted). */
export function validateComponentForm(
  formData: Pick<ComponentFormValues, 'processType' | 'processName' | 'parentId'>,
  { processNodes, editingId, descendantIds }: { processNodes: ProcessNode[]; editingId: string | undefined; descendantIds: Set<string> },
): Record<string, string> {
  const next: Record<string, string> = {}
  if (!formData.processType)        next.processType = 'Select a process type'
  if (!formData.processName.trim()) next.processName = 'Enter a process name'

  const processType = formData.processType as string
  if (processType !== 'product' && formData.processType) {
    if (formData.parentId) {
      // Cycle / self guard (the dropdown already excludes these, but defend
      // against stale state). Tier matching is no longer enforced — any node
      // may be re-parented anywhere it doesn't create a cycle.
      if (formData.parentId === editingId) {
        next.parentId = 'A component cannot be its own parent.'
      } else if (descendantIds.has(formData.parentId)) {
        next.parentId = 'Cannot move a component under one of its own descendants.'
      }
      const siblings = processNodes.filter(
        (n) => n.parentId === formData.parentId && n.id !== editingId,
      )
      if (
        siblings.some(
          (s) => s.name.toLowerCase() === formData.processName.toLowerCase().trim(),
        )
      ) {
        next.processName = 'A component with this name already exists at this level.'
      }
    } else {
      // Only the product is a root; every other step belongs to the product
      // system, so it must sit under something.
      next.parentId = 'Pick the step this belongs under. Every step needs a parent; only the product has none.'
    }
  } else if (processType === 'product') {
    const existing = processNodes.filter(
      (n) => n.type === 'product' && !n.parentId && n.id !== editingId,
    )
    if (existing.length > 0) {
      next.processType = 'A Product already exists. Each case can only have one root Product.'
    }
    if (
      processNodes.some(
        (n) =>
          n.type === 'product' &&
          n.name.toLowerCase() === formData.processName.toLowerCase().trim() &&
          n.id !== editingId,
      )
    ) {
      next.processName = 'A Product with this name already exists.'
    }
  }
  return next
}

/** Name + type are the minimum before the form can be submitted. */
export const isFormSubmittable = (f: Pick<ComponentFormValues, 'processType' | 'processName'>) =>
  Boolean(f.processType && f.processName.trim())

/**
 * The store copy (Zustand, for optimistic UI) and the DB-shaped body for the
 * REST endpoint. The API is the source of truth.
 *
 * Costs: a number (0 included) is saved; a blank is NULL (unknown). The API
 * clears a column when its key is sent as null, so on edit a blank is only
 * sent for a cost this form loaded (and the user emptied): a cost it never
 * loaded is left alone rather than wiped.
 */
export function buildComponentSubmission(
  formData: ComponentFormValues,
  { caseId, isEditMode, initial }: { caseId: string; isEditMode: boolean; initial?: ComponentFormInitialValues },
) {
  const payload: Omit<ComponentNode, 'id'> = {
    caseId,
    type: toDbType(formData.processType) as unknown as ComponentNode['type'],
    name: formData.processName.trim(),
    description: formData.processDescription,
    parentId: formData.processType === 'product' ? null : (formData.parentId || null),
    driverCategory: formData.driverCategory || undefined,
    drivers: formData.drivers.length > 0 ? formData.drivers : undefined,
    mass: formData.mass || undefined,
    massUnit: formData.massUnit || undefined,
    // `?? undefined`, not `|| undefined`: 0 is a cost (FLOW-7).
    operationalCostUSD: formData.operationalCostUSD ?? undefined,
    capitalCostUSD: formData.capitalCostUSD ?? undefined,
    laborCost: formData.laborCost ?? undefined,
    energyCost: formData.energyCost ?? undefined,
    transportationCost: formData.transportationCost ?? undefined,
    materialCost: formData.materialCost ?? undefined,
    equipmentCost: formData.equipmentCost ?? undefined,
    overheadCost: formData.overheadCost ?? undefined,
    currency: formData.currency || undefined,
  }

  const dbBody = {
    component_name: payload.name,
    // Map the form's short type ('machine'/'elemental') to the canonical
    // value the API validates against ('machine_line'/'elemental_task').
    // Without this, Machine/Line and Elemental Task creates returned 400.
    component_type: toDbType(payload.type as unknown as string),
    parent_component_id: payload.parentId ? Number(payload.parentId) : null,
    description: payload.description || null,
    driver_category: payload.driverCategory || null,
    drivers: payload.drivers && payload.drivers.length > 0 ? payload.drivers : null,
    quantity: payload.mass ?? 1,
    unit: payload.massUnit || 'unit',
    currency: payload.currency || 'USD',
  }
  const COST_KEYS: Array<[keyof ComponentFormInitialValues, string]> = [
    ['operationalCostUSD', 'opex'],
    ['capitalCostUSD', 'capex'],
    ['laborCost', 'labor_cost'],
    ['energyCost', 'energy_cost'],
    ['materialCost', 'material_cost'],
    ['transportationCost', 'transportation_cost'],
    ['equipmentCost', 'equipment_cost'],
    ['overheadCost', 'overhead_cost'],
  ]
  for (const [key, col] of COST_KEYS) {
    const v = (payload as any)[key] as number | undefined
    if (v != null) (dbBody as any)[col] = v
    else if (!isEditMode || initial?.[key] != null) (dbBody as any)[col] = null
  }
  return { payload, dbBody }
}

/** The Costs header's running total: every cost field, blanks as 0. */
export function formatCostSummary(f: {
  operationalCostUSD?: number
  capitalCostUSD?: number
  laborCost?: number
  energyCost?: number
  materialCost?: number
  transportationCost?: number
  equipmentCost?: number
  overheadCost?: number
}) {
  const total =
    (f.operationalCostUSD || 0) +
    (f.capitalCostUSD || 0) +
    (f.laborCost || 0) +
    (f.energyCost || 0) +
    (f.materialCost || 0) +
    (f.transportationCost || 0) +
    (f.equipmentCost || 0) +
    (f.overheadCost || 0)
  return total.toFixed(2)
}
