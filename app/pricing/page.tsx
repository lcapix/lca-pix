'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Icon } from '@/components/lcapix'
import { MarketingNav } from '@/components/lcapix/marketing-nav'

type Cadence = 'monthly' | 'annual'

interface Tier {
  name: string
  monthly: number | string
  annual: number | string
  cadenceLabel: { monthly: string; annual: string }
  blurb: string
  highlight: boolean
  features: string[]
  cta: string
  href: string
}

const TIERS: Tier[] = [
  {
    name: 'Free',
    monthly: 0,
    annual: 0,
    cadenceLabel: { monthly: 'forever', annual: 'forever' },
    blurb: 'Build a defensible LCA in a browser. No card.',
    highlight: false,
    features: [
      '3 projects',
      '100 components per project',
      'Unlimited assessments',
      'CML 2001 · ReCiPe (H) · TRACI 2.1',
      'openLCA bundled factor pack (5,234)',
      'ISO-compliant PDF export',
      'Email support',
    ],
    cta: 'Get started free',
    href: '/auth/signup',
  },
  {
    name: 'Pro',
    monthly: 49,
    annual: 39,
    cadenceLabel: { monthly: 'per seat / month', annual: 'per seat / month, billed yearly' },
    blurb: 'Live grid data, regional costing, team collaboration.',
    highlight: true,
    features: [
      'Everything in Free',
      'Unlimited projects + components',
      'Live grid intensity (Electricity Maps)',
      'Regional cost data (BLS · EIA)',
      'PubChem substance enrichment',
      'Comparative cases + delta reports',
      'Audit log',
      'Priority support',
    ],
    cta: 'Start Pro trial',
    href: '/auth/signup?plan=pro',
  },
  {
    name: 'Enterprise',
    monthly: 'Custom',
    annual: 'Custom',
    cadenceLabel: { monthly: 'volume + SLA', annual: 'volume + SLA' },
    blurb: 'For regulated industries, internal deployments, custom data.',
    highlight: false,
    features: [
      'Everything in Pro',
      'Self-hosted or VPC',
      'SSO (SAML · OIDC)',
      'Custom methodologies',
      'Custom factor packs',
      'Dedicated success manager',
      '99.9% uptime SLA',
      'On-prem support',
    ],
    cta: 'Talk to sales',
    href: 'mailto:sales@lcapix.io',
  },
]

const MATRIX = [
  { feature: 'Multi-method assessments', free: true, pro: true, ent: true },
  { feature: 'ISO 14040/14044 PDF export', free: true, pro: true, ent: true },
  { feature: 'Cost × impact tradeoffs', free: true, pro: true, ent: true },
  { feature: 'Projects', free: '3', pro: 'Unlimited', ent: 'Unlimited' },
  { feature: 'Components per project', free: '100', pro: 'Unlimited', ent: 'Unlimited' },
  { feature: 'Live grid carbon (Electricity Maps)', free: false, pro: true, ent: true },
  { feature: 'Regional cost (BLS · EIA)', free: false, pro: true, ent: true },
  { feature: 'Comparative cases', free: true, pro: true, ent: true },
  { feature: 'Team collaboration', free: false, pro: true, ent: true },
  { feature: 'Audit log', free: false, pro: true, ent: true },
  { feature: 'SSO (SAML · OIDC)', free: false, pro: false, ent: true },
  { feature: 'Self-hosted / VPC', free: false, pro: false, ent: true },
  { feature: 'Support', free: 'Email', pro: 'Priority', ent: 'Dedicated' },
] as const

export default function PricingPage() {
  const [cadence, setCadence] = useState<Cadence>('monthly')
  return (
    <div className="app-shell page-pricing" style={{ minHeight: '100%' }}>
      <MarketingNav />

      <section
        style={{
          padding: 'clamp(56px, 9vw, 96px) clamp(20px, 4vw, 40px) 32px',
          textAlign: 'center',
        }}
      >
        <div
          style={{ maxWidth: 760, margin: '0 auto' }}
        >
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            Pricing
          </div>
          <h1
            style={{
              margin: 0,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              letterSpacing: '-0.025em',
              lineHeight: 1.05,
              fontSize: 'clamp(2rem, 4.2vw, 3rem)',
            }}
          >
            Free to model. Pay when you need live data.
          </h1>
          <p
            style={{
              fontSize: 16,
              color: 'var(--text-secondary)',
              maxWidth: 560,
              margin: '20px auto 0',
              lineHeight: 1.55,
            }}
          >
            Most assessments fit comfortably on the Free tier. Pro unlocks
            regional grid intensity, live cost data, and team collaboration.
          </p>
        </div>
        {/* Billing toggle */}
        <div
          role="tablist"
          aria-label="Billing cadence"
          style={{
            display: 'inline-flex',
            position: 'relative',
            marginTop: 28,
            padding: 4,
            background: 'var(--surface-overlay)',
            borderRadius: 999,
            border: '1px solid var(--border-subtle)',
          }}
        >
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: 4,
              bottom: 4,
              left: cadence === 'monthly' ? 4 : '50%',
              width: 'calc(50% - 4px)',
              background: 'var(--surface-raised)',
              borderRadius: 999,
              boxShadow: '0 1px 3px rgba(15,23,42,0.10)',
              transition: 'left 280ms cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
          />
          {(['monthly', 'annual'] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={cadence === c}
              onClick={() => setCadence(c)}
              style={{
                position: 'relative',
                zIndex: 1,
                padding: '8px 22px',
                minWidth: 112,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: cadence === c ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontSize: 13,
                fontFamily: 'var(--font-ui)',
                fontWeight: cadence === c ? 600 : 500,
                transition: 'color 200ms',
                textAlign: 'center',
              }}
            >
              {c === 'monthly' ? 'Monthly' : 'Annual'}
            </button>
          ))}
        </div>
        {/* SAVE 20% chip — lives beside the toggle so the two tabs stay
            equal width and the sliding thumb tracks them correctly. */}
        <span
          className="mono"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            marginTop: 28,
            marginLeft: 12,
            fontSize: 10,
            padding: '5px 10px',
            borderRadius: 999,
            background: 'oklch(from var(--brand-primary) l c h / 0.15)',
            color: 'var(--brand-primary)',
            fontWeight: 600,
            letterSpacing: '0.08em',
            verticalAlign: 'middle',
          }}
        >
          SAVE 20% YEARLY
        </span>
      </section>

      <section style={{ padding: '24px clamp(20px, 4vw, 40px) 60px' }}>
        <div
          style={{
            maxWidth: 1120,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 20,
            alignItems: 'stretch',
          }}
        >
          {TIERS.map((t, i) => (
            <div
              key={t.name}
              className="card fade-slide-up"
              style={{
                animationDelay: `${i * 90}ms`,
                padding: 28,
                minWidth: 0,
                background: t.highlight
                  ? 'linear-gradient(180deg, var(--surface-raised) 0%, oklch(from var(--brand-primary) l c h / 0.04) 100%)'
                  : 'var(--surface-raised)',
                border: t.highlight
                  ? '1.5px solid var(--brand-primary)'
                  : '1px solid var(--border-subtle)',
                position: 'relative',
                boxShadow: t.highlight
                  ? '0 8px 28px -16px oklch(from var(--brand-primary) l c h / 0.45)'
                  : '0 1px 2px rgba(15,23,42,0.04)',
              }}
            >
              {t.highlight && (
                <span
                  className="mono"
                  style={{
                    position: 'absolute',
                    top: -14,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 10,
                    padding: '5px 12px',
                    background: 'var(--brand-gradient)',
                    color: 'var(--on-primary)',
                    borderRadius: 999,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    boxShadow:
                      '0 4px 12px -2px oklch(from var(--brand-primary) l c h / 0.35)',
                  }}
                >
                  Most popular
                </span>
              )}
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: 4,
                }}
              >
                {t.name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 18 }}>
                {t.blurb}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                <span
                  key={`${t.name}-${cadence}`}
                  className="mono fade-slide-up"
                  style={{
                    fontSize: 40,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.025em',
                    lineHeight: 1,
                  }}
                >
                  {typeof t[cadence] === 'number' ? `$${t[cadence]}` : t[cadence]}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{t.cadenceLabel[cadence]}</span>
              </div>
              <Link
                href={t.href}
                className={t.highlight ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ width: '100%', justifyContent: 'center', marginTop: 18 }}
              >
                {t.cta} {t.highlight && <Icon name="arrow-right" size={14} />}
              </Link>
              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '22px 0' }} />
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {t.features.map((f) => (
                  <li
                    key={f}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <Icon
                      name="check"
                      size={14}
                      style={{ color: 'var(--brand-primary)', marginTop: 2, flexShrink: 0 }}
                    />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          padding: '60px clamp(20px, 4vw, 40px) 120px',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            Compare plans
          </div>
          <h2 className="display display-md" style={{ margin: 0, marginBottom: 32 }}>
            Every feature, side by side.
          </h2>
          <div
            className="card"
            style={{
              padding: 0,
              overflow: 'hidden',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr',
                background: 'var(--surface-overlay)',
                padding: '14px 24px',
                fontSize: 11,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                fontWeight: 600,
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div>Feature</div>
              <div style={{ textAlign: 'center' }}>Free</div>
              <div style={{ textAlign: 'center', color: 'var(--brand-primary)' }}>Pro</div>
              <div style={{ textAlign: 'center' }}>Enterprise</div>
            </div>
            {MATRIX.map((row) => (
              <div
                key={row.feature}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr',
                  padding: '14px 24px',
                  borderTop: '1px solid var(--border-subtle)',
                  fontSize: 13,
                  alignItems: 'center',
                }}
              >
                <div style={{ color: 'var(--text-primary)' }}>{row.feature}</div>
                {[row.free, row.pro, row.ent].map((v, i) => (
                  <div
                    key={i}
                    style={{
                      textAlign: 'center',
                      color: i === 1 ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: i === 1 ? 500 : 400,
                    }}
                  >
                    {v === true ? (
                      <Icon name="check" size={14} style={{ color: 'var(--brand-primary)' }} />
                    ) : v === false ? (
                      <span style={{ color: 'var(--text-disabled, var(--text-tertiary))', opacity: 0.4 }}>
                        —
                      </span>
                    ) : (
                      <span className="mono" style={{ fontSize: 12 }}>{v}</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
