'use client'

// Reports (E11): export a case as a report. Pick the project (when none is
// open), the case and its run; the sections are fixed today and listed as
// they print; pick PDF, PowerPoint or CSV and export. The preview shows what
// the report says (the answer, the steps that build it, the sections). A
// case with no run cannot be exported, and says which case has one.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button, ComingSoon, EmptyState, ErrorCard, SavedLine, Segmented } from '@/components/lcapix/ds'
import { useRecentProjects, useShellData } from '@/lib/shell/use-shell'
import { recentProjects } from '@/lib/shell/project-nav'
import { useProjectCases } from '@/lib/project/use-project-cases'
import { useCaseRuns } from '@/lib/workspace/use-runs'
import { runClimate, whatBuilds } from '@/lib/workspace/results-view'
import { downloadRunExport } from '@/lib/results/results-view'
import { perNoun } from '@/lib/compare/compare-view'
import { answer, caseTotal, co2Unit } from '@/lib/ui/format'
import { caseOption, FORMAT_LABEL, formatNote, INCLUDED, PDF_SECTIONS, scopeLine, type ReportFormat } from '@/lib/reports/report-view'

export function ReportsPage() {
  const search = useSearchParams()
  const { projects, profile, status } = useShellData()
  const recent = useRecentProjects(null)
  const fromUrl = Number(search?.get('project'))
  const fallback = useMemo(() => recentProjects(projects, recent, null, 1)[0]?.project_id ?? null, [projects, recent])
  const [projectId, setProjectId] = useState<number | null>(Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : null)
  useEffect(() => {
    if (projectId == null && fallback != null) setProjectId(fallback)
  }, [projectId, fallback])

  if (!projects.length && status === 'ready') {
    if (projectId == null) {
      return (
        <div className="np pc">
          <ReportsHead projectName={null} />
          <EmptyState
            line="A report is exported from a case with a run. Start a project first."
            action={
              <Link className="ds-btn ds-btn--primary" href="/project/new">
                + New project
              </Link>
            }
          />
        </div>
      )
    }
  }
  if (projectId == null) {
    return (
      <div className="np" role="status" style={{ color: 'var(--ds-text-2)' }}>
        Loading your projects…
      </div>
    )
  }
  return (
    <ReportBuilder
      key={projectId}
      projectId={projectId}
      projects={projects.map((p) => ({ id: p.project_id, name: p.project_name }))}
      pickProject={fromUrl > 0 ? null : setProjectId}
      initialCase={Number(search?.get('case')) || null}
      me={profile?.id ?? -1}
    />
  )
}

function ReportsHead({ projectName }: { projectName: string | null }) {
  return (
    <header className="pc-head">
      <div style={{ flex: 1, minWidth: 260 }}>
        {projectName && <p style={{ margin: 0, fontSize: 13, color: 'var(--ds-text-2)' }}>{projectName}</p>}
        <h1 className="ds-title" style={{ margin: '2px 0 0', display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          Reports <span style={{ fontSize: 15, fontWeight: 400, color: 'var(--ds-text-2)' }}>Export a case as a report</span>
        </h1>
      </div>
    </header>
  )
}

function ReportBuilder({
  projectId,
  projects,
  pickProject,
  initialCase,
  me,
}: {
  projectId: number
  projects: Array<{ id: number; name: string }>
  pickProject: ((id: number) => void) | null
  initialCase: number | null
  me: number
}) {
  const { data, error, reload } = useProjectCases(projectId)
  const [caseId, setCaseId] = useState<number | null>(null)
  const [runId, setRunId] = useState<number | null>(null)
  const [format, setFormat] = useState<ReportFormat>('pdf')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  // Mine first (base case first), then everyone else's; the asked-for case, else the base case.
  const ordered = useMemo(() => {
    if (!data) return []
    const rank = (c: (typeof data.cases)[number]) => (c.created_by === me ? 0 : 1) * 2 + (c.case_type === 'base' ? 0 : 1)
    return [...data.cases].sort((a, b) => rank(a) - rank(b) || a.case_id - b.case_id)
  }, [data, me])
  useEffect(() => {
    if (caseId != null || !ordered.length) return
    const asked = ordered.find((c) => c.case_id === initialCase)
    setCaseId((asked ?? ordered.find((c) => c.latest_run) ?? ordered[0]).case_id)
  }, [ordered, caseId, initialCase])

  const kase = ordered.find((c) => c.case_id === caseId) ?? null
  const { completed, status } = useCaseRuns(caseId ?? 0, null)
  const run = completed.find((r) => Number(r.run_id) === runId) ?? completed[0] ?? null
  useEffect(() => setRunId(null), [caseId])

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

  const climate = run ? runClimate(run) : null
  const builds = run && kase ? whatBuilds(run, kase.case_type).slice(0, 3) : []
  const fu = run?.goalScope?.functional_unit ?? data.project.functional_unit
  const scope = scopeLine({ project: data.project.project_name, method: run?.calculation_method ?? data.project.lcia_method, region: run?.regionCode ?? data.project.region_code, fu })
  const withRun = ordered.find((c) => c.latest_run && c.case_id !== caseId)
  const copy = kase?.case_type === 'base' ? ordered.find((c) => c.case_type !== 'base' && c.copied_from === kase.case_id) : null
  const showAuthor = ordered.some((c) => c.created_by !== me)
  const noRun = status === 'ready' && !run

  const doExport = async () => {
    if (!run || !kase) return
    setBusy(true)
    setExportError(null)
    setSaved(null)
    try {
      await downloadRunExport(Number(run.run_id), format, kase.case_name)
      setSaved(`Exported · ${FORMAT_LABEL[format]} of ${kase.case_name}, Run #${run.run_id}`)
    } catch (e: any) {
      setExportError(`The report was not exported: ${e?.message ?? 'the request failed'}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="np pc">
      <ReportsHead projectName={data.project.project_name} />
      <div className="rp-grid">
        <section className="pp-card" aria-labelledby="rp-build-h">
          <h2 id="rp-build-h" className="pp-card-h">
            Build a report
          </h2>

          {pickProject && projects.length > 1 && (
            <label className="rp-field">
              <span className="edu-field-label">Project</span>
              <select className="ds-input rp-select" value={projectId} onChange={(e) => pickProject(Number(e.target.value))}>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {!ordered.length ? (
            <p className="np-sub" style={{ marginTop: 16 }}>
              This project has no case yet.{' '}
              <Link className="ds-link" href={`/project/${projectId}/case/new`}>
                + New case
              </Link>
            </p>
          ) : (
            <>
              <label className="rp-field">
                <span className="edu-field-label">Case</span>
                <select className="ds-input rp-select" value={caseId ?? ''} onChange={(e) => setCaseId(Number(e.target.value))}>
                  {ordered.map((c) => (
                    <option key={c.case_id} value={c.case_id}>
                      {caseOption(c, showAuthor && c.created_by !== me)}
                    </option>
                  ))}
                </select>
              </label>
              {completed.length > 1 && (
                <label className="rp-field">
                  <span className="edu-field-label">Run</span>
                  <select className="ds-input rp-select" value={run?.run_id ?? ''} onChange={(e) => setRunId(Number(e.target.value))}>
                    {completed.map((r, i) => (
                      <option key={r.run_id} value={r.run_id}>
                        Run #{r.run_id}
                        {i === 0 ? ' · latest' : ''}
                        {r.run_date ? ` · ${new Date(r.run_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p style={{ margin: '8px 0 0', fontSize: 15, color: 'var(--ds-text-2)' }}>{scope}</p>

              <fieldset className="rp-include">
                <legend>
                  <span className="edu-field-label" style={{ display: 'inline' }}>
                    What to include
                  </span>{' '}
                  <span style={{ color: 'var(--ds-text-2)', fontSize: 15 }}>fixed sections today</span>
                </legend>
                <ul>
                  {INCLUDED.map((s) => (
                    <li key={s.label}>
                      <label>
                        <input type="checkbox" checked disabled aria-describedby="rp-always" />
                        <span style={{ flex: 1 }}>{s.label}</span>
                        <span className="rp-where">{s.where}</span>
                        <LockIcon />
                      </label>
                    </li>
                  ))}
                  {copy && (
                    <li data-off>
                      <label>
                        <input type="checkbox" disabled />
                        <span style={{ flex: 1 }}>Comparison with {copy.case_name}</span>
                        <span className="rp-where">Not in the PDF yet</span>
                      </label>
                    </li>
                  )}
                </ul>
                <p id="rp-always" className="rp-always">
                  <LockIcon /> Always in the report today
                </p>
              </fieldset>

              <span className="edu-field-label" style={{ display: 'block', margin: '20px 0 8px' }} aria-hidden>
                Format
              </span>
              <Segmented
                label="Format"
                value={format}
                onChange={setFormat}
                options={[
                  { value: 'pdf', label: 'PDF' },
                  { value: 'pptx', label: 'PowerPoint' },
                  { value: 'csv', label: 'CSV' },
                ]}
              />

              <div className="pp-add">
                <Button
                  variant="primary"
                  busy={busy}
                  disabled={!run}
                  disabledReason={
                    noRun ? `Needs a run.${withRun?.latest_run ? ` ${withRun.case_name} has Run #${withRun.latest_run.run_id}.` : ''}` : undefined
                  }
                  onClick={() => void doExport()}
                >
                  <DownloadIcon /> Export {FORMAT_LABEL[format]}
                </Button>
              </div>
              {run && <p style={{ margin: '10px 0 0', fontSize: 14, color: 'var(--ds-text-2)' }}>{formatNote(format, Number(run.run_id))}</p>}
              {noRun && kase && (
                <p style={{ margin: '10px 0 0', fontSize: 14 }}>
                  <Link className="ds-link" href={`/project/${projectId}/case/${kase.case_id}`}>
                    Open {kase.case_name} to run it
                  </Link>
                </p>
              )}
              {saved && (
                <div style={{ marginTop: 12 }}>
                  <SavedLine>{saved}</SavedLine>
                </div>
              )}
              {exportError && (
                <p role="alert" className="pp-alert" style={{ marginTop: 10 }}>
                  {exportError}
                </p>
              )}
            </>
          )}
        </section>

        <section className="pp-card rp-preview" aria-labelledby="rp-prev-h">
          <div className="rp-preview-head">
            <h2 id="rp-prev-h" className="ds-section-label" style={{ margin: 0 }}>
              Preview · what the report says
            </h2>
            <span className="ds-section-label">{format === 'pdf' ? 'A4 · PDF' : FORMAT_LABEL[format]}</span>
          </div>
          <div className="rp-desk">
            {run && kase && climate ? (
              <article className="rp-paper" aria-label={`What the report on ${kase.case_name} says`}>
                <div className="rp-paper-top">
                  <span>
                    <strong className="ds-mono">LCAPIX</strong> LCA report
                  </span>
                  <span className="ds-mono">Run #{run.run_id}</span>
                </div>
                <h3 className="rp-paper-title">{data.project.project_name}</h3>
                <p className="rp-paper-sub">{[kase.case_name, run.calculation_method, run.regionCode, fu ? `per ${fu}` : null].filter(Boolean).join(' · ')}</p>
                <hr />
                <p className="ds-section-label" style={{ margin: '0 0 4px' }}>
                  Global warming
                </p>
                <p className="rp-answer">
                  <span className="ds-mono">{answer(climate.value, kase.case_type)}</span>
                  <span>
                    {co2Unit(climate.unit)} per {perNoun(fu)}
                  </span>
                </p>
                <ul className="rp-bars">
                  {builds.map((b) => (
                    <li key={b.component_id}>
                      <span className="rp-bar-row">
                        <span>{b.name}</span>
                        <span className="ds-mono">{b.share}</span>
                      </span>
                      <span className="an-bar" aria-hidden>
                        <span style={{ width: `${Math.round(b.fraction * 100)}%` }} />
                      </span>
                    </li>
                  ))}
                </ul>
                <hr />
                <p className="ds-section-label" style={{ margin: '0 0 8px' }}>
                  {format === 'csv' ? 'In this file' : 'In this report'}
                </p>
                {format === 'csv' ? (
                  <p style={{ margin: 0, fontSize: 14 }}>
                    One row per flow and impact category: step, stage, substance, in or out, amount, unit, conversion, factor, scope, source, tier,
                    allocation, category, result and its unit. Six header lines first: run, project, case, method and region, functional unit, export time.
                  </p>
                ) : (
                  <ol className="rp-sections">
                    {PDF_SECTIONS.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                )}
              </article>
            ) : (
              <p className="np-sub" style={{ margin: 'auto', textAlign: 'center', maxWidth: 320 }}>
                {status === 'loading' && caseId ? 'Reading the run…' : 'The preview shows once the case has a run.'}
              </p>
            )}
          </div>
        </section>
      </div>
      <div style={{ marginTop: 18 }}>
        <ComingSoon>Choose sections, add a comparison, saved reports with versions</ComingSoon>
      </div>
    </div>
  )
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </svg>
  )
}
