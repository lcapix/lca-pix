'use client'

// Assignments (C06, C07). An instructor (the owner or an admin) sets each one:
// a title, instructions, a due date and the template case students copy, and
// reads who started and who handed in, opening each frozen hand-in. A student
// with Can change starts their own copy, works in it, and hands it in: Hand in
// freezes a read-only copy with its write-up, and can be repeated until the
// due date. Someone who can only read is told how to get started.

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Button, Callout, Card, ConfirmDialog, EmptyState, ErrorCard, SectionLabel } from '@/components/lcapix/ds'
import { apiRequest } from '@/lib/api-client'
import { isProjectRole, projectCapabilities } from '@/lib/project-role'
import { useProjectCases } from '@/lib/project/use-project-cases'
import { useShellStore } from '@/lib/shell/use-shell'
import { safeRunDate } from '@/lib/results/results-view'

interface Assignment {
  assignment_id: number
  title: string
  instructions: string | null
  due_at: string | null
  template_case_id: number | null
  my_case_id: number | null
  my_frozen_case_id: number | null
  my_submitted_at: string | null
}

interface Submission {
  account_id: number
  full_name: string | null
  email: string
  working_case_id: number | null
  frozen_case_id: number | null
  run_id: number | null
  submitted_at: string | null
  status: string
}

/** A due date as the datetime-local field reads it ("2026-11-03T17:00"). */
const toLocalInput = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function AssignmentsPage() {
  const projectId = Number(useParams().projectId)
  const router = useRouter()
  const { data: project, error: projectError } = useProjectCases(projectId)
  const [rows, setRows] = useState<Assignment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Assignment | 'new' | null>(null)

  const load = useCallback(async () => {
    const r = await apiRequest(`/api/projects/${projectId}/assignments`)
    const d = await r.json().catch(() => ({}))
    if (!r.ok) return setError(d?.error ?? `The assignments did not load (${r.status}).`)
    setError(null)
    setRows(d.assignments ?? [])
  }, [projectId])
  useEffect(() => {
    void load()
  }, [load])

  if (projectError || error) return <ErrorCard title="The assignments did not load" cause={projectError ?? error} onRetry={() => void load()} />
  if (!project || !rows) return <p role="status">Loading the assignments…</p>

  const role = isProjectRole(project.project.my_role) ? project.project.my_role : null
  const caps = projectCapabilities(role)
  // A template is one of the project's own cases, never a student's working or handed-in copy.
  const templates = project.cases.filter((c: any) => !c.assignment_id && !Number(c.read_only))
  const nameOf = (id: number | null) => project.cases.find((c) => c.case_id === id)?.case_name ?? null

  return (
    <div className="np" style={{ display: 'grid', gap: 16 }}>
      <header className="pc-head">
        <div style={{ flex: 1, minWidth: 260 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ds-text-2)' }}>{project.project.project_name}</p>
          <h1 className="ds-title" style={{ margin: '2px 0 0' }}>
            Assignments
          </h1>
        </div>
        {caps.canManage && editing === null && (
          <Button variant="primary" onClick={() => setEditing('new')}>
            + New assignment
          </Button>
        )}
      </header>

      {!caps.canEdit && (
        <Callout tone="info" lead="You can read this project.">
          To start an assignment you need Can change. Ask the project&apos;s owner.
        </Callout>
      )}

      {caps.canManage && editing !== null && (
        <AssignmentForm
          projectId={projectId}
          initial={editing === 'new' ? null : editing}
          templates={templates.map((c) => ({ id: c.case_id, name: c.case_name, type: c.case_type }))}
          onDone={() => {
            setEditing(null)
            void load()
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {rows.length === 0 ? (
        <EmptyState line={caps.canManage ? 'No assignments yet. Make one: a title, what to do, a due date and the case students start from.' : 'No assignments in this project yet.'} />
      ) : (
        <ul aria-label="Assignments" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
          {rows.map((a) => (
            <li key={a.assignment_id}>
              <AssignmentCard
                a={a}
                templateName={nameOf(a.template_case_id)}
                projectId={projectId}
                manage={caps.canManage}
                canStart={caps.canEdit}
                onEdit={() => setEditing(a)}
                onChanged={() => void load()}
                openCase={(id) => router.push(`/project/${projectId}/case/${id}`)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AssignmentForm({
  projectId,
  initial,
  templates,
  onDone,
  onCancel,
}: {
  projectId: number
  initial: Assignment | null
  templates: Array<{ id: number; name: string; type: string }>
  onDone: () => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [instructions, setInstructions] = useState(initial?.instructions ?? '')
  const [due, setDue] = useState(toLocalInput(initial?.due_at ?? null))
  const [template, setTemplate] = useState<string>(String(initial?.template_case_id ?? templates.find((t) => t.type === 'base')?.id ?? ''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return setError('Give the assignment a title.')
    setBusy(true)
    setError(null)
    const body = {
      title: title.trim(),
      instructions: instructions.trim(),
      due_at: due ? new Date(due).toISOString() : null,
      template_case_id: template ? Number(template) : null,
    }
    const res = initial
      ? await apiRequest(`/api/assignments/${initial.assignment_id}`, { method: 'PUT', body: JSON.stringify(body) })
      : await apiRequest(`/api/projects/${projectId}/assignments`, { method: 'POST', body: JSON.stringify(body) })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setError(d?.error ?? `Not saved (${res.status}).`)
    onDone()
  }

  return (
    <form className="ds-card ds-card-pad" onSubmit={(e) => void save(e)} aria-labelledby="assign-form-h" style={{ display: 'grid', gap: 10, maxWidth: 720 }}>
      <SectionLabel as="h2" id="assign-form-h">
        {initial ? 'Change the assignment' : 'New assignment'}
      </SectionLabel>
      <label className="np-field">
        <span className="edu-field-label">Title</span>
        <input className="ds-input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="np-field">
        <span className="edu-field-label">Instructions</span>
        <textarea className="ds-input" rows={4} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      </label>
      <label className="np-field">
        <span className="edu-field-label">Due</span>
        <input className="ds-input" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
      </label>
      <label className="np-field">
        <span className="edu-field-label">Students start from</span>
        <select className="ds-input" value={template} onChange={(e) => setTemplate(e.target.value)}>
          <option value="">Choose a case</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.type === 'base' ? ' (base case)' : ''}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="edu-error">
          {error}
        </p>
      )}
      <span style={{ display: 'flex', gap: 8 }}>
        <Button type="submit" variant="primary" busy={busy}>
          {initial ? 'Save' : 'Create assignment'}
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </span>
    </form>
  )
}

function AssignmentCard({
  a,
  templateName,
  projectId,
  manage,
  canStart,
  onEdit,
  onChanged,
  openCase,
}: {
  a: Assignment
  templateName: string | null
  projectId: number
  manage: boolean
  canStart: boolean
  onEdit: () => void
  onChanged: () => void
  openCase: (id: number) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<'handin' | 'delete' | null>(null)
  const [showSubs, setShowSubs] = useState(false)
  const past = a.due_at ? new Date(a.due_at).getTime() < Date.now() : false

  const call = async (path: string, init: RequestInit) => {
    setBusy(true)
    setError(null)
    try {
      const res = await apiRequest(path, init)
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d?.error ?? `Not done (${res.status}).`)
        return null
      }
      return d
    } finally {
      setBusy(false)
    }
  }
  const start = async () => {
    const d = await call(`/api/assignments/${a.assignment_id}/start`, { method: 'POST', body: '{}' })
    // A new working case: the sidebar's Cases count follows (1.9 on this path too).
    if (d?.case_id) void useShellStore.getState().refresh()
    if (d?.case_id) openCase(Number(d.case_id))
  }
  const handIn = async () => {
    setConfirm(null)
    const d = await call(`/api/assignments/${a.assignment_id}/submit`, { method: 'POST', body: '{}' })
    if (d) onChanged()
  }
  const remove = async () => {
    setConfirm(null)
    const d = await call(`/api/assignments/${a.assignment_id}`, { method: 'DELETE' })
    if (d) onChanged()
  }

  return (
    <Card as="article">
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <h2 className="ds-title" style={{ margin: 0, fontSize: 20, flex: 1, minWidth: 200 }}>
          {a.title}
        </h2>
        <span className="ds-mono" style={{ fontSize: 13, color: past ? 'var(--ds-warn)' : 'var(--ds-text-2)' }}>
          {a.due_at ? `${past ? 'Was due' : 'Due'} ${safeRunDate(a.due_at)}` : 'No due date'}
        </span>
      </div>
      {a.instructions ? <p style={{ whiteSpace: 'pre-wrap' }}>{a.instructions}</p> : <p className="np-sub">No instructions written.</p>}
      <p className="np-sub" style={{ margin: 0 }}>Starts from: {templateName ?? 'no case chosen yet'}</p>

      {!manage && canStart && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
          {a.my_case_id ? (
            <Link className="ds-btn" href={`/project/${projectId}/case/${a.my_case_id}`}>
              Continue my case
            </Link>
          ) : (
            <Button variant="primary" busy={busy} disabledReason={a.template_case_id ? undefined : 'Your instructor has not chosen a case yet'} onClick={() => void start()}>
              Start
            </Button>
          )}
          {a.my_case_id && (
            <Button variant="primary" busy={busy} disabledReason={a.my_submitted_at && past ? 'The due date has passed' : undefined} onClick={() => setConfirm('handin')}>
              {a.my_submitted_at ? 'Hand in again' : 'Hand in'}
            </Button>
          )}
          {a.my_submitted_at && (
            <span>
              Handed in {safeRunDate(a.my_submitted_at)}.{' '}
              {a.my_frozen_case_id && (
                <Link className="ds-link" href={`/project/${projectId}/case/${a.my_frozen_case_id}`}>
                  Open what you handed in
                </Link>
              )}
            </span>
          )}
        </div>
      )}

      {manage && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <Button aria-expanded={showSubs} onClick={() => setShowSubs((v) => !v)}>
            {showSubs ? 'Hide hand-ins' : 'Hand-ins'}
          </Button>
          <Button onClick={onEdit}>Change</Button>
          <Button variant="danger-quiet" onClick={() => setConfirm('delete')}>
            Delete
          </Button>
        </div>
      )}
      {manage && showSubs && <Submissions assignmentId={a.assignment_id} projectId={projectId} />}
      {error && (
        <p role="alert" className="edu-error">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={confirm === 'handin'}
        title="Hand in this case?"
        consequence={`A read-only copy of your case and its write-up goes to your instructor.${a.due_at ? ` You can hand in again until ${safeRunDate(a.due_at)}.` : ''}`}
        confirmLabel="Hand in"
        danger={false}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void handIn()}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title="Delete this assignment?"
        consequence="The assignment goes. Students' cases stay in the project."
        confirmLabel="Delete assignment"
        onCancel={() => setConfirm(null)}
        onConfirm={() => void remove()}
      />
    </Card>
  )
}

/** C07: every student's status, their working case and what they handed in. */
function Submissions({ assignmentId, projectId }: { assignmentId: number; projectId: number }) {
  const [rows, setRows] = useState<Submission[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    apiRequest(`/api/assignments/${assignmentId}/submissions`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d?.error ?? `error ${r.status}`)
        if (live) setRows(d.submissions ?? [])
      })
      .catch((e) => live && setError(e?.message ?? 'the hand-ins did not load'))
    return () => {
      live = false
    }
  }, [assignmentId])
  if (error) return <ErrorCard title="The hand-ins did not load" cause={error} />
  if (!rows) return <p role="status">Loading the hand-ins…</p>
  if (!rows.length) return <p className="np-sub">No students in this project yet. Add them on People.</p>
  return (
    <div className="ds-table-wrap" style={{ marginTop: 12 }}>
      <table className="ds-table" aria-label="Hand-ins">
        <thead>
          <tr>
            <th scope="col">Student</th>
            <th scope="col">Status</th>
            <th scope="col">Working case</th>
            <th scope="col">Handed in</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.account_id}>
              <td>
                {s.full_name || s.email}
                {/* Two students can share a name: the email tells them apart. */}
                {s.full_name && <span style={{ display: 'block', fontSize: 12, color: 'var(--ds-text-2)' }}>{s.email}</span>}
              </td>
              <td>{s.status}</td>
              <td>
                {s.working_case_id ? (
                  <Link className="ds-link" href={`/project/${projectId}/case/${s.working_case_id}`}>
                    Open
                  </Link>
                ) : (
                  '–'
                )}
              </td>
              <td>
                {s.frozen_case_id ? (
                  <>
                    <Link className="ds-link" href={`/project/${projectId}/case/${s.frozen_case_id}`}>
                      {s.submitted_at ? safeRunDate(s.submitted_at) : 'Open'}
                    </Link>
                    {/* The run the student handed in with: it belongs to their working case. */}
                    {s.run_id && s.working_case_id ? (
                      <>
                        {' · '}
                        <Link className="ds-link" href={`/project/${projectId}/case/${s.working_case_id}/results?run=${s.run_id}`}>
                          Its run
                        </Link>
                      </>
                    ) : (
                      <span style={{ color: 'var(--ds-text-2)' }}> · no run when handed in</span>
                    )}
                  </>
                ) : (
                  '–'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
