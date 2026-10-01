'use client'

// What the case editor does to components: create (via the /component/new
// modal), save the inspector form, rescale the case when the product's
// quantity changes, delete with the children choice, and pull the tree again
// after Goal & scope saves. Same API calls, payloads, messages and toasts as
// the page had inline; handlers are plain functions over the current render,
// so a handler that awaits keeps the selection it started with.

import { useState } from 'react'
import { toast } from 'sonner'

import { apiRequest } from '@/lib/api-client'
import { useProjectStore, type ComponentNode } from '@/lib/store'
import {
  COMPONENT_TYPES,
  buildComponentUpdatePayload,
  pendingRescale,
  scaleSuccessMessage,
  validateComponentSave,
} from './component-payload'
import { newComponentQuery } from './case-tree'
import { chooseDeleteMode, deleteSuccessMessage, planDelete } from './delete-plan'
import type { EditFormState } from './use-edit-form'
import type { EditFormData } from './types'

type Router = { push: (href: string) => void }

export function useComponentActions({
  projectId,
  caseId,
  router,
  components,
  selectedNode,
  setSelectedNode,
  selectedComponent,
  form,
  reloadComponents,
  refresh,
}: {
  projectId: string
  caseId: string
  router: Router
  components: ComponentNode[]
  selectedNode: string | null
  setSelectedNode: (id: string | null) => void
  selectedComponent: ComponentNode | null
  form: EditFormState
  reloadComponents: () => Promise<ComponentNode[] | null>
  /** Background refetch of the tree, completeness and journey. */
  refresh: () => void
}) {
  const { updateComponentNode, deleteComponentNode } = useProjectStore()
  const { editFormData, setEditFormData, isEditing, setIsEditing, loadFormFor } = form
  const { pendingScale, setPendingScale, skipScaleCheck } = form

  // ---------- Create component ----------
  // Routes to the /component/new URL; an intercepting parallel route renders
  // that page as a modal over this editor while keeping the case canvas
  // mounted underneath.
  const handleCreateComponent = () => {
    // Carry the selection as placement context: a new component defaults to
    // being the CHILD of the node the user is standing on (or its sibling,
    // when a leaf is selected) — never a guess from elsewhere in the tree.
    const query = newComponentQuery(selectedComponent)
    router.push(`/project/${projectId}/case/${caseId}/component/new${query}`)
  }

  // ---------- Rescale (product quantity changed, user chose what it means) ----------
  const applyScale = async (mode: 'scale-inputs' | 'data-covers') => {
    if (!pendingScale) return
    const { from, to, fd } = pendingScale
    setPendingScale(null)
    try {
      const r = await apiRequest(`/api/cases/${caseId}/scale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, mode }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j?.error || 'Could not rescale the case')
      toast.success(scaleSuccessMessage(mode, j.flows_scaled, from, to))
      // Save the rest of the edited fields; the quantity is already set.
      skipScaleCheck.current = true
      await handleSaveComponent({ ...fd, mass: to })
      window.dispatchEvent(new Event('lcapix:flows-changed'))
      refresh()
    } catch (e: any) {
      toast.error(e?.message || 'Could not rescale the case')
    }
  }

  /** Put the field back to the saved quantity so nothing looks changed. */
  const cancelScale = () => {
    if (pendingScale) setEditFormData((f) => ({ ...f, mass: pendingScale.from }))
    setPendingScale(null)
  }

  // ---------- Save ----------
  // Accepts an optional override merged over the current form state, so callers
  // (e.g. the cost "Apply" affordance) can apply-and-save in one action without
  // waiting for a separate Save click or a React state flush.
  const handleSaveComponent = async (override?: Partial<EditFormData>) => {
    const fd = { ...editFormData, ...(override || {}) }
    const invalid = validateComponentSave(fd)
    if (invalid) {
      toast.error(invalid)
      return
    }

    // Changing the product's quantity rescales the case: ask first.
    const current = components.find((c) => c.id === selectedNode)
    if (isEditing && !skipScaleCheck.current) {
      const change = pendingRescale(current, fd)
      if (change) {
        setPendingScale({ ...change, fd })
        return
      }
    }
    skipScaleCheck.current = false

    try {
      if (isEditing && selectedNode) {
        const updatePayload = buildComponentUpdatePayload(fd)

        const response = await apiRequest(`/api/components/${selectedNode}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload),
        })
        const result = await response.json()
        if (!result.success) throw new Error(result.error || 'Failed to update component')

        const transformed = await reloadComponents()
        if (transformed) {
          // Re-fill the panel from what was just saved. It used to be cleared
          // (setEditFormData({}) below), so every field went blank after Save
          // and only came back when the step was selected again.
          const saved = transformed.find((c: any) => String(c.id) === String(selectedNode))
          if (saved) loadFormFor(saved)
        }
        toast.success('Component updated successfully')
      }
    } catch (error: any) {
      console.error('Error saving component:', error)
      toast.error(error.message || 'Failed to save component')
    }
  }

  /** The inspector's "Apply & save" on suggested costs: merge, then save with the patch (avoids stale state). */
  const handleApplyCosts = (patch: Partial<EditFormData>) => {
    setEditFormData((f) => ({ ...f, ...patch }))
    handleSaveComponent(patch as any)
  }

  // ---------- Delete ----------
  // Deletes on the server (DELETE /api/components/:id), then refetches; the
  // node only disappears once the server says it is gone (EDIT-1). A step
  // with children asks two plain questions, and Cancel on the last one never
  // does anything: delete everything under it, or keep the children by
  // moving them up to this step's parent.
  const [isDeleting, setIsDeleting] = useState(false)
  const handleDeleteSelected = async () => {
    if (!selectedNode || isDeleting) return
    const plan = planDelete(components, selectedNode)
    if (!plan) return
    const { comp, children, below } = plan

    const mode = chooseDeleteMode(plan, components, (message) => confirm(message))
    if (!mode) return

    setIsDeleting(true)
    try {
      const res = await apiRequest(
        `/api/components/${encodeURIComponent(comp.id)}?children=${mode}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || `Could not delete "${comp.name}" (${res.status})`)
      }
      // Keep the persisted local cache in step with the server.
      if (mode === 'delete') {
        ;[comp.id, ...below].forEach((id) => deleteComponentNode(id))
      } else {
        children.forEach((ch) => updateComponentNode(ch.id, { parentId: comp.parentId ?? null }))
        deleteComponentNode(comp.id)
      }
      toast.success(deleteSuccessMessage(plan, mode))
      setSelectedNode(null)
      setIsEditing(false)
      setEditFormData({})
      // Background refetch of the tree, completeness and journey.
      refresh()
    } catch (e: any) {
      // The node stays: nothing was removed locally.
      toast.error(e?.message || `Could not delete "${comp.name}"`)
    } finally {
      setIsDeleting(false)
    }
  }

  // ---------- Goal & scope saved (EDIT-8) ----------
  // Saving the data basis also rewrites the product's quantity on the server.
  // Pull the tree again and carry the new quantity into an open product form,
  // or the next inspector Save would send the old one and revert it.
  const handleGoalScopeSaved = async () => {
    try {
      const list = await reloadComponents()
      const product = list?.find((c) => c.type === COMPONENT_TYPES.PRODUCT && !c.parentId)
      if (product && product.id === selectedNode) {
        setEditFormData((f) => ({ ...f, mass: product.mass }))
      }
    } catch {
      toast.error('Could not refresh the steps after saving goal & scope')
    }
  }

  return {
    handleCreateComponent,
    handleSaveComponent,
    handleApplyCosts,
    handleDeleteSelected,
    isDeleting,
    applyScale,
    cancelScale,
    pendingScale,
    handleGoalScopeSaved,
  }
}
