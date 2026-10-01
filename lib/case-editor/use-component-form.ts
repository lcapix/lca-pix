'use client'

// <ComponentForm>'s state and behaviour: the form values and errors, the
// case's nodes (fetched, since the Zustand store often is not hydrated with
// them), which parents are allowed, the auto-attach default parent, and
// submit (POST /api/cases/:id/components or PUT /api/components/:id, then
// the store, the toast, and onSuccess or back to the case).

import * as React from 'react'
import { toast } from 'sonner'

import { apiRequest } from '@/lib/api-client'
import { useProjectStore, type ComponentNode } from '@/lib/store'
import type { ProcessNode } from '@/types/component'
import {
  buildComponentSubmission,
  defaultParentCandidates,
  disabledTypesFor,
  eligibleParentsFor,
  formDescendantIds,
  initialFormValues,
  isFormSubmittable,
  toProcessNodes,
  validateComponentForm,
  type ComponentFormInitialValues,
  type ComponentFormValues,
} from './component-form-model'

type Router = { push: (href: string) => void }

export function useComponentForm({
  projectId,
  caseId,
  initial,
  mode,
  suggestedParentId,
  suggestedType,
  onSuccess,
  router,
}: {
  projectId: string
  caseId: string
  initial?: ComponentFormInitialValues
  mode: 'create' | 'edit'
  suggestedParentId?: string | null
  suggestedType?: string | null
  onSuccess?: () => void
  router: Router
}) {
  const { projects, addComponentNode, updateComponentNode } = useProjectStore()

  const isEditMode = mode === 'edit'

  const [formData, setFormData] = React.useState<ComponentFormValues>(() =>
    initialFormValues(initial, suggestedParentId, suggestedType),
  )
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  /* ------- project context ------- */
  const project = projects.find((p) => p.id === projectId)
  const currentCase = project?.cases.find((c) => c.id === caseId)

  // The Zustand store often isn't hydrated with the case's full component list
  // (the editor fetches them into its own local state via the API). Fetch them
  // directly here so the parent dropdown + auto-attach default see every node,
  // not just whatever happens to be in the store.
  const [fetchedNodes, setFetchedNodes] = React.useState<ProcessNode[]>([])
  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await apiRequest(`/api/cases/${caseId}/components`)
        const d = await r.json()
        if (!cancelled && d?.success && Array.isArray(d.components)) {
          setFetchedNodes(toProcessNodes(d.components))
        }
      } catch {
        /* fall back to store-derived nodes below */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [caseId])

  const processNodes: ProcessNode[] = React.useMemo(() => {
    if (fetchedNodes.length) return fetchedNodes
    const list = currentCase?.components || []
    return list.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      description: c.description,
      parentId: c.parentId || undefined,
    }))
  }, [fetchedNodes, currentCase?.components])

  const editingId = isEditMode ? initial?.id : undefined
  const editingComponent: ComponentNode | undefined = editingId
    ? currentCase?.components.find((c) => c.id === editingId)
    : undefined
  const hasParent = Boolean(editingComponent?.parentId)
  const isAddChildMode = Boolean(suggestedParentId && suggestedType && !isEditMode)
  const suggestedParent = suggestedParentId
    ? processNodes.find((n) => n.id === suggestedParentId)
    : null
  // Add-child mode fixes the PARENT, not the type: the new node may be any tier
  // finer than its parent (levels can be skipped), so the type stays pickable.
  const isProcessTypeLocked = isEditMode && hasParent

  /* ------- eligible parent list -------
   * Any non-product node can be re-parented to ANY other node in the case
   * (full maneuverability), become independent, or stay put. The only hard
   * constraints are: a node can't be its own parent, and can't be parented to
   * one of its own descendants (that would create a cycle). Products are always
   * roots and never show this selector. */
  const descendantIds = React.useMemo(
    () => formDescendantIds(processNodes, editingId),
    [editingId, processNodes],
  )

  const eligibleParents = React.useMemo(
    () => eligibleParentsFor(formData.processType, processNodes, editingId, descendantIds),
    [formData.processType, processNodes, editingId, descendantIds],
  )

  const disabledTypes = disabledTypesFor({ mode, processNodes, isAddChildMode, suggestedParent })

  /* ------- validation ------- */
  const validateForm = () => {
    const next = validateComponentForm(formData, { processNodes, editingId, descendantIds })
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const isFormValid = isFormSubmittable(formData)

  /* ------- submit ------- */
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!validateForm()) return
    setIsSubmitting(true)

    try {
      // The API is the source of truth; Zustand is kept in sync for
      // optimistic UI but the server write is what persists.
      const { payload, dbBody } = buildComponentSubmission(formData, { caseId, isEditMode, initial })

      if (isEditMode && editingId) {
        const res = await apiRequest(`/api/components/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(dbBody),
        })
        if (!res.ok) throw new Error(`PUT /api/components/${editingId} → ${res.status}`)
        updateComponentNode(editingId, payload)
        toast.success('Component updated', {
          description: `${formData.processName} saved to database`,
        })
      } else {
        const res = await apiRequest(`/api/cases/${caseId}/components`, {
          method: 'POST',
          body: JSON.stringify(dbBody),
        })
        if (!res.ok) throw new Error(`POST /api/cases/${caseId}/components → ${res.status}`)
        const data = await res.json().catch(() => ({}))
        const newDbId = data?.component?.component_id ?? data?.component_id
        // Keep Zustand in sync for optimistic UI; use server id when available
        addComponentNode(caseId, { ...payload, id: newDbId ? String(newDbId) : undefined } as any)
        toast.success('Component created', {
          description: `${formData.processName} saved to database`,
        })
      }
      if (onSuccess) {
        onSuccess()
      } else {
        router.push(`/project/${projectId}/case/${caseId}`)
      }
    } catch (err: any) {
      console.error('Component save failed:', err)
      toast.error('Save failed', {
        description: err?.message || `Could not ${isEditMode ? 'update' : 'create'} component.`,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * Choosing a type. Auto-attach by default: when a non-product type is
   * chosen, pre-select the most recently created node of the tier directly
   * above as the parent, so the new component joins the tree instead of
   * floating off on its own. The user can still pick a different parent.
   * Product is always a root, so it gets no parent. In add-child mode the
   * parent is fixed; keep it.
   */
  const handleTypeChange = (v: string) => {
    let defaultParent = isAddChildMode ? (suggestedParentId ?? '') : ''
    if (v !== 'product' && !isAddChildMode) {
      const candidates = defaultParentCandidates(v, processNodes, editingId, descendantIds)
      if (candidates.length) defaultParent = candidates[candidates.length - 1].id
    }
    setFormData((prev) => ({ ...prev, processType: v, parentId: defaultParent }))
    if (errors.processType) setErrors((prev) => ({ ...prev, processType: '' }))
  }

  // Default-fill the parent once the component list finishes loading, in case
  // the user picked a type before the fetch returned (handleTypeChange would
  // have found no candidates yet). Never overrides a parent the user touched.
  const parentTouchedRef = React.useRef(false)
  React.useEffect(() => {
    if (isEditMode || isAddChildMode || parentTouchedRef.current) return
    const ptype = formData.processType
    if (!ptype || ptype === 'product' || formData.parentId) return
    const candidates = defaultParentCandidates(ptype, processNodes, editingId, descendantIds)
    // Auto-pick ONLY when the choice is unambiguous. Grabbing the last
    // eligible node put brand-new parts under whatever operation happened to
    // be created most recently — e.g. "Landfilling" instead of the node the
    // user was looking at (tool-review bug #4). With several candidates the
    // picker stays empty so the placement is a conscious choice.
    if (candidates.length === 1) {
      setFormData((prev) => ({ ...prev, parentId: candidates[0].id }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processNodes, formData.processType])

  /** The user picked a parent: it is never auto-replaced after this. */
  const handleParentChange = (value: string) => {
    parentTouchedRef.current = true
    setFormData((p) => ({ ...p, parentId: value }))
    if (errors.parentId) setErrors((p) => ({ ...p, parentId: '' }))
  }

  const handleNameChange = (value: string) => {
    setFormData((p) => ({ ...p, processName: value }))
    if (errors.processName) setErrors((p) => ({ ...p, processName: '' }))
  }

  /** Merge any other field change. */
  const patchForm = (patch: Partial<ComponentFormValues>) => setFormData((p) => ({ ...p, ...patch }))

  return {
    isEditMode,
    formData,
    setFormData,
    patchForm,
    errors,
    isSubmitting,
    isFormValid,
    project,
    currentCase,
    processNodes,
    isAddChildMode,
    suggestedParent,
    isProcessTypeLocked,
    eligibleParents,
    disabledTypes,
    handleSubmit,
    handleTypeChange,
    handleParentChange,
    handleNameChange,
  }
}

export type ComponentFormState = ReturnType<typeof useComponentForm>
