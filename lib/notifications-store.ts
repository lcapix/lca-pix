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

const SEED: Notification[] = [
  {
    id: 'seed-1',
    kind: 'assessment',
    status: 'success',
    actor: 'You',
    text: 'Assessment completed for Painted Metal Box (CML 2001)',
    ts: Date.now() - 1000 * 60 * 4,
    read: false,
    href: '/project/1/case/1/results',
  },
  {
    id: 'seed-2',
    kind: 'edit',
    status: 'info',
    actor: 'You',
    text: 'Edited Spray Painting component',
    ts: Date.now() - 1000 * 60 * 60 * 2,
    read: false,
    href: '/project/1/case/1',
  },
  {
    id: 'seed-3',
    kind: 'project',
    status: 'info',
    actor: 'You',
    text: 'Created comparative case "Powder Coated variant"',
    ts: Date.now() - 1000 * 60 * 60 * 5,
    read: true,
    href: '/project/1',
  },
  {
    id: 'seed-4',
    kind: 'system',
    status: 'success',
    actor: 'System',
    text: 'openLCA factor pack refreshed (5,234 factors)',
    ts: Date.now() - 1000 * 60 * 60 * 26,
    read: true,
    href: '/admin/integrations',
  },
]

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
    { name: 'lcapix-notifications' },
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
