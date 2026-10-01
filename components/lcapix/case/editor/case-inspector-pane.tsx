'use client'

// The case editor's right pane: the inspector for the selected component.
// Flows for a selected component are loaded live by EnvironmentalFlowsEditor
// inside InspectorPanel (GET /api/components/:id/flows); the `flows` prop is
// only a read-only fallback for non-editable contexts, so it is not passed.

import { InspectorPanel, type InspectorPanelProps } from '@/components/lcapix/case'

export function CaseInspectorPane(props: InspectorPanelProps) {
  return (
    <aside
      className="case-inspector"
      style={{
        borderLeft: '1px solid var(--border-subtle)',
        background: 'var(--surface-base)',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}
    >
      <InspectorPanel {...props} />
    </aside>
  )
}
