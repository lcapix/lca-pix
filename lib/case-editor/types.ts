// Shared shapes for the case editor: the inspector's edit form, the page's
// extended form, and the completeness report that gates Run Assessment.
// The inspector re-exports the first three under their old names.

export interface InspectorEditFormData {
  processName?: string
  processDescription?: string
  parentId?: string
  mass?: number
  massUnit?: string
  laborCost?: number
  /** Labor multiplicand: hours worked. laborCost = laborHours × the SOC rate. */
  laborHours?: number
  /** BLS SOC code of the wage rate used (e.g. '51-4121'), for provenance. */
  laborOccupation?: string
  energyCost?: number
  transportationCost?: number
  materialCost?: number
  equipmentCost?: number
  overheadCost?: number
  /** Which life-cycle stage this step belongs to. */
  lifeCycleStage?: string | null
  /** ISO 14044 4.3.4: share of this node's burden that belongs to the product. */
  allocationMethod?: 'none' | 'physical' | 'economic' | 'system_expansion'
  allocationFactor?: number
  allocationNote?: string
}

/** Candidate re-parent target for the inspector's Parent selector. */
export interface ParentOption {
  id: string
  label: string
}

export interface InspectorFlow {
  id: string
  substance: string
  dir: 'IN' | 'OUT'
  amount: number
  unit: string
}

/** The case editor's form for the selected component (inspector fields + the rest of the row). */
export interface EditFormData extends InspectorEditFormData {
  processType?: string
  parentId?: string
  driverCategory?: string
  selectedDriver?: string
  drivers?: string[]
  operationalCostUSD?: number
  capitalCostUSD?: number
  currency?: string
  costAllocationType?: 'manual' | 'calculated' | 'allocated'
}

/** GET /api/cases/:id/completeness → report: which data layers the case has. */
export type CompletenessReport = {
  present: string[]
  missing: Array<{ layer: string; label: string; suggestedDocs: string[] }>
  score: number
}
