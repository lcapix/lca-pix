'use client'

// Suggested flows from the public catalog (openLCA / PubChem). Click to
// pre-fill the add form; you set the quantity.

import { Icon } from '@/components/lcapix/icon'
import type { FlowSuggestion } from '@/lib/case-editor/substance-search'

export function FlowSuggestions({
  suggestions,
  onPick,
}: {
  suggestions: FlowSuggestion[]
  onPick: (s: FlowSuggestion) => void
}) {
  return (
    <div
      style={{
        marginTop: 10,
        padding: 10,
        borderRadius: 8,
        background: 'color-mix(in oklab, var(--brand-primary) 5%, var(--surface-raised))',
        border: '1px solid color-mix(in oklab, var(--brand-primary) 16%, var(--border-subtle))',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          color: 'var(--text-secondary)',
          marginBottom: 8,
        }}
      >
        <span style={{ color: 'var(--brand-primary)' }}>✦</span>
        Suggested from the substance catalog
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {suggestions.map((s) => (
          <button
            key={s.sub.substance_id}
            type="button"
            onClick={() => onPick(s)}
            className="btn btn-ghost btn-sm"
            style={{
              fontSize: 11,
              padding: '4px 9px',
              border: '1px solid var(--border-subtle)',
              borderRadius: 999,
            }}
            title={`Add ${s.label} as ${s.dir} (${s.unit})`}
          >
            <Icon name="plus" size={11} />
            {s.label}
            <span style={{ color: 'var(--text-tertiary)' }}>
              {' '}· {s.dir === 'input' ? 'IN' : 'OUT'} · {s.unit}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
