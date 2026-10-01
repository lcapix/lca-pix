'use client'

import { HelpTip } from '@/components/lcapix/help-tip'
import { ISO_HELP } from '@/components/lcapix/iso-help'
import { fmtSig } from '@/components/lcapix/formatters'
import type { CategoryBarChartItem } from '@/components/lcapix'
import { ImpactCategoriesPanel } from './impact-categories-panel'

// ─────────────────────────────────────────────────────────────────────────────
// DashboardHero — single tight section that replaced the old KPI strip +
// impact overview row + top contributors. Mirrors the lcapix.io mockup:
// total impact at top-left with Δ-vs-last-run pill, horizontal contribution
// bars beneath, and a stacked categories panel on the right.
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardHeroProps {
  activeCat: CategoryBarChartItem | null
  totalImpactDisplay: string
  flagshipGlow?: boolean
  contributors: Array<{ id: string; name: string; value: number; pct: number }>
  usingDemoContributors?: boolean
  categoryItems: CategoryBarChartItem[]
  activeKey: string
  onSelectCategory: (k: string) => void
  deltaPct: number | null
  methodLabel: string
  activeCategoriesCount: number
  componentsAssessed: number
  lastRunLabel: string
}

export function DashboardHero({
  activeCat,
  totalImpactDisplay,
  flagshipGlow,
  contributors,
  usingDemoContributors,
  categoryItems,
  activeKey,
  onSelectCategory,
  deltaPct,
  methodLabel,
  activeCategoriesCount,
  componentsAssessed,
  lastRunLabel,
}: DashboardHeroProps) {
  const maxContribValue = Math.max(
    1e-9,
    ...contributors.map((c) => Math.abs(c.value)),
  )
  // Significant figures everywhere (RES-1/RES-6): credits keep their sign and
  // a small non-zero value never prints as 0.00.
  const formatVal = (v: number) => fmtSig(v)
  return (
    <div
      className="card"
      style={{
        padding: 0,
        marginBottom: 20,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.7fr) minmax(0, 1fr)',
          gap: 0,
        }}
      >
        {/* LEFT — total impact + delta + contribution bars */}
        <div style={{ padding: '28px 28px 24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
              marginBottom: 8,
            }}
          >
            <span
              className="eyebrow"
              style={{
                fontSize: 11,
                letterSpacing: '0.14em',
                color: 'var(--brand-primary)',
              }}
            >
              TOTAL IMPACT · {activeCat?.label.toUpperCase() || '—'}
            </span>
            <HelpTip label="How do I read this number?" width={320}>
              {ISO_HELP.readTotal}
            </HelpTip>
            <span
              style={{ flex: 1 }}
            />
            <span
              className="mono"
              style={{
                fontSize: 10,
                padding: '3px 8px',
                borderRadius: 999,
                background: 'var(--surface-overlay)',
                color: 'var(--text-tertiary)',
                letterSpacing: '0.04em',
              }}
            >
              {methodLabel}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            <div
              className={`mono success-glow-host ${flagshipGlow ? 'is-glowing' : ''}`}
              style={{
                fontSize: 56,
                fontWeight: 600,
                color: 'var(--brand-primary)',
                lineHeight: 1,
                letterSpacing: '-0.02em',
              }}
            >
              {totalImpactDisplay}
            </div>
            <div
              style={{
                fontSize: 14,
                color: 'var(--text-tertiary)',
              }}
            >
              {activeCat?.unit ?? ''}
            </div>
            {/* The per-category coverage chips were removed from this screen on
                2026-09-29 at Shreya's call: too much warning for the demo. The
                engine still computes coverage and the data-quality statement
                below still states it in words, which is what the report prints. */}
            {deltaPct != null && (
              <span
                className="mono"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: 999,
                  color:
                    deltaPct <= 0
                      ? 'var(--signal-success, #16a34a)'
                      : '#b45309',
                  background:
                    deltaPct <= 0
                      ? 'color-mix(in oklab, var(--signal-success, #16a34a) 14%, transparent)'
                      : 'color-mix(in oklab, #d98568 18%, transparent)',
                }}
              >
                {deltaPct <= 0 ? '↓' : '↑'} {Math.abs(deltaPct).toFixed(1)}% vs last run
              </span>
            )}
          </div>

          {/* Small KPI row */}
          <div
            style={{
              marginTop: 14,
              display: 'flex',
              gap: 18,
              fontSize: 11.5,
              color: 'var(--text-tertiary)',
            }}
          >
            <span>
              <span
                className="mono"
                style={{ color: 'var(--text-primary)', fontWeight: 600 }}
              >
                {activeCategoriesCount}
              </span>{' '}
              categories
            </span>
            <span>·</span>
            <span>
              <span
                className="mono"
                style={{ color: 'var(--text-primary)', fontWeight: 600 }}
              >
                {componentsAssessed}
              </span>{' '}
              components
            </span>
            <span>·</span>
            <span>
              last run <span className="mono">{lastRunLabel}</span>
            </span>
          </div>

          {/* Contribution bars */}
          <div
            style={{
              marginTop: 26,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {contributors.slice(0, 5).map((c, i) => {
              const widthPct =
                maxContribValue > 0
                  ? Math.max(2, (Math.abs(c.value) / maxContribValue) * 100)
                  : 0
              return (
                <div
                  key={c.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(140px, 180px) 1fr 60px',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={c.name}
                  >
                    {c.name}
                  </div>
                  <div
                    style={{
                      height: 22,
                      borderRadius: 6,
                      background: 'var(--surface-overlay)',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        width: `${widthPct}%`,
                        height: '100%',
                        background: `color-mix(in oklab, var(--brand-primary) ${
                          100 - i * 14
                        }%, var(--surface-raised))`,
                        transition: 'width 600ms cubic-bezier(.2,.7,.2,1)',
                      }}
                    />
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 13,
                      textAlign: 'right',
                      color: 'var(--text-primary)',
                      fontWeight: 500,
                    }}
                  >
                    {formatVal(c.value)}
                  </div>
                </div>
              )
            })}
            {contributors.length === 0 && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-tertiary)',
                  marginTop: 4,
                  fontStyle: 'italic',
                }}
              >
                {usingDemoContributors
                  ? 'No contributors yet — run an assessment to see what is driving impact.'
                  : `No step carries ${activeCat?.label ?? 'this category'} in this run.`}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — categories list */}
        <ImpactCategoriesPanel
          categoryItems={categoryItems}
          activeKey={activeKey}
          onSelectCategory={onSelectCategory}
        />
      </div>
    </div>
  )
}
