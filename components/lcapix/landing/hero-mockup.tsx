'use client'

// HeroMockup — stylized product screenshot for the landing hero.
// Now cycles through CML / ReCiPe / TRACI methodologies every 4s.

import { useEffect, useRef, useState } from 'react'
import { Icon, fmtNum } from '@/components/lcapix'
import { DEMO_CONTRIBUTORS, DEMO_CATEGORIES } from '@/lib/lcapix-demo'
import { AnimatedNumber } from '@/components/lcapix/animated-number'
import { HeroTour, type TourStep } from './hero-tour'

const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="method-pill"]',
    label: 'Methodology in use — cycles between CML, ReCiPe, and TRACI so you can compare.',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="total"]',
    label: 'Total impact for the selected method. Number morphs as you switch.',
    placement: 'right',
  },
  {
    selector: '[data-tour="delta"]',
    label: 'Δ vs your previous assessment run — green if down, amber if up.',
    placement: 'left',
  },
  {
    selector: '[data-tour="contributor"]',
    label: 'Top contributors with proportional bars — the longest is your biggest lever.',
    placement: 'right',
  },
  {
    selector: '[data-tour="category"]',
    label: 'Per-category impact tiles — same run, six environmental scores.',
    placement: 'left',
  },
]

interface MethodVariant {
  id: 'cml' | 'recipe' | 'traci'
  label: string
  total: number
  factor: number
  delta: number
}

const METHODS: MethodVariant[] = [
  { id: 'cml', label: 'CML 2001 v4', total: 126.82, factor: 1.0, delta: -2.1 },
  { id: 'recipe', label: 'ReCiPe Midpoint (H)', total: 142.6, factor: 1.124, delta: 1.4 },
  { id: 'traci', label: 'TRACI 2.1', total: 122.1, factor: 0.963, delta: -3.8 },
]

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function HeroMockup() {
  const [idx, setIdx] = useState(0)
  const method = METHODS[idx]
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (prefersReducedMotion()) return
    const t = setInterval(() => setIdx((i) => (i + 1) % METHODS.length), 4200)
    return () => clearInterval(t)
  }, [])

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
        {/* Method indicator pills */}
        <div style={{ display: 'flex', gap: 4 }}>
          {METHODS.map((m, i) => (
            <button
              key={m.id}
              type="button"
              aria-label={`Switch to ${m.label}`}
              onClick={() => setIdx(i)}
              style={{
                width: idx === i ? 18 : 6,
                height: 6,
                borderRadius: 999,
                background: idx === i ? 'var(--brand-primary)' : 'var(--border-subtle)',
                border: 'none',
                cursor: 'pointer',
                transition: 'width 320ms cubic-bezier(0.2, 0.8, 0.2, 1), background 320ms',
                padding: 0,
              }}
            />
          ))}
        </div>
      </div>
      <div
        style={{
          padding: 24,
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: 24,
          minHeight: 480,
        }}
      >
        {/* Left: chart */}
        <div>
          <div
            className="eyebrow"
            style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            TOTAL IMPACT · GLOBAL WARMING
            <span
              key={`pill-${method.id}`}
              data-tour="method-pill"
              className="mono fade-slide-up"
              style={{
                fontSize: 9.5,
                padding: '2px 8px',
                borderRadius: 999,
                background: 'oklch(from var(--brand-primary) l c h / 0.10)',
                color: 'var(--brand-primary)',
                fontWeight: 600,
                letterSpacing: '0.08em',
                marginLeft: 'auto',
              }}
            >
              {method.label}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 24 }}>
            <span data-tour="total" style={{ display: 'inline-flex', alignItems: 'baseline' }}>
              <AnimatedNumber
                value={method.total}
                decimals={2}
                duration={700}
                className="mono"
                style={{
                  fontSize: 48,
                  fontWeight: 600,
                  color: 'var(--brand-primary)',
                  letterSpacing: '-0.02em',
                }}
              />
            </span>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>kg CO₂-eq</div>
            <div
              key={`delta-${method.id}`}
              data-tour="delta"
              className="fade-slide-up"
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                color:
                  method.delta < 0 ? 'var(--signal-success, #16a34a)' : 'var(--signal-warn, #f59e0b)',
                fontSize: 13,
              }}
            >
              <Icon name={method.delta < 0 ? 'arrow-down' : 'arrow-up'} size={14} />
              <span className="mono">
                {method.delta > 0 ? '+' : ''}
                {method.delta.toFixed(1)}%
              </span>
              <span style={{ color: 'var(--text-tertiary)' }}>vs last run</span>
            </div>
          </div>
          {/* Bar chart */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DEMO_CONTRIBUTORS.map((c, i) => {
              const scaledPct = Math.min(100, c.pct * 2.1 * method.factor)
              return (
                <div
                  key={c.id}
                  data-tour={i === 0 ? 'contributor' : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  <div
                    style={{
                      width: 140,
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {c.name}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      height: 20,
                      background: 'var(--surface-overlay)',
                      borderRadius: 3,
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        width: `${scaledPct}%`,
                        height: '100%',
                        background: 'var(--brand-primary)',
                        opacity: 1 - i * 0.12,
                        transition: 'width 700ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                      }}
                    />
                  </div>
                  <div
                    className="mono"
                    style={{ width: 56, fontSize: 12, color: 'var(--text-primary)', textAlign: 'right' }}
                  >
                    {fmtNum(c.value * method.factor, 1)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        {/* Right: category tiles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="eyebrow">IMPACT CATEGORIES</div>
          {DEMO_CATEGORIES.slice(0, 5).map((cat, i) => {
            const val = cat.value * method.factor
            return (
              <div
                key={cat.id}
                data-tour={i === 0 ? 'category' : undefined}
                style={{
                  padding: 12,
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  background: 'var(--surface-raised)',
                  transition: 'background 400ms',
                }}
              >
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>{cat.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span
                    key={`${cat.id}-${method.id}`}
                    className="mono fade-slide-up"
                    style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}
                  >
                    {val < 0.01 ? val.toExponential(2) : fmtNum(val, val < 1 ? 4 : 2)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{cat.unit}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <HeroTour containerRef={containerRef} steps={TOUR_STEPS} intervalMs={3400} />
    </div>
  )
}
