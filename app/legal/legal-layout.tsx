'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MarketingNav } from '@/components/lcapix/marketing-nav'

const TOC = [
  { href: '/legal/privacy', label: 'Privacy policy' },
  { href: '/legal/terms', label: 'Terms of service' },
  { href: '/legal/security', label: 'Security' },
] as const

export function LegalShell({
  eyebrow,
  title,
  effective,
  children,
}: {
  eyebrow: string
  title: string
  effective: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  return (
    <div className="app-shell" style={{ minHeight: '100%' }}>
      <MarketingNav />
      <section style={{ padding: '64px 40px 96px' }}>
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: '220px 1fr',
            gap: 64,
          }}
        >
          <aside>
            <div
              className="eyebrow"
              style={{ marginBottom: 16, color: 'var(--text-tertiary)' }}
            >
              LEGAL
            </div>
            <nav
              style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              {TOC.map((t) => {
                const active = pathname === t.href
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: 14,
                      textDecoration: 'none',
                      color: active
                        ? 'var(--brand-primary)'
                        : 'var(--text-secondary)',
                      background: active
                        ? 'var(--surface-overlay)'
                        : 'transparent',
                      fontWeight: active ? 500 : 400,
                    }}
                  >
                    {t.label}
                  </Link>
                )
              })}
            </nav>
          </aside>
          <article>
            <div
              className="eyebrow"
              style={{ marginBottom: 14, color: 'var(--brand-primary)' }}
            >
              {eyebrow}
            </div>
            <h1
              className="display"
              style={{
                margin: 0,
                marginBottom: 14,
                fontSize: 40,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: 'var(--text-primary)',
              }}
            >
              {title}
            </h1>
            <div
              className="mono"
              style={{
                fontSize: 12,
                color: 'var(--text-tertiary)',
                marginBottom: 40,
              }}
            >
              Effective {effective}
            </div>
            <div className="legal-body" style={{ maxWidth: 720 }}>
              {children}
            </div>
          </article>
        </div>
      </section>
      <style jsx global>{`
        .legal-body h2 {
          font-size: 20px;
          font-weight: 600;
          letter-spacing: -0.01em;
          color: var(--text-primary);
          margin: 32px 0 12px;
        }
        .legal-body p {
          font-size: 15px;
          line-height: 1.7;
          color: var(--text-secondary);
          margin: 0 0 14px;
        }
        .legal-body ul {
          margin: 0 0 14px;
          padding-left: 20px;
          color: var(--text-secondary);
          font-size: 15px;
          line-height: 1.7;
        }
        .legal-body li {
          margin-bottom: 6px;
        }
      `}</style>
    </div>
  )
}
