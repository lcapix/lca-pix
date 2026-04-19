'use client'

// AppTopBar — mirrored from LCAPIX/shared.jsx lines 128-173.
// When `onNav` is not provided, falls back to Next router push using a default id→path map.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Logo } from './logo'
import { Icon } from './icon'
import { useAuthStore } from '@/lib/store'

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

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  padding: '8px 12px',
  border: 'none',
  background: 'transparent',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-ui)',
  fontSize: 13,
  cursor: 'pointer',
  borderRadius: 6,
  textAlign: 'left',
}

export function AppTopBar({ current, onNav, userInitials }: AppTopBarProps) {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const initials =
    userInitials ??
    (user?.name
      ? user.name
          .split(/\s+/)
          .map((p) => p[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()
      : user?.email?.[0]?.toUpperCase() || 'U')

  const navigate = (id: string) => {
    if (onNav) return onNav(id)
    const path = defaultRoutes[id]
    if (path) router.push(path)
  }

  const handleLogout = () => {
    try {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user')
    } catch {}
    logout()
    setMenuOpen(false)
    router.push('/auth/login')
  }

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <div
      style={{
        height: 56,
        // Opaque glass: semi-transparent white with backdrop blur so
        // content scrolls *behind* the nav cleanly (no visual bleed).
        background: 'rgba(248, 250, 248, 0.92)',
        backdropFilter: 'blur(14px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(14px) saturate(1.4)',
        borderBottom: '1px solid var(--border-subtle)',
        boxShadow: '0 1px 0 rgba(25, 28, 27, 0.04)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 12,
        position: 'sticky',
        top: 0,
        zIndex: 100,
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
      <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          type="button"
          aria-label="Account menu"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--brand-subtle)',
            color: 'var(--brand-primary)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {initials}
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="glass"
            style={{
              position: 'absolute',
              right: 0,
              top: 40,
              width: 240,
              padding: 6,
              zIndex: 100,
            }}
          >
            <div style={{ padding: '10px 12px 8px' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                {user?.name || 'Signed in'}
              </div>
              <div
                className="mono"
                style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}
              >
                {user?.email || ''}
              </div>
            </div>
            <div className="divider-tonal" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                router.push('/home')
              }}
              style={menuItemStyle}
            >
              <Icon name="box" size={14} /> Projects
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                router.push('/admin/integrations')
              }}
              style={menuItemStyle}
            >
              <Icon name="settings" size={14} /> Integrations
            </button>
            <div className="divider-tonal" />
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              style={{ ...menuItemStyle, color: 'var(--signal-error)' }}
            >
              <Icon name="x" size={14} /> Log out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
