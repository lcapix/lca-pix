'use client'

import Link from 'next/link'
import { MarketingNav } from '@/components/lcapix/marketing-nav'

interface Post {
  slug: string
  date: string
  category: string
  title: string
  excerpt: string
  readMinutes: number
}

const POSTS: Post[] = [
  {
    slug: 'recipe-vs-cml-vs-traci',
    date: 'May 18, 2026',
    category: 'Methodology',
    title: 'Why your LCA number changes by 44% across CML, ReCiPe and TRACI',
    excerpt:
      'Three ISO-recognized characterization methods, three different answers for the same bill of materials. We break down where the variance actually comes from — and why running all three is the defensible move.',
    readMinutes: 7,
  },
  {
    slug: 'cost-impact-tradeoffs',
    date: 'May 04, 2026',
    category: 'Engineering',
    title: 'Activity-Based Costing meets life cycle assessment',
    excerpt:
      'Most LCA tools treat cost as an afterthought. We fused ABC into the same canvas as environmental load so you can finally answer the question every CFO asks: what does a 20% CO₂ cut actually cost?',
    readMinutes: 9,
  },
  {
    slug: 'regional-grid-carbon',
    date: 'Apr 17, 2026',
    category: 'Data',
    title: 'Switching your assessment region shouldn’t take a week',
    excerpt:
      'A live walkthrough of how Electricity Maps + BLS + EIA feed the same component editor. Flip from US-NY to Germany and watch every characterization factor recompute.',
    readMinutes: 5,
  },
  {
    slug: 'iso-14040-pdf-export',
    date: 'Mar 28, 2026',
    category: 'Product',
    title: 'Audit-ready PDFs without the copy-paste',
    excerpt:
      'Goal & scope, system boundaries, data quality, characterization factors, every claim traced back to its source. Built for the auditor who asks where each number came from.',
    readMinutes: 6,
  },
  {
    slug: 'powder-coat-recycled-steel',
    date: 'Mar 11, 2026',
    category: 'Case study',
    title: 'A painted metal box, two scenarios, one defensible delta',
    excerpt:
      'How a real automotive supplier modeled "recycled steel + powder coat" against their virgin-steel + solvent-paint baseline — and built a board-grade story from the per-category deltas.',
    readMinutes: 8,
  },
]

export default function BlogIndexPage() {
  return (
    <div className="app-shell" style={{ minHeight: '100%' }}>
      <MarketingNav />
      <section style={{ padding: '96px 40px 48px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            BLOG
          </div>
          <h1
            className="display display-lg"
            style={{
              margin: 0,
              marginBottom: 16,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            Notes from the LCA toolchain.
          </h1>
          <p
            className="body"
            style={{
              fontSize: 16,
              color: 'var(--text-secondary)',
              lineHeight: 1.65,
              maxWidth: 640,
            }}
          >
            Methodology deep-dives, engineering write-ups, and case studies from
            teams using LCAPIX to ship products with a defensible environmental
            number.
          </p>
        </div>
      </section>

      <section style={{ padding: '24px 40px 96px' }}>
        <div style={{ maxWidth: 880, margin: '0 auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {POSTS.map((post, i) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                style={{
                  display: 'block',
                  padding: '32px 0',
                  borderTop:
                    i === 0
                      ? '1px solid var(--border-subtle)'
                      : '1px solid var(--border-subtle)',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'transform 200ms ease',
                }}
                className="blog-row"
              >
                <div
                  style={{
                    display: 'flex',
                    gap: 14,
                    alignItems: 'center',
                    marginBottom: 10,
                    fontSize: 12,
                    color: 'var(--text-tertiary)',
                  }}
                >
                  <span
                    className="eyebrow"
                    style={{ color: 'var(--brand-primary)' }}
                  >
                    {post.category}
                  </span>
                  <span>·</span>
                  <span className="mono">{post.date}</span>
                  <span>·</span>
                  <span>{post.readMinutes} min read</span>
                </div>
                <h2
                  style={{
                    margin: 0,
                    marginBottom: 10,
                    fontSize: 24,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.015em',
                    lineHeight: 1.25,
                  }}
                >
                  {post.title}
                </h2>
                <p
                  style={{
                    margin: 0,
                    fontSize: 15,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    maxWidth: 720,
                  }}
                >
                  {post.excerpt}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
