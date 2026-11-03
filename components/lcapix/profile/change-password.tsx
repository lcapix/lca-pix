'use client'

// Change password (Profile). Saves only on its own button, never on Enter in a
// field. The new password signs out every other browser; this one keeps going
// with the fresh token the server sends back.

import { useState } from 'react'
import { Button } from '@/components/lcapix/ds'
import { apiRequest } from '@/lib/api-client'

export function ChangePasswordCard() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      const res = await apiRequest('/api/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ current_password: current, new_password: next }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d?.error ?? `Could not change the password (the server answered ${res.status}).`)
        return
      }
      try {
        localStorage.setItem('auth_token', d.token)
      } catch {}
      setCurrent('')
      setNext('')
      setSaved(true)
    } catch (e: any) {
      setError(e?.message ?? 'Could not change the password. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const noEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') e.preventDefault()
  }

  return (
    <section className="ds-card" aria-labelledby="change-password-title" style={{ padding: 24, gridColumn: '1 / -1' }}>
      <h2 id="change-password-title" style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>
        Change password
      </h2>
      <p style={{ fontSize: 13, color: 'var(--ds-text-2)', margin: '6px 0 14px', lineHeight: 1.55 }}>
        At least 8 characters. Your other browsers are signed out; this one stays signed in. An account that signs in
        with Google has no password here.
      </p>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}>
          <span className="edu-field-label">Current password</span>
          <input className="edu-input" type="password" autoComplete="current-password" value={current} onKeyDown={noEnter} onChange={(e) => setCurrent(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}>
          <span className="edu-field-label">New password</span>
          <input className="edu-input" type="password" autoComplete="new-password" value={next} onKeyDown={noEnter} onChange={(e) => setNext(e.target.value)} />
        </label>
        <Button variant="primary" onClick={save} busy={busy} disabled={!current || next.length < 8} disabledReason={!current ? 'Enter your current password' : next.length < 8 ? 'The new password needs 8 characters' : undefined}>
          Save the new password
        </Button>
      </div>
      {error && (
        <p role="alert" className="edu-error" style={{ margin: '10px 0 0' }}>
          {error}
        </p>
      )}
      {saved && (
        <p role="status" style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--ds-green)' }}>
          Saved · new password set. Other browsers are signed out.
        </p>
      )}
    </section>
  )
}
