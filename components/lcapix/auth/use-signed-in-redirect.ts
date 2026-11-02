'use client'

// Signed in already, on Sign up or Log in (C5): browser back from Home lands
// here with a blank form, and signing up again from it would be wrong. When
// the stored session still answers, go Home instead (replace, so Back does
// not come here again). A stored session that has expired stays on the form.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

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
        if (d?.user) router.replace('/home')
        else setChecking(false)
      })
      .catch(() => live && setChecking(false))
    return () => {
      live = false
    }
  }, [router])
  return checking
}
