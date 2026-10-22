'use client'

// The public landing (F1.1), commercial version. Every line says what the code
// does today (D10): no ledger, bills or forecasts, because none exist yet, and
// no sample study, because the commercial version has none. Card art is
// illustration and carries no study's numbers. A signed-in visitor goes to Home.

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { TIER_COLOURS } from '@/lib/workspace/tier-layout'
import { PixelMark } from '../shell/shell-icons'

const NAV = [
  { label: 'Product', href: '/product' },
  { label: 'Methods', href: '#methods' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Docs', href: '/docs' },
  { label: 'Changelog', href: '/changelog' },
]

export function CommercialLanding() {
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
            <span>ISO 14040/44</span> Cost and carbon for manufacturers
          </p>
          <h1 id="lp-h1">Know what each thing you make costs and emits.</h1>
          <p className="lp-lead">
            Read your plant’s documents into a process tree, price each step beside its impact, and compare a change before you make it.
          </p>
          <p className="lp-actions">
            <Link href="/auth/signup" className="lp-cta">
              Get started →
            </Link>
            <a href="#does" className="lp-cta lp-cta--ghost">
              See what it does
            </a>
          </p>
        </section>

        <section id="does" className="lp-section lp-tint" aria-labelledby="lp-does">
          <p className="lp-eyebrow">What it does</p>
          <h2 id="lp-does">One tree for what a product costs and what it emits.</h2>
          <ul className="lp-cards">
            <Feature title="Reads your documents" line="Drop a routing, a bill of materials or a PDF. What it reads waits for your check before anything is saved.">
              <div className="lp-mini-doc">
                <span className="ds-mono" style={{ color: 'var(--ds-text-2)' }}>
                  bill-of-materials.csv · row 3
                </span>
                <span>
                  Steel sheet → <strong>10. Cut blank</strong>
                </span>
                <span className="lp-accept">Matched</span>
              </div>
            </Feature>
            <Feature title="Builds the process tree with you" line="Five tiers from the product to its elemental tasks, edited on the canvas or from the keyboard.">
              <div className="lp-mini-tree">
                <span style={{ background: TIER_COLOURS.product.fill, borderColor: TIER_COLOURS.product.border }}>Your product</span>
                <span style={{ background: TIER_COLOURS.operation.fill, borderColor: TIER_COLOURS.operation.border, marginLeft: 18 }}>10. Cut blank</span>
                <span className="lp-mini-new" style={{ marginLeft: 36 }}>
                  New operation…
                </span>
              </div>
            </Feature>
            <Feature title="Cost beside impact" line="Each step carries its cost next to its emissions, and every rate keeps its source.">
              <div className="lp-mini-whatif">
                <span className="lp-row">Labour rate · BLS</span>
                <span className="lp-row">Electricity price · EIA</span>
                <span className="lp-row" style={{ color: 'var(--ds-text-2)' }}>
                  Your own rate, with where it came from
                </span>
              </div>
            </Feature>
            <Feature title="Every number shows its source" line="Open any flow to see its factor, where the factor comes from, its region and the run it fed.">
              <div className="lp-mini-src">
                <span className="lp-tip">
                  <strong>Factor · source · region</strong>
                  <span>Shown on every flow, and kept with the run that used it.</span>
                </span>
              </div>
            </Feature>
            <Feature title="What-if in one click" line="Copy a case, change one input, run it, and read the change against the base, with its sign.">
              <div className="lp-mini-whatif">
                <span className="ds-mono lp-chip">Comparative</span> One change from the base case
                <span className="lp-row" style={{ color: 'var(--ds-text-2)' }}>
                  Four checks that the comparison is fair
                </span>
              </div>
            </Feature>
            <Feature title="Exports that name their run" line="PDF, PowerPoint and CSV, each showing one run as it was when it ran.">
              <div className="lp-mini-doc">
                <span className="ds-mono" style={{ color: 'var(--ds-text-2)' }}>
                  report.pdf
                </span>
                <span>One run, its method, region and inputs</span>
              </div>
            </Feature>
          </ul>
        </section>

        <section id="methods" className="lp-section" aria-labelledby="lp-methods">
          <p className="lp-eyebrow">Methods and data</p>
          <h2 id="lp-methods">Three methods, side by side.</h2>
          <ul className="lp-methods">
            {[
              ['CML 2001', 'Developed at Leiden University. Common in European studies.'],
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

        <section className="lp-section lp-tint" aria-labelledby="lp-rely">
          <p className="lp-eyebrow">What you can rely on</p>
          <h2 id="lp-rely">Built to be checked</h2>
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
        </section>

        <section className="lp-band" aria-labelledby="lp-start">
          <PixelMark size={40} />
          <h2 id="lp-start">Start from the documents you already have.</h2>
          <p>A routing, a bill of materials or an equipment list. Check what it reads, then run it.</p>
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
          <p>Cost and life cycle assessment under ISO 14040/14044.</p>
          <p className="ds-mono" style={{ fontSize: 12 }}>
            © 2026 LCAPIX
          </p>
        </div>
        <FootCol title="Product" links={[['Product', '/product'], ['Methods', '#methods'], ['Pricing', '/pricing'], ['Changelog', '/changelog']]} />
        <FootCol title="Resources" links={[['Docs', '/docs'], ['About', '/about']]} />
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
