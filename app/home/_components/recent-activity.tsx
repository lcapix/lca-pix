'use client'

// Sidebar: recent activity from the notifications store.

import { StatusDot } from '@/components/lcapix'
import { useNotificationsStore, formatRelativeTime } from '@/lib/notifications-store'

export function RecentActivity() {
  return (
    <aside
      className="home-sidebar"
      style={{
        flex: '0 0 300px',
        padding: '40px 28px 40px 0',
        borderLeft: '1px solid var(--border-subtle)',
        paddingLeft: 28,
      }}
    >
      <div
        className="eyebrow"
        style={{
          marginBottom: 18,
          color: 'var(--text-tertiary)',
          fontSize: 11,
          letterSpacing: '0.16em',
          fontWeight: 600,
          textTransform: 'uppercase',
        }}
      >
        RECENT ACTIVITY
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <RecentActivityFeed />
      </div>
    </aside>
  )
}

function RecentActivityFeed() {
  const items = useNotificationsStore((s) => s.items)
  const list = items.length > 0 ? items.slice(0, 7) : []
  if (list.length === 0) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
        No activity yet.
      </div>
    )
  }
  return (
    <>
      {list.map((n) => (
        <div
          key={n.id}
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}
        >
          <div style={{ marginTop: 5 }}>
            <StatusDot status={n.status} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-primary)',
                lineHeight: 1.45,
              }}
            >
              <span style={{ fontWeight: 500 }}>{n.actor}</span>{' '}
              <span style={{ color: 'var(--text-secondary)' }}>{n.text}</span>
            </div>
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: 'var(--text-tertiary)',
                marginTop: 2,
              }}
            >
              {formatRelativeTime(n.ts)}
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
