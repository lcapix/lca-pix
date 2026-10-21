'use client'

// The case editor's right pane: the inspector for the selected component.
// Flows for a selected component are loaded live by EnvironmentalFlowsEditor
// inside InspectorPanel (GET /api/components/:id/flows); the `flows` prop is
// only a read-only fallback for non-editable contexts, so it is not passed.

import { InspectorPanel, type InspectorPanelProps } from '@/components/lcapix/case'

export interface CaseInspectorPaneProps extends InspectorPanelProps {
  /**
   * A "Can read" member. The panel keeps showing the step's real values, inside
   * a disabled fieldset so every input and button is inert (and announced as
   * unavailable); the caller also leaves out Save and Delete.
   */
  readOnly?: boolean
}

export function CaseInspectorPane({ readOnly = false, ...props }: CaseInspectorPaneProps) {
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
      {readOnly ? (
        <fieldset
          disabled
          aria-label="Step details, read only"
          style={{ border: 0, margin: 0, padding: 0, minWidth: 0, display: 'flex', flexDirection: 'column', flex: 1 }}
        >
          <p style={{ margin: 0, padding: '10px 20px', fontSize: 12, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
            You can read this case. Ask the project owner for Can change to edit it.
          </p>
          <InspectorPanel {...props} />
        </fieldset>
      ) : (
        <InspectorPanel {...props} />
      )}
    </aside>
  )
}
