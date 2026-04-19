'use client'

// AppTopBar — mirrored from LCAPIX/shared.jsx lines 128-173.
// When `onNav` is not provided, falls back to Next router push using a default id→path map.

import { useRouter } from 'next/navigation'
import { Logo } from './logo'
import { Icon } from './icon'

export interface AppTopBarProps {
  current?: string
  onNav?: (id: string) => void
  userInitials?: string
}

const defaultRoutes: Record<string, string> = {
  home: '/home',
  library: '/home',
  integrations: '/admin/integrations',
  guide: '/guide',
}

const links: { id: string; label: string }[] = [
  { id: 'home', label: 'Projects' },
  { id: 'library', label: 'Library' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'guide', label: 'Docs' },
]

export function AppTopBar({ current, onNav, userInitials = 'KP' }: AppTopBarProps) {
  const router = useRouter()
  const navigate = (id: string) => {
    if (onNav) return onNav(id)
    const path = defaultRoutes[id]
    if (path) router.push(path)
  }

  return (
    <div
      style={{
        height: 56,
        background: 'var(--surface-base)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 12,
        position: 'sticky',
        top: 0,
        zIndex: 50,
        flexWrap: 'nowrap',
        minWidth: 0,
      }}
    >
      <div style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => navigate('home')}>
        <Logo size={18} />
      </div>
      <nav style={{ display: 'flex', gap: 2, marginLeft: 4, flexShrink: 0 }}>
        {links.map((l) => (
          <button
            key={l.id}
            onClick={() => navigate(l.id)}
            style={{
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              padding: '6px 10px',
              borderRadius: 6,
              fontSize: 13,
              fontFamily: 'var(--font-ui)',
              color: current === l.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: current === l.id ? 500 : 400,
              background: current === l.id ? 'var(--surface-raised)' : 'transparent',
            }}
          >
            {l.label}
          </button>
        ))}
      </nav>
      <div style={{ flex: 1, minWidth: 8 }} />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 6,
          padding: '0 8px',
          height: 30,
          fontSize: 12,
          color: 'var(--text-tertiary)',
          cursor: 'pointer',
          width: 160,
          flexShrink: 1,
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        <Icon name="search" size={13} />
        <span
          style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
          }}
        >
          Search…
        </span>
        <span
          className="mono"
          style={{
            padding: '1px 5px',
            background: 'var(--surface-overlay)',
            borderRadius: 3,
            fontSize: 10,
            color: 'var(--text-secondary)',
            flexShrink: 0,
          }}
        >
          ⌘K
        </span>
      </div>
      <button
        className="btn btn-ghost btn-sm"
        aria-label="notifications"
        style={{ flexShrink: 0, padding: 6 }}
      >
        <Icon name="bell" size={15} />
      </button>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'var(--brand-subtle)',
          color: 'var(--brand-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 600,
          fontSize: 13,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {userInitials}
      </div>
    </div>
  )
}
