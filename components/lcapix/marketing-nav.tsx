'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from './logo'
import { Icon } from './icon'

const NAV_LINKS = [
  { label: 'Product', href: '/product' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Docs', href: '/docs' },
  { label: 'Changelog', href: '/changelog' },
] as const

export function MarketingNav() {
  const pathname = usePathname()
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        height: 72,
        background: 'rgba(248, 250, 248, 0.78)',
        backdropFilter: 'blur(24px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 64px',
      }}
    >
      <Link href="/" style={{ textDecoration: 'none' }}>
        <Logo size={22} />
      </Link>
      <nav style={{ display: 'flex', gap: 4, marginLeft: 64 }}>
        {NAV_LINKS.map((l) => {
          const active = pathname?.startsWith(l.href)
          return (
            <Link
              key={l.label}
              href={l.href}
              style={{
                background: active ? 'var(--surface-overlay)' : 'transparent',
                padding: '8px 14px',
                borderRadius: 6,
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: 14,
                fontFamily: 'var(--font-ui)',
                fontWeight: 500,
                letterSpacing: '-0.005em',
                textDecoration: 'none',
                transition: 'background 200ms',
              }}
            >
              {l.label}
            </Link>
          )
        })}
      </nav>
      <div style={{ flex: 1 }} />
      <Link href="/auth/login" className="btn btn-tertiary btn-sm">
        Log in
      </Link>
      <Link href="/auth/signup" className="btn btn-primary btn-sm" style={{ marginLeft: 12 }}>
        Sign up <Icon name="arrow-right" size={14} />
      </Link>
    </div>
  )
}
