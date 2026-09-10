'use client'

// HeroMockup — stylized product screenshot for the landing hero.
// Mirrors the in-app DashboardHero (TOTAL IMPACT card on the case results
// page): tinted right "IMPACT CATEGORIES" panel with selectable tiles, big
// 56px brand-tinted number with a delta pill, KPI strip, and contribution
// bars. An animated cursor walks the dashboard, switching methods and
// clicking different categories so the big number morphs in real time.

import { useEffect, useRef, useState } from 'react'
import { fmtNum } from '@/components/lcapix'
import { AnimatedNumber } from '@/components/lcapix/animated-number'
import { CursorTour, type CursorStep } from './cursor-tour'

// Illustrative sample data for the landing-page product preview (a "Painted
// Metal Box" LCA). Self-contained on purpose — this is a marketing mockup of
// the UI, not live data, so it has no dependency on app/demo state.
const EXAMPLE_CATEGORIES: ReadonlyArray<{ id: string; name: string; unit: string; value: number }> = [
  { id: 'gwp', name: 'Global Warming', unit: 'kg CO₂-eq', value: 126.82 },
  { id: 'ap', name: 'Acidification', unit: 'kg SO₂-eq', value: 0.58 },
  { id: 'ep', name: 'Eutrophication', unit: 'kg PO₄-eq', value: 0.14 },
  { id: 'odp', name: 'Ozone Depletion', unit: 'kg CFC11-eq', value: 0.0000042 },
  { id: 'pocp', name: 'Photochemical Oxidation', unit: 'kg C₂H₄-eq', value: 0.042 },
]
const EXAMPLE_CONTRIBUTORS: ReadonlyArray<{ id: string; name: string; pct: number }> = [
  { id: 'c1', name: 'Steel Sheet (1.2mm)', pct: 42.0 },
  { id: 'c2', name: 'Cutting Electricity', pct: 21.2 },
  { id: 'c3', name: 'Spray Paint (solvent-based)', pct: 16.4 },
  { id: 'c4', name: 'Welding Energy', pct: 11.1 },
  { id: 'c5', name: 'Assembly Labor', pct: 9.3 },
]

interface MethodVariant {
  id: 'cml' | 'recipe' | 'traci'
  label: string
  factor: number
  delta: number
}

const METHODS: MethodVariant[] = [
  { id: 'cml', label: 'CML 2001 v4', factor: 1.0, delta: -2.1 },
  { id: 'recipe', label: 'ReCiPe Midpoint (H)', factor: 1.124, delta: 1.4 },
  { id: 'traci', label: 'TRACI 2.1', factor: 0.963, delta: -3.8 },
]

// Pick a sensible default ordering for the category panel.
const VISIBLE_CATEGORIES = EXAMPLE_CATEGORIES.slice(0, 5)

function formatCatVal(v: number): string {
  if (!isFinite(v)) return '—'
  if (v < 0.001 && v > 0) return v.toExponential(2)
  if (v < 1) return v.toFixed(4)
  if (v < 100) return v.toFixed(2)
  return v.toFixed(0)
}

export function HeroMockup() {
  const [methodIdx, setMethodIdx] = useState(0)
  const [activeCatIdx, setActiveCatIdx] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const method = METHODS[methodIdx]
  const activeCat = VISIBLE_CATEGORIES[activeCatIdx]
  const activeValue = activeCat.value * method.factor

  // Cursor tour — visits categories, then the method pill, in a loop. Each
  // "click" mutates state so the dashboard morphs as the cursor lands.
  const tourSteps: CursorStep[] = [
    {
      selector: '[data-tour="cat-1"]',
      label: 'Click a category — the big number and delta recompute.',
      onClick: () => setActiveCatIdx(1),
      holdMs: 3000,
    },
    {
      selector: '[data-tour="cat-2"]',
      label: 'Each tile shows its category-specific impact + unit.',
      onClick: () => setActiveCatIdx(2),
      holdMs: 3000,
    },
    {
      selector: '[data-tour="method-pill"]',
      label: 'Switch methodology — same inputs, different framework.',
      onClick: () => setMethodIdx((i) => (i + 1) % METHODS.length),
      holdMs: 3200,
    },
    {
      selector: '[data-tour="cat-0"]',
      label: 'Back to Global Warming — the headline number teams report.',
      onClick: () => setActiveCatIdx(0),
      holdMs: 3000,
    },
    {
      selector: '[data-tour="contributor-0"]',
      label: 'Top contributors — your biggest lever for cutting impact.',
      holdMs: 3000,
    },
  ]

  return (
    <div
      ref={containerRef}
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        overflow: 'hidden',
        background: 'var(--surface-sunken)',
        boxShadow: 'var(--shadow-overlay)',
        position: 'relative',
      }}
    >
      {/* Mock window bar */}
      <div
        style={{
          height: 36,
          background: 'var(--surface-raised)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 16px',
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'oklch(0.40 0.02 240)' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'oklch(0.40 0.02 240)' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'oklch(0.40 0.02 240)' }} />
        <div className="mono" style={{ marginLeft: 20, fontSize: 11, color: 'var(--text-tertiary)' }}>
          lcapix.io / project / ev-mfg / baseline-2025 / results
        </div>
        <div style={{ flex: 1 }} />
        {/* Method indicator pills (clickable + driven by cursor) */}
        <div style={{ display: 'flex', gap: 4 }}>
          {METHODS.map((m, i) => (
            <button
              key={m.id}
              type="button"
              aria-label={`Switch to ${m.label}`}
              onClick={() => setMethodIdx(i)}
              style={{
                width: methodIdx === i ? 18 : 6,
                height: 6,
                borderRadius: 999,
                background: methodIdx === i ? 'var(--brand-primary)' : 'var(--border-subtle)',
                border: 'none',
                cursor: 'pointer',
                transition: 'width 320ms cubic-bezier(0.2, 0.8, 0.2, 1), background 320ms',
                padding: 0,
              }}
            />
          ))}
        </div>
      </div>

      {/* Dashboard hero — mirrors the in-app card layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.7fr) minmax(0, 1fr)',
          minHeight: 480,
        }}
      >
        {/* LEFT — total impact + delta + contribution bars */}
        <div style={{ padding: '28px 28px 24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
              marginBottom: 10,
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
              TOTAL IMPACT · {activeCat.name.toUpperCase()}
            </span>
            <span style={{ flex: 1 }} />
            <span
              data-tour="method-pill"
              key={`pill-${method.id}`}
              className="mono fade-slide-up"
              style={{
                fontSize: 10,
                padding: '3px 8px',
                borderRadius: 999,
                background: 'var(--surface-overlay)',
                color: 'var(--text-tertiary)',
                letterSpacing: '0.04em',
              }}
            >
              {method.label}
            </span>
          </div>

          <div
            data-tour="total"
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            <AnimatedNumber
              value={activeValue}
              decimals={activeValue < 1 ? 4 : 2}
              duration={700}
              className="mono"
              style={{
                fontSize: 56,
                fontWeight: 600,
                color: 'var(--brand-primary)',
                lineHeight: 1,
                letterSpacing: '-0.02em',
              }}
            />
            <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
              {activeCat.unit}
            </div>
            <span
              key={`delta-${method.id}-${activeCat.id}`}
              className="mono fade-slide-up"
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: 999,
                color:
                  method.delta <= 0
                    ? 'var(--signal-success, #16a34a)'
                    : '#b45309',
                background:
                  method.delta <= 0
                    ? 'color-mix(in oklab, var(--signal-success, #16a34a) 14%, transparent)'
                    : 'color-mix(in oklab, #d98568 18%, transparent)',
              }}
            >
              {method.delta <= 0 ? '↓' : '↑'} {Math.abs(method.delta).toFixed(1)}% vs last run
            </span>
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
              <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {VISIBLE_CATEGORIES.length}
              </span>{' '}
              categories
            </span>
            <span>·</span>
            <span>
              <span className="mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                12
              </span>{' '}
              components
            </span>
            <span>·</span>
            <span>
              last run <span className="mono">2h ago</span>
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
            {EXAMPLE_CONTRIBUTORS.map((c, i) => {
              const widthPct = Math.min(100, c.pct * 2.1 * method.factor)
              return (
                <div
                  key={c.id}
                  data-tour={`contributor-${i}`}
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
                        transition: 'width 700ms cubic-bezier(0.2, 0.8, 0.2, 1)',
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
                    {fmtNum(c.value * method.factor, c.value < 1 ? 2 : 1)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT — categories list (tinted panel, mirrors in-app dashboard) */}
        <div
          style={{
            padding: '28px 24px 24px',
            borderLeft: '1px solid var(--border-subtle)',
            background: 'color-mix(in oklab, var(--brand-primary) 2%, var(--surface-raised))',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div
            className="eyebrow"
            style={{
              fontSize: 11,
              letterSpacing: '0.14em',
              color: 'var(--brand-primary)',
              marginBottom: 4,
            }}
          >
            IMPACT CATEGORIES
          </div>
          {VISIBLE_CATEGORIES.map((cat, i) => {
            const val = cat.value * method.factor
            const isActive = i === activeCatIdx
            return (
              <button
                key={cat.id}
                type="button"
                data-tour={`cat-${i}`}
                onClick={() => setActiveCatIdx(i)}
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
                  transition:
                    'background 200ms ease, border-color 200ms ease, transform 200ms ease',
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 500,
                    color: 'var(--text-primary)',
                    marginBottom: 4,
                  }}
                >
                  {cat.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span
                    key={`${cat.id}-${method.id}`}
                    className="mono fade-slide-up"
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      color: isActive ? 'var(--brand-primary)' : 'var(--text-primary)',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {formatCatVal(val)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {cat.unit}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <CursorTour containerRef={containerRef} steps={tourSteps} />
    </div>
  )
}
