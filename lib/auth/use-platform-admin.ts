'use client'

import { useEffect, useState } from 'react'

/**
 * True once /api/auth/me says the signed-in account is a platform admin. The
 * integration page's actions are admin-only, so its nav entries stay hidden
 * until then (and on any failure).
 */
export function usePlatformAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    if (!token) return
    let cancelled = false
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setIsAdmin(d?.user?.account_type === 'admin')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return isAdmin
}
