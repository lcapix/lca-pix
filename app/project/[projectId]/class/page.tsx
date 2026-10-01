'use client'

/**
 * The instructor's view of a project: who can see it, and how far each case got.
 *
 * Sharing has existed in the database since the beginning with no interface, so
 * an instructor could not open a student's work and a student had no way to
 * hand anything in. Progress is read from the cases themselves — lesson
 * answers, whether a run exists, whether an interpretation was written — so it
 * cannot drift from the work it describes.
 *
 * "Students see only their own case" (project.members_see_own_cases, B-A1):
 * the owner and admins switch it here; with it on, editors and viewers reach
 * only the cases they created, and each row names its author so two
 * submissions with the same name can be told apart.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { apiRequest } from '@/lib/api-client'
import { LESSONS } from '@/lib/lessons'

type Member = {
  member_id: number
  user_id: number
  username: string | null
  email: string | null
  permission_name: string | null
}

type CaseProgress = {
  case_id: number
  case_name: string
  author: string | null
  steps: number
  flows: number
  runs: number
  has_interpretation: boolean
  has_assumptions: boolean
  lessons_total: number
  lessons_answered: string[]
  prediction_made: boolean
  is_final: boolean
  updated_at: string | null
}

export default function ClassPage() {
  const params = useParams()
  const projectId = String(params.projectId)

  const [members, setMembers] = useState<Member[]>([])
  const [owner, setOwner] = useState<{ username: string | null; email: string | null } | null>(null)
  const [canManage, setCanManage] = useState(false)
  // Only the owner may grant the admin role; the API refuses anyone else (403).
  const [canManageAdmins, setCanManageAdmins] = useState(false)
  const [cases, setCases] = useState<CaseProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('viewer')
  const [adding, setAdding] = useState(false)
  const [ownOnly, setOwnOnly] = useState(false)
  const [savingOwnOnly, setSavingOwnOnly] = useState(false)

  const load = async () => {
    try {
      const [m, p] = await Promise.all([
        apiRequest(`/api/projects/${projectId}/members`),
        apiRequest(`/api/projects/${projectId}/progress`),
      ])
      const md = await m.json().catch(() => ({}))
      const pd = await p.json().catch(() => ({}))
      setMembers(Array.isArray(md?.members) ? md.members : [])
      setOwner(md?.owner ?? null)
      setCanManage(!!md?.canManage)
      setCanManageAdmins(!!md?.canManageAdmins)
      setCases(Array.isArray(pd?.cases) ? pd.cases : [])
      setOwnOnly(!!pd?.members_see_own_cases)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const add = async () => {
    if (!email.trim()) return
    setAdding(true)
    try {
      const res = await apiRequest(`/api/projects/${projectId}/members`, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), role }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error || `Could not add them (${res.status})`)
        return
      }
      toast.success(data?.updated ? 'Their access was changed' : 'Added to the project')
      setEmail('')
      await load()
    } finally {
      setAdding(false)
    }
  }

  const remove = async (userId: number) => {
    const res = await apiRequest(`/api/projects/${projectId}/members?user_id=${userId}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      toast.error(`Could not remove them (${res.status})`)
      return
    }
    await load()
  }

  const changeOwnOnly = async (next: boolean) => {
    setSavingOwnOnly(true)
    try {
      const res = await apiRequest(`/api/projects/${projectId}`, {
        method: 'PUT',
        body: JSON.stringify({ members_see_own_cases: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error || `Could not change it (${res.status})`)
        return
      }
      setOwnOnly(next)
      toast.success(next ? 'Students now see only their own case' : 'Every member sees every case again')
      await load()
    } finally {
      setSavingOwnOnly(false)
    }
  }

  const cell: React.CSSProperties = {
    padding: '8px 10px',
    fontSize: 12.5,
    borderBottom: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
  }
  const head: React.CSSProperties = { ...cell, fontWeight: 600, color: 'var(--text-secondary)' }
  const input: React.CSSProperties = {
    fontSize: 12.5,
    padding: '7px 10px',
    borderRadius: 6,
    border: '1px solid var(--border-subtle)',
    background: 'var(--surface-base)',
    color: 'var(--text-primary)',
  }

  return (
    <main id="content" style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 20px 60px' }}>
      <Link href={`/project/${projectId}`} style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
        ← Back to the project
      </Link>

      <h1 style={{ fontSize: 21, fontWeight: 680, margin: '10px 0 4px', color: 'var(--text-primary)' }}>
        Class
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 26px' }}>
        Who can open this project, and where each case stands. Nothing here is a grade: it says what
        exists in the work.
      </p>

      {canManage ? (
        <section
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
            padding: '14px 16px',
            marginBottom: 26,
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
          }}
        >
          <input
            id="own-cases-only"
            type="checkbox"
            role="switch"
            aria-checked={ownOnly}
            aria-describedby="own-cases-only-help"
            checked={ownOnly}
            disabled={loading || savingOwnOnly}
            onChange={(e) => changeOwnOnly(e.target.checked)}
            style={{
              appearance: 'none',
              flex: '0 0 auto',
              width: 36,
              height: 20,
              marginTop: 1,
              borderRadius: 999,
              cursor: 'pointer',
              background: ownOnly
                ? 'radial-gradient(circle at 26px 50%, #fff 7px, var(--primary) 7.5px)'
                : 'radial-gradient(circle at 10px 50%, #fff 7px, var(--text-tertiary) 7.5px)',
              opacity: savingOwnOnly ? 0.6 : 1,
            }}
          />
          <div>
            <label
              htmlFor="own-cases-only"
              style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}
            >
              Students see only their own case
            </label>
            <div id="own-cases-only-help" style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3 }}>
              Editors and viewers open only the cases they created; you and admins still see every case.
            </div>
          </div>
        </section>
      ) : (
        ownOnly && (
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '0 0 26px' }}>
            Each student sees only their own case in this project; the instructors see every case.
          </p>
        )
      )}

      <section style={{ marginBottom: 34 }}>
        <h2 style={{ fontSize: 15, fontWeight: 650, margin: '0 0 10px', color: 'var(--text-primary)' }}>
          People
        </h2>

        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.6fr 0.8fr auto' }}>
            <div style={head}>Name</div>
            <div style={head}>Email</div>
            <div style={head}>Access</div>
            <div style={head} />

            <div style={cell}>{owner?.username ?? '—'}</div>
            <div style={cell}>{owner?.email ?? '—'}</div>
            <div style={cell}>Owner</div>
            <div style={cell} />

            {members.map((m) => (
              <div key={m.member_id} style={{ display: 'contents' }}>
                <div style={cell}>{m.username ?? '—'}</div>
                <div style={cell}>{m.email ?? '—'}</div>
                <div style={cell}>{m.permission_name ?? 'viewer'}</div>
                <div style={cell}>
                  {canManage && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(m.user_id)}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {!loading && members.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 8 }}>
            Nobody else has been added yet.
          </div>
        )}

        {canManage && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              style={{ ...input, minWidth: 260 }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="their email address"
              aria-label="Email address"
            />
            <select style={input} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="viewer">Viewer, can read</option>
              <option value="editor">Editor, can change</option>
              {canManageAdmins && <option value="admin">Admin, can share</option>}
            </select>
            <button type="button" className="btn btn-primary btn-sm" onClick={add} disabled={adding}>
              {adding ? 'Adding…' : 'Add'}
            </button>
            <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
              They need an account already: no invitation email is sent from here.
            </span>
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 15, fontWeight: 650, margin: '0 0 10px', color: 'var(--text-primary)' }}>
          Progress
        </h2>

        {loading && <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>Loading…</div>}
        {!loading && cases.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            This project has no cases yet.
          </div>
        )}

        {cases.length > 0 && (
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.6fr 1.1fr 0.6fr 0.6fr 0.6fr 1fr 1fr 0.7fr',
              }}
            >
              <div style={head}>Case</div>
              <div style={head}>Author</div>
              <div style={head}>Steps</div>
              <div style={head}>Flows</div>
              <div style={head}>Runs</div>
              <div style={head} title="Lessons whose question was answered correctly">
                Lessons
              </div>
              <div style={head}>Write-up</div>
              <div style={head}>Hand-in</div>

              {cases.map((c) => (
                <div key={c.case_id} style={{ display: 'contents' }}>
                  <div style={cell}>
                    <Link
                      href={`/project/${projectId}/case/${c.case_id}`}
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {c.case_name}
                    </Link>
                  </div>
                  <div style={cell}>{c.author ?? '—'}</div>
                  <div style={cell}>{c.steps}</div>
                  <div style={cell}>{c.flows}</div>
                  <div style={cell}>{c.runs}</div>
                  <div style={cell} title={c.lessons_answered.map((id) => LESSONS.find((l) => l.id === id)?.title ?? id).join(', ')}>
                    {c.lessons_answered.length} of {c.lessons_total}
                    {c.prediction_made ? ' · predicted' : ''}
                  </div>
                  <div style={cell}>
                    {c.has_interpretation ? 'Interpretation' : '—'}
                    {c.has_assumptions ? ' + assumptions' : ''}
                  </div>
                  <div style={cell}>{c.is_final ? 'Yes' : '—'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
