'use client'

// Signing out, in one place (the old top bar and the new sidebar both call it).

import { useAuthStore, useProjectStore } from '@/lib/store'
import { useNotificationsStore } from '@/lib/notifications-store'
import { useShellStore } from '@/lib/shell/use-shell'

/** Keys this browser keeps for the signed-in person; none may outlive them. */
export const SIGNED_IN_KEYS = [
  'auth_token',
  'user',
  'lcapix-projects',
  'lcapix-notifications',
  'lcapix-recent-projects',
]

export function signOut(navigate: (path: string) => void) {
  // Expire the auth cookies server-side (httpOnly ones cannot be touched
  // from JS). Fire-and-forget: local logout must not wait on the network.
  try {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', keepalive: true }).catch(() => {})
  } catch {}
  // Drop the previous person's cached projects so the next person on this
  // browser does not see them.
  useProjectStore.setState({ projects: [], currentProject: null, flows: [], nodes: [] })
  useNotificationsStore.setState({ items: [] })
  useShellStore.getState().reset()
  try {
    for (const k of SIGNED_IN_KEYS) localStorage.removeItem(k)
  } catch {}
  useAuthStore.getState().logout()
  navigate('/auth/login')
}
