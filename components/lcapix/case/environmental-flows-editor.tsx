'use client'

// EnvironmentalFlowsEditor — self-contained CRUD for a component's input/output
// flows, rendered inside the inspector's "Environmental Flows" section.
//
// - Loads the component's flows (GET /api/components/{id}/flows)
// - Loads the substance catalog (GET /api/substances) for the picker. The
//   catalog is populated from the public openLCA/PubChem imports, so this IS
//   the "suggest substances from the integrations" surface.
// - Add flow (POST) / edit in place (PUT) / delete flow (DELETE), then refreshes.
//
// Flows are where environmental impact comes from, so this is the core data
// entry of the whole LCA. Self-contained (own fetches) to keep the inspector
// presentational. The data lives in lib/case-editor (useFlows,
// useSubstanceCatalog, useAddFlowForm, useAddSubstance, useFlowRowEdit); the
// list, row and add form in ./flows/.

import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@/components/lcapix/icon'
import type { FlowRow } from '@/lib/case-editor/flow-types'
import { suggestFlowsFor } from '@/lib/case-editor/substance-search'
import { announceComponentsChanged, useFlowRowEdit, useFlows, useSubstanceCatalog } from '@/lib/case-editor/use-flows'
import { useAddFlowForm, useAddSubstance } from '@/lib/case-editor/use-add-flow-form'
import { FlowList } from './flows/flow-list'
import { FlowSuggestions } from './flows/flow-suggestions'
import { AddFlowForm } from './flows/add-flow-form'

export type { FlowRow } from '@/lib/case-editor/flow-types'

export function EnvironmentalFlowsEditor({
  componentId,
  componentName = '',
  componentType = '',
  studyMethod,
  onFlowsChange,
}: {
  componentId: string
  componentName?: string
  componentType?: string
  /** The study's LCIA method, used as the default for a hand-added factor. */
  studyMethod?: string
  /** Told the step's flows each time they load, so other panels (Suggest costs) see them. */
  onFlowsChange?: (flows: FlowRow[]) => void
}) {
  const { flows, loading, loadError, loadFlows, deleteFlow } = useFlows(componentId, onFlowsChange)
  const { substances, addToCatalog } = useSubstanceCatalog()
  const form = useAddFlowForm({ componentId, substances, loadFlows })
  const substanceForm = useAddSubstance({
    studyMethod,
    onCreated: (s, unit) => {
      addToCatalog(s)
      form.selectCreatedSubstance(s, unit)
    },
  })
  const rowEdit = useFlowRowEdit({ flows, substances, loadFlows })

  // A process picked while creating the step opens the library here, already on
  // that process (dispatched by the case editor after the step is created).
  const [libraryTemplateId, setLibraryTemplateId] = useState<number | null>(null)
  const { setAdding, setLibraryOpen } = form
  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent).detail?.templateId
      setLibraryTemplateId(typeof id === 'number' ? id : null)
      setAdding(true)
      setLibraryOpen(true)
    }
    window.addEventListener('lcapix:open-process-library', onOpen)
    return () => window.removeEventListener('lcapix:open-process-library', onOpen)
  }, [setAdding, setLibraryOpen])

  const suggestions = useMemo(
    () => suggestFlowsFor({ substances, flows, componentName, componentType }),
    [substances, flows, componentName, componentType],
  )

  return (
    <div>
      {/* Flow list */}
      <FlowList
        loading={loading}
        loadError={loadError}
        flows={flows}
        onRetry={() => loadFlows()}
        substances={substances}
        editing={rowEdit.editing}
        setEditing={rowEdit.setEditing}
        editSaving={rowEdit.editSaving}
        startEdit={rowEdit.startEdit}
        saveEdit={rowEdit.saveEdit}
        onDelete={deleteFlow}
      />

      {/* Suggested flows from the public catalog (openLCA / PubChem). Click to
          pre-fill the add form; you set the quantity. */}
      {!form.adding && suggestions.length > 0 && (
        <FlowSuggestions suggestions={suggestions} onPick={form.applySuggestion} />
      )}

      {/* Add-flow affordance. The process library used to be reachable only
          from inside the add form, after opening it and before picking a
          substance, which is three steps away from anybody who does not already
          know it exists. It sits here instead, next to Add flow. */}
      {!form.adding && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ flex: 1, justifyContent: 'center' }}
            type="button"
            onClick={() => {
              form.setAdding(true)
              form.setLibraryOpen(true)
            }}
            title="Pick the kind of process this step is: the library lists what it consumes and in which unit"
          >
            <Icon name="list" size={12} /> Process library
          </button>
        </div>
      )}
      {!form.adding ? (
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}
          type="button"
          onClick={() => form.setAdding(true)}
        >
          <Icon name="plus" size={12} /> Add flow
        </button>
      ) : (
        <AddFlowForm
          componentId={componentId}
          substances={substances}
          form={form}
          substanceForm={substanceForm}
          initialTemplateId={libraryTemplateId}
          onLibraryAdded={() => {
            loadFlows()
            announceComponentsChanged()
          }}
        />
      )}
    </div>
  )
}
