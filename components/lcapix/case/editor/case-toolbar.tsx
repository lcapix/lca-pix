'use client'

// The case editor's toolbar: the Tree / List / Graph switch (the Graph tab
// is labelled "Plot" for now), the canvas search, Reset, the Learn and
// Reference panes, Duplicate and Run Assessment.

import { Icon } from '@/components/lcapix'
import type { CanvasView } from '@/components/lcapix/case'
import { runButtonTitle } from '@/lib/case-editor/run-assessment'

export interface CaseToolbarProps {
  canvasView: CanvasView
  onViewChange: (view: CanvasView) => void
  /** Highlights matching nodes on the canvas. */
  searchQuery: string
  onSearchChange: (query: string) => void
  /** Clears the canvas search and the outline filter. */
  onReset: () => void
  learnOpen: boolean
  onToggleLearn: () => void
  referenceOpen: boolean
  onToggleReference: () => void
  onDuplicate: () => void
  onRun: () => void
  isRunning: boolean
  canRun: boolean
  fuMissing: boolean
}

export function CaseToolbar({
  canvasView,
  onViewChange,
  searchQuery,
  onSearchChange,
  onReset,
  learnOpen,
  onToggleLearn,
  referenceOpen,
  onToggleReference,
  onDuplicate,
  onRun,
  isRunning,
  canRun,
  fuMissing,
}: CaseToolbarProps) {
  return (
    <div
      style={{
        padding: '12px 24px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--surface-base)',
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          gap: 4,
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 6,
          padding: 2,
        }}
      >
        {(() => {
          const tabs = ['Tree', 'List', 'Graph'] as CanvasView[]
          const activeIdx = tabs.indexOf(canvasView)
          const tabW = 100 / tabs.length
          return (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: 2,
                bottom: 2,
                left: `calc(${activeIdx} * ${tabW}% + 2px)`,
                width: `calc(${tabW}% - 4px)`,
                background: 'var(--surface-overlay)',
                borderRadius: 4,
                transition: 'left 240ms cubic-bezier(0.2, 0.8, 0.2, 1), width 240ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                boxShadow: '0 1px 3px rgba(15,23,42,0.08)',
                zIndex: 0,
              }}
            />
          )
        })()}
        {(['Tree', 'List', 'Graph'] as CanvasView[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onViewChange(v)}
            style={{
              position: 'relative',
              zIndex: 1,
              padding: '6px 12px',
              borderRadius: 4,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color:
                canvasView === v ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontSize: 12,
              fontFamily: 'var(--font-ui)',
              fontWeight: canvasView === v ? 500 : 400,
              transition: 'color 200ms',
              flex: '1 0 auto',
              textAlign: 'center',
            }}
          >
            {v === 'Graph' ? 'Plot' : v}
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 6,
          padding: '0 10px',
          height: 32,
          width: 280,
        }}
      >
        <Icon name="search" size={14} style={{ color: 'var(--text-tertiary)' }} />
        <input
          placeholder="Find substance, component, or flow…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: 12,
            flex: 1,
            fontFamily: 'var(--font-ui)',
          }}
        />
      </div>

      <button
        className="btn btn-secondary btn-sm"
        type="button"
        onClick={onReset}
      >
        <Icon name="refresh" size={14} /> Reset
      </button>
      <button
        className={learnOpen ? 'btn btn-primary btn-sm' : 'btn btn-toggle btn-sm'}
        type="button"
        title="Five short lessons that follow the ISO phases, done on this case"
        onClick={onToggleLearn}
        aria-pressed={learnOpen}
      >
        <Icon name="target" size={14} /> Learn
      </button>
      <button
        className={referenceOpen ? 'btn btn-primary btn-sm' : 'btn btn-toggle btn-sm'}
        type="button"
        title="Open the document you are reading your quantities from"
        onClick={onToggleReference}
        aria-pressed={referenceOpen}
      >
        <Icon name="file" size={14} /> Reference
      </button>
      <button
        className="btn btn-secondary btn-sm"
        type="button"
        title="Copy this case (tree, flows, costs) as a what-if with one change"
        onClick={onDuplicate}
      >
        <Icon name="layers" size={14} /> Duplicate
      </button>
      <button
        className="btn btn-primary btn-sm"
        type="button"
        onClick={onRun}
        disabled={isRunning || !canRun}
        title={runButtonTitle(fuMissing, canRun)}
      >
        <Icon name="run" size={14} /> {isRunning ? 'Running…' : 'Run Assessment'}
      </button>
    </div>
  )
}
