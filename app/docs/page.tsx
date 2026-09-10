'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Icon } from '@/components/lcapix'
import { MarketingNav } from '@/components/lcapix/marketing-nav'

// Every item links to a real guide page (no dead anchors). The professor's
// manual content lives under /guide/* — getting started, first assessment,
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
      { l: 'Normalization & weighting', href: '/guide/glossary' },
      { l: 'Impact categories', href: '/guide/glossary' },
    ],
  },
  {
    icon: 'dollar' as const,
    title: 'ABC costing',
    blurb: 'Activity-Based Costing applied to every flow.',
    items: [
      { l: 'Cost drivers — Labor · Energy · Material', href: '/guide/data-model' },
      { l: 'Operational vs capital', href: '/guide/data-model' },
      { l: 'Per-flow attribution', href: '/guide/data-model' },
      { l: 'Cost ↔ impact trade-off', href: '/guide/first-assessment' },
    ],
  },
  {
    icon: 'database' as const,
    title: 'Data sources',
    blurb: 'openLCA, PubChem, Electricity Maps, BLS, EIA.',
    items: [
      { l: 'Substance catalog & sources', href: '/guide/data-model' },
      { l: 'PubChem substance enrichment', href: '/guide/glossary' },
      { l: 'Where each number comes from', href: '/guide/faq' },
      { l: 'Reference cost rates', href: '/guide/data-model' },
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
      { l: 'Run assessment', href: '/guide/api-reference' },
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
          background: 'oklch(from var(--brand-primary) l c h / 0.18)',
          color: 'var(--brand-primary)',
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

export default function DocsPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')

  // Launch the in-app guided walkthrough. It's anchored to the dashboard, so
  // set the start flag and route to /home where <GuidedTour> auto-opens (same
  // mechanism the navbar "Tour" button uses).
  const startTour = () => {
    try {
      sessionStorage.setItem('lcapix:start-tour', '1')
    } catch {}
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
    <div className="app-shell page-docs" style={{ minHeight: '100%' }}>
      <MarketingNav />

      <section
        style={{
          padding: '96px 64px 56px',
          background:
            'linear-gradient(180deg, var(--surface-base) 0%, var(--surface-overlay) 100%)',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            Documentation
          </div>
          <h1 className="display display-lg" style={{ margin: 0 }}>
            Everything you need to ship a defensible LCA.
          </h1>
          <p
            style={{
              marginTop: 20,
              fontSize: 16,
              color: 'var(--text-secondary)',
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
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                flex: '1 1 360px',
                maxWidth: 560,
              }}
            >
              <Icon name="search" size={16} style={{ color: 'var(--text-tertiary)' }} />
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
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-ui)',
                }}
              />
              <span
                className="mono"
                style={{
                  padding: '2px 8px',
                  background: 'var(--surface-overlay)',
                  borderRadius: 4,
                  fontSize: 10,
                  color: 'var(--text-secondary)',
                }}
              >
                ⌘K
              </span>
            </div>
            {/* Guided walkthrough — opens the interactive product tour. */}
            <button
              type="button"
              onClick={startTour}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '13px 20px',
                borderRadius: 10,
                fontSize: 14,
                whiteSpace: 'nowrap',
              }}
              title="Take the interactive product walkthrough"
            >
              <Icon name="sparkle" size={16} /> Take the guided tour
            </button>
          </div>
        </div>
      </section>

      <section style={{ padding: '60px 64px 100px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {filtered.length === 0 && (
            <div
              className="card"
              style={{
                padding: 40,
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                fontSize: 14,
              }}
            >
              No docs match <strong style={{ color: 'var(--text-primary)' }}>"{query}"</strong>. Try a broader term.
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
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: 'var(--brand-subtle)',
                    color: 'var(--brand-primary)',
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
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.005em',
                  }}
                >
                  {highlight(s.title, query)}
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: 'var(--text-tertiary)',
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
                          color: 'var(--text-secondary)',
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <Icon name="arrow-right" size={11} style={{ color: 'var(--text-tertiary)' }} />
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
    </div>
  )
}
