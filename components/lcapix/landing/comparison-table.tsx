'use client'

// ComparisonTable — LCAPIX vs alternatives matrix.
// Mirrors the ComparisonTable inline component in LCAPIX/pages-landing.jsx.

import { Icon } from '@/components/lcapix'
import { useReveal } from '@/lib/hooks/use-reveal'

const COLS = ['LCAPIX', 'SimaPro', 'openLCA', 'GaBi'] as const

type Row = readonly [string, boolean, boolean, boolean, boolean]

const ROWS: readonly Row[] = [
  ['Multi-method side-by-side', true, false, false, false],
  ['Cost + impact combined', true, false, false, true],
  ['Region awareness grid factors', true, false, true, true],
  ['Free tier', true, false, true, false],
  ['Modern web UI', true, false, false, false],
  ['Source attribution per environmental load', true, true, true, true],
]

export function ComparisonTable() {
  return (
    <div
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        overflow: 'hidden',
        background: 'var(--surface-raised)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr repeat(4, 1fr)',
          background: 'var(--surface-overlay)',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            fontSize: 12,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: 500,
          }}
        >
          Capability
        </div>
        {COLS.map((c, i) => (
          <div
            key={c}
            style={{
              padding: '16px 20px',
              fontSize: 13,
              fontWeight: 600,
              color: i === 0 ? 'var(--brand-primary)' : 'var(--text-secondary)',
              textAlign: 'center',
              background: i === 0 ? 'var(--brand-subtle)' : 'transparent',
            }}
          >
            {c}
          </div>
        ))}
      </div>
      {ROWS.map((r, i) => (
        <ComparisonRow key={i} index={i} row={r} />
      ))}
    </div>
  )
}

function ComparisonRow({ row, index }: { row: Row; index: number }) {
  const ref = useReveal<HTMLDivElement>({ threshold: 0.18 })
  return (
    <div
      ref={ref}
      className="reveal"
      style={{
        display: 'grid',
        gridTemplateColumns: '2fr repeat(4, 1fr)',
        borderTop: '1px solid var(--border-subtle)',
        transitionDelay: `${index * 60}ms`,
      }}
    >
      <div style={{ padding: '14px 20px', fontSize: 14, color: 'var(--text-primary)' }}>
        {row[0]}
      </div>
      {row.slice(1).map((v, j) => (
        <div
          key={j}
          style={{
            padding: '14px 20px',
            textAlign: 'center',
            background: j === 0 ? 'oklch(from var(--brand-primary) l c h / 0.08)' : 'transparent',
            color: v
              ? j === 0
                ? 'var(--brand-primary)'
                : 'var(--text-primary)'
              : 'var(--text-disabled)',
          }}
        >
          {v ? (
            <Icon name="check" size={16} style={{ margin: '0 auto' }} />
          ) : (
            <span style={{ opacity: 0.4 }}>—</span>
          )}
        </div>
      ))}
    </div>
  )
}
