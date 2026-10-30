'use client'

// C08: "Assigned to you" on Home, for anyone who is a student in a project,
// someone who also runs projects of their own included. One line per
// assignment: the project, the title, when it is due, and what to do next.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiRequest } from '@/lib/api-client'
import { relationOf, type NavProject } from '@/lib/shell/project-nav'
import { safeRunDate } from '@/lib/results/results-view'

interface Row {
  projectId: number
  projectName: string
  id: number
  title: string
  due: string | null
  myCase: number | null
  handedIn: string | null
}

export function AssignedToYou({ projects, userId }: { projects: NavProject[]; userId: number | null }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  // Projects they are a member of, not ones they run: there they set assignments.
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
          id: Number(a.assignment_id),
          title: a.title,
          due: a.due_at ?? null,
          myCase: a.my_case_id == null ? null : Number(a.my_case_id),
          handedIn: a.my_submitted_at ?? null,
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
            <Link className="ds-link" href={r.myCase ? `/project/${r.projectId}/case/${r.myCase}` : `/project/${r.projectId}/assignments`}>
              {r.myCase ? 'Continue' : 'Start'}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
