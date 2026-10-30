'use client'

// The project Overview in the design system, for every project, the sample
// included (P01). It replaces the classic overview family (project-overview-
// page, project-header, case-tabs, case-tree-panel, case-actions, comparison-
// banner) and keeps every one of their rows (P02 to P29); the writes stay in
// lib/project. Controls follow the person's role (P30); the server enforces it.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Button, Callout, Card, ConfirmDialog, ErrorCard, KeyValue, SectionLabel, TextDialog } from '@/components/lcapix/ds'
import { MiniCanvas } from '@/components/lcapix/project/mini-canvas'
import { apiRequest } from '@/lib/api-client'
import { caseReadiness, journeyPhases, type JourneyPhase } from '@/lib/case-journey'
import { LAYER_LABEL, type CaseLayer } from '@/lib/ingest/doc-types'
import { comparisonBanner, type ComparisonBanner } from '@/lib/project/comparison-banner'
import { nodeDetailsMetrics, nodePathLabel } from '@/lib/project/case-tree'
import { useHierarchyDialog } from '@/lib/project/use-hierarchy-dialog'
import { useProject } from '@/lib/project/use-project'
import { useProjectActions } from '@/lib/project/use-project-actions'
import { workspaceView } from '@/lib/project/workspace'
import { projectCapabilities } from '@/lib/project-role'
import { useShellStore } from '@/lib/shell/use-shell'
import { fixed, money, result3 } from '@/lib/ui/format'
import { makeOwnCopy } from '@/lib/workspace/make-copy'
import { HierarchyView } from './hierarchy-view'
import { ProjectSettings } from './project-settings'

export function ProjectHub() {
  const params = useParams()
  const router = useRouter()
  const projectId = String(params.projectId)
  const data = useProject(projectId, router)
  const actions = useProjectActions({
    projectId,
    router,
    project: data.project,
    setProject: data.setProject,
    activeCaseId: data.activeCaseId,
    setActiveCaseId: data.setActiveCaseId,
  })
  const hierarchy = useHierarchyDialog()
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState<'case' | 'project' | null>(null)
  const [copyBusy, setCopyBusy] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)
  const banner = useComparisonBanner(projectId, data.project?.cases ?? [])
  const journey = useJourney(projectId, data.activeCaseId)

  if (data.isLoading || !data.project) return <p role="status">Loading the project…</p>

  const project = data.project as any
  const view = workspaceView(project, data.activeCaseId, data.caseImpact)
  const sample = !!project.isSample
  // The sample is read-only for everyone: its controls are "Make my own copy".
  const caps = sample ? { ...projectCapabilities('viewer'), canDeleteProject: false } : projectCapabilities(project.myRole)
  const active = view.activeCase
  const selected = data.selectedTreeNode
  const emptyComp = !!active && active.type !== 'base' && !data.isLoadingCaseTree && !data.caseTree && !data.caseTreeError
  const goCase = (id: string, extra = '') => router.push(`/project/${projectId}/case/${id}${extra}`)
  const canRun = journey.readiness?.canRun ?? true

  const makeCopy = async () => {
    const base = view.baseCases[0]
    if (!base) return
    setCopyBusy(true)
    setCopyError(null)
    try {
      const id = await makeOwnCopy(Number(base.id), useShellStore.getState().profile?.fullName?.trim() || null)
      router.push(`/project/${projectId}/case/${id}`)
    } catch (e: any) {
      setCopyError(e?.message ?? 'The copy was not made.')
      setCopyBusy(false)
    }
  }

  return (
    <div className="np hub" style={{ padding: '8px 0 48px' }}>
      <nav aria-label="Breadcrumb" className="ds-breadcrumb">
        <button type="button" className="ds-link" onClick={() => router.push('/home')}>
          Projects
        </button>
        <span aria-hidden> › </span>
        <span aria-current="page">{project.name || 'Project'}</span>
      </nav>

      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 8 }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="ds-title" style={{ margin: 0, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {project.name || 'Project'}
            {view.projectTypeLabel === 'comparative' && <span className="ds-count">comparison</span>}
            {sample && <span className="ds-flag ds-flag--sample">Sample</span>}
          </h1>
          {project.description && <p className="np-sub">{project.description}</p>}
        </div>
        <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button
            disabledReason={active ? undefined : 'Add a case first'}
            onClick={() => active && router.push(`/project/${projectId}/case/${active.id}/results`)}
          >
            Analytics
          </Button>
          <Button disabled={view.cases.length < 2} disabledReason={view.cases.length < 2 ? 'Needs two cases' : undefined} onClick={() => router.push(`/project/${projectId}/comparison`)}>
            Compare Cases
          </Button>
          <Button onClick={() => router.push(`/project/${projectId}/cases`)}>Class</Button>
          {caps.canEdit && <Button onClick={() => router.push(`/project/${projectId}/import`)}>Import Data</Button>}
          {caps.canEdit && (
            <Button variant="primary" onClick={actions.handleAddCase}>
              Add Case
            </Button>
          )}
          {sample && (
            <Button variant="primary" busy={copyBusy} onClick={() => void makeCopy()}>
              Make my own copy
            </Button>
          )}
          {caps.canDeleteProject && (
            <Button variant="danger-quiet" onClick={() => setDeleting('project')}>
              Delete
            </Button>
          )}
        </span>
      </header>
      {copyError && <ErrorCard title="The copy was not made" cause={copyError} onRetry={() => void makeCopy()} />}
      {sample && (
        <Callout tone="info" lead="The sample study is read-only.">
          Read it, then make your own copy to change it and run it.
        </Callout>
      )}
      {caps.readOnly && !sample && (
        <Callout tone="info" lead="You can read this project.">
          The owner or an admin can give you a role that changes it.
        </Callout>
      )}

      <ul aria-label="Project summary" className="hub-kpis">
        {view.kpis.map((k) => (
          <li key={k.label} className="ds-card ds-card-pad">
            <span className="ds-section-label">{k.label}</span>
            <strong className="ds-num" style={{ display: 'block', fontSize: 22 }}>
              {k.value}
            </strong>
            <span style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>{k.note}</span>
          </li>
        ))}
      </ul>

      {view.showComparisonBanner && <Banner banner={banner} projectId={projectId} />}

      <div role="group" aria-label="Cases" className="hub-cases">
        {view.baseCases.map((c: any) => (
          <button key={c.id} type="button" className="ds-btn" aria-pressed={c.id === active?.id} onClick={() => data.setActiveCaseId(c.id)}>
            {c.name}
            <span className="ds-mono" style={{ fontSize: 12 }}>
              {' '}
              base · {c.componentCount ?? c.components?.length ?? 0} steps
            </span>
          </button>
        ))}
        {view.comparativeCases.map((c: any, i: number) => (
          <button
            key={c.id}
            type="button"
            className="ds-btn"
            aria-label={`Comparative ${i + 1} of ${view.comparativeCases.length} ${c.name}`}
            aria-pressed={c.id === active?.id}
            onClick={() => data.setActiveCaseId(c.id)}
          >
            {c.name}
            <span className="ds-mono" style={{ fontSize: 12 }}>
              {' '}
              {c.componentCount ?? c.components?.length ?? 0} steps
            </span>
          </button>
        ))}
        {caps.canEdit && (
          <Button size="small" onClick={actions.handleAddCase}>
            Add case
          </Button>
        )}
      </div>

      {active?.description && <p className="np-sub">{active.description}</p>}

      <div className="hub-panes">
        <section className="ds-card ds-card-pad" aria-label="Case tree">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {caps.canEdit && active && (
              <Button size="small" aria-label="Add a step" onClick={() => goCase(active.id, '?add=step')}>
                + Add a step
              </Button>
            )}
            {active && (
              <Button size="small" onClick={() => goCase(active.id)}>
                Open editor
              </Button>
            )}
            {active && (
              <Button size="small" onClick={() => void hierarchy.openTreeModal(active.id)}>
                View Full Hierarchy
              </Button>
            )}
          </div>
          {data.caseTreeError ? (
            <p role="alert">{data.caseTreeError}</p>
          ) : data.isLoadingCaseTree ? (
            <p role="status">Loading the steps…</p>
          ) : data.caseTree ? (
            // The canvas places its steps absolutely inside its parent: this frame holds them.
            <div className="hub-canvas" role="group" aria-label="Steps of the case">
              <MiniCanvas tree={data.caseTree} selectedId={selected?.id ?? null} onSelect={(n: any) => data.setSelectedTreeNode(n)} />
            </div>
          ) : emptyComp ? null : (
            <p className="np-sub">No steps yet.</p>
          )}
          {selected && <NodeDetails node={selected} tree={data.caseTree} impact={data.caseImpact} onOpen={() => active && goCase(active.id, `?componentId=${selected.id}`)} onDismiss={() => data.setSelectedTreeNode(null)} />}
          {emptyComp && (
            <Callout tone="info" lead="This case is empty.">
              {caps.canEdit ? 'Copy the base case’s steps and flows into it, or start from nothing.' : 'It has no steps yet.'}
              {caps.canEdit && (
                <span style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <Button size="small" variant="primary" onClick={() => void actions.handleCloneFromBase(active)}>
                    Clone from base
                  </Button>
                  <Button size="small" onClick={() => goCase(active.id)}>
                    Start blank
                  </Button>
                </span>
              )}
            </Callout>
          )}
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <section className="ds-card ds-card-pad" aria-labelledby="impact-h">
            <h2 id="impact-h" className="ds-section-label" style={{ margin: 0 }}>
              Impact Overview
            </h2>
            {data.impactError ? (
              <p role="alert">The latest run could not be read: {data.impactError}</p>
            ) : (
              <KeyValue
                rows={[
                  [data.caseImpact?.method ? `Global Warming · ${data.caseImpact.method}` : 'Global Warming', view.assessed && view.totalImpact != null ? `${result3(view.totalImpact)} ${view.impactUnit}` : 'Not yet assessed'],
                  ['Categories in the run', data.caseImpact?.categoryCount != null ? String(data.caseImpact.categoryCount) : '–'],
                  ['Steps and flows', `${view.componentCount} steps · ${view.driverCount} flows`],
                ]}
              />
            )}
          </section>
          <section className="ds-card ds-card-pad" aria-labelledby="top-h">
            <h2 id="top-h" className="ds-section-label" style={{ margin: 0 }}>
              Top contributors
            </h2>
            {data.impactError ? (
              <p role="alert">Not loaded.</p>
            ) : view.contributors.length === 0 ? (
              <p>No run yet.</p>
            ) : (
              <ol style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {view.contributors.map((c) => (
                  <li key={c.name}>
                    {c.name} <span className="ds-num">{result3(c.value)}</span> ({fixed(Number(c.pct), 1)}%)
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section className="ds-card ds-card-pad" aria-labelledby="cost-h">
            <h2 id="cost-h" className="ds-section-label" style={{ margin: 0 }}>
              Cost summary
            </h2>
            {data.costsError ? (
              <p role="alert">The costs could not be read: {data.costsError}</p>
            ) : data.caseImpact?.costs ? (
              <KeyValue
                rows={[
                  ['Total', money(data.caseImpact.costs.total)],
                  ['Labour', money(data.caseImpact.costs.labor)],
                  ['Energy', money(data.caseImpact.costs.energy)],
                  ['Material', money(data.caseImpact.costs.material)],
                  ['Overhead', money(data.caseImpact.costs.overhead)],
                ]}
              />
            ) : (
              <p>No cost entered.</p>
            )}
          </section>
          <section className="ds-card ds-card-pad" aria-labelledby="goal-h">
            <h2 id="goal-h" className="ds-section-label" style={{ margin: 0 }}>
              Goal & scope
            </h2>
            <p style={{ margin: '6px 0' }}>
              Functional unit: {project.functionalUnit || 'not set. Set it before a run.'}
            </p>
            {journey.phases && <Journey phases={journey.phases} reason={journey.reason} present={journey.present} missing={journey.missing} />}
          </section>
          {caps.canEdit && active && (
            <Button variant="primary" busy={actions.isRunningAssessment} disabledReason={canRun ? undefined : journey.reason ?? undefined} onClick={() => void actions.handleRunAssessment(active)}>
              Run Assessment
            </Button>
          )}
          {active && <Button onClick={() => router.push(`/project/${projectId}/case/${active.id}/results`)}>Results</Button>}
          {active && (caps.canEdit || caps.canManage) && (
            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {caps.canEdit && <Button onClick={() => setRenaming(true)}>Rename case</Button>}
              {/* Deleting a case needs admin on the server (DELETE /api/cases/:id), so only an admin sees it. */}
              {caps.canManage && (
                <Button variant="danger-quiet" onClick={() => setDeleting('case')}>
                  Delete case
                </Button>
              )}
            </span>
          )}
        </div>
      </div>

      <TextDialog
        open={renaming && !!active}
        title="Rename case"
        label="Case name"
        initial={active?.name ?? ''}
        confirmLabel="Rename"
        busy={actions.renameBusy}
        error={actions.renameError}
        onCancel={() => {
          setRenaming(false)
          actions.cancelRename()
        }}
        onSubmit={(name) => active && void actions.handleRenameCase(active.id, name).then(() => setRenaming(false))}
      />
      <ConfirmDialog
        open={deleting === 'case' && !!active}
        title="Delete this case?"
        consequence={`"${active?.name ?? 'This case'}" and its steps, flows and runs are removed. This cannot be undone.`}
        confirmLabel="Delete case"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          setDeleting(null)
          if (active) void actions.handleDeleteCase(String(active.id), { confirmed: true })
        }}
      />
      <ConfirmDialog
        open={deleting === 'project'}
        title={`Delete "${project.name}"?`}
        consequence="The project and all of its cases, flows and runs are removed. This cannot be undone."
        confirmLabel="Delete project"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          setDeleting(null)
          void actions.handleDeleteProject({ confirmed: true })
        }}
      />
      <HierarchyView state={hierarchy} />
      {caps.canManage && <ProjectSettings project={project} projectId={projectId} owner={caps.canDeleteProject} onSaved={(p) => data.setProject((cur: any) => (cur ? { ...cur, ...p } : cur))} />}
    </div>
  )
}

/** P13: real numbers from the compare route, or the reason there are none. Never an invented number. */
function useComparisonBanner(projectId: string, cases: any[]): ComparisonBanner | null | 'loading' {
  const base = cases.find((c) => c.type === 'base')
  const other = cases.find((c) => c !== base)
  const key = base && other ? `${base.id},${other.id}` : ''
  const [banner, setBanner] = useState<ComparisonBanner | null | 'loading'>(null)
  useEffect(() => {
    if (!key) return setBanner(null)
    let live = true
    setBanner('loading')
    apiRequest(`/api/projects/${projectId}/compare?cases=${key}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setBanner(d?.success ? comparisonBanner(d.cases) : null))
      .catch(() => live && setBanner(null))
    return () => {
      live = false
    }
  }, [projectId, key])
  return banner
}

function Banner({ banner, projectId }: { banner: ComparisonBanner | null | 'loading'; projectId: string }) {
  if (!banner || banner === 'loading') return null
  return (
    <section aria-label="Comparison" className="ds-card ds-card-pad" style={{ margin: '12px 0' }}>
      <strong>
        Comparing {banner.other} vs {banner.base}
      </strong>
      <span style={{ marginLeft: 8 }}>{banner.line ?? `No number yet. ${banner.why}`}</span>{' '}
      <Link className="ds-link" href={`/project/${projectId}/comparison`}>
        Open Compare
      </Link>
    </section>
  )
}

function NodeDetails({ node, tree, impact, onOpen, onDismiss }: { node: any; tree: any; impact: any; onOpen: () => void; onDismiss: () => void }) {
  const m = nodeDetailsMetrics(node, impact)
  return (
    <Card>
      <SectionLabel>Step</SectionLabel>
      <strong style={{ display: 'block', margin: '4px 0' }}>{node.label}</strong>
      <KeyValue
        rows={[
          ['Path', `Path: ${nodePathLabel(tree, node)}`],
          ['Climate impact', m.co2 != null ? `${result3(m.co2)} (${m.co2Pct}% of the case)` : 'Run the case to see it'],
          ['Cost', m.cost ? money(m.cost) : 'None entered'],
          ['Flows', String(m.flows)],
          ['Steps under it', String(m.childCount)],
        ]}
      />
      <span style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Button size="small" onClick={onOpen}>
          Open in editor
        </Button>
        <Button size="small" aria-label="Dismiss details" onClick={onDismiss}>
          Dismiss
        </Button>
      </span>
    </Card>
  )
}

/** P25: where the case is in the ISO phases, what it has and lacks, and whether it can run. */
function useJourney(projectId: string, caseId: string | null) {
  const [state, setState] = useState<{
    fuSet: boolean | null
    present: string[]
    missing: Array<{ layer: string; label: string; suggestedDocs: string[] }>
    hasAssessment: boolean
  } | null>(null)
  useEffect(() => {
    setState(null)
    if (!caseId) return
    let live = true
    ;(async () => {
      try {
        const [pr, cr, ar] = await Promise.all([
          apiRequest(`/api/projects/${projectId}`),
          apiRequest(`/api/cases/${caseId}/completeness`),
          apiRequest(`/api/cases/${caseId}/assessments?latest=1`),
        ])
        const p = (await pr.json())?.project ?? {}
        const report = (await cr.json())?.report ?? { present: [], missing: [] }
        const runs = ((await ar.json())?.assessments ?? []).filter((a: any) => (!a.status || a.status === 'completed') && Object.keys(a.impacts ?? {}).length > 0)
        if (!live) return
        setState({
          fuSet: 'functional_unit' in p ? !!String(p.functional_unit ?? '').trim() : null,
          present: report.present ?? [],
          missing: report.missing ?? [],
          hasAssessment: runs.length > 0,
        })
      } catch {
        // Advisory: without it the page still works and nothing is blocked.
      }
    })()
    return () => {
      live = false
    }
  }, [projectId, caseId])
  return useMemo(() => {
    if (!state) return { readiness: null, reason: null, phases: null, present: [], missing: [] }
    const readiness = caseReadiness(state)
    const reason =
      readiness.blocker === 'functional-unit'
        ? 'Set the functional unit (Goal & scope) first.'
        : readiness.blocker === 'inventory'
          ? 'Add at least one input or emission first: a run with none would be all zeros.'
          : null
    return { readiness, reason, phases: journeyPhases(state), present: state.present, missing: state.missing }
  }, [state])
}

function Journey({ phases, reason, present, missing }: { phases: JourneyPhase[]; reason: string | null; present: string[]; missing: Array<{ layer: string; label: string; suggestedDocs: string[] }> }) {
  const impact = phases.find((p) => p.label === 'Impact')
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <ol aria-label="ISO phases" className="hub-phases">
        {phases.map((p) => (
          <li key={p.label} data-state={p.state}>
            <span className="ds-mono">{p.state === 'done' ? '✓' : p.state === 'partial' ? '◐' : '○'}</span> {p.label}
          </li>
        ))}
      </ol>
      <p style={{ margin: 0 }}>
        {reason
          ? `Can't run yet. ${reason}`
          : impact?.state === 'partial'
            ? 'Assessed on partial data. Add the missing data and run it again.'
            : impact?.state === 'done'
              ? 'Assessed. Next: read the results.'
              : 'Ready to run.'}
      </p>
      <p style={{ margin: 0, fontSize: 13 }}>
        <span className="ds-section-label">Documents and data added </span>
        {present.length ? present.map((l) => `✓ ${LAYER_LABEL[l as CaseLayer] ?? l}`).join(' · ') : 'nothing yet'}
        {missing.length ? ` · To add: ${missing.map((m) => m.label).join(', ')}` : ''}
      </p>
    </div>
  )
}
