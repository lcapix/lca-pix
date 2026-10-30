'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SignedIn } from '@/components/lcapix/shell/signed-in'

export const TOC: readonly { slug: string; label: string }[] = [
  { slug: '', label: 'Getting started' },
  { slug: 'data-model', label: 'Data model' },
  { slug: 'first-assessment', label: 'First assessment' },
  { slug: 'glossary', label: 'Glossary' },
  { slug: 'faq', label: 'FAQ' },
  { slug: 'api-reference', label: 'API reference' },
] as const

export default function GuideLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname() || '/guide'
  return (
    // G121: signed in, the guide sits inside the app's shell: one nav on every signed-in page.
    <SignedIn>
      <div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '240px 1fr',
            maxWidth: 1200,
            margin: '0 auto',
            minHeight: 800,
          }}
        >
          <aside
            style={{
              padding: '32px 16px',
              borderRight: '1px solid var(--ds-line)',
            }}
          >
            <div className="ds-section-label" style={{ marginBottom: 14 }}>
              DOCS
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {TOC.map((t) => {
                const href = t.slug ? `/guide/${t.slug}` : '/guide'
                const isActive =
                  pathname === href ||
                  (href === '/guide' && pathname === '/guide')
                return (
                  <Link
                    key={t.slug || 'root'}
                    href={href}
                    style={{
                      padding: '8px 12px',
                      textAlign: 'left',
                      background: isActive
                        ? 'var(--ds-row-selected)'
                        : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: 4,
                      color: isActive
                        ? 'var(--ds-text)'
                        : 'var(--ds-text-2)',
                      fontSize: 13,
                      fontFamily: 'var(--ds-font)',
                      fontWeight: isActive ? 600 : 400,
                      borderLeft:
                        '2px solid ' +
                        (isActive ? 'var(--ds-green)' : 'transparent'),
                      textDecoration: 'none',
                    }}
                  >
                    {t.label}
                  </Link>
                )
              })}
            </nav>
          </aside>
          <div className="guide-body" style={{ padding: '32px 40px', maxWidth: 720 }}>
            {children}
          </div>
        </div>
      </div>
    </SignedIn>
  )
}
