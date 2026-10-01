'use client'

// Environmental Flows. A roll-up node only counts the flows below it; a
// process step gets the live editor (EnvironmentalFlowsEditor, keyed by the
// node so its add form never carries over); otherwise the read-only list.

import { HelpTip } from '@/components/lcapix/help-tip'
import { EnvironmentalFlowsEditor } from '@/components/lcapix/case/environmental-flows-editor'
import type { FlatCaseNode } from '@/lib/case-tree-adapter-types'
import { toInspectorFlows } from '@/lib/case-editor/flow-types'
import type { InspectorFlow } from '@/lib/case-editor/types'
import { InspectorSection } from './inspector-section'

export function FlowsSection({
  node,
  controlled,
  hasChildren,
  rolled,
  flows,
  studyMethod,
  onLiveFlows,
}: {
  node: FlatCaseNode
  controlled: boolean
  hasChildren: boolean
  rolled: { cost: number; flows: number } | null
  /** Read-only fallback list, for non-editable contexts. */
  flows: InspectorFlow[]
  studyMethod?: string
  /** The step's flows each time the editor loads them (for Suggest). */
  onLiveFlows: (nodeId: string, flows: InspectorFlow[]) => void
}) {
  return (
    <InspectorSection title="Environmental Flows">
      {hasChildren ? (
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-tertiary)',
            padding: '4px 0',
            lineHeight: 1.5,
          }}
        >
          Roll-up node:{' '}
          <span className="mono" style={{ color: 'var(--text-primary)' }}>
            {rolled?.flows ?? 0}
          </span>{' '}
          flow{(rolled?.flows ?? 0) === 1 ? '' : 's'} across the nodes below. Select a
          process step below to add or edit flows.
          <HelpTip label="Why can't I add flows here?">
            In LCA (ISO 14044) every input and output belongs to a unit process: the
            operation where it is consumed or emitted. Higher nodes are totals of what is
            below them, so giving them flows of their own would count the same thing twice.
          </HelpTip>
        </div>
      ) : controlled && node.id && node.id !== '__root__' ? (
        // Live editor: list + add (substance picker from the catalog) + delete.
        <EnvironmentalFlowsEditor
          key={node.id}
          componentId={node.id}
          componentName={node.label ?? ''}
          componentType={(node.type as string) ?? ''}
          studyMethod={studyMethod}
          onFlowsChange={(rows) => onLiveFlows(node.id, toInspectorFlows(rows))}
        />
      ) : flows.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '4px 0' }}>
          No flows assigned.
        </div>
      ) : (
        <div
          style={{
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          {flows.map((f, i) => (
            <div
              key={f.id}
              style={{
                padding: '10px 12px',
                borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  padding: '2px 6px',
                  borderRadius: 3,
                  background:
                    f.dir === 'IN'
                      ? 'oklch(from var(--signal-info) l c h / 0.18)'
                      : 'oklch(from var(--signal-warn) l c h / 0.18)',
                  color: f.dir === 'IN' ? 'var(--signal-info)' : 'var(--signal-warn)',
                  fontWeight: 600,
                }}
              >
                {f.dir}
              </span>
              <span
                style={{
                  flex: 1,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {f.substance}
              </span>
              <span className="mono" style={{ color: 'var(--text-secondary)' }}>
                {f.amount.toFixed(2)}
              </span>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                {f.unit}
              </span>
            </div>
          ))}
        </div>
      )}
    </InspectorSection>
  )
}
