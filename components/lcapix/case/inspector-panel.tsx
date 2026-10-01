'use client'

// InspectorPanel — right-pane editor.
// Mirrors LCAPIX/pages-app.jsx lines 907-986 but made generic enough to
// bind against real component edit state. When `editFormData` is passed
// along with `onChange`, fields become controlled; otherwise they render
// as read-only placeholders matching the prototype.
//
// Composition only: each section lives in ./inspector/, the number-draft,
// labor, machine-energy and suggest logic in lib/case-editor.

import { useState } from 'react'
import type { FlatCaseNode } from '@/lib/case-tree-adapter-types'
import type { InspectorEditFormData, InspectorFlow, ParentOption } from '@/lib/case-editor/types'
import { useNumberDrafts } from '@/lib/case-editor/use-number-drafts'
import { InspectorHeader } from './inspector/inspector-header'
import { PropertiesSection } from './inspector/properties-section'
import { PlacementSection } from './inspector/placement-section'
import { FlowsSection } from './inspector/flows-section'
import { CostsSection } from './inspector/costs-section'
import { LifeCycleSection } from './inspector/life-cycle-section'
import { AllocationSection } from './inspector/allocation-section'
import { InspectorFooter } from './inspector/inspector-footer'

export type { InspectorEditFormData, InspectorFlow, ParentOption } from '@/lib/case-editor/types'
export { InspectorSection, type InspectorSectionProps } from './inspector/inspector-section'
export { parseNumberDraft } from '@/lib/case-editor/number-draft'

export interface InspectorPanelProps {
  node: FlatCaseNode | null
  /** The study's LCIA method, used as the default when a substance is added by hand. */
  studyMethod?: string
  editFormData?: InspectorEditFormData
  onChange?: (patch: Partial<InspectorEditFormData>) => void
  onSave?: () => void
  onDelete?: () => void
  flows?: InspectorFlow[]
  /** Candidate parents for re-parenting (excludes self + descendants). */
  parentOptions?: ParentOption[]
  /** Apply suggested costs AND persist them in one action. */
  onApplyCosts?: (patch: Partial<InspectorEditFormData>) => void
  /** True when the node has children: it is a roll-up (pure sum), so it has
   * no flows or costs of its own and editing them there is not offered. */
  hasChildren?: boolean
  /** Subtree totals for a roll-up node (this node + everything below). */
  rolled?: { cost: number; flows: number } | null
}

export function InspectorPanel({
  node,
  studyMethod,
  editFormData,
  onChange,
  onSave,
  onDelete,
  flows = [],
  parentOptions = [],
  onApplyCosts,
  hasChildren = false,
  rolled = null,
}: InspectorPanelProps) {
  // Raw text of the number inputs while typing, per node (EDIT-5).
  const nodeId = node?.id ?? null
  const drafts = useNumberDrafts({ nodeId, editFormData, onChange })
  // The step's flows as the flows editor last loaded them, for Suggest (EDIT-3).
  const [liveFlows, setLiveFlows] = useState<{ nodeId: string | null; flows: InspectorFlow[] } | null>(null)

  if (!node) {
    return (
      <div style={{ padding: 24, fontSize: 13, color: 'var(--text-tertiary)' }}>
        Select a component on the left to inspect.
      </div>
    )
  }

  const controlled = !!editFormData && !!onChange

  const suggestFlows =
    liveFlows && liveFlows.nodeId === nodeId ? liveFlows.flows : flows

  return (
    <div style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <InspectorHeader node={node} />

      <PropertiesSection
        node={node}
        controlled={controlled}
        editFormData={editFormData}
        onChange={onChange}
        drafts={drafts}
      />

      {controlled && node.type !== 'Product' && (
        <PlacementSection editFormData={editFormData} onChange={onChange!} parentOptions={parentOptions} />
      )}

      <FlowsSection
        node={node}
        controlled={controlled}
        hasChildren={hasChildren}
        rolled={rolled}
        flows={flows}
        studyMethod={studyMethod}
        onLiveFlows={(id, rows) => setLiveFlows({ nodeId: id, flows: rows })}
      />

      <CostsSection
        node={node}
        controlled={controlled}
        hasChildren={hasChildren}
        rolled={rolled}
        editFormData={editFormData}
        onChange={onChange}
        onApplyCosts={onApplyCosts}
        suggestFlows={suggestFlows}
        drafts={drafts}
      />

      {controlled && node.type !== 'Product' && (
        <LifeCycleSection editFormData={editFormData!} onChange={onChange!} />
      )}

      {controlled && node.type !== 'Product' && (
        <AllocationSection editFormData={editFormData!} onChange={onChange!} hasChildren={hasChildren} />
      )}

      {(onSave || onDelete) && (
        <InspectorFooter
          onSave={onSave}
          onDelete={onDelete}
          saveBlocked={drafts.saveBlocked}
          invalidNumbers={drafts.invalidNumbers}
          guardSave={drafts.guardSave}
        />
      )}
    </div>
  )
}
