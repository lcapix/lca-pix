'use client'

// Mini-dashboard KPI strip — always renders, even when empty, so the project
// page reads as a real workspace from minute one. Each tile shows a count + a
// one-line context note. Honest empty states: a "0" with a friendly nudge,
// not a fabricated number (lib/project/workspace.ts workspaceKpis).

import type { WorkspaceKpi } from '@/lib/project/workspace'

export function WorkspaceKpis({ kpis }: { kpis: WorkspaceKpi[] }) {
  return (
    <div
      style={{
        marginTop: 20,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
      }}
    >
      {kpis.map((k) => (
        <div
          key={k.label}
          className="card"
          style={{
            padding: '22px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            position: 'relative',
            overflow: 'hidden',
            minHeight: 124,
            justifyContent: 'center',
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 4,
              background:
                k.tone === 'brand'
                  ? 'var(--brand-primary)'
                  : 'color-mix(in oklab, var(--text-tertiary) 28%, transparent)',
            }}
          />
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            {k.label}
          </div>
          <div
            className="mono"
            style={{
              fontSize: 32,
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.05,
            }}
          >
            {k.value}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-tertiary)',
              fontStyle: k.tone === 'neutral' ? 'italic' : 'normal',
            }}
          >
            {k.note}
          </div>
        </div>
      ))}
    </div>
  )
}
