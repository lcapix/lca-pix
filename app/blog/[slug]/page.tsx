'use client'

import Link from 'next/link'
import { use } from 'react'
import { notFound } from 'next/navigation'
import { MarketingNav } from '@/components/lcapix/marketing-nav'

interface Section {
  heading?: string
  body: string[]
}

interface PostBody {
  date: string
  category: string
  title: string
  lede: string
  readMinutes: number
  sections: Section[]
}

const POSTS: Record<string, PostBody> = {
  'recipe-vs-cml-vs-traci': {
    date: 'May 18, 2026',
    category: 'Methodology',
    readMinutes: 7,
    title:
      'Why your LCA number changes by 44% across CML, ReCiPe and TRACI',
    lede:
      'Three ISO-recognized characterization methods, three different answers for the same bill of materials. Here is where the variance actually comes from — and why running all three is the defensible move.',
    sections: [
      {
        heading: 'The methods are not interchangeable',
        body: [
          'CML 2001 is the original European baseline — midpoint indicators, conservative weighting, broad acceptance across European EPDs. ReCiPe Midpoint (H) ships a Hierarchist worldview with 18 categories and consensus scientific weighting. TRACI 2.1 is the US EPA method, tuned for North American grid carbon and required for federal sustainability reporting.',
          'When you run the same EV battery pack through all three, the headline GWP number can vary by 44%. That is not noise. It is the methods asking different questions.',
        ],
      },
      {
        heading: 'Where the variance comes from',
        body: [
          'Most of the spread shows up in three categories: global warming (different time horizons), photochemical oxidation (different VOC weighting), and human toxicity (different effect factors).',
          'CML uses a 100-year GWP from IPCC AR4. ReCiPe defaults to AR5 plus climate-carbon feedbacks at the Hierarchist time horizon. TRACI imports the IPCC values but adds US-specific normalization. Same emissions, different multipliers.',
        ],
      },
      {
        heading: 'What we recommend',
        body: [
          'Run all three. Report the variance alongside the number. An auditor who sees "126.82 / 72.37 / 70.36 kg CO₂-eq across CML / ReCiPe / TRACI" trusts your model more than one that hides behind a single point estimate.',
          'LCAPIX runs every assessment through all three methods in parallel — one click, three numbers, full algorithm trace. The point is not which method is correct. The point is which method your stakeholder cares about.',
        ],
      },
    ],
  },
  'cost-impact-tradeoffs': {
    date: 'May 04, 2026',
    category: 'Engineering',
    readMinutes: 9,
    title: 'Activity-Based Costing meets life cycle assessment',
    lede:
      'Most LCA tools treat cost as an afterthought. We fused ABC into the same canvas as environmental load so you can finally answer the question every CFO asks: what does a 20% CO₂ cut actually cost?',
    sections: [
      {
        heading: 'The hidden assumption in legacy tools',
        body: [
          'LCA software was built by environmental scientists, for environmental scientists. Cost lived in a separate spreadsheet, on a separate team, with separate sign-off. By the time the two numbers met, the decision had already been made.',
          'The result: sustainability teams shipped reports nobody read, and procurement teams shipped products nobody could defend.',
        ],
      },
      {
        heading: 'One canvas, two number lines',
        body: [
          'In LCAPIX every flow carries both a characterization factor and a cost driver. Labor, energy, material, equipment, overhead, transport, capital — each layered onto the same component tree. Edit the OPEX of a process and you see the impact recompute in real time. Swap a material and you see both the kg CO₂-eq and the dollar number shift together.',
        ],
      },
      {
        heading: 'The 20% question',
        body: [
          'Boards ask: "what does a 20% CO₂ cut cost us?" The tool that cannot answer that question loses the budget fight. The tool that can — with sourced data and a defensible algorithm trace — wins it.',
        ],
      },
    ],
  },
  'regional-grid-carbon': {
    date: 'Apr 17, 2026',
    category: 'Data',
    readMinutes: 5,
    title: 'Switching your assessment region shouldn’t take a week',
    lede:
      'A live walkthrough of how Electricity Maps + BLS + EIA feed the same component editor. Flip from US-NY to Germany and watch every characterization factor recompute.',
    sections: [
      {
        heading: 'Region as a first-class parameter',
        body: [
          'Most LCA models bake region assumptions into static factors. Change the geography and you re-do half the workbook. We made region a first-class field on every case — grid carbon, labor rates, material prices all pull from live integrations.',
        ],
      },
      {
        heading: 'The integrations we wired',
        body: [
          'Electricity Maps for hourly grid intensity. BLS for labor rates by occupation and metro. EIA for industrial energy prices. Metals API for commodity benchmarks. Bring your own keys when you outgrow the bundled free tier.',
        ],
      },
    ],
  },
  'iso-14040-pdf-export': {
    date: 'Mar 28, 2026',
    category: 'Product',
    readMinutes: 6,
    title: 'Audit-ready PDFs without the copy-paste',
    lede:
      'Goal & scope, system boundaries, data quality, characterization factors, every claim traced back to its source. Built for the auditor who asks where each number came from.',
    sections: [
      {
        heading: 'Source-attributed by default',
        body: [
          'Every number in an LCAPIX export carries a provenance chain. Click any value in the PDF and the algorithm trace shows you which characterization factor was applied, which integration sourced the cost, which user last edited the flow. ISO 14040/14044 reviewers love it.',
        ],
      },
    ],
  },
  'powder-coat-recycled-steel': {
    date: 'Mar 11, 2026',
    category: 'Case study',
    readMinutes: 8,
    title: 'A painted metal box, two scenarios, one defensible delta',
    lede:
      'How a real automotive supplier modeled "recycled steel + powder coat" against their virgin-steel + solvent-paint baseline — and built a board-grade story from the per-category deltas.',
    sections: [
      {
        heading: 'The setup',
        body: [
          'Base case: virgin steel sheet, solvent-based spray paint. Comparative case: 95% post-consumer recycled steel from a secondary EAF mill, electrostatic powder coating. Identical product, two manufacturing strategies.',
        ],
      },
      {
        heading: 'The result',
        body: [
          'Global warming dropped 65% on recycled steel — the biggest single lever. Powder coating cut VOC-driven smog formation 55%, but raised energy load slightly. Net story: 28% reduction in headline GWP, with auditable per-category attribution.',
        ],
      },
    ],
  },
}

const POST_INDEX = Object.entries(POSTS).map(([slug, p]) => ({
  slug,
  date: p.date,
  category: p.category,
  title: p.title,
  readMinutes: p.readMinutes,
}))

export default function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  const post = POSTS[slug]
  if (!post) {
    notFound()
  }
  const others = POST_INDEX.filter((p) => p.slug !== slug).slice(0, 3)

  return (
    <div className="app-shell" style={{ minHeight: '100%' }}>
      <MarketingNav />
      <section style={{ padding: '64px 40px 32px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Link
            href="/blog"
            style={{
              fontSize: 13,
              color: 'var(--text-tertiary)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 32,
            }}
          >
            ← All posts
          </Link>
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              fontSize: 12,
              color: 'var(--text-tertiary)',
              marginBottom: 16,
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
          <h1
            className="display"
            style={{
              margin: 0,
              marginBottom: 20,
              fontSize: 40,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              color: 'var(--text-primary)',
            }}
          >
            {post.title}
          </h1>
          <p
            style={{
              fontSize: 18,
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
              marginBottom: 40,
            }}
          >
            {post.lede}
          </p>
          {post.sections.map((sec, i) => (
            <div key={i} style={{ marginBottom: 32 }}>
              {sec.heading && (
                <h2
                  style={{
                    margin: 0,
                    marginBottom: 14,
                    fontSize: 22,
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    color: 'var(--text-primary)',
                  }}
                >
                  {sec.heading}
                </h2>
              )}
              {sec.body.map((p, j) => (
                <p
                  key={j}
                  style={{
                    margin: 0,
                    marginBottom: 14,
                    fontSize: 16,
                    lineHeight: 1.7,
                    color: 'var(--text-secondary)',
                  }}
                >
                  {p}
                </p>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: '48px 40px 96px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div
            className="eyebrow"
            style={{ marginBottom: 18, color: 'var(--text-tertiary)' }}
          >
            More reading
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {others.map((o) => (
              <Link
                key={o.slug}
                href={`/blog/${o.slug}`}
                style={{
                  padding: '20px 0',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-tertiary)',
                    display: 'flex',
                    gap: 10,
                  }}
                >
                  <span
                    className="eyebrow"
                    style={{ color: 'var(--brand-primary)' }}
                  >
                    {o.category}
                  </span>
                  <span>·</span>
                  <span>{o.date}</span>
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {o.title}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
