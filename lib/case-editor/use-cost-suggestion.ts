'use client'

// "Suggest" costs for a step from its real flows (EDIT-3). Grounded: energy ×
// the carrier's rate, material mass × the ACTUAL material's rate, transport
// tonne-km × freight rate, labor hours × wage. Reference rates supply the
// rate only; the quantity is always the real flow amount. Anything
// unpriceable is surfaced as a note, never dropped.

import { useState } from 'react'
import { suggestCostsFromFlows } from '@/lib/costs/suggest-costs'
import type { InspectorFlow } from './types'

export interface SuggestedCosts {
  labor?: number
  energy?: number
  material?: number
  transportation?: number
}

export interface CostSuggestion {
  lines: string[]
  notes: string[]
  payload: SuggestedCosts
}

/** The suggestion for a step's flows (pure: no state). */
export function suggestCosts(
  flows: InspectorFlow[],
  opts: { nodeName?: string; nodeType: string; laborHours?: number },
): CostSuggestion {
  const s = suggestCostsFromFlows(
    (flows || []).map((f) => ({
      substance: f.substance,
      dir: f.dir,
      amount: f.amount,
      unit: f.unit,
    })),
    opts,
  )
  return {
    lines: s.lines,
    notes: s.notes,
    payload: {
      labor: s.labor,
      energy: s.energy,
      material: s.material,
      transportation: s.transportation,
    },
  }
}

/** True when the suggestion has at least one cost to apply. */
export const hasSuggestedCost = (p: SuggestedCosts) =>
  p.labor != null || p.energy != null || p.material != null || p.transportation != null

export function useCostSuggestion({
  flows,
  componentType,
  nodeName,
  laborHours,
  onApply,
}: {
  flows: InspectorFlow[]
  componentType: string
  nodeName?: string
  laborHours?: number
  onApply: (s: SuggestedCosts) => void
}) {
  const [result, setResult] = useState<CostSuggestion | null>(null)
  const [applied, setApplied] = useState(false)

  function suggest() {
    setApplied(false)
    setResult(suggestCosts(flows, { nodeName, nodeType: componentType, laborHours }))
  }

  /** Apply & save the shown suggestion. */
  function apply() {
    if (!result) return
    onApply(result.payload)
    setApplied(true)
    setResult(null)
  }

  const dismiss = () => setResult(null)

  return { result, applied, suggest, apply, dismiss }
}
