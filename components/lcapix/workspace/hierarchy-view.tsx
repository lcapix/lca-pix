'use client'

// "View full hierarchy" in the design system (P19): the case's whole tree with
// search, expand or collapse all, zoom and drag to pan. Focus moves in and
// stays inside, Esc closes, focus returns to the button that opened it.

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/lcapix/ds'
import { HierarchyFlowChart } from '@/components/lcapix/project/hierarchy-flow-chart'
import { countMatches, stepZoom, toggleAllCollapsed } from '@/lib/project/hierarchy-chart'
import type { HierarchyDialogState } from '@/lib/project/use-hierarchy-dialog'

export function HierarchyView({ state }: { state: HierarchyDialogState }) {
  const {
    isTreeModalOpen: open,
    setIsTreeModalOpen: setOpen,
    modalComponents: components,
    modalCase,
    isLoadingModal: loading,
    modalZoom: zoom,
    setModalZoom: setZoom,
    modalSearchQuery: query,
    setModalSearchQuery: setQuery,
    modalExpandedNodes: collapsed,
    setModalExpandedNodes: setCollapsed,
  } = state
  const ref = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const node = ref.current
    const focusables = () =>
      Array.from(node?.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])') ?? []).filter(
        (el) => !el.hasAttribute('disabled'),
      )
    focusables()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        return
      }
      if (e.key !== 'Tab') return
      const list = focusables()
      if (!list.length) return
      if (e.shiftKey && document.activeElement === list[0]) {
        e.preventDefault()
        list[list.length - 1].focus()
      } else if (!e.shiftKey && document.activeElement === list[list.length - 1]) {
        e.preventDefault()
        list[0].focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
  }, [open, setOpen])

  if (!open) return null
  const matches = query ? countMatches(components, query) : null
  return (
    <div className="ds-scrim" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div
        ref={ref}
        className="ds-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hier-title"
        style={{ width: '88vw', maxWidth: 1400, height: '82vh', display: 'flex', flexDirection: 'column', padding: 0 }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--ds-line)' }}>
          <h2 id="hier-title" className="ds-dialog-title" style={{ margin: 0, flex: '1 1 240px' }}>
            Process Hierarchy: {modalCase?.case_name ?? 'loading'} <span className="ds-count">{components.length} steps</span>
          </h2>
          <input
            className="ds-input"
            type="search"
            aria-label="Search steps"
            placeholder="Search steps"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: 200 }}
          />
          <Button size="small" onClick={() => setCollapsed(toggleAllCollapsed(components, collapsed))}>
            {collapsed.size === 0 ? 'Collapse all' : 'Expand all'}
          </Button>
          <Button size="small" aria-label="Zoom out" onClick={() => setZoom(stepZoom(zoom, -10))}>
            −
          </Button>
          <span className="ds-mono" aria-live="polite" style={{ minWidth: 48, textAlign: 'center' }}>
            {zoom}%
          </span>
          <Button size="small" aria-label="Zoom in" onClick={() => setZoom(stepZoom(zoom, 10))}>
            +
          </Button>
          <Button
            size="small"
            onClick={() => {
              setZoom(100)
              setPan({ x: 0, y: 0 })
            }}
          >
            Reset view
          </Button>
          <Button size="small" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
        <div
          style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'var(--ds-main)', cursor: drag.current ? 'grabbing' : 'grab' }}
          onMouseDown={(e) => {
            if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return
            drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
          }}
          onMouseMove={(e) => {
            if (!drag.current) return
            setPan({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y })
          }}
          onMouseUp={() => (drag.current = null)}
          onMouseLeave={() => (drag.current = null)}
          onWheel={(e) => {
            if (!(e.ctrlKey || e.metaKey)) return
            e.preventDefault()
            setZoom(stepZoom(zoom, e.deltaY > 0 ? -5 : 5))
          }}
        >
          {loading ? (
            <p role="status" style={{ padding: 24 }}>
              Loading the hierarchy…
            </p>
          ) : components.length === 0 ? (
            <p style={{ padding: 24 }}>No steps yet. Add steps in the case to build its hierarchy.</p>
          ) : (
            <div style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: '40px 40px 80px' }}>
              <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`, transformOrigin: 'top center' }}>
                <HierarchyFlowChart components={components} searchQuery={query} collapsed={collapsed} setCollapsed={setCollapsed} />
              </div>
            </div>
          )}
        </div>
        <p className="ds-mono" style={{ margin: 0, padding: '8px 18px', borderTop: '1px solid var(--ds-line)', fontSize: 12, color: 'var(--ds-text-2)' }}>
          {components.length} steps{matches !== null ? ` · ${matches} matching "${query}"` : ''} · drag to move · Ctrl or ⌘ and scroll to zoom · click a step to open or close it
        </p>
      </div>
    </div>
  )
}
