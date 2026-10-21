'use client'

// "Add a flow to this step" inside the step panel. It is the case editor's own
// add form (substance search, the process library, a transport leg, a
// substance added by hand), composed from the same hooks, so there is one way
// a flow gets added and one set of rules for it. A save announces the change
// and the workspace reloads its inventory.

import { useEffect, useRef } from 'react'
import { useFlows, useSubstanceCatalog } from '@/lib/case-editor/use-flows'
import { useAddFlowForm, useAddSubstance } from '@/lib/case-editor/use-add-flow-form'
import { AddFlowForm } from '@/components/lcapix/case/flows/add-flow-form'

export function AddFlowInPanel({ componentId, studyMethod, onDone }: { componentId: number; studyMethod?: string; onDone: () => void }) {
  const id = String(componentId)
  const { loadFlows } = useFlows(id)
  const { substances, addToCatalog } = useSubstanceCatalog()
  const form = useAddFlowForm({ componentId: id, substances, loadFlows })
  const substanceForm = useAddSubstance({
    studyMethod,
    onCreated: (s, unit) => {
      addToCatalog(s)
      form.selectCreatedSubstance(s, unit)
    },
  })

  // The form keeps its own open state: open it now, and close the panel's
  // section once it has been open and closes (saved, or Cancel).
  const { adding, setAdding } = form
  const wasOpen = useRef(false)
  useEffect(() => setAdding(true), [setAdding])
  useEffect(() => {
    if (adding) wasOpen.current = true
    else if (wasOpen.current) onDone()
  }, [adding, onDone])

  if (!adding) return null
  return (
    <AddFlowForm
      componentId={id}
      substances={substances}
      form={form}
      substanceForm={substanceForm}
      onLibraryAdded={() => loadFlows()}
    />
  )
}
