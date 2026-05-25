'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Icon } from '@/components/lcapix'
import { MarketingNav } from '@/components/lcapix/marketing-nav'

const SECTIONS = [
  {
    icon: 'play' as const,
    title: 'Getting started',
    blurb: 'Sign up, create your first project, model a hierarchy.',
    items: [
      { l: 'Quick start (5 min)', href: '/guide' },
      { l: 'Concepts: Product → Elemental Task', href: '#concepts' },
      { l: 'Importing existing LCA data', href: '#import' },
      { l: 'First assessment', href: '#first-run' },
    ],
  },
  {
    icon: 'layers' as const,
    title: 'Methodology',
    blurb: 'CML, ReCiPe, TRACI explained. When to use which.',
    items: [
      { l: 'CML 2001 — midpoint reference', href: '#cml' },
      { l: 'ReCiPe Midpoint (H)', href: '#recipe' },
      { l: 'TRACI 2.1 — US-focused', href: '#traci' },
      { l: 'Characterization factors', href: '#cf' },
      { l: 'Normalization & weighting', href: '#nw' },
    ],
  },
  {
    icon: 'dollar' as const,
    title: 'ABC costing',
    blurb: 'Activity-Based Costing applied to every flow.',
    items: [
      { l: 'Cost drivers — Labor · Energy · Material', href: '#drivers' },
      { l: 'Operational vs capital', href: '#opex-capex' },
      { l: 'Per-flow attribution', href: '#flow-attr' },
      { l: 'Region-aware cost rates', href: '#region-cost' },
    ],
  },
  {
    icon: 'database' as const,
    title: 'Data sources',
    blurb: 'openLCA, PubChem, Electricity Maps, BLS, EIA.',
    items: [
      { l: 'openLCA factor pack', href: '#openlca' },
      { l: 'PubChem substance enrichment', href: '#pubchem' },
      { l: 'Electricity Maps integration', href: '#emaps' },
      { l: 'BLS labor codes', href: '#bls' },
      { l: 'EIA energy prices', href: '#eia' },
    ],
  },
  {
    icon: 'command' as const,
    title: 'API reference',
    blurb: 'REST endpoints for projects, cases, assessments.',
    items: [
      { l: 'Authentication', href: '#auth' },
      { l: 'Projects', href: '#api-projects' },
      { l: 'Cases & components', href: '#api-cases' },
      { l: 'Run assessment', href: '#api-assess' },
      { l: 'Export PDF', href: '#api-export' },
    ],
  },
  {
    icon: 'shield' as const,
    title: 'Compliance',
    blurb: 'ISO 14040/14044 alignment, audit trails, data lineage.',
    items: [
      { l: 'ISO 14040/14044 mapping', href: '#iso' },
      { l: 'Goal & scope template', href: '#goal-scope' },
      { l: 'Data quality indicators', href: '#dqi' },
      { l: 'Audit log format', href: '#audit' },
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
  const [query, setQuery] = useState('')
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
              padding: '14px 18px',
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
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
