'use client'

// Signed in already, on Sign up or Log in (C5): browser back from Home lands
// here with a blank form, and signing up again from it would be wrong. When
// the stored session still answers, go Home instead (replace, so Back does
// not come here again). A stored session that has expired stays on the form.
// The session is marked signed in first: a token whose signed-in flag was lost
// would otherwise bounce between Home and Log in for ever.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'

/** True while the stored session is being checked, so the page can say so instead of flashing the form. */
export function useSignedInRedirect(): boolean {
  const router = useRouter()
  const [checking, setChecking] = useState(false)
  useEffect(() => {
    let token: string | null = null
    try {
      token = localStorage.getItem('auth_token')
    } catch {
      token = null
    }
    if (!token) return
    let live = true
    setChecking(true)
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live) return
        if (d?.user) {
          try {
            localStorage.setItem('user', JSON.stringify(d.user))
          } catch {}
          useAuthStore.getState().login({ id: String(d.user.id), name: d.user.username, email: d.user.email, createdAt: new Date() })
          router.replace('/home')
        }
        else setChecking(false)
      })
      .catch(() => live && setChecking(false))
    return () => {
      live = false
    }
  }, [router])
  return checking
}
