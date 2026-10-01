'use client'

// The hero's right panel: every impact category of the run, the active one
// highlighted; clicking one makes it the active category.

import { HelpTip } from '@/components/lcapix/help-tip'
import { ISO_HELP, impactCategoryHelp } from '@/components/lcapix/iso-help'
import { fmtSig } from '@/components/lcapix/formatters'
import type { CategoryBarChartItem } from '@/components/lcapix'

export function ImpactCategoriesPanel({
  categoryItems,
  activeKey,
  onSelectCategory,
}: {
  categoryItems: CategoryBarChartItem[]
  activeKey: string
  onSelectCategory: (k: string) => void
}) {
  const formatCatVal = (v?: number) => fmtSig(v)
  return (
    <div
      style={{
        padding: '28px 28px 24px',
        borderLeft: '1px solid var(--border-subtle)',
        background:
          'color-mix(in oklab, var(--brand-primary) 2%, var(--surface-raised))',
      }}
    >
      <div
        className="eyebrow"
        style={{
          fontSize: 11,
          letterSpacing: '0.14em',
          color: 'var(--brand-primary)',
          marginBottom: 14,
        }}
      >
        IMPACT CATEGORIES
        <HelpTip label="What are impact categories?">{ISO_HELP.categoriesOverview}</HelpTip>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          maxHeight: 360,
          overflowY: 'auto',
        }}
      >
        {categoryItems.map((c) => {
          const isActive = c.key === activeKey
          return (
            <button
              key={c.key}
              type="button"
              title={impactCategoryHelp(c.label)}
              onClick={() => onSelectCategory(c.key)}
              style={{
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: 8,
                border:
                  '1px solid ' +
                  (isActive
                    ? 'color-mix(in oklab, var(--brand-primary) 45%, transparent)'
                    : 'var(--border-subtle)'),
                background: isActive
                  ? 'color-mix(in oklab, var(--brand-primary) 10%, var(--surface-raised))'
                  : 'var(--surface-raised)',
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
                transition: 'background 160ms ease, border-color 160ms ease',
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  color: 'var(--text-primary)',
                  marginBottom: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {c.label}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 6,
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: isActive
                      ? 'var(--brand-primary)'
                      : 'var(--text-primary)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {formatCatVal(c.value)}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--text-tertiary)',
                  }}
                >
                  {c.unit || ''}
                </span>
              </div>
            </button>
          )
        })}
        {categoryItems.length === 0 && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-tertiary)',
              fontStyle: 'italic',
              padding: '6px 0',
            }}
          >
            No categories available — run an assessment.
          </div>
        )}
      </div>
    </div>
  )
}
