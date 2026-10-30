'use client'

import { Icon } from '@/components/lcapix'
import { chipLabel, type ChipId, type InsightChip } from '@/lib/insights/magic-insights'

export interface InsightActionChipsProps {
  chips: InsightChip[]
  activeChip: ChipId
  reducePct: number
  onSelect: (id: ChipId) => void
}

/** The row of insight modes (summary, reduce, trade-off, base, ask). */
export function InsightActionChips({ chips, activeChip, reducePct, onSelect }: InsightActionChipsProps) {
  return (
    <div
      style={{
        padding: '14px 24px 0',
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
      }}
    >
      {chips.map((c) => {
        const active = activeChip === c.id
        const label = chipLabel(c, reducePct)
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            className="ds-btn ds-btn--small"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 999,
              border: active
                ? '1px solid var(--ds-green)'
                : '1px solid var(--ds-line)',
              background: active
                ? 'oklch(from var(--ds-green) l c h / 0.10)'
                : 'var(--ds-card)',
              color: active ? 'var(--ds-green)' : 'var(--ds-text-2)',
              fontSize: 12,
              fontWeight: active ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 180ms',
              fontFamily: 'var(--ds-font)',
            }}
          >
            <Icon name={c.icon as any} size={12} />
            {label}
          </button>
        )
      })}
    </div>
  )
}
