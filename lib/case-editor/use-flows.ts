'use client'

// The flows editor's data: a step's flows (load, edit in place, delete), the
// substance catalog it picks from, and the shared "something changed"
// signals. Same requests as the editor always made: plain fetch with the
// bearer token, GET/POST /api/components/:id/flows, PUT/DELETE /api/flows/:id,
// GET /api/substances?limit=500.

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { FlowRow, Substance } from './flow-types'

/** JSON headers with the stored bearer token, as the flows editor sends them. */
export function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const t = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  if (t) h.Authorization = 'Bearer ' + t
  return h
}

/** Tell the canvas/sidebar to refresh flow counts. */
export function announceComponentsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lcapix:components-changed'))
  }
}

/**
 * A step's flows. Only the newest load may land (FLOW-6): switching steps
 * quickly used to show, and let you edit, the previous step's flows when its
 * response came back last. A failed load says so instead of "No flows yet".
 * Other panels (e.g. the machine-energy calculator) add flows too; the list
 * reloads when they announce lcapix:flows-changed.
 */
export function useFlows(componentId: string, onFlowsChange?: (flows: FlowRow[]) => void) {
  const [flows, setFlows] = useState<FlowRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const loadSeq = useRef(0)

  const loadFlows = useCallback(async () => {
    const seq = ++loadSeq.current
    setLoading(true)
    try {
      const r = await fetch(`/api/components/${componentId}/flows`, { headers: authHeaders() })
      const d = await r.json().catch(() => ({}))
      if (seq !== loadSeq.current) return
      if (!r.ok || !Array.isArray(d?.flows)) {
        setLoadError(`Could not load this step's flows (${d?.error || `error ${r.status}`}).`)
        setFlows([])
        return
      }
      setLoadError(null)
      setFlows(d.flows)
    } catch {
      if (seq !== loadSeq.current) return
      setLoadError("Could not load this step's flows (network error).")
      setFlows([])
    } finally {
      if (seq === loadSeq.current) setLoading(false)
    }
  }, [componentId])

  useEffect(() => {
    loadFlows()
    // Anything still in flight belongs to a step this editor no longer shows.
    return () => {
      loadSeq.current++
    }
  }, [loadFlows])

  // Told the step's flows each time they load, so other panels (Suggest costs) see them.
  const onFlowsChangeRef = useRef(onFlowsChange)
  onFlowsChangeRef.current = onFlowsChange
  useEffect(() => {
    onFlowsChangeRef.current?.(flows)
  }, [flows])

  useEffect(() => {
    const onChanged = () => loadFlows()
    window.addEventListener('lcapix:flows-changed', onChanged)
    return () => window.removeEventListener('lcapix:flows-changed', onChanged)
  }, [loadFlows])

  /** Delete a flow after asking; reload and announce on success. */
  async function deleteFlow(flowId: number) {
    const f = flows.find((x) => x.flow_id === flowId)
    if (!confirm(`Delete the ${f?.substance_name ?? 'flow'} line from this step?`)) return
    try {
      const r = await fetch(`/api/flows/${flowId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (r.ok) {
        toast.success('Flow deleted')
        await loadFlows()
        announceComponentsChanged()
      } else {
        const body = await r.json().catch(() => null)
        toast.error(body?.error || 'Could not delete flow')
      }
    } catch {
      toast.error('Could not delete flow (network error).')
    }
  }

  return { flows, loading, loadError, loadFlows, deleteFlow }
}

/** The substance catalog for the picker, loaded once. Empty when it cannot load. */
export function useSubstanceCatalog() {
  const [substances, setSubstances] = useState<Substance[]>([])
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/substances?limit=500', { headers: authHeaders() })
        const d = await r.json().catch(() => ({}))
        if (!cancelled) setSubstances(d?.substances ?? d?.data ?? [])
      } catch {
        /* non-fatal — picker just shows empty */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])
  /** A substance just added by hand joins the list. */
  const addToCatalog = (s: Substance) => setSubstances((list) => [...list, s])
  return { substances, addToCatalog }
}

export interface FlowEdit {
  id: number
  qty: string
  unit: string
  substanceId: number
}

/**
 * In-place edit of an existing row's quantity/unit — a what-if is "duplicate
 * the case, tweak a few quantities, re-run"; without this the only way to
 * change 95 → 40 was delete + re-add. The substance can be swapped too
 * (aluminum → steel): same flow, another material, which is what a
 * comparative case changes.
 */
export function useFlowRowEdit({
  flows,
  substances,
  loadFlows,
}: {
  flows: FlowRow[]
  substances: Substance[]
  loadFlows: () => Promise<void>
}) {
  const [editing, setEditing] = useState<FlowEdit | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  const startEdit = (f: FlowRow) =>
    setEditing({
      id: f.flow_id,
      qty: String(f.quantity),
      unit: f.unit,
      substanceId: f.substance_id,
    })

  async function saveEdit() {
    if (!editing || editSaving) return
    const qtyNum = Number(editing.qty)
    if (editing.qty.trim() === '' || isNaN(qtyNum)) {
      toast.error('Quantity must be a number')
      return
    }
    setEditSaving(true)
    try {
      const before = flows.find((x) => x.flow_id === editing.id)
      const swapped = !!before && before.substance_id !== editing.substanceId
      const r = await fetch(`/api/flows/${editing.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          quantity: qtyNum,
          unit: editing.unit.trim() || undefined,
          ...(swapped ? { substance_id: editing.substanceId } : {}),
        }),
      })
      if (r.ok) {
        const to = substances.find((s) => s.substance_id === editing.substanceId)?.substance_name
        toast.success(swapped && to ? `Swapped to ${to}` : 'Flow updated')
        setEditing(null)
        await loadFlows()
        announceComponentsChanged()
      } else {
        // Surfaces the server's unit-compatibility guard, among others.
        const body = await r.json().catch(() => null)
        toast.error(body?.error || 'Could not update flow')
      }
    } catch {
      toast.error('Could not update flow (network error). Nothing was saved.')
    } finally {
      setEditSaving(false)
    }
  }

  return { editing, setEditing, editSaving, startEdit, saveEdit, cancelEdit: () => setEditing(null) }
}
