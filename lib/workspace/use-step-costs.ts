'use client'

/**
 * A step's six costs and what its flows would cost (E14), from the costs
 * route. It reloads whenever a flow or a step changes anywhere on the page
 * (lcapix:flows-changed, lcapix:components-changed), so adding a flow in the
 * step panel shows its cost suggestion straight away. Only the newest load
 * may land: a slow answer for the step before must not cover this one.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiRequest } from '@/lib/api-client'
import type { CostBasis, CostBasisKind, CostLine } from '@/lib/costs/cost-basis'
import type { FromFlows } from './flow-cost-text'

export interface StepCosts {
  currency: string
  costs: Array<{ kind: CostBasisKind; amount: number | null; basis: CostBasis | null }>
  set: number
  of: number
  /** Absent from an older server: then nothing is suggested. */
  from_flows?: FromFlows
}

export function useStepCosts(componentId: number, enabled = true) {
  const [data, setData] = useState<StepCosts | null>(null)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)
  const load = useCallback(async () => {
    if (!enabled) return
    const mine = ++seq.current
    setError(null)
    try {
      const res = await apiRequest(`/api/components/${componentId}/costs`)
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d?.error ?? `error ${res.status}`)
      if (mine === seq.current) setData(d as StepCosts)
    } catch (e: any) {
      if (mine === seq.current) setError(e?.message ?? 'the costs did not load')
    }
  }, [componentId, enabled])
  useEffect(() => {
    setData(null)
    load()
    const onChange = () => load()
    window.addEventListener('lcapix:components-changed', onChange)
    window.addEventListener('lcapix:flows-changed', onChange)
    return () => {
      window.removeEventListener('lcapix:components-changed', onChange)
      window.removeEventListener('lcapix:flows-changed', onChange)
    }
  }, [load])
  return { data, error, load }
}

/**
 * Every listed step's costs at once, for the Inventory's cost cells and step
 * cost rows (E4). Reloads on the same announcements; only the newest load lands.
 */
export function useCaseStepCosts(componentIds: number[]) {
  const [data, setData] = useState<Map<number, StepCosts>>(new Map())
  const seq = useRef(0)
  const key = componentIds.join(',')
  const load = useCallback(async () => {
    const ids = key ? key.split(',').map(Number) : []
    const mine = ++seq.current
    const got = await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await apiRequest(`/api/components/${id}/costs`)
          if (!res.ok) return null
          return [id, (await res.json()) as StepCosts] as const
        } catch {
          return null
        }
      }),
    )
    if (mine === seq.current) setData(new Map(got.filter((x): x is readonly [number, StepCosts] => !!x)))
  }, [key])
  useEffect(() => {
    load()
    const onChange = () => load()
    window.addEventListener('lcapix:components-changed', onChange)
    window.addEventListener('lcapix:flows-changed', onChange)
    return () => {
      window.removeEventListener('lcapix:components-changed', onChange)
      window.removeEventListener('lcapix:flows-changed', onChange)
    }
  }, [load])
  return data
}

/** PUT one cost; resolves to the server's error text, or null when saved. */
export async function putCost(componentId: number, body: Record<string, unknown>): Promise<string | null> {
  const res = await apiRequest(`/api/components/${componentId}/costs`, { method: 'PUT', body: JSON.stringify(body) })
  if (res.ok) return null
  const d = await res.json().catch(() => ({}))
  return d?.error ?? `Not saved (${res.status}).`
}

export interface CostPreview {
  kind: CostBasisKind
  amount: number
  basis?: CostBasis | null
  lines?: CostLine[] | null
}

/**
 * Work a cost out without storing it (B1): the panels show the number beside
 * Save, and only Save stores it. Resolves to the preview, or the server's error.
 */
export async function previewCost(
  componentId: number,
  body: Record<string, unknown>,
): Promise<{ preview: CostPreview | null; error: string | null }> {
  const res = await apiRequest(`/api/components/${componentId}/costs`, { method: 'PUT', body: JSON.stringify({ ...body, preview: true }) })
  const d = await res.json().catch(() => ({}))
  if (!res.ok) return { preview: null, error: d?.error ?? `Not worked out (${res.status}).` }
  return { preview: (d?.preview ?? null) as CostPreview | null, error: null }
}
