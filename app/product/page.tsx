'use client'

import { PublicLayout } from '@/components/lcapix/landing/public-layout'
import Link from 'next/link'
import { Icon } from '@/components/lcapix'

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
    title: 'Five tiers, from Product to Elemental Task',
    body: 'Build the case as a tree of steps. Add a step under any parent, move it from its menu, and colour by tier keeps deep trees readable.',
    icon: 'tree',
    facts: ['Product', 'Machine/Line', 'Subprocess', 'Operation', 'Elemental Task'],
  },
  {
    eyebrow: 'Methods',
    title: 'CML 2001 · ReCiPe Midpoint (H) · TRACI 2.1',
    body: 'Each study picks its method, and every run records the method and region it used. Compare reads cases run the same way and says when they differ.',
    icon: 'layers',
    facts: ['CML 2001', 'ReCiPe Midpoint (H)', 'TRACI 2.1'],
  },
  {
    eyebrow: 'Cost and impact',
    title: 'Activity-based costing beside the environmental result',
    body: 'Cost lines sit on the steps that cause them, so a run shows cost by kind and cost per unit of impact next to the footprint.',
    icon: 'dollar',
    facts: ['Labor · Energy · Material', 'Equipment · Overhead', 'Transportation', 'Per-step attribution'],
  },
  {
    eyebrow: 'Region',
    title: 'Electricity by region, everything else Global',
    body: 'Electricity has factors for the United States and Europe. Any other flow uses its Global factor, and Results marks where it did.',
    icon: 'globe',
    facts: ['Global', 'United States', 'Europe (EU-27)'],
  },
  {
    eyebrow: 'ISO 14040/14044 write-up',
    title: 'Reports that show where every number comes from',
    body: 'Goal and scope, the inventory, the impact assessment and the interpretation, with each factor named by its source, exported as PDF or slides.',
    icon: 'file',
    facts: ['Goal & scope', 'Inventory analysis', 'Impact assessment', 'Interpretation'],
  },
  {
    eyebrow: 'Cited data',
    title: 'Every factor names its source',
    body: 'TRACI 2.1 comes from the US EPA (public domain). Materials carry the industry source they were published by. A number you add yourself is marked as yours.',
    icon: 'database',
    facts: ['US EPA TRACI 2.1', 'CML 2001', 'ReCiPe Midpoint (H)', 'Your own factors, marked'],
  },
]

function ProductPageBody() {
  return (
    <div className="page-product" style={{ minHeight: '100%' }}>

      <section
        style={{
          padding: '96px 64px 56px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative' }}>
          <div className="ds-section-label" style={{ marginBottom: 16 }}>
            Product
          </div>
          <h1
            className="display display-lg"
            style={{ margin: 0, color: 'var(--ds-text)', maxWidth: 800 }}
          >
            Six capabilities. One browser tab.
            <br />
            <span style={{ color: 'var(--ds-text-3)' }}>No desktop install. No dongles.</span>
          </h1>
          <p
            style={{
              marginTop: 24,
              fontSize: 17,
              color: 'var(--ds-text-2)',
              maxWidth: 640,
              lineHeight: 1.55,
            }}
          >
            LCAPIX is built for the practitioner: the engineer who has to defend a
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
                background: 'var(--ds-card)',
                border: '1px solid var(--ds-line)',
                animationDelay: `${i * 60}ms`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    background: 'var(--ds-green-wash)',
                    color: 'var(--ds-green)',
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
                    color: 'var(--ds-text-3)',
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
                  color: 'var(--ds-text)',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.25,
                }}
              >
                {c.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: 'var(--ds-text-2)',
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
                    className="ds-mono"
                    style={{
                      fontSize: 11,
                      padding: '4px 10px',
                      background: 'var(--surface-overlay)',
                      borderRadius: 999,
                      color: 'var(--ds-text-2)',
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
        <div className="ds-section-label" style={{ marginBottom: 12 }}>
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

/** Task 9: the public layout around the page. */
export default function ProductPage() {
  return (
    <PublicLayout>
      <ProductPageBody />
    </PublicLayout>
  )
}
