'use client'

// Home (E02, E12, behaviour spec "Sequence" 6): nothing yet → the three ways
// in; the sample alone → the sample study's Overview; later → Continue (the
// case opened last on this device), Needs attention, your projects with their
// latest result, the sample as a small row with Remove, and Recent findings as
// Coming soon. Search finds a project or a case.

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, ComingSoon, ConfirmDialog, CountPill, EmptyState, ErrorCard } from '@/components/lcapix/ds'
import { apiRequest } from '@/lib/api-client'
import { useShellData, useShellStore } from '@/lib/shell/use-shell'
import { caseTotal, co2Unit } from '@/lib/ui/format'
import { continueNext, continueParts, countsLine, homeMode, needsAttention, projectMeta, toHomeProject, type HomeProject } from '@/lib/home/home-view'
import { useContinueCase } from '@/lib/home/use-continue'
import { readLastCase, whenWords } from '@/lib/home/last-case'
import { SampleOverview } from './sample-overview'
import { StudentHome } from './student-home'
import { ReadOnlyBar } from '../shell/read-only-bar'
import { usePhone } from '@/lib/shell/use-phone'
import { isStudentHome } from '@/lib/home/student-view'

export function EduHome() {
  const { projects: raw, profile, status, refresh } = useShellData()
  // Home reads the summaries fresh, not the session's first load.
  useEffect(() => {
    void useShellStore.getState().refresh()
  }, [])
  const projects = useMemo(() => (raw as any[]).map(toHomeProject), [raw])
  const userId = profile?.id ?? -1
  const mode = homeMode(projects)

  if (status === 'error' && !projects.length) {
    return (
      <div style={{ padding: 24 }}>
        <ErrorCard title="Your projects did not load" cause="The server did not answer." onRetry={refresh} />
      </div>
    )
  }
  if ((status === 'idle' || status === 'loading') && !projects.length) {
    return (
      <div style={{ padding: 24, color: 'var(--ds-text-2)' }} role="status">
        Loading your projects…
      </div>
    )
  }
  const ownName = profile?.fullName?.trim() || null
  const owns = projects.some((p) => !p.is_sample && p.owner_id === userId)
  if (mode === 'sample') {
    const sample = projects.find((p) => p.is_sample)!
    return <SampleOverview projectId={sample.project_id} ownName={ownName} ownsProject={owns} />
  }
  if (mode === 'empty') return <EmptyHome />
  // Projects shared with them and none they run: the student's Home (E13, E15).
  if (isStudentHome(projects, userId)) return <StudentHome projects={projects} userId={userId} fullName={ownName} />
  return <HomeLater projects={projects} userId={userId} firstName={ownName?.split(/\s+/)[0] ?? null} teaching={profile?.useCase === 'teaching'} />
}

/** Build the sample study (POST /api/example-project; it answers with the one that exists). */
function useAddSample() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const build = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await apiRequest('/api/example-project', { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d?.error ?? `error ${res.status}`)
      await useShellStore.getState().refresh()
    } catch (e: any) {
      setError(e?.message ?? 'the sample was not built')
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, build }
}

/** No project yet (the sample was skipped, removed, or failed): the three ways in. */
function EmptyHome() {
  const router = useRouter()
  const { busy, error, build } = useAddSample()
  return (
    <div className="home">
      <header className="home-head">
        <h1 className="ds-title">Welcome to LCAPIX</h1>
        <p className="home-sub">Start one of three ways.</p>
      </header>
      <div className="home-ways">
        <div className="so-next-card">
          <span className="ds-section-label" style={{ color: 'var(--ds-green)' }}>
            Read first
          </span>
          <h2>Open the sample study</h2>
          <p>A finished study of a painted steel bracket, built for you in a few seconds: the question, the tree, what goes in, the answer.</p>
          <Button variant="primary" onClick={build} busy={busy}>
            Open the sample study
          </Button>
          {error && (
            <ErrorCard title="We couldn't build the sample study. Nothing was lost." cause={error} onRetry={build} />
          )}
        </div>
        <div className="so-next-card">
          <span className="ds-section-label">From a file</span>
          <h2>Start from a file</h2>
          <p>A bill of materials, a routing or an equipment list. You check what we read before anything is saved.</p>
          <Button onClick={() => router.push('/project/new')}>+ New project</Button>
        </div>
        <div className="so-next-card">
          <span className="ds-section-label">Empty</span>
          <h2>Start empty</h2>
          <p>Build the tree yourself, one tier at a time.</p>
          <Button onClick={() => router.push('/project/new')}>+ New project</Button>
        </div>
      </div>
    </div>
  )
}

function HomeLater({ projects, userId, firstName, teaching }: { projects: HomeProject[]; userId: number; firstName: string | null; teaching: boolean }) {
  const router = useRouter()
  const cont = useContinueCase()
  const items = needsAttention(projects, userId, teaching ? 'student' : 'member')
  const own = projects.filter((p) => !p.is_sample)
  const sample = projects.find((p) => p.is_sample) ?? null
  const last = readLastCase()
  const [removeOpen, setRemoveOpen] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const addSample = useAddSample()
  const phone = usePhone()

  const remove = async () => {
    if (!sample) return
    setRemoving(true)
    setRemoveError(null)
    const res = await apiRequest(`/api/projects/${sample.project_id}`, { method: 'DELETE' })
    setRemoving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setRemoveError(d?.error ?? `The sample was not removed (${res.status}).`)
      return
    }
    setRemoveOpen(false)
    await useShellStore.getState().refresh()
  }

  const line = [countsLine(projects, userId), last?.project_name ? `last open: ${last.project_name}, ${whenWords(last.at)}` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="home" data-phone={phone || undefined}>
      <header className="home-head home-head--row">
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 className="ds-title">{firstName ? `Welcome back, ${firstName}.` : 'Welcome back.'}</h1>
          <p className="home-sub">{line}</p>
        </div>
        <HomeSearch projects={projects} q={q} setQ={setQ} />
      </header>

      <div className="home-top">
        {cont.data && <ContinueCard c={cont.data} />}
        {items.length > 0 && (
          <section className="home-card" aria-labelledby="attention-h">
            <h2 id="attention-h" className="ds-section-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              Needs attention <CountPill n={items.length} label={`${items.length} items`} />
            </h2>
            <ul className="home-attention">
              {items.map((i) => (
                <li key={i.key}>
                  <AttentionIcon kind={i.kind} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: 16 }}>{i.title}</strong>
                    <span style={{ fontSize: 14, color: 'var(--ds-text-2)' }}>{i.where}</span>
                  </span>
                  <Link href={i.href} className="ds-link" style={{ fontWeight: 600 }}>
                    {i.action}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <section aria-labelledby="yours-h" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <h2 id="yours-h" className="ds-section-label" style={{ flex: 1 }}>
            Your projects · {own.length}
          </h2>
          <Link href="/project/new" className="ds-link" style={{ fontWeight: 600 }}>
            + New project
          </Link>
        </div>
        {own.length ? (
          <div className="home-projects">
            {own.map((p) => (
              <Link key={p.project_id} href={`/project/${p.project_id}`} className="home-project ds-focusable">
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: 'block', fontSize: 19 }}>{p.project_name}</strong>
                  <span style={{ fontSize: 14, color: 'var(--ds-text-2)' }}>{projectMeta(p, userId)}</span>
                </span>
                <span style={{ textAlign: 'right' }}>
                  {p.base_run?.headline ? (
                    <>
                      <span className="ds-mono" style={{ display: 'block', fontSize: 26, fontWeight: 600 }}>
                        {caseTotal(p.base_run.headline.value, 'base')}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>
                        {co2Unit(p.base_run.headline.unit)} · Base case · Run #{p.base_run.run_id}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="ds-mono" style={{ display: 'block', fontSize: 26, fontWeight: 600 }} aria-hidden>
                        –
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>No run yet</span>
                    </>
                  )}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState line="No project of your own yet." action={<Button onClick={() => router.push('/project/new')}>+ New project</Button>} />
        )}
      </section>

      {sample && (
        <div className="home-sample">
          <span className="ds-flag ds-flag--sample">Sample</span>
          <span style={{ flex: 1, minWidth: 200, fontSize: 16 }}>
            {sample.project_name}
            {sample.base_run?.headline ? ` · ${caseTotal(sample.base_run.headline.value, 'base')} ${co2Unit(sample.base_run.headline.unit)}` : ''} · read any time
          </span>
          <Link href={`/project/${sample.project_id}`} className="ds-link" style={{ fontWeight: 600 }}>
            Open
          </Link>
          {!phone && (
            <button type="button" className="ds-link" style={{ color: 'var(--ds-text)' }} onClick={() => setRemoveOpen(true)}>
              Remove the sample
            </button>
          )}
        </div>
      )}
      {/* E12's promise: the sample can be added again once removed. */}
      {!sample && !phone && (
        <div className="home-sample">
          <span className="ds-flag ds-flag--sample">Sample</span>
          <span style={{ flex: 1, minWidth: 200, fontSize: 16 }}>The sample study: a finished painted steel bracket to read, run and copy.</span>
          <Button size="small" busy={addSample.busy} onClick={() => void addSample.build()}>
            Add the sample study
          </Button>
          {addSample.error && (
            <span role="alert" className="pp-alert" style={{ flexBasis: '100%', margin: 0 }}>
              The sample was not added: {addSample.error}
            </span>
          )}
        </div>
      )}
      <div style={{ marginTop: 16 }}>
        <ComingSoon>Recent findings</ComingSoon>
      </div>
      {phone && <ReadOnlyBar />}

      <ConfirmDialog
        open={removeOpen}
        title="Remove the sample study?"
        consequence="Your own projects stay. You can add the sample again from All projects."
        confirmLabel="Remove sample"
        busy={removing}
        onCancel={() => setRemoveOpen(false)}
        onConfirm={remove}
      >
        {removeError && (
          <p className="ds-dialog-body" style={{ color: 'var(--ds-error)' }} role="alert">
            {removeError}
          </p>
        )}
      </ConfirmDialog>
    </div>
  )
}

function ContinueCard({ c }: { c: NonNullable<ReturnType<typeof useContinueCase>['data']> }) {
  const parts = continueParts(c)
  const next = continueNext(c)
  const href = (tab: string) => `/project/${c.projectId}/case/${c.caseId}${tab === 'tree' ? '' : `?tab=${tab}`}`
  const facts = [
    c.sourceFile ? `From ${c.sourceFile}, ${whenWords(c.last.at)}` : `Opened ${whenWords(c.last.at)}`,
    `${c.steps} ${c.steps === 1 ? 'step' : 'steps'}`,
    `${c.flowsIn} ${c.flowsIn === 1 ? 'line' : 'lines'} in`,
    c.held ? `${c.held} held` : null,
    c.latestRunId ? `Run #${c.latestRunId}` : 'no run yet',
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <section className="home-card home-continue" aria-labelledby="continue-h">
      <span className="ds-section-label">Continue</span>
      <h2 id="continue-h" style={{ fontSize: 28, fontWeight: 600, margin: '8px 0 6px', letterSpacing: '-0.01em' }}>
        {c.last.project_name ? `${c.last.project_name} · ` : ''}
        {c.caseName}
      </h2>
      <p style={{ margin: 0, fontSize: 15, color: 'var(--ds-text-2)' }}>{facts}</p>
      <ol className="home-parts" aria-label="Where the case is">
        {parts.map((p) => (
          <li key={p.label} data-done={p.done || undefined}>
            <span className="home-part-bar" aria-hidden>
              <span style={{ width: `${Math.round(p.fill * 100)}%` }} />
            </span>
            {p.label}
          </li>
        ))}
      </ol>
      <div className="home-next">
        <span style={{ flex: 1, minWidth: 200, fontSize: 16 }}>{next.line}</span>
        {next.tab !== 'tree' && (
          <Link href={href('tree')} className="ds-link" style={{ fontWeight: 600 }}>
            Open the tree
          </Link>
        )}
        <Link href={href(next.tab)} className="ds-btn ds-btn--primary">
          {next.button}
        </Link>
      </div>
    </section>
  )
}

function AttentionIcon({ kind }: { kind: 'held' | 'changed' | 'no_run' }) {
  return kind === 'no_run' ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden style={{ flex: 'none', marginTop: 2 }}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8F5B00" strokeWidth="1.8" aria-hidden style={{ flex: 'none', marginTop: 2 }}>
      <path d="M12 4 2.5 20h19z" strokeLinejoin="round" />
      <path d="M12 10v4.5M12 17.5v.5" strokeLinecap="round" />
    </svg>
  )
}

/** "Find a project or case": projects by name now; cases once typed (their lists load then). */
function HomeSearch({ projects, q, setQ }: { projects: HomeProject[]; q: string; setQ: (v: string) => void }) {
  const router = useRouter()
  const [cases, setCases] = useState<Array<{ project_id: number; project_name: string; case_id: number; case_name: string }> | null>(null)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!q.trim() || cases) return
    let live = true
    Promise.all(
      projects.slice(0, 20).map((p) =>
        apiRequest(`/api/projects/${p.project_id}/cases`)
          .then((r) => (r.ok ? r.json() : { cases: [] }))
          .then((d) => (d.cases ?? []).map((c: any) => ({ project_id: p.project_id, project_name: p.project_name, case_id: Number(c.case_id), case_name: c.case_name }))),
      ),
    ).then((all) => live && setCases(all.flat()))
    return () => {
      live = false
    }
  }, [q, cases, projects])
  useEffect(() => {
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])
  const term = q.trim().toLowerCase()
  const hits = term
    ? [
        ...projects.filter((p) => p.project_name.toLowerCase().includes(term)).map((p) => ({ key: `p${p.project_id}`, label: p.project_name, meta: 'Project', href: `/project/${p.project_id}` })),
        ...(cases ?? [])
          .filter((c) => c.case_name.toLowerCase().includes(term))
          .map((c) => ({ key: `c${c.case_id}`, label: c.case_name, meta: c.project_name, href: `/project/${c.project_id}/case/${c.case_id}` })),
      ].slice(0, 8)
    : []
  return (
    <div ref={box} style={{ position: 'relative', width: 340, maxWidth: '100%' }}>
      <label className="ds-sr-only" htmlFor="home-find">
        Find a project or case
      </label>
      <input
        id="home-find"
        className="ds-input"
        style={{ width: '100%', height: 44, paddingLeft: 38 }}
        placeholder="Find a project or case"
        value={q}
        role="combobox"
        aria-expanded={open && !!term}
        aria-controls="home-find-list"
        aria-autocomplete="list"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
          if (e.key === 'Enter' && hits[0]) router.push(hits[0].href)
        }}
      />
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden style={{ position: 'absolute', left: 13, top: 14, color: 'var(--ds-text-2)' }}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      {open && term && (
        <ul id="home-find-list" role="listbox" className="ws-menu" style={{ left: 0, right: 0, top: 50, listStyle: 'none', margin: 0 }}>
          {hits.map((h) => (
            <li key={h.key} role="option" aria-selected={false}>
              <Link href={h.href} className="home-hit">
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.label}</span>
                <span className="ds-option-meta">{h.meta}</span>
              </Link>
            </li>
          ))}
          {!hits.length && <li style={{ padding: '8px 12px', fontSize: 13, color: 'var(--ds-text-3)' }}>{cases ? 'Nothing matches.' : 'Looking…'}</li>}
        </ul>
      )}
    </div>
  )
}
