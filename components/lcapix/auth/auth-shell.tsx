'use client'

// AuthShell — two-pane layout for login/signup.
//
// Left pane (44%): Logo top-left + vertically-centred `children` (the form).
// Right pane (56%): brand panel showing an animated "base vs comparative" demo
//                   — the core LCAPIX value prop in motion.

import type { ReactNode } from 'react'
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
        background: 'var(--surface-base)',
      }}
    >
      {/* Left pane — form */}
      <div
        style={{
          flex: '0 0 44%',
          display: 'flex',
          flexDirection: 'column',
          padding: '40px 56px 48px',
          minHeight: '100vh',
        }}
      >
        <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex' }}>
          <Logo size={32} />
        </Link>
        <div style={{ margin: 'auto 0', maxWidth: 420, width: '100%' }}>{children}</div>
      </div>

      {/* Right pane — branded compare-cases animation */}
      <BrandPane />

      <style jsx global>{`
        @keyframes lca-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(56, 142, 102, 0.0); }
          50%      { box-shadow: 0 0 0 8px rgba(56, 142, 102, 0.10); }
        }
        @keyframes lca-arrow-slide {
          0%   { transform: translateX(-8px); opacity: 0.4; }
          50%  { transform: translateX(0);    opacity: 1;   }
          100% { transform: translateX(8px);  opacity: 0.4; }
        }
        @keyframes lca-tick-up {
          from { transform: translateY(6px); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
        @keyframes lca-glow {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1;    }
        }
      `}</style>
    </div>
  )
}

function BrandPane() {
  return (
    <div
      style={{
        flex: 1,
        background:
          'radial-gradient(120% 80% at 100% 0%, rgba(56,142,102,0.10), transparent 55%), var(--surface-sunken)',
        borderLeft: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        padding: '56px 64px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle grid background */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(var(--border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          opacity: 0.25,
          maskImage: 'radial-gradient(70% 60% at 50% 40%, black, transparent)',
          WebkitMaskImage: 'radial-gradient(70% 60% at 50% 40%, black, transparent)',
        }}
      />

      {/* Top brand block */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ color: 'var(--brand-primary)' }}>
          <LogoMark size={56} />
        </div>
        <div>
          <div
            className="logo-wordmark"
            style={{
              fontSize: 28,
              color: 'var(--brand-primary)',
              letterSpacing: '0.02em',
              lineHeight: 1,
            }}
          >
            LCAPIX
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-tertiary)',
              marginTop: 6,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            Life Cycle Assessment · v3
          </div>
        </div>
      </div>

      {/* Tagline */}
      <div style={{ position: 'relative', margin: '48px 0 36px', maxWidth: 560 }}>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 34,
            lineHeight: 1.18,
            fontWeight: 500,
            color: 'var(--text-primary)',
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          Compare any two ways
          <br />
          of making anything.
        </h2>
        <p
          style={{
            marginTop: 16,
            fontSize: 15,
            lineHeight: 1.55,
            color: 'var(--text-secondary)',
            maxWidth: 480,
          }}
        >
          Run a base case. Run an alternative. Watch the carbon, cost and time
          deltas update side-by-side — with the math you can defend.
        </p>
      </div>

      {/* Animated compare card */}
      <CompareDemo />

      {/* Trust strip */}
      <div
        style={{
          position: 'relative',
          marginTop: 'auto',
          paddingTop: 32,
          display: 'flex',
          gap: 22,
          flexWrap: 'wrap',
          color: 'var(--text-tertiary)',
          fontSize: 11,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
        }}
      >
        <span>CML 2001</span>
        <span>·</span>
        <span>ReCiPe (H)</span>
        <span>·</span>
        <span>TRACI 2.1</span>
        <span>·</span>
        <span>ISO 14040 / 14044</span>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 4,
          background:
            'linear-gradient(90deg, transparent, var(--brand-primary), transparent)',
          animation: 'lca-glow 4s ease-in-out infinite',
        }}
      />
    </div>
  )
}

function CompareDemo() {
  return (
    <div
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: '1fr 88px 1fr',
        gap: 16,
        alignItems: 'stretch',
        maxWidth: 620,
      }}
    >
      <CaseCard
        label="Base case"
        title="Steel bracket"
        co2={2.115}
        cost={5.06}
        tone="base"
      />
      <ArrowColumn />
      <CaseCard
        label="Alternative"
        title="Aluminum bracket"
        co2={3.406}
        cost={3.44}
        tone="alt"
      />
      <div style={{ gridColumn: '1 / -1' }}>
        <DeltaBar />
      </div>
    </div>
  )
}

function CaseCard({
  label,
  title,
  co2,
  cost,
  tone,
}: {
  label: string
  title: string
  co2: number
  cost: number
  tone: 'base' | 'alt'
}) {
  const accent =
    tone === 'base' ? 'var(--brand-primary)' : 'rgba(180, 96, 60, 0.95)'
  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--surface-raised)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        padding: '16px 18px',
        animation: 'lca-pulse 3.6s ease-in-out infinite',
        animationDelay: tone === 'alt' ? '1.8s' : '0s',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: accent,
          fontWeight: 600,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: accent,
          }}
        />
        {label}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </div>
      <div
        style={{
          marginTop: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <Metric label="CO₂" value={co2.toFixed(3)} unit="kg CO₂-eq" tone={tone} />
        <Metric label="Cost" value={`$${cost.toFixed(2)}`} unit="per unit" tone={tone} />
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  unit,
  tone,
}: {
  label: string
  value: string
  unit: string
  tone: 'base' | 'alt'
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        animation: 'lca-tick-up 600ms ease-out',
        animationDelay: tone === 'alt' ? '300ms' : '0ms',
        animationFillMode: 'both',
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: 'var(--text-tertiary)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
        <span
          className="mono"
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          {value}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{unit}</span>
      </span>
    </div>
  )
}

function ArrowColumn() {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--brand-primary)',
          fontWeight: 600,
        }}
      >
        Compare
      </div>
      <div
        style={{
          position: 'relative',
          width: 64,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width="64"
          height="28"
          viewBox="0 0 64 28"
          fill="none"
          style={{ animation: 'lca-arrow-slide 1.6s ease-in-out infinite' }}
        >
          <path d="M2 14 H56" stroke="var(--brand-primary)" strokeWidth="2" strokeLinecap="round" />
          <path
            d="M48 6 L58 14 L48 22"
            stroke="var(--brand-primary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>
      <div
        style={{
          fontSize: 9,
          color: 'var(--text-tertiary)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        side by side
      </div>
    </div>
  )
}

function DeltaBar() {
  return (
    <div
      style={{
        marginTop: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '14px 18px',
        background: 'var(--surface-raised)',
        border: '1px dashed var(--border-strong)',
        borderRadius: 12,
        flexWrap: 'wrap',
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
          fontWeight: 600,
        }}
      >
        Δ Verdict
      </div>
      <DeltaChip label="CO₂" value="+61%" worse />
      <DeltaChip label="Cost" value="−32%" />
      <div
        style={{
          marginLeft: 'auto',
          fontSize: 11,
          color: 'var(--text-secondary)',
          maxWidth: 220,
          textAlign: 'right',
          lineHeight: 1.35,
        }}
      >
        Lighter material, heavier footprint. The trade-off you can defend.
      </div>
    </div>
  )
}

function DeltaChip({
  label,
  value,
  worse = false,
}: {
  label: string
  value: string
  worse?: boolean
}) {
  const color = worse ? 'rgba(180, 96, 60, 0.95)' : 'var(--brand-primary)'
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        background: worse ? 'rgba(180, 96, 60, 0.10)' : 'rgba(56, 142, 102, 0.10)',
        border: `1px solid ${color}`,
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: 'var(--text-tertiary)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
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
