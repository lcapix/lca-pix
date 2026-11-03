'use client'

// Home (E02, E12, behaviour spec "Sequence" 6): nothing yet → the three ways
// in; the sample alone → the sample study's Overview; later → Continue (the
// case opened last on this device), Needs attention, your projects with their
// latest result, the sample as a small row with Remove, and Recent findings as
// Coming soon. Search finds a project or a case. /home?view=all is "All
// projects": the list, even when the sample is all there is (C3).

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, ComingSoon, ConfirmDialog, CountPill, EmptyState, ErrorCard, Segmented } from '@/components/lcapix/ds'
import { runLabel } from '@/lib/results/full-results-view'
import { apiRequest } from '@/lib/api-client'
import { useShellData, useShellStore } from '@/lib/shell/use-shell'
import { caseTotal, co2Unit } from '@/lib/ui/format'
import { continueNext, continueParts, countsLine, homeMode, needsAttention, projectMeta, toHomeProject, type HomeProject } from '@/lib/home/home-view'
import { homeKpis, ISO_STEPS, libraryCounts } from '@/lib/home/projects'
import { useContinueCase } from '@/lib/home/use-continue'
import { readLastCase, whenWords } from '@/lib/home/last-case'
import { SampleOverview } from './sample-overview'
import { AssignedToYou } from './assigned-to-you'
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
  const allProjects = useSearchParams()?.get('view') === 'all'

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
  if (mode === 'sample' && !allProjects) {
    const sample = projects.find((p) => p.is_sample)!
    return <SampleOverview projectId={sample.project_id} ownName={ownName} ownsProject={owns} />
  }
  if (mode === 'empty') return <EmptyHome teaching={profile?.useCase === 'teaching'} />
  // Projects shared with them and none they run: the student's Home (E13, E15).
  if (isStudentHome(projects, userId) && !allProjects) return <StudentHome projects={projects} userId={userId} fullName={ownName} />
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
      return Number(d?.project_id) || null
    } catch (e: any) {
      setError(e?.message ?? 'the sample was not built')
      return null
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, build }
}

/** No project yet (the sample was skipped, removed, or failed): the three ways in. */
function EmptyHome({ teaching }: { teaching: boolean }) {
  const router = useRouter()
  const { busy, error, build } = useAddSample()
  // C3: the button goes to the study, not back to Home.
  const openSample = async () => {
    const id = await build()
    if (id) router.push(`/project/${id}`)
  }
  return (
    <div className="home">
      <header className="home-head">
        <h1 className="ds-title">Welcome to LCAPIX</h1>
        <p className="home-sub">Start one of three ways.</p>
      </header>
      {teaching && <SetUpClass />}
      {/* G27: the ISO 14040 path every project follows. */}
      <section aria-labelledby="iso-h" style={{ margin: '8px 0 16px' }}>
        <h2 id="iso-h" className="ds-section-label">
          ISO 14040 · 5 phases
        </h2>
        <ol className="np-rail">
          {ISO_STEPS.map((p, i) => (
            <li key={p.title}>
              <strong>
                {i + 1}. {p.title}
              </strong>
              <span>{p.description}</span>
            </li>
          ))}
        </ol>
      </section>
      <div className="home-ways">
        <div className="so-next-card">
          <span className="ds-section-label" style={{ color: 'var(--ds-green)' }}>
            Read first
          </span>
          <h2>Open the sample study</h2>
          <p>A finished study of a painted steel bracket, built for you in a few seconds: the question, the tree, what goes in, the answer.</p>
          <Button variant="primary" onClick={() => void openSample()} busy={busy}>
            Open the sample study
          </Button>
          {error && (
            <ErrorCard title="We couldn't build the sample study. Nothing was lost." cause={error} onRetry={() => void openSample()} />
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
      {/* G30: the standards the method follows, as classic named them. */}
      <section aria-labelledby="trust-h" style={{ marginTop: 24, textAlign: 'center' }}>
        <h2 id="trust-h" className="ds-section-label">
          Built on standards you can defend
        </h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0', display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {TRUST.map((t) => (
            <li key={t.label} className="ds-tag" title={t.hint}>
              {t.label}
            </li>
          ))}
        </ul>
        <p className="np-sub">Methodology-grade calculations, traceable from inventory to result.</p>
      </section>
    </div>
  )
}

const TRUST = [
  { label: 'ISO 14040', hint: 'Life cycle assessment: principles and framework' },
  { label: 'ISO 14044', hint: 'Life cycle assessment: requirements and guidelines' },
  { label: 'GHG Protocol', hint: 'Greenhouse Gas Protocol corporate standard' },
  { label: 'EPD', hint: 'Environmental Product Declaration framework' },
  { label: 'PEF', hint: 'EU Product Environmental Footprint' },
]

/**
 * 2.1: someone teaching a class is offered one: a project where students see
 * only their own case, opened on People to add the class.
 */
function SetUpClass() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const go = async () => {
    setBusy(true)
    setError(null)
    try {
      let id = 0
      for (let i = 1; i <= 20 && !id; i++) {
        const res = await apiRequest('/api/projects', { method: 'POST', body: JSON.stringify({ project_name: i === 1 ? 'My class' : `My class ${i}`, description: 'A class: each student works in their own case.' }) })
        const d = await res.json().catch(() => ({}))
        if (res.status === 409) continue
        if (!res.ok) throw new Error(d?.error ?? `error ${res.status}`)
        id = Number(d?.project?.project_id ?? d?.project_id)
      }
      if (!id) throw new Error('every class name tried is taken; rename one of your classes')
      const put = await apiRequest(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify({ members_see_own_cases: true }) })
      if (!put.ok) throw new Error(`the class was made, but "see only their own case" was not switched on (${put.status})`)
      await useShellStore.getState().refresh()
      router.push(`/project/${id}/people`)
    } catch (e: any) {
      setError(e?.message ?? 'the class was not set up')
      setBusy(false)
    }
  }
  return (
    <section aria-labelledby="class-h" className="ds-card ds-card-pad" style={{ margin: '12px 0' }}>
      <h2 id="class-h" className="ds-section-label" style={{ margin: 0 }}>
        Teaching a class
      </h2>
      <p style={{ margin: '6px 0 10px' }}>Set up a class project: each student sees only their own case, and you see everyone&apos;s. Then add the class on People.</p>
      <Button variant="primary" busy={busy} onClick={() => void go()}>
        Set up a class
      </Button>
      {error && <ErrorCard title="The class was not set up" cause={error} onRetry={() => void go()} />}
    </section>
  )
}

function HomeLater({ projects, userId, firstName, teaching }: { projects: HomeProject[]; userId: number; firstName: string | null; teaching: boolean }) {
  const router = useRouter()
  const cont = useContinueCase(userId)
  const items = needsAttention(projects, userId, teaching ? 'student' : 'member')
  const own = projects.filter((p) => !p.is_sample)
  const sample = projects.find((p) => p.is_sample) ?? null
  const last = readLastCase(userId)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'base' | 'comp'>('all')
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [lib, setLib] = useState<{ factors: number; components: number } | null>(null)
  const [libError, setLibError] = useState<string | null>(null)
  const [pinError, setPinError] = useState<string | null>(null)
  const addSample = useAddSample()
  const phone = usePhone()
  useEffect(() => {
    let live = true
    apiRequest('/api/integrations/status')
      .then(async (r) => {
        if (!r.ok) throw new Error(`error ${r.status}`)
        return r.json()
      })
      .then((d) => live && setLib(libraryCounts(d)))
      .catch((e) => live && setLibError(e?.message ?? 'the library did not load'))
    return () => {
      live = false
    }
  }, [])
  const shown = own.filter((p) => (filter === 'all' ? true : filter === 'base' ? p.case_count <= 1 : p.case_count > 1))
  const tiles = homeKpis({
    projectCount: own.length,
    totalCases: own.reduce((s, p) => s + p.case_count, 0),
    totalComponents: own.reduce((s, p) => s + p.component_count, 0),
    factors: lib?.factors ?? null,
    substances: lib?.components ?? null,
    // G08, G09: a failed read says so, never "Loading…" for good.
    libraryError: libError,
    fmtInt: (n) => n.toLocaleString('en-US'),
  })

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
      <AssignedToYou projects={projects} userId={userId} />
      <ul aria-label="Home counts" style={{ display: 'flex', gap: 12, listStyle: 'none', padding: 0, flexWrap: 'wrap' }}>
        {tiles.map((k) => (
          <li key={k.label} className="ds-card" style={{ padding: 12, minWidth: 140 }}>
            {k.href ? <Link href={k.href}><strong>{k.label}</strong></Link> : <strong>{k.label}</strong>}
            <span style={{ display: 'block', fontSize: 22 }}>{k.display ?? k.numeric}</span>
            <span style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>{k.sub}</span>
          </li>
        ))}
      </ul>
      {teaching && <SetUpClass />}

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
            Your projects · {shown.length}
          </h2>
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginRight: 12 }}>
            <Segmented
              label="Show projects"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'base', label: 'Single case' },
                { value: 'comp', label: 'Comparison' },
              ]}
            />
            <Segmented
              label="Layout"
              value={layout}
              onChange={setLayout}
              options={[
                { value: 'grid', label: 'Grid' },
                { value: 'list', label: 'List' },
              ]}
            />
          </span>
          <Link href="/project/new" className="ds-link" style={{ fontWeight: 600 }}>
            + New project
          </Link>
        </div>
        {pinError && (
          <p role="alert" className="edu-error">
            {pinError}
          </p>
        )}
        {shown.length && layout === 'list' ? (
          <ProjectList projects={shown} />
        ) : shown.length ? (
          <div className="home-projects" data-layout={layout}>
            {shown.map((p) => (
              <div key={p.project_id} className="home-project ds-focusable" style={{ display: 'flex', gap: 12 }}>
                <Link href={`/project/${p.project_id}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: 'block', fontSize: 19 }}>{p.project_name}</strong>
                  {p.description && <span style={{ display: 'block', fontSize: 14 }}>{p.description}</span>}
                  <span style={{ fontSize: 14, color: 'var(--ds-text-2)' }}>{projectMeta(p, userId)}</span>
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--ds-text-2)' }}>
                    <span className="ds-tag" style={{ marginRight: 6 }}>{p.case_count > 1 ? 'Comparison' : 'Single case'}</span>
                    {p.case_count} {p.case_count === 1 ? 'case' : 'cases'} · {p.component_count} steps
                    {p.base_run?.run_date ? ` · Last run ${whenWords(p.base_run.run_date)}` : ''}
                    {p.updated_at ? ` · Updated ${whenWords(p.updated_at)}` : ''}
                  </span>
                </span>
                <span style={{ textAlign: 'right' }}>
                  {p.base_run?.headline ? (
                    <>
                      <span className="ds-mono" style={{ display: 'block', fontSize: 26, fontWeight: 600 }}>
                        {caseTotal(p.base_run.headline.value, 'base')}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>
                        {co2Unit(p.base_run.headline.unit)} · Base case · {runLabel(p.base_run)}
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
              <button
                type="button"
                className="ds-link"
                aria-label={`${p.pinned ? 'Unpin' : 'Pin'} ${p.project_name}`}
                aria-pressed={!!p.pinned}
                onClick={async () => {
                  // G24: a refused pin (20 is the most) says why.
                  setPinError(null)
                  const res = await apiRequest(`/api/projects/${p.project_id}/pin`, { method: p.pinned ? 'DELETE' : 'PUT' })
                  if (!res.ok) {
                    const d = await res.json().catch(() => ({}))
                    setPinError(d?.error ?? `${p.project_name} was not ${p.pinned ? 'unpinned' : 'pinned'} (${res.status}).`)
                    return
                  }
                  await useShellStore.getState().refresh()
                }}
              >
                {p.pinned ? 'Unpin' : 'Pin'}
              </button>
            </div>
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
    c.latestRunId ? (c.latestRunNumber ? `Run ${c.latestRunNumber}` : `Run #${c.latestRunId}`) : 'no run yet',
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
        // G11: a project's description counts too.
        ...projects.filter((p) => p.project_name.toLowerCase().includes(term) || String((p as any).description ?? '').toLowerCase().includes(term)).map((p) => ({ key: `p${p.project_id}`, label: p.project_name, meta: 'Project', href: `/project/${p.project_id}` })),
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

/** G12, G22: the list view, one row per project with the classic columns. */
function ProjectList({ projects }: { projects: HomeProject[] }) {
  return (
    <div className="ds-table-wrap">
      <table className="ds-table" aria-label="Your projects">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Type</th>
            <th scope="col" className="ds-num">Cases</th>
            <th scope="col" className="ds-num">Steps</th>
            <th scope="col">Last run</th>
            <th scope="col">Updated</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.project_id}>
              <td>
                <Link className="ds-link" href={`/project/${p.project_id}`}>
                  {p.project_name}
                </Link>
              </td>
              <td>{p.case_count > 1 ? 'Comparison' : 'Single case'}</td>
              <td className="ds-num">{p.case_count}</td>
              <td className="ds-num">{p.component_count}</td>
              <td>{p.base_run?.run_date ? whenWords(p.base_run.run_date) : 'No run yet'}</td>
              <td>{p.updated_at ? whenWords(p.updated_at) : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
