'use client'

import Link from 'next/link'
import { Icon } from '@/components/lcapix'
import { MarketingNav } from '@/components/lcapix/marketing-nav'

import type { IconName } from '@/components/lcapix/icon'
import { SpotlightCard } from '@/components/lcapix/spotlight-card'

interface Capability {
  eyebrow: string
  title: string
  body: string
  icon: IconName
  facts: string[]
}

const CAPABILITIES: Capability[] = [
  {
    eyebrow: 'Process hierarchy',
    title: '5-tier model from Product → Elemental Task',
    body: 'Mirror real-world process structure with a drag-to-restructure tree. Auto-save debounced. Pastel-coded by tier so deep trees stay readable.',
    icon: 'tree',
    facts: ['Product', 'Machine/Line', 'Subprocess', 'Operation', 'Elemental Task'],
  },
  {
    eyebrow: 'Multi-method evaluation',
    title: 'CML 2001 · ReCiPe (H) · TRACI 2.1 side by side',
    body: 'Run the same bill of materials through three ISO-recognized methodologies in one click. Compare the variance, defend the number.',
    icon: 'layers',
    facts: ['CML 2001', 'ReCiPe Midpoint (H)', 'TRACI 2.1', 'CED (module)', 'IPCC GWP (module)'],
  },
  {
    eyebrow: 'Cost × impact tradeoffs',
    title: 'ABC costing fused with environmental load',
    body: 'Activity-Based Costing layered on every flow. The same canvas tells you what a 20% CO₂ cut costs — or what you save by switching aluminum to steel.',
    icon: 'dollar',
    facts: ['Labor · Energy · Material', 'Equipment · Overhead', 'Transport · Capital', 'Per-flow attribution'],
  },
  {
    eyebrow: 'Region awareness',
    title: 'Grid carbon + labor + materials by geography',
    body: 'Electricity Maps for live grid intensity. BLS for labor rates. EIA for energy prices. Switch region and everything recomputes.',
    icon: 'globe',
    facts: ['US-NY · US-CA · US-TX', 'France · Germany · UK', 'China · India', 'Global average'],
  },
  {
    eyebrow: 'ISO 14040/14044 reports',
    title: 'Source-attributed PDFs your auditor will accept',
    body: 'Goal & scope, system boundaries, data quality assessment, characterization factors — every claim traced back to its source.',
    icon: 'file',
    facts: ['Goal & scope', 'Inventory analysis', 'Impact assessment', 'Interpretation'],
  },
  {
    eyebrow: 'Open data',
    title: '5,234 factors · 1,842 PubChem substances',
    body: 'CAS-mapped provenance, openLCA-sourced factor pack, free tier. Bring your own keys for live grid/cost data when you outgrow the basics.',
    icon: 'database',
    facts: ['openLCA factor pack', 'PubChem substances', 'Electricity Maps', 'BLS · EIA'],
  },
]

export default function ProductPage() {
  return (
    <div className="app-shell page-product" style={{ minHeight: '100%' }}>
      <MarketingNav />

      <section
        style={{
          padding: '96px 64px 56px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative' }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>
            Product
          </div>
          <h1
            className="display display-lg"
            style={{ margin: 0, color: 'var(--text-primary)', maxWidth: 800 }}
          >
            Six capabilities. One browser tab.
            <br />
            <span style={{ color: 'var(--text-tertiary)' }}>No desktop install. No dongles.</span>
          </h1>
          <p
            style={{
              marginTop: 24,
              fontSize: 17,
              color: 'var(--text-secondary)',
              maxWidth: 640,
              lineHeight: 1.55,
            }}
          >
            LCAPIX is built for the practitioner — the engineer who has to defend a
            number in front of an auditor, a buyer, or a board. Everything below is
            in production today.
          </p>
        </div>
      </section>

      <section style={{ padding: '40px 64px 120px' }}>
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 24,
          }}
        >
          {CAPABILITIES.map((c, i) => (
            <SpotlightCard
              key={c.title}
              className="card card-hover fade-slide-up"
              style={{
                padding: 32,
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-subtle)',
                animationDelay: `${i * 60}ms`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    background: 'var(--brand-subtle)',
                    color: 'var(--brand-primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon name={c.icon} size={18} />
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--text-tertiary)',
                    letterSpacing: '0.01em',
                  }}
                >
                  {c.eyebrow}
                </span>
              </div>
              <h3
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  margin: 0,
                  marginBottom: 12,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.25,
                }}
              >
                {c.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  margin: 0,
                  marginBottom: 18,
                }}
              >
                {c.body}
              </p>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                }}
              >
                {c.facts.map((f) => (
                  <span
                    key={f}
                    className="mono"
                    style={{
                      fontSize: 11,
                      padding: '4px 10px',
                      background: 'var(--surface-overlay)',
                      borderRadius: 999,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </SpotlightCard>
          ))}
        </div>
      </section>

      <section
        style={{
          padding: '80px 64px 120px',
          background: 'var(--surface-overlay)',
          textAlign: 'center',
        }}
      >
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          Try it
        </div>
        <h2 className="display display-md" style={{ margin: 0, marginBottom: 28 }}>
          See it on your own process.
        </h2>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/auth/signup" className="btn btn-primary btn-lg">
            Get started free <Icon name="arrow-right" size={16} />
          </Link>
          <Link href="/pricing" className="btn btn-secondary btn-lg">
            See pricing
          </Link>
        </div>
      </section>
    </div>
  )
}
