'use client'

// Changing the tree from the step menu and the Add step button: rename, move
// under another step, add a step below, delete. Each goes through the same
// routes as the rest of the app (which check access and the read-only sample)
// and then tells the workspace to reload.

import { useState } from 'react'
import { apiRequest } from '@/lib/api-client'
import { announceComponentsChanged } from '@/lib/case-editor/use-flows'
import { TIERS } from '@/lib/workspace/tier-layout'
import type { WorkspaceCase, WorkspaceStep } from '@/lib/workspace/use-workspace'

async function errorOf(res: Response): Promise<string> {
  const d = await res.json().catch(() => ({}))
  return d?.error ?? `The server answered ${res.status}.`
}

export function useStepActions({
  kase,
  steps,
  onSelect,
}: {
  kase: WorkspaceCase
  steps: WorkspaceStep[]
  onSelect: (id: number) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<Response>, after?: (res: Response) => Promise<void> | void): Promise<boolean> => {
    setBusy(true)
    setError(null)
    try {
      const res = await fn()
      if (!res.ok) {
        setError(await errorOf(res))
        return false
      }
      await after?.(res)
      announceComponentsChanged()
      return true
    } catch (e: any) {
      setError(e?.message ?? 'The change did not reach the server.')
      return false
    } finally {
      setBusy(false)
    }
  }

  const rename = (id: number, name: string) =>
    run(() => apiRequest(`/api/components/${id}`, { method: 'PUT', body: JSON.stringify({ component_name: name }) }))

  const move = (id: number, parentId: number) =>
    run(() => apiRequest(`/api/components/${id}`, { method: 'PUT', body: JSON.stringify({ parent_component_id: parentId }) }))

  /**
   * The first step of an empty case (F2.5): the product, named after the
   * project, then the chosen tier's step under it.
   */
  const addFirst = (productName: string, tier: string, name: string) =>
    run(
      async () => {
        const product = await apiRequest(`/api/cases/${kase.case_id}/components`, {
          method: 'POST',
          body: JSON.stringify({ component_name: productName, component_type: 'product', parent_component_id: null }),
        })
        if (!product.ok) return product
        const pd = await product.clone().json().catch(() => ({}))
        const productId = Number(pd?.component?.component_id ?? pd?.component_id)
        return apiRequest(`/api/cases/${kase.case_id}/components`, {
          method: 'POST',
          body: JSON.stringify({ component_name: name, component_type: tier, parent_component_id: productId }),
        })
      },
      async (res) => {
        const d = await res.clone().json().catch(() => ({}))
        const id = Number(d?.component?.component_id ?? d?.component_id)
        if (id) onSelect(id)
      },
    )

  /** A new step one tier below `parentId` ("Add a task below", "Add step"). */
  const addBelow = (parentId: number | null) => {
    const parent = steps.find((s) => s.id === parentId) ?? null
    const tier = parent ? TIERS[Math.min(TIERS.indexOf(parent.tier) + 1, TIERS.length - 1)] : 'product'
    const word = tier === 'elemental_task' ? 'task' : 'step'
    const taken = new Set(steps.map((s) => s.name.toLowerCase()))
    let name = `New ${word}`
    for (let i = 2; taken.has(name.toLowerCase()); i++) name = `New ${word} ${i}`
    return run(
      () =>
        apiRequest(`/api/cases/${kase.case_id}/components`, {
          method: 'POST',
          body: JSON.stringify({ component_name: name, component_type: tier, parent_component_id: parentId }),
        }),
      async (res) => {
        const d = await res.clone().json().catch(() => ({}))
        const id = Number(d?.component?.component_id ?? d?.component_id)
        if (id) onSelect(id)
      },
    )
  }

  const remove = (id: number) => run(() => apiRequest(`/api/components/${id}`, { method: 'DELETE' }))

  return { busy, error, rename, move, addBelow, addFirst, remove }
}
