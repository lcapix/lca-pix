'use client'

// One public layout for the pages anyone can read (Task 9): the landing's
// header and footer around /about, /docs, /changelog, /pricing, /product and
// the legal pages. Signed in or out, the header is the same; the guide, which
// needs an account, sits inside the app's shell instead (G121).

import Link from 'next/link'
import type { ReactNode } from 'react'
import { PixelMark } from '../shell/shell-icons'

export const PUBLIC_NAV = [
  { label: 'Product', href: '/product' },
  { label: 'Methods', href: '/#methods' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Docs', href: '/docs' },
  { label: 'Changelog', href: '/changelog' },
]

export function PublicHeader() {
  return (
    <header className="lp-nav">
      <Link href="/" className="lp-logo" aria-label="LCAPIX home">
        <PixelMark size={26} />
        <span>lcapix</span>
      </Link>
      <nav aria-label="Site" className="lp-links">
        {PUBLIC_NAV.map((n) => (
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
  )
}

export function PublicFooter() {
  return (
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
      <FootCol title="Product" links={[['Product', '/product'], ['Methods', '/#methods'], ['Pricing', '/pricing'], ['Changelog', '/changelog']]} />
      <FootCol title="Resources" links={[['Docs', '/docs'], ['Guide (sign in to read)', '/guide'], ['About', '/about']]} />
      <FootCol title="Legal" links={[['Privacy', '/legal/privacy'], ['Security', '/legal/security'], ['Terms', '/legal/terms']]} />
    </footer>
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

/** A public page: the header, the page in a readable column, the footer. */
export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="lp">
      <a href="#pub-main" className="ds-skip">
        Skip to content
      </a>
      <PublicHeader />
      <main id="pub-main" className="pub-main">
        {children}
      </main>
      <PublicFooter />
    </div>
  )
}
