// A component's flows as GET /api/components/:id/flows returns them, the
// catalog substances the flows editor picks from, and the inspector's
// compact view of a flow (what Suggest costs reads).

import type { InspectorFlow } from './types'

export interface FlowRow {
  flow_id: number
  substance_id: number
  substance_name?: string
  substance_category?: string
  cas_number?: string
  flow_type: 'input' | 'output'
  quantity: number | string
  unit: string
}

export interface Substance {
  substance_id: number
  substance_name: string
  unit?: string
  category?: string
  cas_number?: string
  /** '|'-joined method names that have non-zero factors for this substance. */
  methods_with_factors?: string
  factor_count?: number
  /** Set when this substance is a version of another (migrate-022). */
  variant_of?: number | null
  variant_label?: string | null
}

/** The inspector's view of a step's flows. */
export function toInspectorFlows(rows: FlowRow[]): InspectorFlow[] {
  return rows.map((f) => ({
    id: String(f.flow_id),
    substance: f.substance_name ?? '',
    dir: f.flow_type === 'output' ? 'OUT' : 'IN',
    amount: Number(f.quantity) || 0,
    unit: f.unit,
  }))
}
