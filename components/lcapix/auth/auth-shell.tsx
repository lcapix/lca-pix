'use client'

// AuthShell — two-pane layout for login/signup.
//
// Left pane (44%): Logo top-left + vertically-centred `children` (the form).
// Right pane (56%): MontageHero — a scenario montage that cycles through
//                   four real LCA trade-offs (bracket / bottle / freight /
//                   plastic) with tweened numbers, glass cards, an aurora
//                   background, and a dot-grid+noise texture overlay. The
//                   right-side aesthetic the design doc calls "montage".

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Logo, LogoMark } from '@/components/lcapix/logo'

export interface AuthShellProps {
  children: ReactNode
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        // Left-to-right blend: form-side surface bleeds into the hero side,
        // so the seam between the two panes disappears. The hero's own
        // aurora + glass cards float on top of this base.
        background:
          'linear-gradient(90deg, var(--surface-base) 0%, var(--surface-base) 38%, color-mix(in oklab, var(--surface-sunken) 92%, var(--brand-primary) 8%) 100%)',
      }}
    >
      {/* Left pane — form. Shrunk slightly so the hero gets more breathing
          room. Form still has a hard cap at maxWidth 420 so the readable
          line length doesn't change. */}
      <div
        style={{
          flex: '0 0 38%',
          display: 'flex',
          flexDirection: 'column',
          padding: '48px 64px 56px',
          minHeight: '100vh',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex' }}>
          <Logo size={32} />
        </Link>
        <div style={{ margin: 'auto 0', maxWidth: 420, width: '100%' }}>{children}</div>
      </div>

      {/* Right pane — montage hero, now 62% of the viewport */}
      <MontageHero />

      <style jsx global>{`
        @keyframes lca-aurora-a {
          0%   { transform: translate3d(-12%, -8%, 0) scale(1); }
          50%  { transform: translate3d(8%, 6%, 0)   scale(1.15); }
          100% { transform: translate3d(-12%, -8%, 0) scale(1); }
        }
        @keyframes lca-aurora-b {
          0%   { transform: translate3d(10%, 12%, 0) scale(1.1); }
          50%  { transform: translate3d(-6%, -4%, 0) scale(0.95); }
          100% { transform: translate3d(10%, 12%, 0) scale(1.1); }
        }
        @keyframes lca-aurora-c {
          0%   { transform: translate3d(4%, -14%, 0) scale(0.9); }
          50%  { transform: translate3d(-8%, 8%, 0)  scale(1.2); }
          100% { transform: translate3d(4%, -14%, 0) scale(0.9); }
        }
        @keyframes lca-fade-up {
          from { transform: translateY(8px); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
        @keyframes lca-arrow-slide {
          0%   { transform: translateX(-6px); opacity: 0.5; }
          50%  { transform: translateX(0);    opacity: 1;   }
          100% { transform: translateX(6px);  opacity: 0.5; }
        }
        @keyframes lca-pill-glow {
          0%, 100% { box-shadow: 0 0 0 0 currentColor; opacity: 0.95; }
          50%      { box-shadow: 0 0 0 6px transparent; opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .lca-aurora,
          .lca-arrow { animation: none !important; }
        }
      `}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario data — four real LCA trade-offs. Numbers are representative of
// published CML 2001 / ecoinvent-style averages so they hold up to scrutiny.
// Scenario 1 is anchored to the manual-test runbook so a returning customer
// recognises it.
// ─────────────────────────────────────────────────────────────────────────────
type Scenario = {
  headline: string
  baseLabel: string
  baseValue: number   // kg CO2-eq
  baseCost: number    // USD per unit
  altLabel: string
  altValue: number
  altCost: number
  unit: string
  perUnit: string
  verdictCo2Pct: number   // signed: positive = alt is worse
  verdictCostPct: number  // signed: positive = alt is more expensive
  flavor: string          // human note in the verdict strip
}

const SCENARIOS: Scenario[] = [
  {
    headline: 'Steel or aluminum?',
    baseLabel: 'Steel bracket',
    baseValue: 2.010, baseCost: 3.17,
    altLabel: 'Aluminum bracket',
    altValue: 3.406, altCost: 2.60,
    unit: 'kg CO₂-eq', perUnit: 'per bracket',
    verdictCo2Pct: 69, verdictCostPct: -18,
    flavor: 'Lighter material, heavier footprint.',
  },
  {
    headline: 'PET or HDPE?',
    baseLabel: 'PET bottle',
    baseValue: 0.082, baseCost: 0.18,
    altLabel: 'HDPE bottle',
    altValue: 0.071, altCost: 0.16,
    unit: 'kg CO₂-eq', perUnit: 'per bottle',
    verdictCo2Pct: -13, verdictCostPct: -11,
    flavor: 'Same shelf, smaller footprint.',
  },
  {
    headline: 'Air or sea freight?',
    baseLabel: 'Air freight',
    baseValue: 2.100, baseCost: 0.420,
    altLabel: 'Sea freight',
    altValue: 0.012, altCost: 0.025,
    unit: 'kg CO₂-eq / tkm', perUnit: 'per tonne-km',
    verdictCo2Pct: -99, verdictCostPct: -94,
    flavor: 'Eighteen extra days, ninety-nine fewer percent.',
  },
  {
    headline: 'Fossil or bio-based PE?',
    baseLabel: 'Fossil PE',
    baseValue: 1.900, baseCost: 1.40,
    altLabel: 'Bio-based PE',
    altValue: -0.500, altCost: 1.99,
    unit: 'kg CO₂-eq', perUnit: 'per kg',
    verdictCo2Pct: -126, verdictCostPct: 42,
    flavor: 'Carbon negative on the bag, three times the land use.',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// MontageHero — the right-side panel.
// ─────────────────────────────────────────────────────────────────────────────
function MontageHero() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const scenario = SCENARIOS[index]

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => setIndex(i => (i + 1) % SCENARIOS.length), 5000)
    return () => clearInterval(id)
  }, [paused])

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: '64px 80px',
        // No hard border — the parent gradient bleeds the form-side surface
        // into here so the seam dissolves. The aurora + cards float above.
        background:
          'linear-gradient(180deg, color-mix(in oklab, var(--surface-sunken) 95%, var(--brand-primary) 5%), color-mix(in oklab, var(--surface-sunken) 65%, #001F12 35%))',
        isolation: 'isolate',
      }}
    >
      {/* Aurora blobs — three pseudo-elements via real divs so they animate
          independently. Bigger + slightly more saturated than before to make
          the panel visibly alive without screaming. filter: blur creates the
          soft glow; the parent owns overflow: hidden so they bleed past
          edges without scrollbars. */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <div
          className="lca-aurora"
          style={{
            position: 'absolute', top: '-25%', left: '-20%', width: 880, height: 880,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(56, 142, 102, 0.72), transparent 62%)',
            filter: 'blur(90px)',
            animation: 'lca-aurora-a 18s ease-in-out infinite',
          }}
        />
        <div
          className="lca-aurora"
          style={{
            position: 'absolute', bottom: '-30%', right: '-15%', width: 800, height: 800,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(91, 191, 139, 0.55), transparent 62%)',
            filter: 'blur(100px)',
            animation: 'lca-aurora-b 22s ease-in-out infinite',
          }}
        />
        <div
          className="lca-aurora"
          style={{
            position: 'absolute', top: '28%', left: '35%', width: 600, height: 600,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(13, 59, 38, 0.62), transparent 65%)',
            filter: 'blur(80px)',
            animation: 'lca-aurora-c 26s ease-in-out infinite',
          }}
        />
      </div>

      {/* Dot grid pattern with radial fade — sharp engineering precision */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, zIndex: 1,
          backgroundImage:
            'radial-gradient(circle at 1px 1px, color-mix(in oklab, var(--text-primary) 35%, transparent) 1px, transparent 0)',
          backgroundSize: '24px 24px',
          opacity: 0.28,
          maskImage: 'radial-gradient(70% 55% at 55% 45%, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(70% 55% at 55% 45%, black 30%, transparent 80%)',
        }}
      />

      {/* Noise texture — 4% opacity, kills banding */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
          opacity: 0.04, mixBlendMode: 'overlay',
          backgroundImage:
            `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
        }}
      />

      {/* Edge vignette */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none',
          boxShadow: 'inset 0 0 120px 0 color-mix(in oklab, #000 18%, transparent)',
        }}
      />

      {/* Brand block */}
      <div style={{ position: 'relative', zIndex: 4, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ color: 'var(--brand-primary)' }}>
          <LogoMark size={48} />
        </div>
        <div>
          <div
            className="logo-wordmark"
            style={{ fontSize: 24, color: 'var(--text-primary)', letterSpacing: '0.02em', lineHeight: 1 }}
          >
            LCAPIX
          </div>
          <div
            style={{
              fontSize: 11, color: 'var(--text-tertiary)', marginTop: 5,
              letterSpacing: '0.18em', textTransform: 'uppercase',
            }}
          >
            Life Cycle Assessment · v3
          </div>
        </div>
      </div>

      {/* Headline that morphs per scenario — bigger, more breathing room */}
      <div style={{ position: 'relative', zIndex: 4, marginTop: 72, maxWidth: 680 }}>
        <div
          style={{
            fontSize: 12, color: 'var(--brand-primary)',
            letterSpacing: '0.24em', textTransform: 'uppercase', fontWeight: 700,
          }}
        >
          {scenario.perUnit}
        </div>
        <h2
          key={`headline-${index}`}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 56, lineHeight: 1.08, fontWeight: 500,
            color: 'var(--text-primary)', margin: '18px 0 0',
            letterSpacing: '-0.025em',
            animation: 'lca-fade-up 480ms ease-out',
          }}
        >
          {scenario.headline}
        </h2>
        <p
          style={{
            marginTop: 18, fontSize: 17, lineHeight: 1.55,
            color: 'var(--text-secondary)', maxWidth: 540,
          }}
        >
          Run a base case. Run an alternative. Watch the carbon, cost and time
          deltas update side-by-side — with the math you can defend.
        </p>
      </div>

      {/* Compare cards — wider to occupy more space */}
      <div style={{ position: 'relative', zIndex: 4, marginTop: 44, maxWidth: 760 }}>
        <CompareGrid scenario={scenario} index={index} />
      </div>

      {/* Dot indicator — bigger caption, higher contrast so it actually reads */}
      <div
        style={{
          position: 'relative', zIndex: 4, marginTop: 32,
          display: 'flex', alignItems: 'center', gap: 10,
        }}
      >
        {SCENARIOS.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Show scenario ${i + 1}`}
            style={{
              width: i === index ? 32 : 10,
              height: 10,
              padding: 0,
              borderRadius: 999,
              border: 'none',
              background: i === index
                ? 'var(--brand-primary)'
                : 'color-mix(in oklab, var(--text-primary) 28%, transparent)',
              cursor: 'pointer',
              transition: 'width 320ms ease, background 320ms ease',
              boxShadow: i === index
                ? '0 0 16px 0 color-mix(in oklab, var(--brand-primary) 60%, transparent)'
                : 'none',
            }}
          />
        ))}
        <div
          style={{
            marginLeft: 16, fontSize: 12, color: 'var(--text-secondary)',
            letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600,
          }}
        >
          Same math you’ll see in the app
        </div>
      </div>

      {/* Trust strip pinned bottom — larger, higher contrast */}
      <div
        style={{
          position: 'relative', zIndex: 4,
          marginTop: 'auto', paddingTop: 40,
          display: 'flex', gap: 26, flexWrap: 'wrap',
          color: 'var(--text-secondary)', fontSize: 13,
          letterSpacing: '0.20em', textTransform: 'uppercase', fontWeight: 600,
        }}
      >
        <span>CML 2001</span>
        <span style={{ opacity: 0.35 }}>·</span>
        <span>ReCiPe (H)</span>
        <span style={{ opacity: 0.35 }}>·</span>
        <span>TRACI 2.1</span>
        <span style={{ opacity: 0.35 }}>·</span>
        <span>ISO 14040 / 14044</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CompareGrid — the two glass cards + the verdict strip beneath.
// ─────────────────────────────────────────────────────────────────────────────
function CompareGrid({ scenario, index }: { scenario: Scenario; index: number }) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: '1fr 88px 1fr',
        gap: 16,
        alignItems: 'stretch',
      }}
    >
      <CaseCard
        key={`base-${index}`}
        label="Base case"
        title={scenario.baseLabel}
        co2={scenario.baseValue}
        cost={scenario.baseCost}
        unit={scenario.unit}
        tone="base"
      />
      <ArrowColumn />
      <CaseCard
        key={`alt-${index}`}
        label="Alternative"
        title={scenario.altLabel}
        co2={scenario.altValue}
        cost={scenario.altCost}
        unit={scenario.unit}
        tone="alt"
      />
      <div style={{ gridColumn: '1 / -1' }}>
        <DeltaBar scenario={scenario} index={index} />
      </div>
    </div>
  )
}

// useCountUp — tween a number between renders. ~700ms ease-out via rAF.
function useCountUp(target: number, duration = 700, decimals = 3) {
  const [value, setValue] = useState(target)
  const fromRef = useRef(target)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const from = fromRef.current
    const to = target
    if (from === to) return
    startRef.current = null

    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t
      const elapsed = t - startRef.current
      const p = Math.min(1, elapsed / duration)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3)
      const next = from + (to - from) * eased
      setValue(parseFloat(next.toFixed(decimals)))
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration, decimals])

  return value
}

function CaseCard({
  label, title, co2, cost, unit, tone,
}: {
  label: string
  title: string
  co2: number
  cost: number
  unit: string
  tone: 'base' | 'alt'
}) {
  const accent = tone === 'base' ? 'var(--brand-primary)' : 'rgba(214, 132, 73, 0.95)'
  const co2Tween = useCountUp(co2, 700, 3)
  const costTween = useCountUp(cost, 700, 2)

  return (
    <div
      style={{
        position: 'relative',
        background: 'color-mix(in oklab, var(--surface-raised) 78%, transparent)',
        backdropFilter: 'blur(18px) saturate(140%)',
        WebkitBackdropFilter: 'blur(18px) saturate(140%)',
        border: '1px solid color-mix(in oklab, var(--border-subtle) 65%, transparent)',
        borderRadius: 14,
        padding: '18px 20px 18px 22px',
        overflow: 'hidden',
        boxShadow:
          '0 1px 0 0 color-mix(in oklab, #fff 35%, transparent) inset, 0 22px 60px -28px color-mix(in oklab, var(--brand-primary) 65%, transparent)',
      }}
    >
      {/* Accent strip down the left edge */}
      <div
        aria-hidden
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          background: accent, opacity: 0.85,
        }}
      />
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11, letterSpacing: '0.20em', textTransform: 'uppercase',
          color: accent, fontWeight: 700,
        }}
      >
        <span
          style={{
            width: 7, height: 7, borderRadius: '50%', background: accent,
            boxShadow: `0 0 14px 0 ${accent}`,
          }}
        />
        {label}
      </div>
      <div
        style={{
          marginTop: 12, fontSize: 20, fontWeight: 600,
          color: 'var(--text-primary)', letterSpacing: '-0.015em',
        }}
      >
        {title}
      </div>
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Metric label="CO₂" value={co2Tween.toFixed(3)} unit={unit} />
        <Metric label="Cost" value={`$${costTween.toFixed(2)}`} unit="per unit" />
      </div>
    </div>
  )
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <span
        style={{
          fontSize: 12, color: 'var(--text-secondary)',
          letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 600,
        }}
      >
        {label}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5 }}>
        <span
          className="mono"
          style={{
            fontSize: 22, fontWeight: 600,
            color: 'var(--text-primary)',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.01em',
          }}
        >
          {value}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{unit}</span>
      </span>
    </div>
  )
}

function ArrowColumn() {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 6,
      }}
    >
      <div
        style={{
          fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase',
          color: 'var(--brand-primary)', fontWeight: 600,
        }}
      >
        Compare
      </div>
      <div style={{ width: 64, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg
          className="lca-arrow"
          width="64" height="28" viewBox="0 0 64 28" fill="none"
          style={{ animation: 'lca-arrow-slide 1.6s ease-in-out infinite' }}
        >
          <path d="M2 14 H56" stroke="var(--brand-primary)" strokeWidth="2" strokeLinecap="round" />
          <path
            d="M48 6 L58 14 L48 22"
            stroke="var(--brand-primary)" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" fill="none"
          />
        </svg>
      </div>
      <div
        style={{
          fontSize: 9, color: 'var(--text-tertiary)',
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}
      >
        side by side
      </div>
    </div>
  )
}

function DeltaBar({ scenario, index }: { scenario: Scenario; index: number }) {
  const co2Pct = useCountUp(scenario.verdictCo2Pct, 700, 0)
  const costPct = useCountUp(scenario.verdictCostPct, 700, 0)
  // Sign convention: for CO2, positive = alt worse → red. For cost, positive = more expensive → amber.
  const co2Worse = co2Pct > 0
  const costWorse = costPct > 0
  return (
    <div
      key={`delta-${index}`}
      style={{
        marginTop: 14,
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        padding: '14px 18px',
        background: 'color-mix(in oklab, var(--surface-raised) 70%, transparent)',
        backdropFilter: 'blur(18px) saturate(140%)',
        WebkitBackdropFilter: 'blur(18px) saturate(140%)',
        border: '1px dashed color-mix(in oklab, var(--border-strong) 70%, transparent)',
        borderRadius: 14,
        animation: 'lca-fade-up 520ms ease-out',
      }}
    >
      <div
        style={{
          fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase',
          color: 'var(--text-tertiary)', fontWeight: 600,
        }}
      >
        Δ Verdict
      </div>
      <DeltaChip label="CO₂" value={formatPct(co2Pct)} worse={co2Worse} />
      <DeltaChip label="Cost" value={formatPct(costPct)} worse={costWorse} />
      <div
        style={{
          marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)',
          maxWidth: 240, textAlign: 'right', lineHeight: 1.4,
        }}
      >
        {scenario.flavor}
      </div>
    </div>
  )
}

function formatPct(n: number) {
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  return `${sign}${Math.abs(Math.round(n))}%`
}

function DeltaChip({ label, value, worse }: { label: string; value: string; worse: boolean }) {
  const color = worse ? 'rgba(214, 132, 73, 0.95)' : 'var(--brand-primary)'
  const bg = worse ? 'rgba(214, 132, 73, 0.12)' : 'rgba(56, 142, 102, 0.12)'
  return (
    <div
      style={{
        display: 'inline-flex', alignItems: 'baseline', gap: 6,
        padding: '5px 11px', borderRadius: 999,
        background: bg, border: `1px solid ${color}`,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span
        style={{
          fontSize: 10, color: 'var(--text-tertiary)',
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span className="mono" style={{ fontSize: 13, fontWeight: 600, color }}>
        {value}
      </span>
    </div>
  )
}
