'use client'

import { REDUCE_PRESETS } from '@/lib/insights/magic-insights'

export interface ReduceTargetRowProps {
  /** What the number field shows (applied to reducePct after a pause). */
  reducePctInput: string
  onInputChange: (value: string) => void
  /** The applied target, which marks the matching preset. */
  reducePct: number
  onPreset: (preset: number) => void
}

/** Reduce % input and presets; shown while the reduce chip is active. */
export function ReduceTargetRow({ reducePctInput, onInputChange, reducePct, onPreset }: ReduceTargetRowProps) {
  return (
    <div
      style={{
        padding: '12px 24px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--ds-text-2)' }}>
        Reduce target
      </span>
      <input
        type="number"
        min={1}
        max={100}
        step={1}
        value={reducePctInput}
        onChange={(e) => onInputChange(e.target.value)}
        style={{
          width: 72,
          fontSize: 13,
          padding: '4px 8px',
          borderRadius: 6,
          border: '1px solid var(--ds-line)',
          background: 'var(--ds-main)',
          color: 'var(--ds-text)',
          fontFamily: 'var(--ds-font)',
          textAlign: 'right',
        }}
      />
      <span style={{ fontSize: 12, color: 'var(--ds-text-3)' }}>%</span>
      <div style={{ display: 'flex', gap: 6, marginLeft: 4 }}>
        {REDUCE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onPreset(preset)}
            className="ds-btn ds-btn--small"
            style={{
              fontSize: 11,
              padding: '3px 8px',
              borderRadius: 999,
              border: '1px solid var(--ds-line)',
              background:
                reducePct === preset
                  ? 'oklch(from var(--ds-green) l c h / 0.10)'
                  : 'transparent',
              color:
                reducePct === preset
                  ? 'var(--ds-green)'
                  : 'var(--ds-text-2)',
              cursor: 'pointer',
              fontFamily: 'var(--ds-font)',
            }}
          >
            {preset}%
          </button>
        ))}
      </div>
    </div>
  )
}
