'use client'

// LCAPIX Landing page — ported from LCAPIX/pages-landing.jsx.
// Preserves the auth gateway: authenticated visitors redirect to /home.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/lib/store'
import { Logo, Icon, fmtNum, type IconName } from '@/components/lcapix'
import { HeroMockup } from '@/components/lcapix/landing/hero-mockup'
import { ComparisonTable } from '@/components/lcapix/landing/comparison-table'
import { InteractiveMethodCards } from '@/components/lcapix/landing/interactive-method-cards'
import { MagneticLink } from '@/components/lcapix/magnetic-button'
import { SpotlightCard } from '@/components/lcapix/spotlight-card'

interface Faq {
  readonly q: string
  readonly a: string
}

const FAQS: readonly Faq[] = [
  {
    q: 'How is LCAPIX different from openLCA / SimaPro?',
    a: 'We run multiple evaluation methods simultaneously (CML, ReCiPe, TRACI) and show cost and environmental impact in the same view. No desktop install, no license dongles — just a browser.',
  },
  {
    q: 'Is it ISO 14040/14044 compliant?',
    a: 'Yes. Every PDF export includes goal & scope, system boundaries, data quality assessment, and source attribution for every factor used.',
  },
  {
    q: 'What evaluation methods are supported?',
    a: 'CML 2001, ReCiPe Midpoint (H), TRACI 2.1 out of the box. CED and IPCC GWP available as separate modules.',
  },
  {
    q: 'Can I import my existing LCA data?',
    a: 'Import openLCA JSON, Excel, and CSV. We map substances via CAS + PubChem so your factors keep their provenance.',
  },
  {
    q: 'Do I need API keys?',
    a: 'Free tier runs on our bundled factor pack. For live grid intensity (Electricity Maps) or regional cost (BLS/EIA) you bring your own keys.',
  },
  {
    q: "What's the free tier limit?",
    a: '3 projects, 100 components per project, unlimited assessments. Team features and audit logs on Pro.',
  },
]

interface Feature {
  readonly icon: IconName
  readonly title: string
  readonly desc: string
}

const FEATURES: readonly Feature[] = [
  { icon: 'tree', title: 'Process hierarchies', desc: '5-tier tree from Product down to Elemental Task. Drag to restructure, debounced auto-save.' },
  { icon: 'layers', title: 'Multiple methods', desc: "CML 2001, ReCiPe (H), TRACI 2.1 side by side. Same inputs, different answers — that's science." },
  { icon: 'globe', title: 'Region awareness', desc: 'Grid carbon via Electricity Maps, labor rates via BLS occupation codes. US, EU, APAC.' },
  { icon: 'dollar', title: 'Cost × impact tradeoffs', desc: 'Steel vs aluminum bracket: −32% cost, +61% CO₂. The commercial edge your engineers actually need.' },
  { icon: 'file', title: 'ISO PDF reports', desc: 'Source-attributed per factor. ISO 14040/14044 compliant. Goal & scope to interpretation.' },
  { icon: 'database', title: 'Open data', desc: '5,234 factors from openLCA + 1,842 PubChem substances. CAS-mapped provenance.' },
]

const NAV_LINKS = [
  { label: 'Product', href: '/product' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Docs', href: '/docs' },
  { label: 'Changelog', href: '/changelog' },
] as const

const STEPS = [
  { n: '01', t: 'Build tree', d: 'Model your process as Product → Machine → Subprocess → Operation → Task. Drag to restructure; auto-save debounced.' },
  { n: '02', t: 'Pick method + region', d: 'Choose CML / ReCiPe / TRACI and a grid region. Factors auto-populate from openLCA & PubChem.' },
  { n: '03', t: 'Run, compare, export', d: 'Calculate, compare scenarios, export a PDF with ISO-compliant source attribution for every factor used.' },
] as const

const FOOTER_COLS = [
  {
    t: 'Product',
    links: [
      { label: 'Features', href: '/product' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Changelog', href: '/changelog' },
    ],
  },
  {
    t: 'Resources',
    links: [
      { label: 'Docs', href: '/guide' },
      { label: 'API reference', href: '/guide/api-reference' },
      { label: 'Methodology', href: '/guide/data-model' },
      { label: 'Blog', href: '/blog' },
    ],
  },
  {
    t: 'Legal',
    links: [
      { label: 'Privacy', href: '/legal/privacy' },
      { label: 'Terms', href: '/legal/terms' },
      { label: 'Security', href: '/legal/security' },
    ],
  },
] as const

export default function RootPage() {
  const { isAuthenticated } = useAuthStore()
  const router = useRouter()
  const [hydrated, setHydrated] = useState(false)
  const [faqOpen, setFaqOpen] = useState<number>(0)

  useEffect(() => {
    setHydrated(true)
  }, [])

  // Once hydrated, if the user is authenticated, send them to /home.
  // Unauthenticated visitors stay on the landing page.
  useEffect(() => {
    if (hydrated && isAuthenticated) {
      router.replace('/home')
    }
  }, [hydrated, isAuthenticated, router])

  // Brief spinner only during the authenticated redirect to avoid flashing
  // the landing marketing page to logged-in users.
  if (hydrated && isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="app-shell landing-canvas" style={{ minHeight: '100%' }}>
      {/* Sticky nav — glass */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          height: 72,
          background: 'rgba(248, 250, 248, 0.78)',
          backdropFilter: 'blur(24px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 64px',
        }}
      >
        <Logo size={22} />
        <nav style={{ display: 'flex', gap: 4, marginLeft: 64 }}>
          {NAV_LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '8px 14px',
                color: 'var(--text-secondary)',
                fontSize: 14,
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
                fontWeight: 500,
                letterSpacing: '-0.005em',
                textDecoration: 'none',
              }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div style={{ flex: 1 }} />
        <Link href="/auth/login" className="btn btn-tertiary btn-sm">
          Log in
        </Link>
        <Link href="/auth/signup" className="btn btn-primary btn-sm" style={{ marginLeft: 12 }}>
          Sign up <Icon name="arrow-right" size={14} />
        </Link>
      </div>

      {/* Hero — Botanical atmosphere */}
      <section
        className="botanical-atmosphere"
        style={{
          position: 'relative',
          padding: '80px 64px 96px',
          overflow: 'hidden',
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: 64, alignItems: 'end' }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 28 }}>
                Built for practitioners · ISO 14040/14044
              </div>
              <h1 className="display display-lg" style={{ margin: 0, color: 'var(--text-primary)' }}>
                Built for sustainability engineers.
                <br />
                Not{' '}
                <span
                  style={{
                    color: 'var(--primary)',
                    fontStyle: 'italic',
                    fontWeight: 600,
                  }}
                >
                  greenwash
                </span>
                .
              </h1>
            </div>
            {/* Offset display number — editorial */}
            <div style={{ textAlign: 'right', paddingBottom: 12 }}>
              <div className="label-sm" style={{ color: 'var(--text-tertiary)', marginBottom: 8 }}>
                Factors indexed
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 72,
                  fontWeight: 500,
                  color: 'var(--primary)',
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                }}
              >
                5,234
              </div>
              <div className="label-sm" style={{ marginTop: 6, color: 'var(--text-tertiary)' }}>
                openLCA · PubChem · EIA
              </div>
            </div>
          </div>
          <p
            style={{
              fontSize: 18,
              color: 'var(--text-secondary)',
              maxWidth: 620,
              marginTop: 24,
              lineHeight: 1.55,
            }}
          >
            Run life-cycle assessments with cost and environmental impact in the same view. Import factors
            from openLCA, PubChem, and Electricity Maps. Export ISO-compliant PDF reports.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 32, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="cta-conic-host">
              <MagneticLink href="/auth/signup" className="btn btn-primary btn-lg">
                Get started free <Icon name="arrow-right" size={16} />
              </MagneticLink>
            </span>
            <button className="btn btn-secondary btn-lg">Book a demo</button>
          </div>
          <div
            style={{
              marginTop: 40,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              color: 'var(--text-tertiary)',
              fontSize: 13,
            }}
          >
            <div style={{ width: 32, height: 1, background: 'var(--border-subtle)' }} />
            <span>
              Used on <span style={{ color: 'var(--text-secondary)' }}>EV batteries</span> ·{' '}
              <span style={{ color: 'var(--text-secondary)' }}>Consumer products</span> ·{' '}
              <span style={{ color: 'var(--text-secondary)' }}>Industrial processes</span>
            </span>
          </div>

          {/* product screenshot mockup */}
          <div style={{ marginTop: 72, position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                inset: '-40px',
                borderRadius: 24,
                background: 'radial-gradient(ellipse at center, var(--brand-glow), transparent 60%)',
                pointerEvents: 'none',
              }}
            />
            <HeroMockup />
          </div>
        </div>
      </section>

      {/* Same input, three methods */}
      <section style={{ padding: '96px 64px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>
            Same input, three methods
          </div>
          <h2 className="display display-md" style={{ margin: 0, marginBottom: 16 }}>
            Different methods. Different answers.
            <br />
            <span style={{ color: 'var(--text-tertiary)' }}>We show you using three different methodologies.</span>
          </h2>
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: 15,
              marginBottom: 56,
              maxWidth: 560,
            }}
          >
            Same 60 kWh EV battery pack. Same bill of materials. Three ISO-recognized evaluation methods (that include valuation).
          </p>
          <InteractiveMethodCards />
        </div>
      </section>

      {/* Features — asymmetric editorial grid, tonal only */}
      <section style={{ padding: '128px 64px 96px 128px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 2fr',
              gap: 64,
              marginBottom: 80,
              alignItems: 'end',
            }}
          >
            <div>
              <div className="eyebrow" style={{ marginBottom: 16 }}>
                What's inside
              </div>
              <h2 className="display display-md" style={{ margin: 0 }}>
                Everything an LCA
                <br />
                practitioner needs.
              </h2>
            </div>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: 17,
                lineHeight: 1.55,
                margin: 0,
                paddingBottom: 8,
              }}
            >
              Six capabilities, all in one browser tab — no desktop install, no license dongles, no rainbow
              dashboards.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
            {FEATURES.map((f) => (
              <SpotlightCard key={f.title} className="card card-hover" style={{ padding: 32 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    background: 'var(--brand-subtle)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 28,
                  }}
                >
                  <Icon name={f.icon} size={22} />
                </div>
                <h3
                  style={{
                    fontSize: 17,
                    fontWeight: 600,
                    margin: 0,
                    marginBottom: 10,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {f.title}
                </h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                  {f.desc}
                </p>
              </SpotlightCard>
            ))}
          </div>
        </div>
      </section>

      {/* How it works — tonal sectioning, no connector line */}
      <section style={{ padding: '96px 64px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ marginBottom: 64 }}>
            <div className="eyebrow" style={{ marginBottom: 16 }}>
              How it works
            </div>
            <h2 className="display display-md" style={{ margin: 0 }}>
              Three steps to a defensible ISO-compliant number.
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 48 }}>
            {STEPS.map((s) => (
              <div key={s.n}>
                <div
                  className="mono"
                  style={{
                    fontSize: 64,
                    fontWeight: 500,
                    color: 'var(--primary)',
                    marginBottom: 24,
                    letterSpacing: '-0.03em',
                    lineHeight: 1,
                  }}
                >
                  {s.n}
                </div>
                <h3 className="title" style={{ margin: 0, marginBottom: 12, color: 'var(--text-primary)' }}>
                  {s.t}
                </h3>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                  {s.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section style={{ padding: '128px 64px 96px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>
            Vs the alternatives
          </div>
          <h2 className="display display-md" style={{ margin: 0, marginBottom: 48 }}>
            Pick your trade-offs.
          </h2>
          <ComparisonTable />
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '96px 64px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>
            FAQ
          </div>
          <h2 className="display display-md" style={{ margin: 0, marginBottom: 48 }}>
            Questions?
          </h2>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {FAQS.map((f, i) => (
              <div key={i} style={{ padding: '0 28px' }}>
                <button
                  onClick={() => setFaqOpen(faqOpen === i ? -1 : i)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '24px 0',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                    fontSize: 15,
                    fontWeight: 500,
                    fontFamily: 'var(--font-ui)',
                    textAlign: 'left',
                    letterSpacing: '-0.005em',
                  }}
                >
                  <span style={{ flex: 1 }}>{f.q}</span>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: faqOpen === i ? 'var(--brand-gradient)' : 'var(--surface-overlay)',
                      color: faqOpen === i ? 'var(--on-primary)' : 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      fontWeight: 500,
                      transition: 'all 200ms',
                      transform: faqOpen === i ? 'rotate(45deg)' : 'none',
                    }}
                  >
                    +
                  </span>
                </button>
                {faqOpen === i && (
                  <div
                    className="fade-in"
                    style={{
                      padding: '0 0 28px',
                      fontSize: 14,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.7,
                      maxWidth: '92%',
                    }}
                  >
                    {f.a}
                  </div>
                )}
                {i < FAQS.length - 1 && (
                  <div style={{ height: 1, background: 'var(--outline-variant)', opacity: 0.35 }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA — Veridian Light */}
      <section
        className="veridian-glow"
        style={{ padding: '120px 64px', textAlign: 'center', position: 'relative' }}
      >
        {/* Domain accent — left: LCA process-flow snippet (system → unit → result) */}
        <svg
          aria-hidden
          width="180"
          height="80"
          viewBox="0 0 180 80"
          style={{
            position: 'absolute',
            left: 64,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--brand-primary)',
            opacity: 0.32,
            pointerEvents: 'none',
          }}
        >
          <line x1="14" y1="40" x2="58" y2="40" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
          <line x1="70" y1="40" x2="116" y2="40" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
          <line x1="128" y1="40" x2="168" y2="40" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
          <rect x="2" y="34" width="12" height="12" rx="1.5" fill="currentColor" opacity="0.95" />
          <rect x="58" y="34" width="12" height="12" rx="1.5" fill="currentColor" opacity="0.65" />
          <rect x="116" y="34" width="12" height="12" rx="1.5" fill="currentColor" opacity="0.45" />
          <circle cx="174" cy="40" r="6" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        {/* Domain accent — right: tiny impact-categories bar cluster */}
        <svg
          aria-hidden
          width="120"
          height="100"
          viewBox="0 0 120 100"
          style={{
            position: 'absolute',
            right: 64,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--brand-primary)',
            opacity: 0.32,
            pointerEvents: 'none',
          }}
        >
          <line x1="10" y1="10" x2="10" y2="90" stroke="currentColor" strokeWidth="1" />
          <line x1="6" y1="20" x2="10" y2="20" stroke="currentColor" strokeWidth="1" />
          <line x1="6" y1="40" x2="10" y2="40" stroke="currentColor" strokeWidth="1" />
          <line x1="6" y1="60" x2="10" y2="60" stroke="currentColor" strokeWidth="1" />
          <line x1="6" y1="80" x2="10" y2="80" stroke="currentColor" strokeWidth="1" />
          <rect x="12" y="16" width="92" height="8" rx="1.5" fill="currentColor" opacity="0.85" />
          <rect x="12" y="36" width="64" height="8" rx="1.5" fill="currentColor" opacity="0.55" />
          <rect x="12" y="56" width="42" height="8" rx="1.5" fill="currentColor" opacity="0.35" />
          <rect x="12" y="76" width="28" height="8" rx="1.5" fill="currentColor" opacity="0.22" />
        </svg>
        <div className="eyebrow" style={{ marginBottom: 16, position: 'relative' }}>
          Ready when you are
        </div>
        <h2
          className="display display-md"
          style={{
            margin: 0,
            marginBottom: 32,
            maxWidth: 720,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          Run your first assessment
          <br />
          in the next sixty seconds.
        </h2>
        <span className="cta-conic-host">
          <MagneticLink href="/auth/signup" className="btn btn-primary btn-lg">
            Get started free <Icon name="arrow-right" size={16} />
          </MagneticLink>
        </span>
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: '56px 40px 32px',
          background: 'transparent',
          borderTop: 'none',
          position: 'relative',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr repeat(3, 1fr)',
              gap: 40,
              marginBottom: 40,
            }}
          >
            <div>
              <Logo size={20} />
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--text-tertiary)',
                  marginTop: 16,
                  maxWidth: 280,
                  lineHeight: 1.55,
                }}
              >
                Life cycle assessment for engineers who ship.
              </p>
            </div>
            {FOOTER_COLS.map((col) => (
              <div key={col.t}>
                <div className="eyebrow" style={{ marginBottom: 14 }}>
                  {col.t}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {col.links.map((l) => (
                    <Link
                      key={l.label}
                      href={l.href}
                      style={{
                        color: 'var(--text-secondary)',
                        fontSize: 13,
                        textDecoration: 'none',
                      }}
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              paddingTop: 24,
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 12,
              color: 'var(--text-tertiary)',
            }}
          >
            <div>© 2026 LCAPIX</div>
            <div style={{ display: 'flex', gap: 20 }}>
              <Link
                href="/legal/privacy"
                style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}
              >
                Privacy
              </Link>
              <Link
                href="/legal/terms"
                style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}
              >
                Terms
              </Link>
              <Link
                href="/legal/security"
                style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}
              >
                Security
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
