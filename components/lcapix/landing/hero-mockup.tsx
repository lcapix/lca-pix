'use client'

// HeroMockup — stylized product screenshot for the landing hero.
// Mirrors the HeroMockup inline component in LCAPIX/pages-landing.jsx.

import { Icon, fmtNum } from '@/components/lcapix'
import { DEMO_CONTRIBUTORS, DEMO_CATEGORIES } from '@/lib/lcapix-demo'

export function HeroMockup() {
  return (
    <div
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
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            TOTAL IMPACT · GLOBAL WARMING
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 24 }}>
            <div
              className="mono"
              style={{ fontSize: 48, fontWeight: 600, color: 'var(--brand-primary)', letterSpacing: '-0.02em' }}
            >
              126.82
            </div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>kg CO₂-eq</div>
            <div
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                color: 'var(--signal-success)',
                fontSize: 13,
              }}
            >
              <Icon name="arrow-down" size={14} />
              <span className="mono">−2.1%</span>
              <span style={{ color: 'var(--text-tertiary)' }}>vs last run</span>
            </div>
          </div>
          {/* Bar chart */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DEMO_CONTRIBUTORS.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
                      width: `${c.pct * 2.1}%`,
                      height: '100%',
                      background: 'var(--brand-primary)',
                      opacity: 1 - i * 0.12,
                    }}
                  />
                </div>
                <div
                  className="mono"
                  style={{ width: 56, fontSize: 12, color: 'var(--text-primary)', textAlign: 'right' }}
                >
                  {fmtNum(c.value, 1)}
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Right: category tiles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="eyebrow">IMPACT CATEGORIES</div>
          {DEMO_CATEGORIES.slice(0, 5).map((cat) => (
            <div
              key={cat.id}
              style={{
                padding: 12,
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                background: 'var(--surface-raised)',
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>{cat.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span
                  className="mono"
                  style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}
                >
                  {cat.value < 0.01 ? cat.value.toExponential(2) : fmtNum(cat.value, cat.value < 1 ? 4 : 2)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{cat.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
