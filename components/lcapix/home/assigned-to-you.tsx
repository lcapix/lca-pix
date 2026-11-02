'use client'

// C08: "Assigned to you" on Home, for anyone who is a student in a project,
// someone who also runs projects of their own included. One line per
// assignment: the project, the title, when it is due, and what to do next.
// D5: one Start, and it starts: it makes (or opens) the assignment's own case
// and goes there. Someone who can only read is told why there is no Start.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/lcapix/ds'
import { apiRequest } from '@/lib/api-client'
import { relationOf, type NavProject } from '@/lib/shell/project-nav'
import { useShellStore } from '@/lib/shell/use-shell'
import { safeRunDate } from '@/lib/results/results-view'

export interface AssignedRow {
  projectId: number
  projectName: string
  ownerName: string | null
  /** The person's role in the project: a viewer cannot start. */
  role: string | null
  id: number
  title: string
  due: string | null
  hasTemplate: boolean
  myCase: number | null
  handedIn: string | null
  frozenCase: number | null
}

/** Every assignment in the projects the person is a member of (not ones they run). */
export function useAssigned(projects: NavProject[], userId: number | null): AssignedRow[] | null {
  const [rows, setRows] = useState<AssignedRow[] | null>(null)
  const asStudent = projects.filter((p) => relationOf(p, userId) === 'member')
  const key = asStudent.map((p) => p.project_id).join(',')
  useEffect(() => {
    if (!key) return setRows([])
    let live = true
    Promise.all(
      asStudent.map(async (p) => {
        const r = await apiRequest(`/api/projects/${p.project_id}/assignments`)
        const d = r.ok ? await r.json().catch(() => null) : null
        return ((d?.assignments ?? []) as any[]).map((a) => ({
          projectId: Number(p.project_id),
          projectName: p.project_name,
          ownerName: p.owner_name ?? null,
          role: p.permission_name ?? null,
          id: Number(a.assignment_id),
          title: a.title,
          due: a.due_at ?? null,
          hasTemplate: a.template_case_id != null,
          myCase: a.my_case_id == null ? null : Number(a.my_case_id),
          handedIn: a.my_submitted_at ?? null,
          frozenCase: a.my_frozen_case_id == null ? null : Number(a.my_frozen_case_id),
        }))
      }),
    )
      .then((all) => live && setRows(all.flat()))
      .catch(() => live && setRows([]))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return rows
}

export function AssignedToYou({ projects, userId, rows: given }: { projects: NavProject[]; userId: number | null; rows?: AssignedRow[] | null }) {
  const loaded = useAssigned(given === undefined ? projects : [], userId)
  const rows = given === undefined ? loaded : given
  if (!rows || !rows.length) return null
  return (
    <section aria-labelledby="assigned-h" className="ds-card ds-card-pad" style={{ margin: '12px 0' }}>
      <h2 id="assigned-h" className="ds-section-label" style={{ margin: 0 }}>
        Assigned to you · {rows.length}
      </h2>
      <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'grid', gap: 6 }}>
        {rows.map((r) => (
          <li key={`${r.projectId}-${r.id}`} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <strong>{r.title}</strong>
            <span className="np-sub">{r.projectName}</span>
            <span className="ds-mono" style={{ fontSize: 13 }}>
              {r.handedIn ? `handed in ${safeRunDate(r.handedIn)}` : r.due ? `due ${safeRunDate(r.due)}` : 'no due date'}
            </span>
            <AssignedAction row={r} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Continue (the case exists), Start (makes it, then opens it), or why neither. */
function AssignedAction({ row }: { row: AssignedRow }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (row.myCase) {
    return (
      <span style={{ display: 'inline-flex', gap: 10, flexWrap: 'wrap' }}>
        <Link className="ds-link" href={`/project/${row.projectId}/case/${row.myCase}`}>
          Continue
        </Link>
        <Link className="ds-link" href={`/project/${row.projectId}/assignments`}>
          {row.handedIn ? 'Hand in again' : 'Hand in'}
          <span className="ds-sr-only">: {row.title}</span>
        </Link>
      </span>
    )
  }
  if (row.role === 'viewer') {
    return (
      <span className="np-sub">
        You can read this project, so you cannot start it. Ask {row.ownerName ?? 'its owner'} for Can change.
      </span>
    )
  }
  if (!row.hasTemplate) return <span className="np-sub">Not ready yet: your instructor has not chosen the case to start from.</span>
  const start = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await apiRequest(`/api/assignments/${row.id}/start`, { method: 'POST', body: '{}' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d?.case_id) throw new Error(d?.error ?? `The assignment did not start (${res.status}).`)
      void useShellStore.getState().refresh()
      router.push(`/project/${row.projectId}/case/${d.case_id}`)
    } catch (e: any) {
      setError(e?.message ?? 'The assignment did not start.')
      setBusy(false)
    }
  }
  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
      <Button size="small" variant="primary" busy={busy} onClick={() => void start()}>
        Start
        <span className="ds-sr-only">: {row.title}</span>
      </Button>
      {error && (
        <span role="alert" className="edu-error">
          {error}
        </span>
      )}
    </span>
  )
}
