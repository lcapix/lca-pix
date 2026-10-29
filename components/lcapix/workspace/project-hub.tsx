'use client'

// Project Overview in the design system. It replaces the classic overview
// family. The writes stay in lib/project. The sample study still uses its
// education overview.

import { useEffect, useState, type FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api-client'
import { useProject } from '@/lib/project/use-project'
import { useProjectActions } from '@/lib/project/use-project-actions'
import { nodePathLabel } from '@/lib/project/case-tree'
import { workspaceView } from '@/lib/project/workspace'
import { projectCapabilities } from '@/lib/project-role'
import type { DemoTreeNode } from '@/lib/lcapix-demo'

function flatten(node: DemoTreeNode | null): DemoTreeNode[] {
  if (!node || node.id === '__root__') return (node?.children ?? []).flatMap((c) => flatten(c))
  return [node, ...(node.children ?? []).flatMap((c) => flatten(c))]
}

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
  const [rename, setRename] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [treeOpen, setTreeOpen] = useState(false)

  useEffect(() => {
    if (!treeOpen && !rename) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTreeOpen(false)
        setRename(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [treeOpen, rename])

  if (data.isLoading || !data.project) {
    return <p role="status">Loading the project…</p>
  }

  const project = data.project
  const view = workspaceView(project, data.activeCaseId, data.caseImpact)
  const caps = projectCapabilities(project.myRole)
  const active = view.activeCase
  const nodes = flatten(data.caseTree)
  const selected = data.selectedTreeNode
  const emptyComp = !!active && active.type !== 'base' && !data.isLoadingCaseTree && !data.caseTree && !data.caseTreeError

  const goCase = (id: string) => router.push(`/project/${projectId}/case/${id}`)

  return (
    <div className="np" style={{ padding: '8px 0 48px' }}>
      <button type="button" className="ds-link" onClick={() => router.push('/home')}>
        Projects
      </button>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginTop: 8 }}>
        <div>
          <h1 className="ds-title" style={{ margin: 0, display: 'flex', gap: 10, alignItems: 'center' }}>
            {project.name || 'Project'}
            {view.projectTypeLabel === 'comparative' && <span className="ds-count">comparison</span>}
          </h1>
          {project.description && <p className="np-sub">{project.description}</p>}
        </div>
        <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {active && (
            <button type="button" className="ds-btn" onClick={() => router.push(`/project/${projectId}/case/${active.id}/results`)}>
              Analytics
            </button>
          )}
          <button type="button" className="ds-btn" disabled={view.cases.length < 2} onClick={() => router.push(`/project/${projectId}/comparison`)}>
            Compare Cases
          </button>
          <button type="button" className="ds-btn" onClick={() => router.push(`/project/${projectId}/class`)}>
            Class
          </button>
          {caps.canEdit && (
            <button type="button" className="ds-btn" onClick={() => router.push(`/project/${projectId}/import`)}>
              Import Data
            </button>
          )}
          {caps.canEdit && (
            <button type="button" className="ds-btn ds-btn--primary" onClick={actions.handleAddCase}>
              Add Case
            </button>
          )}
          {caps.canDeleteProject && (
            <button type="button" className="ds-btn" onClick={() => void actions.handleDeleteProject()}>
              Delete
            </button>
          )}
        </span>
      </header>

      <ul aria-label="Project summary" style={{ display: 'flex', gap: 12, listStyle: 'none', padding: 0, margin: '18px 0' }}>
        {view.kpis.map((k) => (
          <li key={k.label} className="ds-card" style={{ minWidth: 140, padding: 14 }}>
            <span className="ds-section-label">{k.label}</span>
            <strong style={{ display: 'block', fontSize: 22 }}>{k.value}</strong>
            <span style={{ fontSize: 13, color: 'var(--ds-text-2)' }}>{k.note}</span>
          </li>
        ))}
      </ul>

      {view.showComparisonBanner && (
        <p className="ds-card" style={{ padding: 14 }}>
          Comparing {view.baseCases[0]?.name || 'Baseline'} vs {view.comparativeCases[0]?.name || view.cases[1]?.name || 'Comparative'}
        </p>
      )}

      <div role="group" aria-label="Cases" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>
        {view.baseCases.map((c: any) => (
          <button key={c.id} type="button" className="ds-btn" aria-pressed={c.id === active?.id} onClick={() => data.setActiveCaseId(c.id)}>
            {c.name}
            <span> {c.componentCount ?? c.components?.length ?? 0} steps</span>
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
            <span> {c.componentCount ?? c.components?.length ?? 0} steps</span>
          </button>
        ))}
        {caps.canEdit && (
          <button type="button" className="ds-btn" onClick={actions.handleAddCase}>
            Add case
          </button>
        )}
      </div>

      {active?.description && <p>{active.description}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(260px, 1fr)', gap: 16, marginTop: 16 }}>
        <section className="ds-card" style={{ padding: 16 }} aria-label="Case tree">
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button type="button" className="ds-btn ds-btn--small" aria-label="+">+</button>
            {active && (
              <button type="button" className="ds-btn ds-btn--small" onClick={() => goCase(active.id)}>
                Open editor
              </button>
            )}
            <button type="button" className="ds-btn ds-btn--small" onClick={() => setTreeOpen(true)}>
              View Full Hierarchy
            </button>
          </div>
          {nodes.map((n) => (
            <button key={n.id} type="button" className="ds-link" style={{ display: 'block' }} onClick={() => data.setSelectedTreeNode(n)}>
              {n.label}
            </button>
          ))}
          {data.caseTreeError && <p role="alert">{data.caseTreeError}</p>}
          {selected && (
            <div style={{ marginTop: 12 }}>
              <strong>{selected.label}</strong>
              <div>Path: {nodePathLabel(data.caseTree, selected)}</div>
              <button type="button" className="ds-link" aria-label="Dismiss details" onClick={() => data.setSelectedTreeNode(null)}>
                Dismiss details
              </button>
              <button type="button" className="ds-link" onClick={() => active && goCase(active.id)}>
                Open in editor
              </button>
            </div>
          )}
          {emptyComp && caps.canEdit && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button type="button" className="ds-btn" onClick={() => void actions.handleCloneFromBase(active)}>
                Clone from base
              </button>
              <button type="button" className="ds-btn" onClick={() => goCase(active.id)}>
                Start blank
              </button>
            </div>
          )}
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <section className="ds-card" style={{ padding: 16 }} aria-labelledby="impact-h">
            <h2 id="impact-h" className="np-h2">Impact Overview</h2>
            <p>{view.assessed && view.totalImpact != null ? `${view.totalImpact.toFixed(3)} ${view.impactUnit}` : 'Not yet assessed'}</p>
            <p>{view.componentCount} steps · {view.driverCount} flows</p>
          </section>
          <section className="ds-card" style={{ padding: 16 }} aria-labelledby="top-h">
            <h2 id="top-h" className="np-h2">Top contributors</h2>
            {view.contributors.length === 0 && <p>No run yet.</p>}
            <ul>
              {view.contributors.map((c) => (
                <li key={c.name}>{c.name} {c.value.toFixed(3)}</li>
              ))}
            </ul>
          </section>
          <section className="ds-card" style={{ padding: 16 }} aria-labelledby="cost-h">
            <h2 id="cost-h" className="np-h2">Cost summary</h2>
            <p>{view.totalCost != null ? `$${view.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'No cost entered'}</p>
          </section>
          <section className="ds-card" style={{ padding: 16 }} aria-labelledby="goal-h">
            <h2 id="goal-h" className="np-h2">Goal & scope</h2>
            <p>{project.functionalUnit || project.functional_unit || 'Set the functional unit before a run.'}</p>
          </section>
          {caps.canEdit && active && (
            <button type="button" className="ds-btn ds-btn--primary" disabled={actions.isRunningAssessment} onClick={() => void actions.handleRunAssessment(active)}>
              Run Assessment
            </button>
          )}
          {active && (
            <button type="button" className="ds-btn" onClick={() => router.push(`/project/${projectId}/case/${active.id}/results`)}>
              Results
            </button>
          )}
          {caps.canEdit && active && (
            <span style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="ds-btn" onClick={() => { setRename(String(active.id)); setName(active.name ?? '') }}>
                Rename case
              </button>
              <button type="button" className="ds-btn" onClick={() => void actions.handleDeleteCase(String(active.id))}>
                Delete case
              </button>
            </span>
          )}
        </div>
      </div>

      {rename && (
        <form
          className="ds-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rename-title"
          onSubmit={(e) => {
            e.preventDefault()
            void actions.handleRenameCase(rename, name).then(() => setRename(null))
          }}
        >
          <h2 id="rename-title" className="ds-dialog-title">Rename case</h2>
          <label>
            <span className="ds-section-label">Name</span>
            <input className="ds-input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Case name" />
          </label>
          {actions.renameError && <p role="alert">{actions.renameError}</p>}
          <div className="ds-dialog-actions">
            <button type="button" className="ds-btn" onClick={() => setRename(null)}>Cancel</button>
            <button type="submit" className="ds-btn ds-btn--primary" disabled={actions.renameBusy}>Rename</button>
          </div>
        </form>
      )}

      {treeOpen && (
        <div className="ds-dialog" role="dialog" aria-modal="true" aria-labelledby="hier-title">
          <h2 id="hier-title" className="ds-dialog-title">Process Hierarchy</h2>
          <ul>
            {nodes.map((n) => (
              <li key={n.id}>{n.label}</li>
            ))}
          </ul>
          <button type="button" className="ds-btn" onClick={() => setTreeOpen(false)}>Close</button>
        </div>
      )}
      {caps.canManage && <ProjectSettings project={project} projectId={projectId} owner={caps.canDeleteProject} />}
    </div>
  )
}

function ProjectSettings({ project, projectId, owner }: { project: any; projectId: string; owner: boolean }) {
  const [name, setName] = useState(project.name ?? '')
  const [description, setDescription] = useState(project.description ?? '')
  const [goal, setGoal] = useState(project.goalStatement ?? '')
  const [unit, setUnit] = useState(project.functionalUnit ?? '')
  const [boundary, setBoundary] = useState(project.systemBoundary ?? 'cradle-to-gate')
  const [notes, setNotes] = useState(project.boundaryNotes ?? '')
  const [method, setMethod] = useState(project.lciaMethod ?? 'CML 2001')
  const [region, setRegion] = useState(project.regionCode ?? 'Global')
  const [ai, setAi] = useState(!!project.aiEnabled)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaved(null)
    const body: Record<string, unknown> = {
      project_name: name.trim(),
      description: description.trim(),
      goal_statement: goal.trim(),
      functional_unit: unit.trim(),
      system_boundary: boundary,
      boundary_notes: notes.trim(),
      lcia_method: method,
      region_code: region,
    }
    if (owner) body.ai_enabled = ai
    const res = await apiRequest(`/api/projects/${projectId}`, { method: 'PUT', body: JSON.stringify(body) })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) return setError(d?.error ?? `Not saved (${res.status}).`)
    setSaved('Saved.')
  }

  return (
    <form className="ds-card" style={{ padding: 16, marginTop: 18 }} onSubmit={(e) => void save(e)} aria-labelledby="settings-h">
      <h2 id="settings-h" className="np-h2">Project settings</h2>
      <label className="np-field">Name <input className="ds-input" aria-label="Project name" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="np-field">Description <textarea className="ds-input" aria-label="Description" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <label className="np-field">Goal of the study <textarea className="ds-input" aria-label="Goal of the study" value={goal} onChange={(e) => setGoal(e.target.value)} /></label>
      <label className="np-field">Functional unit <input className="ds-input" aria-label="Functional unit" value={unit} onChange={(e) => setUnit(e.target.value)} /></label>
      <label className="np-field">Boundary
        <select className="ds-input" aria-label="System boundary" value={boundary} onChange={(e) => setBoundary(e.target.value)}>
          <option value="cradle-to-gate">Cradle-to-gate</option>
          <option value="gate-to-gate">Gate-to-gate</option>
          <option value="cradle-to-grave">Cradle-to-grave</option>
        </select>
      </label>
      <label className="np-field">Exclusions <textarea className="ds-input" aria-label="Exclusions" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <label className="np-field">Method
        <select className="ds-input" aria-label="Default method" value={method} onChange={(e) => setMethod(e.target.value)}>
          {['CML 2001', 'ReCiPe Midpoint (H)', 'TRACI 2.1'].map((m) => <option key={m}>{m}</option>)}
        </select>
      </label>
      <label className="np-field">Region
        <select className="ds-input" aria-label="Default region" value={region} onChange={(e) => setRegion(e.target.value)}>
          {['Global', 'US', 'EU'].map((r) => <option key={r}>{r}</option>)}
        </select>
      </label>
      {owner && (
        <label className="np-field">
          <input type="checkbox" checked={ai} onChange={(e) => setAi(e.target.checked)} /> AI may read this project's figures
        </label>
      )}
      {error && <p role="alert">{error}</p>}
      {saved && <p role="status">{saved}</p>}
      <button type="submit" className="ds-btn ds-btn--primary">Save settings</button>
    </form>
  )
}
