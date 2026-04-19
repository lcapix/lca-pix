'use client'

// CategoryBarChart — mirrored from LCAPIX/pages-misc.jsx lines 163-185.
// Horizontal log-scale bar chart. Each row shows a category label, a
// proportional bar against the log10-transformed max, the numeric value,
// and the unit. Optional `onSelect`/`selectedKey` support highlighting.

import { fmtNum } from '../formatters'

export interface CategoryBarChartItem {
  key: string
  label: string
  value: number
  unit: string
}

export interface CategoryBarChartProps {
  categories: CategoryBarChartItem[]
  selectedKey?: string
  onSelect?: (key: string) => void
}

export function CategoryBarChart({
  categories,
  selectedKey,
  onSelect,
}: CategoryBarChartProps) {
  if (!categories.length) {
    return (
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-tertiary)',
          padding: '24px 0',
          textAlign: 'center',
        }}
      >
        No category data available.
      </div>
    )
  }

  const logs = categories.map((c) => Math.log10(c.value + 0.00001) + 10)
  const max = Math.max(...logs)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {categories.map((c, i) => {
        const v = Math.log10(c.value + 0.00001) + 10
        const pct = Math.max(2, (v / max) * 100)
        const active = selectedKey === c.key
        return (
          <div
            key={c.key}
            onClick={onSelect ? () => onSelect(c.key) : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: onSelect ? 'pointer' : 'default',
              opacity: selectedKey && !active ? 0.65 : 1,
            }}
          >
            <div
              style={{
                width: 150,
                fontSize: 12,
                color: 'var(--text-secondary)',
              }}
            >
              {c.label}
            </div>
            <div
              style={{
                flex: 1,
                height: 24,
                background: 'var(--surface-overlay)',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: 'var(--brand-primary)',
                  opacity: 1 - i * 0.08,
                  transition: 'width 400ms',
                }}
              />
            </div>
            <div
              className="mono"
              style={{
                width: 100,
                fontSize: 12,
                textAlign: 'right',
                color: 'var(--text-primary)',
              }}
            >
              {c.value < 0.01
                ? c.value.toExponential(1)
                : fmtNum(c.value, c.value < 1 ? 3 : 2)}
            </div>
            <div
              style={{ width: 80, fontSize: 10, color: 'var(--text-tertiary)' }}
            >
              {c.unit}
            </div>
          </div>
        )
      })}
    </div>
  )
}
