import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type NotificationKind = 'assessment' | 'edit' | 'project' | 'system' | 'comment'
export type NotificationStatus = 'success' | 'info' | 'warn' | 'error'

export interface Notification {
  id: string
  kind: NotificationKind
  status: NotificationStatus
  actor: string
  text: string
  ts: number
  read: boolean
  href?: string
}

interface NotificationsState {
  items: Notification[]
  push: (n: Omit<Notification, 'id' | 'ts' | 'read'>) => void
  markRead: (id: string) => void
  markAllRead: () => void
  clear: () => void
  unreadCount: () => number
}

// The feed shows only events the user actually caused (via push()); it starts
// empty. Demo events that never happened erode trust in every real number on
// the dashboard.
const SEED: Notification[] = []

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      items: SEED,
      push: (n) =>
        set((s) => ({
          items: [
            { ...n, id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ts: Date.now(), read: false },
            ...s.items,
          ].slice(0, 100),
        })),
      markRead: (id) =>
        set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, read: true } : it)) })),
      markAllRead: () => set((s) => ({ items: s.items.map((it) => ({ ...it, read: true })) })),
      clear: () => set({ items: [] }),
      unreadCount: () => get().items.filter((i) => !i.read).length,
    }),
    {
      name: 'lcapix-notifications',
      // v1 strips the old demo seed entries out of browsers that already
      // persisted them.
      version: 1,
      migrate: (persisted: any) => {
        if (persisted?.items) {
          persisted.items = persisted.items.filter(
            (it: Notification) => !String(it.id).startsWith('seed-'),
          )
        }
        return persisted
      },
    },
  ),
)

export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}
