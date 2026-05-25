'use client'

// AppTopBar — mirrored from LCAPIX/shared.jsx lines 128-173.
// When `onNav` is not provided, falls back to Next router push using a default id→path map.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Logo } from './logo'
import { Icon } from './icon'
import { useAuthStore } from '@/lib/store'
import { useNotificationsStore, formatRelativeTime } from '@/lib/notifications-store'

export interface AppTopBarProps {
  current?: string
  onNav?: (id: string) => void
  userInitials?: string
}

const defaultRoutes: Record<string, string> = {
  home: '/home',
  integrations: '/admin/integrations',
  guide: '/guide',
}

const links: { id: string; label: string }[] = [
  { id: 'home', label: 'Projects' },
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
  const [notifOpen, setNotifOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const notifications = useNotificationsStore((s) => s.items)
  const markRead = useNotificationsStore((s) => s.markRead)
  const markAllRead = useNotificationsStore((s) => s.markAllRead)
  const unreadCount = notifications.filter((n) => !n.read).length

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

  useEffect(() => {
    if (!notifOpen) return
    const onClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotifOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [notifOpen])

  return (
    <div
      style={{
        height: 56,
        // Fully opaque background — no blur, no transparency. Content
        // that scrolls under the nav must be completely hidden, not
        // just softly blurred. Using the solid token for light-mode
        // parity with the rest of the shell.
        background: '#f8faf8',
        borderBottom: '1px solid var(--border-subtle)',
        boxShadow: '0 2px 12px -6px rgba(25, 28, 27, 0.08)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 12,
        position: 'sticky',
        top: 0,
        // z-index 1000 beats any card/modal/overlay on the page below
        // (the page's highest was 50; we pick 1000 for future-proofing
        // against any dialog or tooltip that might otherwise clip).
        zIndex: 1000,
        flexWrap: 'nowrap',
        minWidth: 0,
      }}
    >
      <style>{`
        .lcapix-nav-btn {
          position: relative;
          border: none;
          cursor: pointer;
          white-space: nowrap;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-family: var(--font-ui);
          color: var(--text-secondary);
          font-weight: 450;
          background: transparent;
          transition: background-color 180ms ease, color 180ms ease, transform 120ms ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .lcapix-nav-btn > span:first-child {
          position: relative;
          z-index: 1;
          pointer-events: none;
        }
        .lcapix-nav-btn:hover {
          color: var(--text-primary);
          background: color-mix(in oklab, var(--brand-primary) 10%, transparent);
          transform: translateY(-1px);
        }
        .lcapix-nav-btn:active {
          transform: translateY(0) scale(0.94);
          background: color-mix(in oklab, var(--brand-primary) 18%, transparent);
        }
        .lcapix-nav-btn:focus-visible {
          outline: 2px solid color-mix(in oklab, var(--brand-primary) 40%, transparent);
          outline-offset: 2px;
        }
        .lcapix-nav-btn[data-active="true"] {
          color: var(--text-primary);
          font-weight: 600;
          background: color-mix(in oklab, var(--brand-primary) 12%, transparent);
        }
        .lcapix-nav-underline {
          position: absolute;
          left: 14px;
          right: 14px;
          bottom: 2px;
          height: 2px;
          border-radius: 2px;
          background: var(--brand-primary);
          transform-origin: center;
          transform: scaleX(0);
          opacity: 0;
          transition: transform 220ms cubic-bezier(.2,.7,.2,1), opacity 180ms ease;
          pointer-events: none;
        }
        .lcapix-nav-btn:hover .lcapix-nav-underline {
          transform: scaleX(0.6);
          opacity: 0.7;
        }
        .lcapix-nav-btn[data-active="true"] .lcapix-nav-underline {
          transform: scaleX(1);
          opacity: 1;
        }
        @keyframes lcapixNavPulse {
          0%   { box-shadow: 0 0 0 0 color-mix(in oklab, var(--brand-primary) 35%, transparent); }
          100% { box-shadow: 0 0 0 8px color-mix(in oklab, var(--brand-primary) 0%, transparent); }
        }
        .lcapix-nav-btn[data-active="true"] {
          animation: lcapixNavPulse 600ms ease-out;
        }
      `}</style>
      <div style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => navigate('home')}>
        <Logo size={18} />
      </div>
      <nav
        style={{
          display: 'flex',
          gap: 4,
          marginLeft: 4,
          flexShrink: 0,
          alignItems: 'center',
        }}
      >
        {links.map((l) => {
          const active = current === l.id
          return (
            <button
              key={l.id}
              onClick={() => navigate(l.id)}
              className="lcapix-nav-btn"
              data-active={active ? 'true' : 'false'}
            >
              <span>{l.label}</span>
              <span className="lcapix-nav-underline" />
            </button>
          )
        })}
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
      <div ref={notifRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-label="notifications"
          onClick={() => setNotifOpen((o) => !o)}
          style={{ position: 'relative', padding: 6 }}
        >
          <Icon name="bell" size={15} />
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                minWidth: 14,
                height: 14,
                padding: '0 4px',
                borderRadius: 7,
                background: 'var(--signal-error, #ef4444)',
                color: 'white',
                fontSize: 9,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        {notifOpen && (
          <div
            role="menu"
            style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 6px)',
              width: 340,
              maxHeight: 460,
              overflow: 'auto',
              background: 'var(--surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              boxShadow: 'var(--shadow-lg)',
              zIndex: 80,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 12px',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600 }}>Notifications</span>
              <div style={{ flex: 1 }} />
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 11,
                    color: 'var(--brand-primary)',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <div style={{ padding: 24, fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                No notifications yet.
              </div>
            ) : (
              notifications.slice(0, 12).map((n) => {
                // Sensible default route if the notification was seeded before hrefs existed.
                const fallbackHref =
                  n.kind === 'assessment'
                    ? '/project/1/case/1/results'
                    : n.kind === 'edit'
                    ? '/project/1/case/1'
                    : n.kind === 'project'
                    ? '/project/1'
                    : n.kind === 'system'
                    ? '/admin/integrations'
                    : '/home'
                const target = n.href ?? fallbackHref
                return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    markRead(n.id)
                    setNotifOpen(false)
                    router.push(target)
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    display: 'flex',
                    gap: 10,
                    padding: '10px 12px',
                    background: n.read ? 'transparent' : 'oklch(from var(--brand-primary) l c h / 0.06)',
                    border: 'none',
                    borderBottom: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      marginTop: 6,
                      flexShrink: 0,
                      background:
                        n.status === 'success'
                          ? 'var(--signal-success, #22c55e)'
                          : n.status === 'warn'
                          ? 'var(--signal-warn, #f59e0b)'
                          : n.status === 'error'
                          ? 'var(--signal-error, #ef4444)'
                          : 'var(--brand-primary)',
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-primary)',
                        marginBottom: 2,
                        lineHeight: 1.4,
                      }}
                    >
                      <strong style={{ fontWeight: 600 }}>{n.actor}</strong> {n.text}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                      {formatRelativeTime(n.ts)}
                    </div>
                  </div>
                </button>
                )
              })
            )}
          </div>
        )}
      </div>
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
