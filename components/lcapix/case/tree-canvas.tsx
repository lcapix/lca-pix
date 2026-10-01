'use client'

// TreeCanvas — flexible playground canvas with pan/zoom/drag.
// Default "Tree" view is a full interactive canvas: Ctrl/⌘ + wheel to zoom,
// drag empty space to pan, drag nodes to reposition, click to select.
// List and Graph views are still delegated out.
//
// Layout and zoom math: lib/case-editor/tree-layout. Interaction state:
// lib/case-editor/use-tree-canvas. Cards, edges and controls: ./canvas/.

import type { HierarchyNodeType } from '@/lib/lcapix-demo'
import { matchesQuery } from '@/lib/case-editor/tree-layout'
import { useTreeCanvas } from '@/lib/case-editor/use-tree-canvas'
import { ListView } from './list-view'
import { GraphView } from './graph-view'
import { CanvasLegend } from './canvas/canvas-legend'
import { TreeEdges } from './canvas/tree-edges'
import { TreeNodeCard } from './canvas/tree-node-card'
import { ZoomControls } from './canvas/zoom-controls'
import type { CaseTreeNode, FlatCaseNode } from '@/lib/case-tree-adapter-types'

export type CanvasView = 'Tree' | 'List' | 'Graph'

export interface TreeCanvasProps {
  root: CaseTreeNode
  flat: FlatCaseNode[]
  selected: string | null
  onSelect: (id: string) => void
  view?: CanvasView
  highlightQuery?: string
}

// Classroom legend: what each of the 5 hierarchy tiers means, top to bottom,
// and where impacts vs costs attach. Teaches the process diagram in-context so
// a student reading the tree knows what they are looking at.
const TIER_GUIDE: Array<{ id: HierarchyNodeType; blurb: string }> = [
  { id: 'Product', blurb: 'The finished thing you are assessing.' },
  { id: 'Machine', blurb: 'A production line or major stage.' },
  { id: 'Subprocess', blurb: 'A group of related steps (e.g. a work center).' },
  {
    id: 'Operation',
    blurb: 'One processing step (a unit process). Its materials, energy, emissions & labor live here as exchanges.',
  },
  { id: 'Task', blurb: 'An optional finer sub-step — only when you split an operation.' },
]

export function TreeCanvas({ root, flat, selected, onSelect, view = 'Tree', highlightQuery }: TreeCanvasProps) {
  if (view === 'List') return <ListView flat={flat} selected={selected} onSelect={onSelect} />
  if (view === 'Graph') return <GraphView flat={flat} selected={selected} onSelect={onSelect} />

  return (
    <PlaygroundCanvas root={root} selected={selected} onSelect={onSelect} highlightQuery={highlightQuery} />
  )
}

interface PlaygroundProps {
  root: CaseTreeNode
  selected: string | null
  onSelect: (id: string) => void
  highlightQuery?: string
}

function PlaygroundCanvas({ root, selected, onSelect, highlightQuery }: PlaygroundProps) {
  const normalizedQuery = (highlightQuery ?? '').trim().toLowerCase()
  const {
    viewportRef,
    nodes,
    bounds,
    rollup,
    positions,
    transform,
    cursor,
    onMouseDown,
    onMouseMove,
    endInteraction,
    onMouseLeave,
    isDragging,
    zoomOut,
    zoomIn,
    fitToView,
    resetLayout,
  } = useTreeCanvas({ root, onSelect })

  return (
    <div
      ref={viewportRef}
      data-testid="tree-canvas-viewport"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={endInteraction}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        cursor,
        userSelect: 'none',
        backgroundImage:
          'radial-gradient(var(--border-subtle) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* Stage */}
      <div
        data-testid="tree-canvas-stage"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
          transformOrigin: '0 0',
          willChange: 'transform',
        }}
      >
        {/* Edges */}
        <TreeEdges nodes={nodes} positions={positions} bounds={bounds} />

        {/* Nodes */}
        {nodes.map((n) => {
          const pos = positions[n.id]
          if (!pos) return null
          const isMatch = matchesQuery({ id: n.id, label: n.node.label }, normalizedQuery)
          return (
            <TreeNodeCard
              key={n.id}
              n={n}
              pos={pos}
              active={selected === n.id}
              isMatch={isMatch}
              dimmed={normalizedQuery.length > 0 && !isMatch}
              dragging={isDragging(n.id)}
              rolled={rollup.get(n.id)}
              onSelect={onSelect}
            />
          )
        })}
      </div>

      {/* Hierarchy legend — teaches the 5 tiers + where impacts/costs attach */}
      <CanvasLegend tiers={TIER_GUIDE} />

      {/* Zoom controls overlay */}
      <ZoomControls
        zoom={transform.k}
        onZoomOut={zoomOut}
        onZoomIn={zoomIn}
        onFit={fitToView}
        onReset={resetLayout}
      />
    </div>
  )
}
