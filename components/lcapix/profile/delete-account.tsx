'use client'

// Delete my account (Profile). Says first what goes: each project the person
// owns, with how many other people are in it, whose work there goes too. The
// person types their email to confirm; nothing else deletes. Their work in
// other people's projects stays there under "Deleted account".

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/lcapix/ds'
import { apiGet, apiRequest } from '@/lib/api-client'
import { signOut } from '@/lib/auth/sign-out'
import { CONTACT_EMAIL } from '@/lib/contact'

interface Owned {
  project_id: number
  project_name: string
  others: number
}

export function DeleteAccountCard({ email }: { email: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [owned, setOwned] = useState<Owned[] | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = async () => {
    setOpen(true)
    setError(null)
    try {
      setOwned((await apiGet<{ projects: Owned[] }>('/api/auth/account')).projects)
    } catch (e: any) {
      setError(e?.message ?? 'Could not read what deleting would take. Try again.')
    }
  }

  const confirmed = typed.trim().toLowerCase() === email.trim().toLowerCase()

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await apiRequest('/api/auth/account', { method: 'DELETE', body: JSON.stringify({ confirm_email: typed }) })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d?.error ?? `Could not delete the account (the server answered ${res.status}).`)
        setBusy(false)
        return
      }
      signOut((path) => router.replace(path))
    } catch (e: any) {
      setError(e?.message ?? 'Could not delete the account. Try again.')
      setBusy(false)
    }
  }

  return (
    <section className="ds-card" aria-labelledby="delete-account-title" style={{ padding: 24, gridColumn: '1 / -1', borderColor: 'var(--ds-error-line)' }}>
      <h2 id="delete-account-title" style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>
        Delete my account
      </h2>
      <p style={{ fontSize: 13, color: 'var(--ds-text-2)', margin: '6px 0 14px', lineHeight: 1.55 }}>
        Deletes your account and every project you own, with everything in them. Your work in other people&apos;s projects
        stays there, shown as &quot;Deleted account&quot;. This cannot be undone. Questions first? Email{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
      {!open ? (
        <Button onClick={start}>Delete my account…</Button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {owned === null && !error && <p style={{ margin: 0, fontSize: 13 }}>Reading your projects…</p>}
          {owned && (
            <div>
              <strong style={{ fontSize: 14 }}>
                {owned.length === 0 ? 'You own no projects, so only your account goes.' : `These ${owned.length} project${owned.length === 1 ? '' : 's'} go:`}
              </strong>
              {owned.length > 0 && (
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 14 }}>
                  {owned.map((p) => (
                    <li key={p.project_id}>
                      {p.project_name}
                      {p.others > 0 && (
                        <span style={{ color: 'var(--ds-error)' }}>
                          {' '}
                          · {p.others === 1 ? '1 other person in it loses their' : `${p.others} other people in it lose their`} work there too
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 420 }}>
            <span className="edu-field-label">Type your email, {email}, to confirm</span>
            <input className="edu-input" type="email" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </label>
          {error && (
            <p role="alert" className="edu-error" style={{ margin: 0 }}>
              {error}
            </p>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button
              variant="danger"
              onClick={remove}
              busy={busy}
              disabled={!confirmed || owned === null}
              disabledReason={!confirmed ? 'Type your email first' : undefined}
            >
              Delete my account and everything I own
            </Button>
            <Button
              onClick={() => {
                setOpen(false)
                setTyped('')
                setError(null)
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
