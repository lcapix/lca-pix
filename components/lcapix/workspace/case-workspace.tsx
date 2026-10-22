'use client'

// Inside a case (behaviour spec "Inside a case", E03 to E06, E14): the header
// (name, facts, warning line, Case switcher, one primary), then the four tabs
// (Tree with its step count, Inventory with "N need an amount", Results with
// the run number, Write-up), Hide panel and Compare at the row's end. The tab
// is in the URL (?tab=), an older run too (?run=). Run Assessment runs the
// case with the study's method and region, counts the seconds, then opens
// Results.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { EmptyState, ErrorCard, Tabs } from '@/components/lcapix/ds'
import { MagicInsightsModal } from '@/components/lcapix/magic-insights-modal'
import { apiRequest } from '@/lib/api-client'
import { insightsBreakdownOf, insightsMaterialsOf } from '@/lib/results/insights-inputs'
import { useShellData } from '@/lib/shell/use-shell'
import { rememberCase } from '@/lib/home/last-case'
import { ownClimate, runClimate, subtreeSums } from '@/lib/workspace/results-view'
import { inventoryBadge } from '@/lib/workspace/inventory'
import { pickRun, useCaseRuns, type CompareTarget } from '@/lib/workspace/use-runs'
import { useCaseWorkspace } from '@/lib/workspace/use-workspace'
import { CaseHeader } from './case-header'
import { InventoryTab } from './inventory-tab'
import { ResultsPanel } from './results-panel'
import { TreeTab, type TreeView } from './tree-tab'
import { WriteUpPanel } from './write-up-panel'
import { usePhone } from '@/lib/shell/use-phone'

type Tab = 'tree' | 'inventory' | 'results' | 'writeup'
// The phone view loads only on a phone.
const PhoneCase = dynamic(() => import('./phone-case').then((m) => m.PhoneCase))
const TABS: Tab[] = ['tree', 'inventory', 'results', 'writeup']
const HIDDEN_KEY = 'lcapix-panel-hidden'

function usePanelHidden(): [boolean, (v: boolean) => void] {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(HIDDEN_KEY) === '1')
    } catch {}
  }, [])
  const set = (v: boolean) => {
    setHidden(v)
    try {
      localStorage.setItem(HIDDEN_KEY, v ? '1' : '0')
    } catch {}
  }
  return [hidden, set]
}

export function CaseWorkspace() {
  const params = useParams()
  const router = useRouter()
  const search = useSearchParams()
  const caseId = Number(params.caseId)
  const { kase, steps, inventory, siblings, layout, status, error, reload, readOnly } = useCaseWorkspace(caseId)
  const { projects } = useShellData()

  const asked = search.get('tab')
  const tab: Tab = (TABS as string[]).includes(asked ?? '') ? (asked as Tab) : 'tree'
  const runParam = search.get('run')
  const [view, setView] = useState<TreeView>('impact')
  const [panelHidden, setPanelHidden] = usePanelHidden()
  // 600 px and below: the read-only phone view (E16, E17).
  const phone = usePhone()
  const [insightsOpen, setInsightsOpen] = useState(false)

  // Home's Continue card reads the case opened last on this device.
  const projectName = projects.find((p) => p.project_id === kase?.project_id)?.project_name ?? null
  useEffect(() => {
    if (kase) rememberCase({ project_id: kase.project_id, case_id: kase.case_id, project_name: projectName, case_name: kase.case_name })
  }, [kase, projectName])

  // The case this one is measured against: the case it was copied from, else
  // the project's Base case; the Base case itself reads its previous run.
  const base = siblings.find((s) => s.case_type === 'base' && s.case_id !== caseId)
  const target: CompareTarget | null = useMemo(() => {
    if (!kase) return null
    if (kase.copied_from) {
      const isBase = siblings.some((s) => s.case_id === kase.copied_from!.case_id && s.case_type === 'base')
      return { caseId: kase.copied_from.case_id, label: isBase ? 'Base case' : kase.copied_from.case_name }
    }
    if (kase.case_type === 'comparative' && base) return { caseId: base.case_id, label: 'Base case' }
    return null
  }, [kase, siblings, base])
  const { completed, reload: reloadRuns, against } = useCaseRuns(caseId, target)
  const { run, older } = pickRun(completed, runParam)

  const go = useCallback(
    (next: Tab, runId?: number | null) => {
      const q = new URLSearchParams()
      if (next !== 'tree') q.set('tab', next)
      if (next === 'results' && runId) q.set('run', String(runId))
      const qs = q.toString()
      router.replace(`/project/${params.projectId}/case/${caseId}${qs ? `?${qs}` : ''}`, { scroll: false })
    },
    [router, params.projectId, caseId],
  )

  // Run Assessment: the study's method and region, a seconds count, then Results.
  const [running, setRunning] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [runError, setRunError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => () => void (timer.current && clearInterval(timer.current)), [])
  const runCase = async () => {
    if (running || !kase) return
    setRunning(true)
    setRunError(null)
    setSeconds(0)
    const started = Date.now()
    timer.current = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000)
    try {
      const res = await apiRequest(`/api/cases/${kase.case_id}/assessments`, { method: 'POST', body: JSON.stringify({}) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d?.error ?? `the run answered ${res.status}`)
      await Promise.all([reload(), reloadRuns()])
      go('results')
    } catch (e: any) {
      setRunError(e?.message ?? 'the run failed')
    } finally {
      if (timer.current) clearInterval(timer.current)
      timer.current = null
      setRunning(false)
    }
  }

  // The run's value per step on the tree (its own tree, frozen), for Results and Write-up.
  const runValues = useMemo(() => {
    if (!run) return null
    const total = runClimate(run)?.value
    if (total === undefined) return null
    const tree = (run.run_steps ?? []).map((s) => ({ id: s.component_id, parentId: s.parent_id }))
    return { run_id: run.run_id, total, sums: subtreeSums(tree, ownClimate(run)) }
  }, [run])

  if (status === 'loading' && !kase) {
    return (
      <div className="ws" role="status" style={{ padding: 24, color: 'var(--ds-text-2)' }}>
        Loading the case…
      </div>
    )
  }
  if (status === 'notfound') {
    return (
      <div className="ws" style={{ padding: 24 }}>
        <EmptyState
          line="This case is not here. It may have been deleted, or it is not shared with you."
          action={
            <Link className="ds-link" href={`/project/${params.projectId}`}>
              Back to the project
            </Link>
          }
        />
      </div>
    )
  }
  if (!kase) {
    return (
      <div className="ws" style={{ padding: 24 }}>
        <ErrorCard title="The case did not load" cause={error} onRetry={reload} />
      </div>
    )
  }

  if (phone) {
    return (
      <PhoneCase
        kase={kase}
        steps={steps}
        inventory={inventory}
        run={run}
        against={against}
        targetCaseId={target?.caseId ?? null}
        projectName={projectName}
        tab={tab}
        onTab={(t) => go(t, t === 'results' ? run?.run_id ?? null : null)}
      />
    )
  }

  const counts = inventory?.counts ?? null
  const badge = inventoryBadge(counts)
  const canRun = (inventory?.rows ?? []).some((r) => r.status === 'counted' || r.status === 'no_factor')
  const quietRun = (tab === 'results' || tab === 'writeup') && !!run
  const hasPanel = tab !== 'inventory'
  const compareHref = target
    ? `/project/${kase.project_id}/comparison?cases=${target.caseId},${kase.case_id}`
    : `/project/${kase.project_id}/comparison?cases=${kase.case_id}`

  const stepCosts = steps.map((s) => ({
    id: String(s.id),
    name: s.name,
    labor: s.costs.labor ?? 0,
    material: s.costs.material ?? 0,
    energy: s.costs.energy ?? 0,
    other: (s.costs.transportation ?? 0) + (s.costs.equipment ?? 0) + (s.costs.overhead ?? 0),
  }))

  const treeProps = {
    kase,
    steps,
    layout,
    inventory,
    readOnly,
    panelHidden,
    view,
    onView: setView,
    onOpenInsights: () => setInsightsOpen(true),
    projectName,
  }

  const tabBody = (
      <div id="ws-tabpanel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="ws-body">
          {tab === 'tree' && <TreeTab {...treeProps} />}
          {tab === 'inventory' && (
            <InventoryTab caseId={kase.case_id} steps={steps} inventory={inventory} readOnly={readOnly} onOpenInsights={() => setInsightsOpen(true)} />
          )}
          {tab === 'results' && (
            <TreeTab
              {...treeProps}
              runValues={runValues}
              resultsPanel={
                <ResultsPanel
                  kase={kase}
                  run={run}
                  older={older}
                  completed={completed}
                  against={against}
                  readOnly={readOnly}
                  onOpenRun={(id) => go('results', id)}
                  onOpenInsights={() => setInsightsOpen(true)}
                />
              }
            />
          )}
          {tab === 'writeup' && (
            <TreeTab
              {...treeProps}
              runValues={runValues}
              resultsPanel={<WriteUpPanel kase={kase} run={run} against={against} readOnly={readOnly} onSaved={reload} />}
            />
          )}
        </div>
  )

  return (
    <div className="ws">
      <CaseHeader
        kase={kase}
        inventory={inventory}
        siblings={siblings}
        readOnly={readOnly}
        canRun={canRun}
        onRun={runCase}
        running={running}
        runSeconds={seconds}
        runError={runError}
        quiet={quietRun}
        runReason={steps.length ? 'Add a counted flow first' : 'Add a step first'}
        noSteps={!steps.length}
      />
      {error && status === 'ready' && (
        <div style={{ padding: '12px 24px 0' }}>
          <ErrorCard title="The case did not refresh" cause={error} fix="What you see may be a moment old." onRetry={reload} />
        </div>
      )}
      <Tabs
        label="Case"
        selected={tab}
        onSelect={(t) => go(t, t === 'results' && older ? run?.run_id : null)}
        tabs={[
          { id: 'tree', label: 'Tree', badge: <span className="ws-tabbadge">{steps.length}</span>, controls: 'ws-tabpanel' },
          {
            id: 'inventory',
            label: 'Inventory',
            badge: badge ? (
              <span className="ws-tabbadge ws-tabbadge--warn">{badge}</span>
            ) : (
              <span className="ws-tabbadge">{inventory?.rows.length ? inventory.rows.length : 'no flows yet'}</span>
            ),
            controls: 'ws-tabpanel',
          },
          {
            id: 'results',
            label: 'Results',
            badge: <span className="ws-tabbadge">{run ? `Run #${run.run_id}` : 'not run yet'}</span>,
            controls: 'ws-tabpanel',
          },
          { id: 'writeup', label: 'Write-up', controls: 'ws-tabpanel' },
        ]}
        end={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 16 }}>
            {hasPanel && (
              <button type="button" className="ws-panel-toggle" aria-pressed={panelHidden} onClick={() => setPanelHidden(!panelHidden)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
                  <path d="M14.5 4.5v15" />
                </svg>
                {panelHidden ? 'Show panel' : 'Hide panel'}
              </button>
            )}
            <Link className="ws-compare-link" href={compareHref}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M8 4v16M16 4v16M4 12h4M16 12h4" strokeLinecap="round" />
              </svg>
              Compare
            </Link>
          </span>
        }
      />
      {tabBody}

      <MagicInsightsModal
        open={insightsOpen}
        onClose={() => setInsightsOpen(false)}
        caseName={kase.case_name}
        method={run?.calculation_method ?? inventory?.method ?? kase.project_lcia_method ?? ''}
        impacts={run?.impacts}
        componentBreakdown={insightsBreakdownOf(run)}
        materialBreakdown={insightsMaterialsOf(run)}
        totalCost={stepCosts.reduce((t, s) => t + s.labor + s.material + s.energy + s.other, 0)}
        stepCosts={stepCosts}
        projectId={String(kase.project_id)}
        caseId={String(kase.case_id)}
        runId={run?.run_id ?? null}
      />
    </div>
  )
}
