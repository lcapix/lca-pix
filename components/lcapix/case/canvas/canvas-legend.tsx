'use client'

// Hierarchy legend — teaches the 5 tiers + where impacts/costs attach. The
// tier copy is TIER_GUIDE in tree-canvas.tsx. Stops mousedown so it never
// pans the canvas.

import { useState } from 'react'
import { HIERARCHY_TYPES, type HierarchyNodeType } from '@/lib/lcapix-demo'

export function CanvasLegend({ tiers }: { tiers: Array<{ id: HierarchyNodeType; blurb: string }> }) {
  const [legendOpen, setLegendOpen] = useState(true)
  const colorFor = (t: HierarchyNodeType) =>
    HIERARCHY_TYPES.find((h) => h.id === t)?.color || 'var(--text-tertiary)'
  const labelFor = (t: HierarchyNodeType) =>
    HIERARCHY_TYPES.find((h) => h.id === t)?.label || t
  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 5,
        width: legendOpen ? 252 : 'auto',
        background: 'var(--surface-raised)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: legendOpen ? '10px 12px' : '6px 10px',
        boxShadow: 'var(--shadow-sm)',
        fontSize: 11,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 11.5 }}>
          Process hierarchy{legendOpen ? '' : ' · 5 tiers'}
        </span>
        <button
          type="button"
          onClick={() => setLegendOpen((o) => !o)}
          aria-label={legendOpen ? 'Hide legend' : 'Show legend'}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            fontSize: 13,
            lineHeight: 1,
          }}
        >
          {legendOpen ? '×' : '?'}
        </button>
      </div>
      {legendOpen && (
        <>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {tiers.map((t, i) => (
              <div key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span
                  style={{
                    marginTop: 2,
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: colorFor(t.id),
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {i + 1}. {labelFor(t.id)}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                    {t.blurb}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: '1px solid var(--border-subtle)',
              color: 'var(--text-tertiary)',
              lineHeight: 1.4,
            }}
          >
            Impacts &amp; costs live on the lower tiers; each parent is the total of what
            is below it.
          </div>
        </>
      )}
    </div>
  )
}
