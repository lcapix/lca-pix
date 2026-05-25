'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AuthGuard } from '@/components/auth-guard'
import { AppTopBar } from '@/components/lcapix'

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
    <AuthGuard>
      <div className="app-shell">
        <AppTopBar current="guide" />
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
              borderRight: '1px solid var(--border-subtle)',
            }}
          >
            <div className="eyebrow" style={{ marginBottom: 14 }}>
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
                        ? 'var(--surface-raised)'
                        : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: 4,
                      color: isActive
                        ? 'var(--text-primary)'
                        : 'var(--text-secondary)',
                      fontSize: 13,
                      fontFamily: 'var(--font-ui)',
                      fontWeight: isActive ? 600 : 400,
                      borderLeft:
                        '2px solid ' +
                        (isActive ? 'var(--brand-primary)' : 'transparent'),
                      textDecoration: 'none',
                    }}
                  >
                    {t.label}
                  </Link>
                )
              })}
            </nav>
          </aside>
          <main style={{ padding: '48px 56px', maxWidth: 720 }}>
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  )
}
