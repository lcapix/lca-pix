'use client'

// Breadcrumb — mirrored from LCAPIX/shared.jsx lines 176-191
// When an item has `page` but no `onClick`, falls back to Next router push.

import { Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from './icon'

export interface BreadcrumbItem {
  label: string
  page?: string
  onClick?: () => void
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[]
  onNav?: (page: string) => void
}

const defaultRoutes: Record<string, string> = {
  home: '/home',
  library: '/home',
  integrations: '/admin/integrations',
  guide: '/guide',
}

export function Breadcrumb({ items, onNav }: BreadcrumbProps) {
  const router = useRouter()
  const handle = (it: BreadcrumbItem) => {
    if (it.onClick) return it.onClick()
    if (!it.page) return
    if (onNav) return onNav(it.page)
    const path = defaultRoutes[it.page] ?? it.page
    router.push(path)
  }

  return (
    <div
      // Sticky so the breadcrumb stays visible as the page scrolls. The 56px
      // top offset matches the AppTopBar height so they sit flush. A soft
      // backdrop-blur + translucent surface keeps content underneath from
      // bleeding through the breadcrumb row.
      style={{
        // NON-sticky: the breadcrumb scrolls away with the page. Making it
        // sticky caused the prominent page title (the first content element)
        // to clip under it on any small scroll, which read as broken. The
        // persistent chrome is the top nav (which stays sticky); the
        // breadcrumb is contextual and scrolls with content. This is the
        // standard, premium-feeling behaviour.
        display: 'flex',
        alignItems: 'center',
        padding: '14px 32px 4px',
        fontSize: 13,
        color: 'var(--text-tertiary)',
        gap: 6,
        background: 'transparent',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      {items.map((it, i) => (
        <Fragment key={i}>
          {i > 0 && <Icon name="chevron-right" size={12} style={{ opacity: 0.5 }} />}
          {it.onClick || it.page ? (
            <button
              onClick={() => handle(it)}
              style={{
                background: 'none',
                border: 'none',
                color:
                  i === items.length - 1
                    ? 'var(--text-primary)'
                    : 'var(--text-tertiary)',
                cursor: 'pointer',
                fontSize: 13,
                padding: 0,
                fontFamily: 'var(--font-ui)',
              }}
            >
              {it.label}
            </button>
          ) : (
            <span
              style={{
                color:
                  i === items.length - 1
                    ? 'var(--text-primary)'
                    : 'var(--text-tertiary)',
              }}
            >
              {it.label}
            </span>
          )}
        </Fragment>
      ))}
    </div>
  )
}
