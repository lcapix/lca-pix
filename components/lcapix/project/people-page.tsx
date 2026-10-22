'use client'

// People (E08, E08b): who is on the project, with their access and how many
// cases each made; Add people by one or many emails or a CSV of emails (they
// need an account first, no email is sent), with what happened to each email.
// Only the owner and people who can share change anything here; everyone else
// reads the list.

import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { useParams } from 'next/navigation'
import { Button, ComingSoon, ConfirmDialog, ErrorCard, SavedLine, Segmented } from '@/components/lcapix/ds'
import { initialsOf } from '@/lib/home/projects'
import { useShellData } from '@/lib/shell/use-shell'
import { usePeople } from '@/lib/project/use-people'
import {
  ACCESS_LABEL,
  casesBy,
  emailsIn,
  holdersLine,
  lastAddLines,
  matchesPerson,
  nameOf,
  peopleHeader,
  theirCases,
  type Access,
  type AddLine,
  type Person,
} from '@/lib/project/people-view'

const ROWS = 8
/** A list of emails is a few kB; anything far larger is not one. */
const CSV_MAX_BYTES = 1_000_000

export function PeoplePage() {
  const params = useParams()
  const projectId = Number(params.projectId)
  const { profile } = useShellData()
  const me = profile?.id ?? -1
  const { data, error, reload, addPeople, changeAccess, remove } = usePeople(projectId)

  const [q, setQ] = useState('')
  const [all, setAll] = useState(false)
  const [saved, setSaved] = useState<{ text: string; undo?: () => void } | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const [busyRow, setBusyRow] = useState<number | null>(null)
  const [removing, setRemoving] = useState<Person | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)
  const [justAdded, setJustAdded] = useState<Set<number>>(new Set())

  const by = useMemo(() => (data ? casesBy(data.cases) : new Map<number, number>()), [data])

  if (error) {
    return (
      <div className="np">
        <ErrorCard title="The people did not load" cause={error} onRetry={reload} />
      </div>
    )
  }
  if (!data) {
    return (
      <div className="np" role="status" style={{ color: 'var(--ds-text-2)' }}>
        Loading the people…
      </div>
    )
  }

  const isOwner = data.owner.user_id === me
  const head = (
    <p style={{ margin: 0, fontSize: 13, color: 'var(--ds-text-2)' }}>{data.project.project_name}</p>
  )

  // The owner first, then whoever was just added (so the last add is in view), then the rest as they joined.
  const everyone: Person[] = [data.owner, ...data.members.filter((m) => justAdded.has(m.user_id)), ...data.members.filter((m) => !justAdded.has(m.user_id))]
  const found = everyone.filter((p) => matchesPerson(p, q))
  const searching = q.trim() !== ''
  const shown = searching || all ? found : found.slice(0, ROWS)
  const holders = holdersLine(data.members, by)
  const canEdit = (p: Person) => data.canManage && p.user_id !== data.owner.user_id && (p.permission_name !== 'admin' || data.canManageAdmins)

  const onAccess = async (p: Person, role: Access) => {
    setBusyRow(p.user_id)
    setRowError(null)
    try {
      await changeAccess(p, role)
      setSaved({ text: `${nameOf(p)} ${role === 'viewer' ? 'can now read only' : role === 'editor' ? 'can now change cases' : 'can now share this project'}` })
    } catch (e: any) {
      setRowError(e?.message ?? 'Their access did not change.')
    } finally {
      setBusyRow(null)
    }
  }

  const onRemove = async () => {
    if (!removing) return
    setRemoveBusy(true)
    setRowError(null)
    try {
      await remove(removing)
      setSaved({ text: `Removed ${nameOf(removing)} from ${data.project.project_name}` })
      setRemoving(null)
    } catch (e: any) {
      setRowError(e?.message ?? 'They were not removed.')
      setRemoving(null)
    } finally {
      setRemoveBusy(false)
    }
  }

  return (
    <div className="np pc">
      <header className="pc-head">
        <div style={{ flex: 1, minWidth: 260 }}>
          {head}
          <h1 className="ds-title" style={{ margin: '2px 0 0', display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
            People{' '}
            <span style={{ fontSize: 15, fontWeight: 400, color: 'var(--ds-text-2)' }}>
              {peopleHeader(data.members, { name: nameOf(data.owner), isMe: isOwner })}
            </span>
          </h1>
        </div>
        <label className="pc-search">
          <span className="ds-sr-only">Find a person</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input value={q} placeholder="Find a person" onChange={(e) => setQ(e.target.value)} />
        </label>
      </header>

      <div className={data.canManage ? 'pp-grid' : undefined}>
        <section aria-labelledby="pp-list-h" style={{ minWidth: 0 }}>
          <h2 id="pp-list-h" className="ds-sr-only">
            Who is on this project
          </h2>
          {saved && (
            <div style={{ marginBottom: 10 }}>
              <SavedLine onUndo={saved.undo}>{saved.text}</SavedLine>
            </div>
          )}
          {rowError && (
            <p role="alert" className="pp-alert">
              {rowError}
            </p>
          )}
          <div className="ds-table-wrap pp-wrap" tabIndex={0} role="region" aria-label="People table">
            <table className="ds-table pp-table">
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  <th scope="col">Access</th>
                  <th scope="col">Their cases</th>
                  {data.canManage && (
                    <th scope="col">
                      <span className="ds-sr-only">More</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => {
                  const owner = p.user_id === data.owner.user_id
                  const name = nameOf(p)
                  return (
                    <tr key={p.user_id}>
                      <td>
                        <span className="pp-person">
                          <span className="pc-avatar" data-owner={owner || undefined} aria-hidden>
                            {initialsOf(name)}
                          </span>
                          <span style={{ minWidth: 0 }}>
                            <strong className="pp-name">
                              {name}
                              {p.user_id === me ? ' (you)' : ''}
                            </strong>
                            <span className="pp-email">
                              {p.email}
                              {justAdded.has(p.user_id) ? ' · added just now' : ''}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td>
                        {owner ? (
                          'Owner'
                        ) : canEdit(p) ? (
                          <select
                            className="ds-input pp-access"
                            aria-label={`Access for ${name}`}
                            value={p.permission_name ?? 'viewer'}
                            disabled={busyRow === p.user_id}
                            onChange={(e) => void onAccess(p, e.target.value as Access)}
                          >
                            <option value="editor">{ACCESS_LABEL.editor}</option>
                            <option value="viewer">{ACCESS_LABEL.viewer}</option>
                            {(data.canManageAdmins || p.permission_name === 'admin') && <option value="admin">{ACCESS_LABEL.admin}</option>}
                          </select>
                        ) : (
                          ACCESS_LABEL[(p.permission_name ?? 'viewer') as Access] ?? p.permission_name
                        )}
                      </td>
                      <td className={by.get(p.user_id) ? 'ds-mono' : 'pp-none'}>{theirCases(by.get(p.user_id) ?? 0, owner ? 'owner' : p.permission_name)}</td>
                      {data.canManage && <td style={{ width: 56, textAlign: 'right' }}>{canEdit(p) && <PersonMenu name={name} onRemove={() => setRemoving(p)} />}</td>}
                    </tr>
                  )
                })}
                {!found.length && (
                  <tr>
                    <td colSpan={data.canManage ? 4 : 3} style={{ color: 'var(--ds-text-2)', fontSize: 15 }}>
                      Nobody here matches “{q.trim()}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="pc-table-foot">
              <span style={{ flex: 1 }}>
                {searching
                  ? `${found.length} of ${everyone.length} match`
                  : [`Showing ${shown.length} of ${everyone.length}`, holders].filter(Boolean).join(' · ')}
              </span>
              {!searching && found.length > ROWS && (
                <button type="button" className="ds-link" style={{ fontWeight: 600 }} aria-expanded={all} onClick={() => setAll((v) => !v)}>
                  {all ? 'Show fewer' : `Show all ${found.length}`}
                </button>
              )}
            </p>
          </div>
          {!data.canManage && (
            <p className="np-sub" style={{ marginTop: 12 }}>
              Only the owner and people who can share add or remove people here.
            </p>
          )}
        </section>

        {data.canManage && (
          <aside style={{ display: 'grid', gap: 16, alignContent: 'start', minWidth: 0 }}>
            <AddPeople
              onAdd={addPeople}
              onAdded={(ids) => setJustAdded(new Set(ids))}
            />
            <ComingSoon>Invite by email, requests to join, comments</ComingSoon>
          </aside>
        )}
      </div>

      <ConfirmDialog
        open={!!removing}
        title={`Remove ${removing ? nameOf(removing) : ''}?`}
        consequence={
          removing
            ? `They lose access to ${data.project.project_name}.${(by.get(removing.user_id) ?? 0) > 0 ? ` Their ${by.get(removing.user_id) === 1 ? 'case stays' : `${by.get(removing.user_id)} cases stay`} in the project, and you can still open ${by.get(removing.user_id) === 1 ? 'it' : 'them'}.` : ''}`
            : ''
        }
        confirmLabel="Remove"
        busy={removeBusy}
        onConfirm={() => void onRemove()}
        onCancel={() => setRemoving(null)}
      />
    </div>
  )
}

function PersonMenu({ name, onRemove }: { name: string; onRemove: () => void }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLSpanElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    wrap.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        button.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <span ref={wrap} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={button}
        type="button"
        className="pp-more ds-focusable"
        aria-label={`More for ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open && (
        <span className="ws-menu" role="menu" aria-label={`More for ${name}`} style={{ right: 0, top: 'calc(100% + 4px)' }}>
          <button
            type="button"
            role="menuitem"
            className="danger"
            onClick={() => {
              setOpen(false)
              onRemove()
            }}
          >
            Remove from project
          </button>
        </span>
      )}
    </span>
  )
}

function AddPeople({
  onAdd,
  onAdded,
}: {
  onAdd: (emails: string[], role: Access) => Promise<{ results: Array<{ outcome: string; email: string; member?: any }>; error: string | null }>
  onAdded: (userIds: number[]) => void
}) {
  const [text, setText] = useState('')
  const [role, setRole] = useState<Access>('editor')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileNote, setFileNote] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const [last, setLast] = useState<{ count: number; lines: AddLine[] } | null>(null)
  const emails = emailsIn(text)

  const readFile = async (file: File | undefined) => {
    setFileNote(null)
    setError(null)
    if (!file) return
    if (!/\.(csv|txt)$/i.test(file.name)) return setError(`${file.name} is not a CSV. Save the list as .csv and drop it again.`)
    if (file.size > CSV_MAX_BYTES) return setError(`${file.name} is larger than a list of emails (over 1 MB).`)
    const found = emailsIn(await file.text())
    if (!found.length) return setError(`No email addresses in ${file.name}.`)
    setText((t) => emailsIn(`${t}\n${found.join('\n')}`).join('\n'))
    setFileNote(`${found.length} ${found.length === 1 ? 'email' : 'emails'} from ${file.name}. Check them, then add.`)
  }

  const add = async () => {
    if (!emails.length) return
    setBusy(true)
    setError(null)
    try {
      const { results, error: partError } = await onAdd(emails, role)
      if (results.length) {
        setLast({ count: results.length, lines: lastAddLines(results as any, role) })
        onAdded(results.filter((r) => r.outcome === 'added' && r.member).map((r) => Number(r.member.user_id)))
        // Keep what was not added in the box, so it can be fixed and sent again.
        const left = results.filter((r) => ['no_account', 'invalid', 'limited'].includes(r.outcome)).map((r) => r.email)
        setText(left.join('\n'))
        setFileNote(null)
      }
      if (partError) setError(partError)
    } catch (e: any) {
      setError(e?.message ?? 'Nobody was added.')
    } finally {
      setBusy(false)
    }
  }

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setOver(false)
    void readFile(e.dataTransfer.files?.[0])
  }

  return (
    <section className="pp-card" aria-labelledby="pp-add-h">
      <h2 id="pp-add-h" className="pp-card-h">
        Add people
      </h2>
      <p style={{ margin: '4px 0 16px', fontSize: 15, color: 'var(--ds-text-2)' }}>They need an account first. No email is sent from here.</p>
      <label style={{ display: 'grid', gap: 6 }} htmlFor="pp-emails">
        <span className="edu-field-label">Email addresses</span>
        <textarea
          id="pp-emails"
          className="ds-input pp-emails"
          rows={2}
          value={text}
          placeholder="name@university.edu, one or many"
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      {(emails.length > 0 || fileNote) && (
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ds-text-2)' }}>
          {fileNote ?? `${emails.length} ${emails.length === 1 ? 'email' : 'emails'}`}
        </p>
      )}
      <label className="pp-drop" data-over={over || undefined} onDragOver={(e) => (e.preventDefault(), setOver(true))} onDragLeave={() => setOver(false)} onDrop={onDrop}>
        <input
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          className="ds-sr-only"
          onChange={(e) => {
            void readFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5M9 13h6M9 17h6" />
        </svg>
        <span>
          <strong style={{ display: 'block', fontSize: 15 }}>Or drop a CSV of emails</strong>
          <span style={{ fontSize: 14, color: 'var(--ds-text-2)' }}>One email per row.</span>
        </span>
      </label>
      <span className="edu-field-label" style={{ display: 'block', margin: '16px 0 6px' }} aria-hidden>
        They can
      </span>
      <Segmented
        label="They can"
        value={role}
        onChange={setRole}
        options={[
          { value: 'editor', label: 'Can change' },
          { value: 'viewer', label: 'Can read' },
        ]}
      />
      <div className="pp-add">
        <Button variant="primary" busy={busy} disabled={!emails.length} disabledReason={!emails.length ? 'Enter an email first' : undefined} onClick={() => void add()}>
          Add to this project
        </Button>
      </div>
      {error && (
        <p role="alert" className="pp-alert" style={{ marginTop: 10 }}>
          {error}
        </p>
      )}
      {last && (
        <div className="pp-last" role="status">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className="ds-section-label" style={{ flex: 1 }}>
              Last add · {last.count} {last.count === 1 ? 'email' : 'emails'}
            </span>
            <button type="button" className="pp-x ds-focusable" aria-label="Close the last add" onClick={() => setLast(null)}>
              ×
            </button>
          </div>
          <ul>
            {last.lines.map((l, i) => (
              <li key={i} data-kind={l.kind}>
                <span aria-hidden>{l.kind === 'ok' ? '✓' : l.kind === 'changed' ? '↻' : '⚠'}</span>
                <span>{l.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
