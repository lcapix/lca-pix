'use client'

// The case editor's centre pane: the canvas host (the Add Component dialog
// portals into #case-canvas-host), the tree / list / graph canvas or the
// empty state, and the selected node's details strip below it.

import { Icon } from '@/components/lcapix'
// Through the barrel, as the page always imported them.
import { TreeCanvas, NodeDetailsStrip, type CanvasView } from '@/components/lcapix/case'
import type { NodeRollup } from '@/lib/case-tree-adapter'
import type { CaseTreeNode, FlatCaseNode } from '@/lib/case-tree-adapter-types'

export interface CaseCanvasPaneProps {
  tree: CaseTreeNode | null
  flat: FlatCaseNode[]
  selected: string | null
  onSelect: (id: string) => void
  view: CanvasView
  highlightQuery: string
  /** "Create your first component" on an empty case. */
  onCreate: () => void
  selectedFlatNode: FlatCaseNode | null
  totalComponents: number
  /** The selected node's subtree totals. */
  rolled: NodeRollup | null
}

export function CaseCanvasPane({
  tree,
  flat,
  selected,
  onSelect,
  view,
  highlightQuery,
  onCreate,
  selectedFlatNode,
  totalComponents,
  rolled,
}: CaseCanvasPaneProps) {
  return (
    <section
      style={{
        background: 'var(--surface-sunken)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        id="case-canvas-host"
        style={{ position: 'relative', flex: 1, overflow: 'hidden', minHeight: 0 }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(var(--border-subtle) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            opacity: 0.5,
            pointerEvents: 'none',
          }}
        />
        {tree ? (
          <TreeCanvas
            root={tree}
            flat={flat}
            selected={selected}
            onSelect={onSelect}
            view={view}
            highlightQuery={highlightQuery}
          />
        ) : (
          <div
            style={{
              padding: 48,
              color: 'var(--text-tertiary)',
              textAlign: 'center',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div style={{ fontSize: 14, marginBottom: 10 }}>
              No components in this case yet.
            </div>
            <button
              className="btn btn-primary btn-sm"
              type="button"
              onClick={onCreate}
            >
              <Icon name="plus" size={12} /> Create your first component
            </button>
          </div>
        )}
      </div>
      <NodeDetailsStrip
        node={selectedFlatNode}
        totalComponents={totalComponents}
        rolled={rolled}
        hasChildren={!!rolled?.hasChildren}
      />
    </section>
  )
}
