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
import type { CostBasis, CostBasisKind } from '@/lib/costs/cost-basis'
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

/** PUT one cost; resolves to the server's error text, or null when saved. */
export async function putCost(componentId: number, body: Record<string, unknown>): Promise<string | null> {
  const res = await apiRequest(`/api/components/${componentId}/costs`, { method: 'PUT', body: JSON.stringify(body) })
  if (res.ok) return null
  const d = await res.json().catch(() => ({}))
  return d?.error ?? `Not saved (${res.status}).`
}
