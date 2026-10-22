'use client'

// The inspector's unsaved edits for the selected component: what the form
// holds, whether a component is loaded into it, and the change waiting for
// the user to say what a new product quantity means (ScaleDialog).

import { useRef, useState } from 'react'
import type { ComponentNode } from '@/lib/store'
import type { PendingScale } from '@/components/lcapix/case/scale-dialog'
import { formDataFromComponent } from './component-payload'
import type { EditFormData } from './types'

export function useEditForm() {
  const [isEditing, setIsEditing] = useState(false)
  const [editFormData, setEditFormData] = useState<EditFormData>({})
  // A change to the product's quantity waits here until the user says what it
  // means (scale the inputs, or the data already covers that many units).
  const [pendingScale, setPendingScale] = useState<(PendingScale & { fd: EditFormData }) | null>(null)
  // Set by applyScale so the Save it triggers does not ask again.
  const skipScaleCheck = useRef(false)

  /** Load a component's saved values into the form. */
  function loadFormFor(c: ComponentNode) {
    setEditFormData(formDataFromComponent(c))
    setIsEditing(true)
  }

  /** Merge a change from the inspector into the form. */
  const patchForm = (patch: Partial<EditFormData>) => setEditFormData((f) => ({ ...f, ...patch }))

  /** Nothing selected: an empty form, not editing. */
  const clearForm = () => {
    setIsEditing(false)
    setEditFormData({})
  }

  return {
    editFormData,
    setEditFormData,
    isEditing,
    setIsEditing,
    loadFormFor,
    patchForm,
    clearForm,
    pendingScale,
    setPendingScale,
    skipScaleCheck,
  }
}

export type EditFormState = ReturnType<typeof useEditForm>
