'use client'

import { PublicLayout } from '@/components/lcapix/landing/public-layout'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Icon } from '@/components/lcapix'
import { turnOnGuidedMode } from '@/lib/shell/use-shell'

// Every item links to a real guide page (no dead anchors). The professor's
// manual content lives under /guide/*: getting started, first assessment,
// data model, glossary, API reference, FAQ.
const SECTIONS = [
  {
    icon: 'play' as const,
    title: 'Getting started',
    blurb: 'Sign up, create your first project, model a hierarchy.',
    items: [
      { l: 'Quick start (5 min)', href: '/guide' },
      { l: 'Concepts: Product → Elemental Task', href: '/guide/data-model' },
      { l: 'Building your first hierarchy', href: '/guide/first-assessment' },
      { l: 'Running your first assessment', href: '/guide/first-assessment' },
    ],
  },
  {
    icon: 'layers' as const,
    title: 'Methodology',
    blurb: 'CML, ReCiPe, TRACI explained. When to use which.',
    items: [
      { l: 'LCIA methods (CML · ReCiPe · TRACI)', href: '/guide/glossary' },
      { l: 'Midpoint vs. endpoint', href: '/guide/glossary' },
      { l: 'Characterization factors', href: '/guide/glossary' },
      { l: 'Impact categories', href: '/guide/glossary' },
    ],
  },
  {
    icon: 'dollar' as const,
    title: 'ABC costing',
    blurb: 'Cost lines on the steps that cause them, read beside the impact.',
    items: [
      { l: 'Cost by kind and per unit of impact', href: '/guide/first-assessment' },
    ],
  },
  {
    icon: 'database' as const,
    title: 'Data sources',
    blurb: 'Where the factors and substances come from.',
    items: [
      { l: 'Substance catalog & sources', href: '/guide/data-model' },
      { l: 'Where each number comes from', href: '/guide/faq' },
    ],
  },
  {
    icon: 'command' as const,
    title: 'API reference',
    blurb: 'REST endpoints for projects, cases, assessments.',
    items: [
      { l: 'Authentication', href: '/guide/api-reference' },
      { l: 'Projects', href: '/guide/api-reference' },
      { l: 'Cases & components', href: '/guide/api-reference' },
      { l: 'Run a case', href: '/guide/api-reference' },
      { l: 'Export PDF / PowerPoint', href: '/guide/api-reference' },
    ],
  },
  {
    icon: 'shield' as const,
    title: 'Compliance',
    blurb: 'ISO 14040/14044 alignment, audit trails, data lineage.',
    items: [
      { l: 'ISO 14040/14044 mapping', href: '/guide/glossary' },
      { l: 'Goal & scope', href: '/guide/first-assessment' },
      { l: 'Common questions', href: '/guide/faq' },
      { l: 'Glossary of terms', href: '/guide/glossary' },
    ],
  },
]

// Where the data comes from: only what the app calls or ships, each checked
// against its caller (the step cost panel, the admin Integrations page, the
// factor rows' source references), with where a person meets it.
const SOURCES = [
  {
    name: 'BLS',
    full: 'US Bureau of Labor Statistics',
    what: 'Hourly wages by occupation, for the whole US or one state.',
    where: "A step's Cost view: Labor, Look up a labor rate.",
  },
  {
    name: 'EIA',
    full: 'US Energy Information Administration',
    what: 'Electricity and natural gas prices, for the whole US or one state.',
    where: "A step's Cost view: Energy, Price the energy.",
  },
  {
    name: 'Metals-API',
    full: 'Metal market prices',
    what: 'Prices per kg for aluminum, copper, zinc, nickel, lead, tin and steel.',
    where: "A step's Cost view: Material, Look up the price.",
  },
  {
    name: 'openLCA',
    full: 'CML 2001 factor set',
    what: 'The CML 2001 characterization factors, imported into the factor library.',
    where: 'Admins import it on the Integrations page.',
  },
  {
    name: 'PubChem',
    full: 'US National Library of Medicine',
    what: 'Molecular formula, molecular weight and chemical name for substances.',
    where: 'Admins run it on the Integrations page.',
  },
  {
    name: 'Factor sources',
    full: 'Behind every impact number',
    what:
      'TRACI 2.1 from the US EPA (its lciafmt tool); CML 2001, ReCiPe Midpoint (H) and TRACI 2.1 factors from openLCA; US grid electricity from EPA eGRID 2023; steel from worldsteel.',
    where: 'The factor library names the source of each factor.',
  },
]

function highlight(text: string, query: string) {
  const q = query.trim()
  if (!q) return text
  const lower = text.toLowerCase()
  const i = lower.indexOf(q.toLowerCase())
  if (i === -1) return text
  return (
    <>
      {text.slice(0, i)}
      <mark
        style={{
          background: 'oklch(from var(--ds-green) l c h / 0.18)',
          color: 'var(--ds-green)',
          padding: '0 2px',
          borderRadius: 3,
        }}
      >
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  )
}

function DocsPageBody() {
  const router = useRouter()
  const [query, setQuery] = useState('')

  // Guided mode is the app's guide (E02 to E06): turn it on, then go Home.
  const startTour = () => {
    turnOnGuidedMode()
    router.push('/home')
  }
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return SECTIONS.map((s) => ({ section: s, items: s.items }))
    return SECTIONS
      .map((s) => {
        const sectionMatch =
          s.title.toLowerCase().includes(q) || s.blurb.toLowerCase().includes(q)
        const matchedItems = s.items.filter((it) => it.l.toLowerCase().includes(q))
        if (sectionMatch || matchedItems.length > 0) {
          return { section: s, items: matchedItems.length > 0 ? matchedItems : s.items }
        }
        return null
      })
      .filter((x): x is { section: typeof SECTIONS[number]; items: typeof SECTIONS[number]['items'] } => x !== null)
  }, [query])

  return (
    <div className="page-docs" style={{ minHeight: '100%' }}>

      <section
        style={{
          padding: '96px 64px 56px',
          background:
            'linear-gradient(180deg, var(--surface-base) 0%, var(--surface-overlay) 100%)',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="ds-section-label" style={{ marginBottom: 14 }}>
            Documentation
          </div>
          <h1 className="display display-lg" style={{ margin: 0 }}>
            Everything you need to ship a defensible LCA.
          </h1>
          <p
            style={{
              marginTop: 20,
              fontSize: 16,
              color: 'var(--ds-text-2)',
              maxWidth: 640,
              lineHeight: 1.55,
            }}
          >
            Concept guides, methodology references, ABC costing primer, integration
            docs, and a complete REST API reference.
          </p>
          <div
            style={{
              marginTop: 28,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 18px',
                background: 'var(--ds-card)',
                border: '1px solid var(--ds-line)',
                borderRadius: 10,
                flex: '1 1 360px',
                maxWidth: 560,
              }}
            >
              <Icon name="search" size={16} style={{ color: 'var(--ds-text-3)' }} />
              <input
                placeholder="Search the docs…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  flex: 1,
                  fontSize: 14,
                  color: 'var(--ds-text)',
                  fontFamily: 'var(--font-ui)',
                }}
              />
              <span
                className="ds-mono"
                style={{
                  padding: '2px 8px',
                  background: 'var(--surface-overlay)',
                  borderRadius: 4,
                  fontSize: 10,
                  color: 'var(--ds-text-2)',
                }}
              >
                ⌘K
              </span>
            </div>
            {/* Guided mode: a short guide at each step of a case. */}
            <button
              type="button"
              onClick={startTour}
              className="ds-btn ds-btn--primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '13px 20px',
                borderRadius: 10,
                fontSize: 14,
                whiteSpace: 'nowrap',
              }}
              title="A short guide at each step of a case, on this device"
            >
              <Icon name="sparkle" size={16} /> Turn on Guided mode
            </button>
          </div>
        </div>
      </section>

      <section style={{ padding: '60px 64px 100px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {filtered.length === 0 && (
            <div
              className="ds-card"
              style={{
                padding: 40,
                textAlign: 'center',
                color: 'var(--ds-text-3)',
                fontSize: 14,
              }}
            >
              No docs match <strong style={{ color: 'var(--ds-text)' }}>"{query}"</strong>. Try a broader term.
            </div>
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 20,
            }}
          >
            {filtered.map(({ section: s, items }, i) => (
              <div
                key={s.title}
                className="card fade-slide-up"
                style={{
                  animationDelay: `${i * 80}ms`,
                  padding: 28,
                  background: 'var(--ds-card)',
                  border: '1px solid var(--ds-line)',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: 'var(--ds-green-wash)',
                    color: 'var(--ds-green)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 14,
                  }}
                >
                  <Icon name={s.icon} size={18} />
                </div>
                <h3
                  style={{
                    fontSize: 17,
                    fontWeight: 600,
                    margin: 0,
                    marginBottom: 6,
                    color: 'var(--ds-text)',
                    letterSpacing: '-0.005em',
                  }}
                >
                  {highlight(s.title, query)}
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: 'var(--ds-text-3)',
                    margin: 0,
                    marginBottom: 16,
                    lineHeight: 1.55,
                  }}
                >
                  {highlight(s.blurb, query)}
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map((it) => (
                    <li key={it.l}>
                      <Link
                        href={it.href}
                        style={{
                          fontSize: 13,
                          color: 'var(--ds-text-2)',
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <Icon name="arrow-right" size={11} style={{ color: 'var(--ds-text-3)' }} />
                        {highlight(it.l, query)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="docs-sources" style={{ padding: '0 64px 100px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="ds-section-label" style={{ marginBottom: 10 }}>
            Data sources
          </div>
          <h2 id="docs-sources" style={{ fontSize: 24, fontWeight: 600, margin: 0, color: 'var(--ds-text)' }}>
            Where the data comes from
          </h2>
          <p style={{ marginTop: 10, fontSize: 14, color: 'var(--ds-text-2)', maxWidth: 680, lineHeight: 1.55 }}>
            Only the sources the app really calls or ships. Prices are live when the service answers. If it does not, the
            app uses a dated reference rate and tags it Reference. Signed in, the{' '}
            <Link className="ds-link" href="/library/sources">
              Data sources
            </Link>{' '}
            page shows which of them answer live right now.
          </p>
          <ul
            aria-label="Data sources"
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '24px 0 0',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            {SOURCES.map((src) => (
              <li
                key={src.name}
                style={{ padding: 20, background: 'var(--ds-card)', border: '1px solid var(--ds-line)', borderRadius: 10 }}
              >
                <strong style={{ display: 'block', fontSize: 15, color: 'var(--ds-text)' }}>{src.name}</strong>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--ds-text-3)', marginTop: 2 }}>{src.full}</span>
                <p style={{ fontSize: 13, color: 'var(--ds-text-2)', margin: '10px 0 6px', lineHeight: 1.5 }}>{src.what}</p>
                <p style={{ fontSize: 13, color: 'var(--ds-text-2)', margin: 0, lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--ds-text-3)' }}>In the app: </span>
                  {src.where}
                </p>
              </li>
            ))}
          </ul>
          <p style={{ marginTop: 20, fontSize: 13, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              ['How the data fits together', '/guide/data-model'],
              ['API reference', '/guide/api-reference'],
              ['Factor library', '/library/factors'],
            ].map(([l, href]) => (
              <Link key={href} href={href} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 24, color: 'var(--ds-green)' }}>
                <Icon name="arrow-right" size={11} />
                {l}
              </Link>
            ))}
          </p>
        </div>
      </section>
    </div>
  )
}

/** Task 9: the public layout around the page. */
export default function DocsPage() {
  return (
    <PublicLayout>
      <DocsPageBody />
    </PublicLayout>
  )
}
