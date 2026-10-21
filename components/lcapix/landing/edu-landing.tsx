'use client'

// The public landing (F1.1). Every number on it is the sample study's own run
// (1.72 kg CO2-eq per bracket; 10. Cut blank 1.538, 89.4%), and every line
// says what the code does today (D10): no templates, approvals, published
// versions or student pricing, because none exist. A signed-in visitor goes
// to Home.

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { layoutOnLanes, TIER_COLOURS, TIER_LABEL } from '@/lib/workspace/tier-layout'
import { PixelMark } from '../shell/shell-icons'
import { UseCaseDrawing, type DrawingKind } from './use-case-drawings'

const NAV = [
  { label: 'Product', href: '/product' },
  { label: 'Methods', href: '#methods' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Docs', href: '/docs' },
  { label: 'Changelog', href: '/changelog' },
]

// The sample study's tree and its run (lib/example-case.ts; run checked in stage 5).
const SAMPLE = [
  { id: 1, parentId: null, type: 'product', name: 'Painted steel bracket', value: '1.72' },
  { id: 2, parentId: 1, type: 'machine_line', name: 'Fabrication line', value: '1.58' },
  { id: 3, parentId: 2, type: 'subprocess', name: 'Cutting', value: '1.538' },
  { id: 4, parentId: 3, type: 'operation', name: '10. Cut blank', value: '1.538' },
  { id: 5, parentId: 4, type: 'elemental_task', name: 'Shear blank', value: null },
  { id: 6, parentId: 4, type: 'elemental_task', name: 'Deburr edges', value: '0.0005' },
  { id: 7, parentId: 2, type: 'subprocess', name: 'Welding', value: '0.042' },
  { id: 8, parentId: 7, type: 'operation', name: '20. Weld tab', value: '0.042' },
  { id: 9, parentId: 1, type: 'machine_line', name: 'Coating line', value: '0.14' },
  { id: 10, parentId: 9, type: 'subprocess', name: 'Powder coating', value: '0.14' },
  { id: 11, parentId: 10, type: 'operation', name: '30. Powder coat and cure', value: '0.14' },
  { id: 12, parentId: 11, type: 'elemental_task', name: 'Spray powder', value: null },
  { id: 13, parentId: 11, type: 'elemental_task', name: 'Cure 20 min', value: null },
  { id: 14, parentId: 1, type: 'machine_line', name: 'Dispatch', value: '0' },
  { id: 15, parentId: 14, type: 'subprocess', name: 'Packing', value: '0' },
  { id: 16, parentId: 15, type: 'operation', name: '40. Pack and ship', value: '0' },
  { id: 17, parentId: 16, type: 'elemental_task', name: 'Fold and tape', value: null },
] as const

const BUILDS = [
  { name: '10. Cut blank', kg: '1.538', share: '89.4%', w: 89.4 },
  { name: '30. Powder coat and cure', kg: '0.140', share: '8.1%', w: 8.1 },
  { name: '20. Weld tab', kg: '0.042', share: '2.4%', w: 2.4 },
]

const USE_CASES: Array<{ kind: DrawingKind; fig: string; title: string; line: string }> = [
  { kind: 'metal', fig: 'FIG. 01', title: 'Metal fabrication', line: 'Cut, weld, coat. Operations and shared lines, each with its own flows.' },
  { kind: 'electronics', fig: 'FIG. 02', title: 'Electronics', line: 'Moulded parts and board assemblies, with a supplier’s declared factor where you have one.' },
  { kind: 'packaging', fig: 'FIG. 03', title: 'Packaging', line: 'From the dieline to mass per pack, board grade and the waste it leaves.' },
  { kind: 'building', fig: 'FIG. 04', title: 'Building and construction', line: 'Wall and roof build-ups, layer by layer, per m² or per building.' },
  { kind: 'food', fig: 'FIG. 05', title: 'Food and beverage', line: 'Single-use and reusable formats, compared on the same unit.' },
  { kind: 'energy', fig: 'FIG. 06', title: 'Automotive and energy', line: 'Modules and packs, from the cells to the housing.' },
]

const CHANGELOG = [
  { v: 'v3.4', date: 'May 21, 2026', title: 'Premium polish pass', tag: 'Polish' },
  { v: 'v3.3', date: 'May 18, 2026', title: 'Comparative cases follow their base case', tag: 'Feature' },
  { v: 'v3.2', date: 'May 15, 2026', title: 'API schema drift fixes', tag: 'Fix' },
]

export function EduLanding() {
  const { isAuthenticated } = useAuthStore()
  const router = useRouter()
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  useEffect(() => {
    if (hydrated && isAuthenticated) router.replace('/home')
  }, [hydrated, isAuthenticated, router])

  return (
    <div className="lp">
      <a href="#lp-main" className="ds-skip">
        Skip to content
      </a>
      <header className="lp-nav">
        <Link href="/" className="lp-logo" aria-label="LCAPIX home">
          <PixelMark size={26} />
          <span>lcapix</span>
        </Link>
        <nav aria-label="Site" className="lp-links">
          {NAV.map((n) => (
            <a key={n.label} href={n.href}>
              {n.label}
            </a>
          ))}
        </nav>
        <span style={{ flex: 1 }} />
        <Link href="/auth/login" className="lp-login">
          Log in
        </Link>
        <Link href="/auth/signup" className="lp-cta lp-cta--dark">
          Get started →
        </Link>
      </header>

      <main id="lp-main">
        <section className="lp-hero" aria-labelledby="lp-h1">
          <p className="lp-badge">
            <span>ISO 14040/44</span> Life cycle assessment for people who make things
          </p>
          <h1 id="lp-h1">Know the footprint of anything you make.</h1>
          <p className="lp-lead">Model how it’s made, attach real emission data, and get an ISO 14044 answer you can defend.</p>
          <p className="lp-actions">
            <Link href="/auth/signup" className="lp-cta">
              Get started →
            </Link>
            <a href="#worked" className="lp-cta lp-cta--ghost">
              See the worked example
            </a>
          </p>
          <AppFrame />
        </section>

        <section className="lp-section lp-tint" aria-labelledby="lp-uses">
          <div className="lp-split">
            <div>
              <p className="lp-eyebrow">Use cases · drawn to be checked</p>
              <h2 id="lp-uses">Every product, taken apart like a technical drawing.</h2>
            </div>
            <p className="lp-aside">A process tree is an exploded view: each part, each step, each flow, labelled and traceable. Six kinds of product, each as a tree.</p>
          </div>
          <ul className="lp-figs">
            {USE_CASES.map((u) => (
              <li key={u.kind}>
                <UseCaseDrawing kind={u.kind} />
                <p className="lp-fig-title">
                  <span className="ds-mono">{u.fig}</span> · {u.title.toUpperCase()}
                </p>
                <p className="lp-fig-line">{u.line}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="lp-section" aria-labelledby="lp-does">
          <p className="lp-eyebrow">What it does</p>
          <h2 id="lp-does">An assessment tool that works the way a study actually goes.</h2>
          <ul className="lp-cards">
            <Feature title="Builds the process tree with you" line="Five tiers from the product to its elemental tasks, edited on the canvas or from the keyboard.">
              <div className="lp-mini-tree">
                <span style={{ background: TIER_COLOURS.product.fill, borderColor: TIER_COLOURS.product.border }}>Painted steel bracket</span>
                <span style={{ background: TIER_COLOURS.operation.fill, borderColor: TIER_COLOURS.operation.border, marginLeft: 18 }}>10. Cut blank</span>
                <span className="lp-mini-new" style={{ marginLeft: 36 }}>
                  New operation…
                </span>
              </div>
            </Feature>
            <Feature title="Every number shows its source" line="Open any flow to see its factor, where the factor comes from, its region and the run it fed.">
              <div className="lp-mini-src">
                <span className="ds-mono" style={{ fontSize: 20, fontWeight: 600 }}>
                  1.900 <small>kg CO₂-eq/kg</small>
                </span>
                <span className="lp-tip">
                  <strong>worldsteel 2022 · Global average</strong>
                  <span>Steel, crude, global average. No US value, so the Global one is used.</span>
                </span>
              </div>
            </Feature>
            <Feature title="Reads your documents" line="Drop a routing, a bill of materials or a PDF. What it reads waits for your check before anything is saved.">
              <div className="lp-mini-doc">
                <span className="ds-mono" style={{ color: 'var(--ds-text-2)' }}>
                  bill-of-materials.csv · row 3
                </span>
                <span>
                  Steel sheet 0.80 kg → <strong>10. Cut blank</strong>
                </span>
                <span className="lp-accept">
                  <span className="ds-mono">92%</span> Matched
                </span>
              </div>
            </Feature>
            <Feature title="Explains the result" line="Magic Insights says what drives the answer and what to try next. Its numbers come from the run, never from the model.">
              <div className="lp-mini-ai">
                <p>
                  <strong>Steel in 10. Cut blank is 89% of the answer.</strong> A lighter blank would move it most.
                </p>
                <span className="ds-mono">every number checked against the run</span>
              </div>
            </Feature>
            <Feature title="What-if in one click" line="Copy a case, change one input, run it, and read the change against the base, with its sign.">
              <div className="lp-mini-whatif">
                <span className="ds-mono lp-chip">Comparative</span> Shorter cure cycle
                <span className="lp-row">
                  Global warming <b className="ds-mono">▼ 3.1% lower</b>
                </span>
                <span className="lp-row" style={{ color: 'var(--ds-text-2)' }}>
                  Cure electricity 0.40 → 0.25 kWh
                </span>
              </div>
            </Feature>
            <Feature title="Teaches as you go" line="Guided mode puts six short exercises beside the work, and the instructor sees how far each case got.">
              <div className="lp-mini-lesson">
                <span className="ds-mono" style={{ color: 'var(--ds-green)' }}>
                  EXERCISE 1 · GOAL AND SCOPE
                </span>
                <span>Which of these is a functional unit?</span>
                <span className="lp-opt">○ 0.80 kg of steel sheet</span>
                <span className="lp-opt" data-on>
                  ● One painted steel bracket, at the factory gate
                </span>
              </div>
            </Feature>
          </ul>
        </section>

        <section id="worked" className="lp-section lp-tint" aria-labelledby="lp-phases">
          <p className="lp-eyebrow">ISO 14040/44</p>
          <h2 id="lp-phases">Four phases. Always know the next one.</h2>
          <div className="lp-phases">
            <ol>
              {[
                ['Goal and scope', 'Say what you assess and where the study stops.'],
                ['Inventory', 'Every input and output, with its source.'],
                ['Impact assessment', 'Run a method; each category keeps its unit.'],
                ['Interpretation', 'The answer first, then what drives it and how sure it is.'],
              ].map(([t, d], i) => (
                <li key={t} data-on={i === 3 || undefined}>
                  <span className="ds-mono">0{i + 1}</span>
                  <span>
                    <strong>{t}</strong>
                    <span>{d}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="lp-answer-card">
              <p className="lp-answer">
                <span className="ds-mono">1.72</span> <span className="ds-mono">kg CO₂-eq per bracket</span>
              </p>
              <p style={{ margin: '4px 0 14px' }}>
                89% comes from <strong>10. Cut blank</strong>, almost all of it steel.
              </p>
              <table className="lp-builds">
                <caption className="ds-sr-only">What builds the sample study’s answer</caption>
                <tbody>
                  {BUILDS.map((b, i) => (
                    <tr key={b.name}>
                      <td className="ds-mono">{i + 1}</td>
                      <th scope="row">{b.name}</th>
                      <td aria-hidden>
                        <span className="an-bar">
                          <span style={{ width: `${b.w}%` }} />
                        </span>
                      </td>
                      <td className="ds-mono">{b.kg}</td>
                      <td className="ds-mono">{b.share}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ margin: '14px 0 0', fontSize: 14, color: 'var(--ds-text-2)' }}>The sample study every new account starts with: a painted steel bracket, TRACI 2.1, US.</p>
            </div>
          </div>
        </section>

        <section id="methods" className="lp-section" aria-labelledby="lp-methods">
          <p className="lp-eyebrow">Methods and data</p>
          <h2 id="lp-methods">Three methods, side by side.</h2>
          <ul className="lp-methods">
            {[
              ['CML 2001', 'Developed at Leiden University. Common in European studies and teaching.'],
              ['ReCiPe Midpoint (H)', 'The hierarchist perspective, with a broad set of categories. Widely used internationally.'],
              ['TRACI 2.1', 'The US EPA’s method. The usual choice for studies set in the United States.'],
            ].map(([m, d], i) => (
              <li key={m}>
                <span className="ds-mono">0{i + 1}</span>
                <strong>{m}</strong>
                <span>{d}</span>
              </li>
            ))}
          </ul>
          <p className="lp-sources">
            <span className="ds-mono">Data sources</span>
            {['openLCA', 'PubChem', 'Electricity Maps', 'EPA eGRID', 'worldsteel', 'EIA', 'BLS', 'Metals-API'].map((s) => (
              <span key={s} className="ds-mono">
                {s}
              </span>
            ))}
          </p>
        </section>

        <section className="lp-section lp-tint" aria-labelledby="lp-two">
          <p className="lp-eyebrow">Two audiences, one product</p>
          <h2 id="lp-two">The same engine, set up for how you work.</h2>
          <div className="lp-two">
            <Audience
              label="For teaching"
              mock={
                <div className="lp-mock">
                  <span style={{ fontWeight: 600 }}>Steel bracket · LCA 301</span>
                  <span className="ds-mono" style={{ color: 'var(--ds-text-2)' }}>
                    32 student cases · 23 ran · 12 wrote up · 5 ticked
                  </span>
                </div>
              }
              items={[
                'Guided mode with six exercises beside the work',
                'A finished sample study to read, in research order',
                'Students copy your base case; you see how far each got',
                'Hand-in is a tick; grades stay in your LMS',
              ]}
              more={{ label: 'Read the guide', href: '/docs' }}
            />
            <Audience
              label="For teams"
              mock={
                <div className="lp-mock">
                  <span style={{ fontWeight: 600 }}>Base case vs Shorter cure cycle</span>
                  <span className="ds-mono" style={{ color: 'var(--ds-text-2)' }}>
                    1.72 → 1.667 kg CO₂-eq · ▼ 3.1% · all four checks pass
                  </span>
                </div>
              }
              items={[
                'Routings, bills of materials and equipment lists read in',
                'Comparative cases with four fairness checks',
                'Cost beside impact, each rate with its source',
                'Exports to PDF, PowerPoint and CSV',
              ]}
              more={{ label: 'See pricing', href: '/pricing' }}
            />
          </div>
        </section>

        <section className="lp-section" aria-label="Recent changes and what you can rely on">
          <div className="lp-two">
            <div>
              <p className="lp-eyebrow">Recently shipped</p>
              <h2 className="lp-h3">From the changelog</h2>
              <ul className="lp-log">
                {CHANGELOG.map((c) => (
                  <li key={c.v}>
                    <span className="ds-mono">
                      {c.v}
                      <small>{c.date}</small>
                    </span>
                    <span style={{ flex: 1 }}>{c.title}</span>
                    <span className="lp-tag">{c.tag}</span>
                  </li>
                ))}
              </ul>
              <Link href="/changelog" className="ds-link" style={{ fontWeight: 600 }}>
                See the full changelog →
              </Link>
            </div>
            <div>
              <p className="lp-eyebrow">What you can rely on</p>
              <h2 className="lp-h3">Built to be checked</h2>
              <ul className="lp-checks">
                <li>
                  <strong>Per-project roles.</strong> Owner, admin, editor and viewer; the server checks the role on every request.
                </li>
                <li>
                  <strong>Frozen run snapshots.</strong> Every run keeps the method, region and inputs it used.
                </li>
                <li>
                  <strong>Exports name their run.</strong> A report shows one run as it was when it ran.
                </li>
                <li>
                  <strong>Provenance on every flow.</strong> The factor’s source and region travel with the number.
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="lp-band" aria-labelledby="lp-start">
          <PixelMark size={40} />
          <h2 id="lp-start">Start with the worked example.</h2>
          <p>A painted steel bracket, modelled end to end. Run it, then change it.</p>
          <p className="lp-actions">
            <Link href="/auth/signup" className="lp-cta">
              Get started →
            </Link>
            <Link href="/docs" className="lp-cta lp-cta--ghost-dark">
              Read the docs
            </Link>
          </p>
        </section>
      </main>

      <footer className="lp-foot">
        <div>
          <span className="lp-logo">
            <PixelMark size={22} />
            <span>lcapix</span>
          </span>
          <p>Life cycle assessment under ISO 14040/14044.</p>
          <p className="ds-mono" style={{ fontSize: 12 }}>
            © 2026 LCAPIX
          </p>
        </div>
        <FootCol title="Product" links={[['Product', '/product'], ['Methods', '#methods'], ['Pricing', '/pricing'], ['Changelog', '/changelog']]} />
        <FootCol title="Resources" links={[['Docs', '/docs'], ['Guide (sign in to read)', '/guide'], ['About', '/about']]} />
        <FootCol title="Legal" links={[['Privacy', '/legal/privacy'], ['Security', '/legal/security'], ['Terms', '/legal/terms']]} />
      </footer>
    </div>
  )
}

function Feature({ title, line, children }: { title: string; line: string; children: ReactNode }) {
  return (
    <li className="lp-card">
      <div className="lp-card-art" aria-hidden>
        {children}
      </div>
      <h3>{title}</h3>
      <p>{line}</p>
    </li>
  )
}

function Audience({ label, mock, items, more }: { label: string; mock: ReactNode; items: string[]; more: { label: string; href: string } }) {
  return (
    <div className="lp-aud">
      <h3 className="ds-mono">{label}</h3>
      <div aria-hidden>{mock}</div>
      <ul>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
      <Link href={more.href} className="ds-link" style={{ fontWeight: 600 }}>
        {more.label} →
      </Link>
    </div>
  )
}

function FootCol({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <nav aria-label={title}>
      <h2 className="ds-mono">{title}</h2>
      <ul>
        {links.map(([l, h]) => (
          <li key={l}>
            <a href={h}>{l}</a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * The app as it opens on the sample study's copy: the sidebar, the case header
 * and tabs, the tree on its five lanes (laid out by the workspace's own
 * layout), and the Results panel. A picture: one description for screen readers.
 */
function AppFrame() {
  const layout = layoutOnLanes(SAMPLE.map((s) => ({ id: s.id, parentId: s.parentId, type: s.type })))
  const byId = new Map<number, (typeof SAMPLE)[number]>(SAMPLE.map((s) => [s.id, s]))
  const LABEL = 170
  return (
    <figure className="lp-frame" role="img" aria-label="The sample study open in LCAPIX: a tree of 17 steps on five tiers, and Results showing 1.72 kg CO2-eq per bracket, 89% of it from 10. Cut blank.">
      <div className="lp-frame-side" aria-hidden>
        <span className="lp-logo">
          <PixelMark size={20} />
          <span>LCAPIX</span>
        </span>
        <span>Home</span>
        <span>Findings</span>
        <span>Reports</span>
        <span className="lp-frame-proj">
          Painted steel bracket <small>SAMPLE</small>
        </span>
        <span>Overview</span>
        <span data-on>Cases</span>
        <span>Compare</span>
      </div>
      <div className="lp-frame-main" aria-hidden>
        <div className="lp-frame-head">
          <span>
            <strong>Elena Rivera’s case</strong>
            <small>Copy of the Base case · 1 bracket · TRACI 2.1 · US · Run #102</small>
          </span>
          <span className="lp-frame-run">▶ Run Assessment</span>
        </div>
        <div className="lp-frame-tabs">
          <span data-on>Tree 17</span>
          <span>Inventory</span>
          <span>Results Run #102</span>
          <span>Write-up</span>
        </div>
        <div className="lp-frame-body">
          <svg viewBox={`0 0 ${layout.width + LABEL} ${layout.height}`} className="lp-frame-tree">
            {layout.lanes.map((l, i) => (
              <g key={l.tier}>
                {i % 2 === 1 && <rect x={0} y={l.y} width={layout.width + LABEL} height={l.h} fill="#f4f6f4" />}
                <rect x={14} y={l.y + 14} width={14} height={14} rx={3} fill={TIER_COLOURS[l.tier].fill} stroke={TIER_COLOURS[l.tier].border} strokeWidth={2} />
                <text x={36} y={l.y + 26} className="lp-lane">
                  {TIER_LABEL[l.tier].toUpperCase()}
                </text>
              </g>
            ))}
            <g transform={`translate(${LABEL} 0)`}>
              {layout.edges.map((e) => (
                <path key={`${e.from}-${e.to}`} d={e.path} fill="none" stroke="#9aa29d" strokeWidth={2} />
              ))}
              {layout.steps.map((s) => {
                const step = byId.get(s.id)!
                return (
                  <g key={s.id}>
                    <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={10} fill={TIER_COLOURS[s.tier].fill} stroke={TIER_COLOURS[s.tier].border} strokeWidth={2} />
                    <text x={s.x + s.w / 2} y={s.y + 28} textAnchor="middle" className="lp-node">
                      {step.name.length > 16 ? `${step.name.slice(0, 15)}…` : step.name}
                    </text>
                    {step.value && (
                      <text x={s.x + s.w / 2} y={s.y + 52} textAnchor="middle" className="lp-node-v">
                        {step.value}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          </svg>
          <div className="lp-frame-results">
            <span className="lp-frame-label">Results · Run #102</span>
            <span className="lp-frame-label" style={{ marginTop: 10 }}>
              Answer · Global warming
            </span>
            <span>
              <b className="ds-mono" style={{ fontSize: 34 }}>
                1.72
              </b>{' '}
              <small className="ds-mono">kg CO₂-eq per bracket</small>
            </span>
            <span style={{ fontSize: 12 }}>89% comes from 10. Cut blank, almost all of it steel.</span>
            <span className="lp-frame-label" style={{ marginTop: 10 }}>
              What builds this number
            </span>
            {BUILDS.map((b) => (
              <span key={b.name} className="lp-frame-build">
                <span>{b.name}</span>
                <span className="an-bar">
                  <span style={{ width: `${b.w}%` }} />
                </span>
                <span className="ds-mono">{b.kg}</span>
              </span>
            ))}
            <span className="lp-frame-label" style={{ marginTop: 10 }}>
              Where the factors come from
            </span>
            <span className="lp-frame-build">
              <span>Steel · worldsteel 2022</span>
              <span className="lp-pill lp-pill--global">Global average</span>
            </span>
            <span className="lp-frame-build">
              <span>Electricity · EPA eGRID 2023</span>
              <span className="lp-pill lp-pill--regional">Regional</span>
            </span>
          </div>
        </div>
      </div>
    </figure>
  )
}
