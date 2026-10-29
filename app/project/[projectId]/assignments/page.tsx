'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { apiRequest } from '@/lib/api-client'

export default function AssignmentsPage() {
  const projectId = String(useParams().projectId)
  const [rows, setRows] = useState<any[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')

  const load = async () => {
    const r = await apiRequest(`/api/projects/${projectId}/assignments`)
    const d = await r.json().catch(() => ({}))
    if (!r.ok) return setError(d?.error ?? 'Could not load assignments.')
    setRows(d.assignments ?? [])
  }
  useEffect(() => { void load() }, [projectId])

  return (
    <div className="np">
      <h1 className="ds-title">Assignments</h1>
      {error && <p role="alert">{error}</p>}
      {!rows && !error && <p role="status">Loading assignments…</p>}
      <ul>
        {(rows ?? []).map((a) => (
          <li key={a.assignment_id}>
            <strong>{a.title}</strong>
            {a.due_at && <span> due {new Date(a.due_at).toLocaleString()}</span>}
            {a.instructions && <p>{a.instructions}</p>}
          </li>
        ))}
      </ul>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          const r = await apiRequest(`/api/projects/${projectId}/assignments`, { method: 'POST', body: JSON.stringify({ title }) })
          if (r.ok) { setTitle(''); void load() }
          else setError('Could not create the assignment.')
        }}
      >
        <label>Title <input className="ds-input" aria-label="Assignment title" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <button type="submit" className="ds-btn ds-btn--primary">Create assignment</button>
      </form>
    </div>
  )
}
