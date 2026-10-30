'use client'

// Cases (E07 pipeline, E07b table): the project's cases. Yours first, each
// with its latest answer (a copy with its change against the Base case); then
// the class's (or the members'), on a board of four columns (Not run yet,
// Run, Written, Ticked as hand-in) or as a table sorted by how far along each
// one is. Each card says what is missing next. Nothing here grades: it says
// what exists. Search finds a person or a case.

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Button, ConfirmDialog, ErrorCard, Segmented, TextDialog } from '@/components/lcapix/ds'
import { apiRequest } from '@/lib/api-client'
import { useShellData, useShellStore } from '@/lib/shell/use-shell'
import { isProjectRole, projectCapabilities } from '@/lib/project-role'
import { readRunPrefs, runAssessmentBody } from '@/lib/project/workspace'
import { runLabel } from '@/lib/results/full-results-view'
import { initialsOf } from '@/lib/home/projects'
import { LMS_NAME } from '@/lib/lms-name'
import { whenWords } from '@/lib/home/last-case'
import { LESSONS } from '@/lib/lessons'
import { useProjectCases } from '@/lib/project/use-project-cases'
import {
  answerOf,
  byStage,
  CARD_TAG,
  casesHeader,
  changeVsBase,
  lessonsOf,
  matchesSearch,
  noCaseYet,
  writeUpOf,
  PIPELINE_LABEL,
  segmentsFilled,
  splitCases,
  STAGES,
  type ProgressCase,
} from '@/lib/project/cases-view'

const LESSON_TITLES: Record<string, string> = Object.fromEntries(LESSONS.map((l) => [l.id, l.title]))
const PER_COLUMN = 2
const TABLE_ROWS = 8
const DOT: Record<string, string> = { not_run: 'ring', run: '#2F7BC0', written: '#8F5B00', handed_in: '#006A44' }

export function CasesPage() {
  const params = useParams()
  const projectId = Number(params.projectId)
  const { profile } = useShellData()
  const userId = profile?.id ?? -1
  const word = profile?.useCase === 'teaching' ? 'student' : 'member'
  const { data, error, reload } = useProjectCases(projectId)
  const [view, setView] = useState<'pipeline' | 'table'>('pipeline')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [allRows, setAllRows] = useState(false)

  const split = useMemo(() => (data ? splitCases(data.cases, userId) : { mine: [], others: [] }), [data, userId])
  if (error) {
    return (
      <div className="np">
        <ErrorCard title="The cases did not load" cause={error} onRetry={reload} />
      </div>
    )
  }
  if (!data) {
    return (
      <div className="np" role="status" style={{ color: 'var(--ds-text-2)' }}>
        Loading the cases…
      </div>
    )
  }

  const scope = [data.project.lcia_method, data.project.region_code].filter(Boolean).join(' · ') || null
  const base = data.cases.find((c) => c.case_type === 'base')
  const others = split.others.filter((c) => matchesSearch(c, q))
  const mine = split.mine.filter((c) => matchesSearch(c, q))
  // 2.7: only a view that holds every case can count who has none. With "see
  // only their own case" on, a student's view holds their own cases only.
  const seesAll = projectCapabilities(isProjectRole(data.project.my_role) ? data.project.my_role : null).canManage || !data.membersSeeOwnCases
  const missing = seesAll ? noCaseYet(data.members, data.cases) : 0
  const plural = `${word[0].toUpperCase()}${word.slice(1)}s`
  const caseHref = (c: ProgressCase) => `/project/${projectId}/case/${c.case_id}`

  return (
    <div className="np pc">
      <header className="pc-head">
        <div style={{ flex: 1, minWidth: 260 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ds-text-2)' }}>{data.project.project_name}</p>
          <h1 className="ds-title" style={{ margin: '2px 0 0', display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
            Cases{' '}
            <span style={{ fontSize: 15, fontWeight: 400, color: 'var(--ds-text-2)' }}>
              {casesHeader({ all: data.cases.length, mine: split.mine.length, others: split.others.length }, word, scope)}
            </span>
          </h1>
        </div>
        <label className="pc-search">
          <span className="ds-sr-only">Find a {word} or case</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input value={q} placeholder={`Find a ${word} or case`} onChange={(e) => setQ(e.target.value)} />
        </label>
        {split.others.length > 0 && (
          <Segmented
            label="Show the cases as"
            value={view}
            onChange={setView}
            options={[
              { value: 'pipeline', label: 'Pipeline' },
              { value: 'table', label: 'Table' },
            ]}
          />
        )}
        <Link href={`/project/${projectId}/case/new`} className="ds-btn ds-btn--primary">
          + New case
        </Link>
      </header>

      <section aria-labelledby="mine-h">
        <h2 id="mine-h" className="ds-section-label">
          Your cases · {mine.length}
        </h2>
        {mine.length ? (
          <div className="pc-mine">
            {mine.map((c) => {
              const answer = answerOf(c)
              const change = c.case_type !== 'base' ? changeVsBase(c, base) : null
              return (
                <div key={c.case_id} className="pc-mine-card">
                  <Link href={caseHref(c)} className="ds-focusable" style={{ flex: 1, minWidth: 0, display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: 18 }}>{c.case_name}</strong>
                    <span style={{ display: 'block', fontSize: 13, color: 'var(--ds-text-2)' }}>
                      <Progress c={c} />
                    </span>
                    <span style={{ fontSize: 14, color: 'var(--ds-text-2)' }}>
                      {[c.description || (c.case_type === 'base' ? 'The base case' : 'A what-if'), c.latest_run ? runLabel(c.latest_run) : 'not run yet'].join(' · ')}
                    </span>
                  </span>
                  {change && change !== 'Same' && <span className="pc-change">{change}</span>}
                  <span className="ds-mono" style={{ fontSize: 28, fontWeight: 600 }}>
                    {answer ?? '–'}
                  </span>
                  </Link>
                  <CaseMenu projectId={projectId} caseId={c.case_id} name={c.case_name} role={data.project.my_role} readOnly={!!Number((c as any).read_only)} onChanged={reload} />
                </div>
              )
            })}
          </div>
        ) : (
          <p className="np-sub" style={{ margin: '8px 0 0' }}>
            None yet. <Link className="ds-link" href={`/project/${projectId}/case/new`}>+ New case</Link>
          </p>
        )}
      </section>

      {/* Also when nobody has a case yet: that is when "N people have no case yet" matters most (2.7). */}
      {(split.others.length > 0 || missing > 0) && (
        <section aria-labelledby="others-h" style={{ marginTop: 26 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <h2 id="others-h" className="ds-section-label" style={{ flex: 1 }}>
              {plural}&apos; cases · {split.others.length}
            </h2>
            <span style={{ fontSize: 14, color: 'var(--ds-text-2)' }}>
              What exists in each {word}&apos;s work. No reminders go out{LMS_NAME ? `, and grades stay in ${LMS_NAME}` : ''}.
            </span>
          </div>

          {view === 'pipeline' ? (
            <div className="pc-board">
              {STAGES.map((stage) => {
                const col = others.filter((c) => c.stage === stage)
                const shown = open[stage] ? col : col.slice(0, PER_COLUMN)
                return (
                  <section key={stage} className="pc-col" aria-label={`${PIPELINE_LABEL[stage]}, ${col.length}`}>
                    <h3 className="pc-col-head">
                      <span className="pc-dot" data-ring={DOT[stage] === 'ring' || undefined} style={DOT[stage] === 'ring' ? undefined : { background: DOT[stage] }} aria-hidden />
                      <span style={{ flex: 1 }}>{PIPELINE_LABEL[stage]}</span>
                      <span className="ds-count">{col.length}</span>
                    </h3>
                    {shown.map((c) => (
                      <CaseCard key={c.case_id} c={c} href={caseHref(c)} />
                    ))}
                    {col.length > PER_COLUMN && (
                      <button type="button" className="pc-more" aria-expanded={!!open[stage]} onClick={() => setOpen((o) => ({ ...o, [stage]: !o[stage] }))}>
                        {open[stage] ? 'Show fewer' : `Show ${col.length - PER_COLUMN} more`}
                      </button>
                    )}
                    {stage === 'not_run' && missing > 0 && (
                      <p className="pc-missing">
                        {missing} {missing === 1 ? 'person has' : 'people have'} no case yet ·{' '}
                        <Link className="ds-link" href={`/project/${projectId}/people`}>
                          See People
                        </Link>
                      </p>
                    )}
                  </section>
                )
              })}
            </div>
          ) : (
            <div className="ds-table-wrap">
              <table className="ds-table">
                <thead>
                  <tr>
                    <th scope="col">{word[0].toUpperCase() + word.slice(1)}</th>
                    <th scope="col">Case</th>
                    <th scope="col" aria-sort="descending">
                      Stage ↓
                    </th>
                    <th scope="col">Run</th>
                    <th scope="col">Steps · flows · runs</th>
                    <th scope="col">Lessons</th>
                    <th scope="col">Write-up</th>
                    <th scope="col" style={{ textAlign: 'right' }}>
                      Answer
                    </th>
                    <th scope="col">Hand-in</th>
                  </tr>
                </thead>
                <tbody>
                  {[...others]
                    .sort(byStage)
                    .slice(0, allRows ? undefined : TABLE_ROWS)
                    .map((c) => (
                      <tr key={c.case_id}>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                            <span className="pc-avatar" aria-hidden>
                              {initialsOf(c.author ?? '?')}
                            </span>
                            <strong>{c.author ?? 'Someone'}</strong>
                          </span>
                        </td>
                        <td>
                          <Link className="ds-link" href={caseHref(c)} style={{ color: 'var(--ds-text)' }}>
                            {c.case_name}
                          </Link>
                        </td>
                        <td>
                          <span className="pc-stage">
                            <span className="pc-dot" data-ring={DOT[c.stage] === 'ring' || undefined} style={DOT[c.stage] === 'ring' ? undefined : { background: DOT[c.stage] }} aria-hidden />
                            {PIPELINE_LABEL[c.stage]}
                          </span>
                        </td>
                        <td className="ds-mono">{c.latest_run ? runLabel(c.latest_run) : <span style={{ color: 'var(--ds-text-2)' }}>No run</span>}</td>
                        <td className="ds-mono">
                          {c.steps ?? 0} · {c.flows ?? 0} · {c.runs ?? 0}
                        </td>
                        <td>{lessonsOf(c, LESSON_TITLES) ? <span title={lessonsOf(c, LESSON_TITLES)!.title}>{lessonsOf(c, LESSON_TITLES)!.text}</span> : '–'}</td>
                        <td>{writeUpOf(c)}</td>
                        <td className="ds-mono" style={{ textAlign: 'right' }}>
                          {answerOf(c) ?? <span style={{ color: 'var(--ds-text-2)' }}>None yet</span>}
                        </td>
                        <td>{c.stage === 'handed_in' ? <span style={{ color: 'var(--ds-green)', fontWeight: 600 }}>✓ Ticked</span> : 'Not ticked'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <p className="pc-table-foot">
                <span>
                  Showing {Math.min(others.length, allRows ? others.length : TABLE_ROWS)} of {others.length}
                </span>
                {missing > 0 && (
                  <span>
                    {missing} {missing === 1 ? 'person has' : 'people have'} no case yet ·{' '}
                    <Link className="ds-link" href={`/project/${projectId}/people`}>
                      See People
                    </Link>
                  </span>
                )}
                <span style={{ flex: 1 }} />
                {others.length > TABLE_ROWS && (
                  <Button size="small" onClick={() => setAllRows((v) => !v)}>
                    {allRows ? 'Show fewer' : `Show all ${others.length}`}
                  </Button>
                )}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function CaseCard({ c, href }: { c: ProgressCase; href: string }) {
  const tag = CARD_TAG[c.stage]
  const answer = answerOf(c)
  const filled = segmentsFilled(c.stage)
  return (
    <Link href={href} className="pc-card ds-focusable">
      <span style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span className="pc-avatar" aria-hidden>
          {initialsOf(c.author ?? '?')}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ display: 'block', fontSize: 16 }}>{c.author ?? 'Someone'}</strong>
          <span style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>
            {c.case_name} · {c.latest_run ? <span className="ds-mono">{runLabel(c.latest_run)}</span> : c.case_type === 'base' ? 'not run yet' : c.created_at ? `copied ${whenWords(c.created_at)}` : 'not run yet'}
          </span>
          <span style={{ display: 'block', fontSize: 13, color: 'var(--ds-text-2)' }}>
            <Progress c={c} />
          </span>
        </span>
        {answer && (
          <span className="ds-mono" style={{ fontWeight: 600 }}>
            {answer}
          </span>
        )}
      </span>
      <span className="pc-segs" aria-label={`${filled} of 4 stages reached`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} data-on={i < filled || undefined} />
        ))}
      </span>
      <span className={`pc-tag pc-tag--${tag.tone}`}>{tag.text}</span>
    </Link>
  )
}

/**
 * P118: a case's menu, on every row the person may act on: Rename (a dialog),
 * Copy, Run (with the method and region remembered for the case, then its
 * Results) and Delete (a confirm). Rename, Copy and Run need editor; Delete
 * needs admin, as the server does. Esc or a click outside closes it.
 */
function CaseMenu({
  projectId,
  caseId,
  name,
  role,
  readOnly = false,
  onChanged,
}: {
  projectId: number
  caseId: number
  name: string
  role: string | null
  /** A read-only case (the sample, a hand-in) can be copied, never renamed or run. */
  readOnly?: boolean
  onChanged: () => void
}) {
  const router = useRouter()
  const caps = projectCapabilities(isProjectRole(role) ? role : null)
  const [open, setOpen] = useState(false)
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        ref.current?.querySelector<HTMLElement>('[aria-haspopup]')?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  if (!caps.canEdit) return null

  const act = async (path: string, init: RequestInit): Promise<any | null> => {
    setError(null)
    setBusy(true)
    try {
      const res = await apiRequest(path, init)
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d?.error ?? (res.status === 403 ? 'Your role cannot do that here.' : `Not done (${res.status}).`))
        return null
      }
      setOpen(false)
      setDialog(null)
      void useShellStore.getState().refresh()
      onChanged()
      return d
    } finally {
      setBusy(false)
    }
  }
  const run = async () => {
    const remembered = readRunPrefs((k) => localStorage.getItem(k), String(caseId))
    const d = await act(`/api/cases/${caseId}/assessments`, { method: 'POST', body: JSON.stringify(runAssessmentBody(name, remembered)) })
    if (d) router.push(`/project/${projectId}/case/${caseId}/results`)
  }
  return (
    <span ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="ds-btn ds-btn--small" aria-haspopup="menu" aria-expanded={open} aria-label={`Menu for ${name}`} onClick={() => setOpen((v) => !v)}>
        Menu
      </button>
      {open && (
        <span className="ws-menu" role="menu" aria-label={`${name} menu`} style={{ right: 0, top: 'calc(100% + 6px)' }}>
          {!readOnly && (
            <button type="button" role="menuitem" onClick={() => { setOpen(false); setDialog('rename') }}>
              Rename
            </button>
          )}
          <button type="button" role="menuitem" disabled={busy} onClick={() => void act(`/api/cases/${caseId}/duplicate`, { method: 'POST', body: '{}' })}>
            Copy
          </button>
          {!readOnly && (
            <button type="button" role="menuitem" disabled={busy} onClick={() => void run()}>
              Run
            </button>
          )}
          {caps.canManage && (
            <button type="button" role="menuitem" onClick={() => { setOpen(false); setDialog('delete') }}>
              Delete
            </button>
          )}
        </span>
      )}
      {error && (
        <span role="alert" style={{ display: 'block', fontSize: 13, color: 'var(--ds-error)' }}>
          {error}
        </span>
      )}
      <TextDialog
        open={dialog === 'rename'}
        title="Rename case"
        label="Case name"
        initial={name}
        confirmLabel="Rename"
        busy={busy}
        error={error}
        onCancel={() => setDialog(null)}
        onSubmit={(next) => void act(`/api/cases/${caseId}`, { method: 'PUT', body: JSON.stringify({ case_name: next }) })}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        title="Delete this case?"
        consequence={`"${name}" and its steps, flows and runs are removed. This cannot be undone.`}
        confirmLabel="Delete case"
        busy={busy}
        onCancel={() => setDialog(null)}
        onConfirm={() => void act(`/api/cases/${caseId}`, { method: 'DELETE' })}
      />
    </span>
  )
}

/** A case's progress in one line (C03, P38 to P41): steps, flows, runs, lessons and the write-up. */
function Progress({ c }: { c: ProgressCase }) {
  const lessons = lessonsOf(c, LESSON_TITLES)
  return (
    <>
      {c.steps ?? 0} steps · {c.flows ?? 0} flows · {c.runs ?? 0} runs
      {lessons && (
        <>
          {' · '}
          <span title={lessons.title}>{lessons.text}</span>
        </>
      )}
      {' · '}
      {writeUpOf(c)}
    </>
  )
}
