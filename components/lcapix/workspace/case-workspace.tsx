'use client'

// Inside a case (behaviour spec "Inside a case", E03 to E06, E14): the header
// (name, facts, warning line, Case switcher, one primary), then the four tabs
// (Tree with its step count, Inventory with "N need an amount", Results with
// the run number, Write-up), Hide panel and Compare at the row's end. The tab
// is in the URL (?tab=), an older run too (?run=). Run the case runs the
// case with the study's method and region, counts the seconds, then opens
// Results. UX 2: one docked panel beside the tab (side-panel.tsx) holds the
// tab's own content (Step, Results, Write-up) and Documents (E21) as its two
// tabs; Documents at the row's end opens it there, and it starts closed. C5: each tab is its own history
// entry, so browser back returns to the tab before, not out of the case. D5:
// an assignment case reads only for anyone but the student who owns it (an
// instructor reads a student's hand-in or working case, never edits it). D4:
// after a run on an assignment case the next step is "Write up, then hand in".
// UX 3: a student's first case (no Guided mode choice yet on this device)
// starts Guided mode on, says so once, and offers to turn it off.

import { frozenStepCosts, runCosts, runLabel } from '@/lib/results/full-results-view'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Button, Callout, EmptyState, ErrorCard, Tabs } from '@/components/lcapix/ds'
import { guidedChoiceMade, useGuidedMode } from '@/lib/shell/use-shell'
import { MagicInsightsModal } from '@/components/lcapix/magic-insights-modal'
import { apiRequest } from '@/lib/api-client'
import { insightsBreakdownOf, insightsMaterialsOf } from '@/lib/results/insights-inputs'
import { useShellData } from '@/lib/shell/use-shell'
import { rememberCase } from '@/lib/home/last-case'
import { ownClimate, runClimate, subtreeSums, whatBuilds } from '@/lib/workspace/results-view'
import { inventoryBadge } from '@/lib/workspace/inventory'
import { pickRun, useCaseRuns, type CompareTarget } from '@/lib/workspace/use-runs'
import { useCaseWorkspace } from '@/lib/workspace/use-workspace'
import { CaseHeader } from './case-header'
import { CaseSteps } from './case-steps'
import { caseSteps, type CaseStepKey } from '@/lib/workspace/case-steps'
import { InventoryTab } from './inventory-tab'
import { ResultsPanel } from './results-panel'
import { TreeTab, type TreeView } from './tree-tab'
import { WriteUpPanel } from './write-up-panel'
import { DocumentsPanel } from './documents-panel'
import { SidePanel, type SideShows } from './side-panel'
import { dataBasisLine } from '@/lib/workspace/per-fu'
import { perUnit } from '@/lib/workspace/per-unit'
import { SideSlotContext } from './floating-panel'
import { ExerciseProvider, exerciseFacts } from './exercise-card'
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
  const { kase, steps, inventory, siblings, layout, status, error, reload, readOnly: caseReadOnly, caps } = useCaseWorkspace(caseId)
  const { profile, projects } = useShellData()
  // D5: someone else's assignment case (a student's working case or hand-in)
  // reads only, until the case list says whose it is.
  const ownerOfCase = siblings.find((s) => s.case_id === caseId)?.created_by
  const othersAssignment = !!kase?.assignment_id && (ownerOfCase === undefined || ownerOfCase !== profile?.id)
  const readOnly = caseReadOnly || othersAssignment
  const ownName = profile?.fullName?.trim() || null
  // UX 3: a student is someone who signed up as one, or who works on their own assignment case.
  const studentCase = !!kase && !readOnly && (profile?.useCase === 'student' || (!!kase.assignment_id && ownerOfCase === profile?.id))
  const [, setGuided] = useGuidedMode()
  const [guidedStarted, setGuidedStarted] = useState(false)
  useEffect(() => {
    if (studentCase && !guidedChoiceMade()) {
      setGuided(true)
      setGuidedStarted(true)
    }
  }, [studentCase, setGuided])

  const asked = search.get('tab')
  const tab: Tab = (TABS as string[]).includes(asked ?? '') ? (asked as Tab) : 'tree'
  const runParam = search.get('run')
  const [view, setView] = useState<TreeView>('impact')
  const [panelHidden, setPanelHidden] = usePanelHidden()
  // 600 px and below: the read-only phone view (E16, E17).
  const phone = usePhone()
  const [insightsOpen, setInsightsOpen] = useState(false)
  // The docked panel: the tab's own content goes into its slot; Documents is
  // closed until asked for, and closing it puts focus back on its button.
  const [docsOpen, setDocsOpen] = useState(false)
  const [sideShows, setSideShows] = useState<SideShows>('main')
  const [sideSlot, setSideSlot] = useState<HTMLElement | null>(null)
  const [sideMain, setSideMain] = useState<{ tab: string; key: string } | null>(null)
  const sideCtx = useMemo(() => ({ slot: sideSlot, setMain: setSideMain }), [sideSlot])
  // Another step clicked, or another tab: the panel shows it, not Documents.
  useEffect(() => {
    if (sideMain) setSideShows('main')
  }, [sideMain?.key]) // eslint-disable-line react-hooks/exhaustive-deps
  const docsButton = useRef<HTMLButtonElement>(null)
  const closeDocs = () => {
    setDocsOpen(false)
    setSideShows('main')
    docsButton.current?.focus()
  }

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
      const to = `/project/${params.projectId}/case/${caseId}${qs ? `?${qs}` : ''}`
      // C5: a new tab is a new history entry (back returns to the tab before);
      // the same tab with another run, or the same address, replaces it.
      const here = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('tab') ?? 'tree'
      if (here === next) router.replace(to, { scroll: false })
      else router.push(to, { scroll: false })
    },
    [router, params.projectId, caseId],
  )

  // Run the case: the study's method and region, a seconds count, then Results.
  const [running, setRunning] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [runError, setRunError] = useState<string | null>(null)
  const [runOpen, setRunOpen] = useState(false)
  const [runMethod, setRunMethod] = useState('')
  const [runRegion, setRunRegion] = useState('')
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => () => void (timer.current && clearInterval(timer.current)), [])
  const runCase = async () => {
    if (running || !kase) return
    setRunOpen(false)
    setRunning(true)
    setRunError(null)
    setSeconds(0)
    const started = Date.now()
    timer.current = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000)
    try {
      const res = await apiRequest(`/api/cases/${kase.case_id}/assessments`, {
        method: 'POST',
        body: JSON.stringify({
          calculation_method: runMethod || kase.project_lcia_method || undefined,
          region_code: runRegion || kase.region_code || undefined,
        }),
      })
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

  // The exercises' checks read the case's layers (materials, energy, …) fresh after each change.
  const [layers, setLayers] = useState<string[]>([])
  useEffect(() => {
    let live = true
    apiRequest(`/api/cases/${caseId}/completeness`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setLayers(d?.report?.present ?? []))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [caseId, inventory])

  // The run's value per step on the tree (its own tree, frozen), for Results and Write-up.
  const runValues = useMemo(() => {
    if (!run) return null
    const total = runClimate(run)?.value
    if (total === undefined) return null
    const tree = (run.run_steps ?? []).map((s) => ({ id: s.component_id, parentId: s.parent_id }))
    return { run_id: run.run_id, label: runLabel(run), total, sums: subtreeSums(tree, ownClimate(run)) }
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
  const openDocs = () => {
    setDocsOpen(true)
    setSideShows('docs')
    if (hasPanel) setPanelHidden(false)
  }
  const sideVisible = hasPanel ? !panelHidden && (!!sideMain || docsOpen) : docsOpen
  const docsShowing = docsOpen && sideVisible && (sideShows === 'docs' || !sideMain)
  const compareHref = target
    ? `/project/${kase.project_id}/comparison?cases=${target.caseId},${kase.case_id}`
    : `/project/${kase.project_id}/comparison?cases=${kase.case_id}`


  const treeProps = {
    kase,
    steps,
    layout,
    inventory,
    readOnly,
    panelHidden,
    sideOpen: sideVisible,
    view,
    onView: setView,
    onOpenInsights: () => setInsightsOpen(true),
    projectName,
    initialStepId: Number(search.get('componentId')) || null,
    startAdd: search.get('add') === 'step',
    // W8: "Add the flow" from a step cost with no flow opens that step's Add a flow.
    startAddFlow: search.get('add') === 'flow',
  }

  const openRun = () => {
    setRunMethod(kase.project_lcia_method ?? '')
    setRunRegion(kase.region_code ?? '')
    setRunOpen(true)
  }

  // The step bar (ISO 14044's four phases, then Hand in on an assignment case). D4:
  // after a run on an assignment case its Next is the write-up, then Hand in.
  const latestRun = inventory?.latest_run ?? null
  const barSteps = caseSteps({
    functionalUnit: kase.project_functional_unit,
    referenceFlow: kase.reference_flow,
    canSetScope: caps.canManage,
    stepCount: steps.length,
    flowCount: inventory?.rows.length ?? 0,
    countedFlows: (counts?.counted ?? 0) + (counts?.no_factor ?? 0),
    needsAmount: counts?.needs_amount ?? 0,
    leftOut: counts?.left_out ?? 0,
    runLabel: latestRun ? runLabel(latestRun) : null,
    changedAfterRun: !!latestRun?.changed_after_run,
    hasWriteUp: !!kase.interpretation?.trim(),
    assignment: !!kase.assignment_id,
    handedIn: siblings.some((s) => s.read_only && s.assignment_id === kase.assignment_id && s.created_by === profile?.id),
  })
  const actOn = (key: CaseStepKey) => {
    const s = barSteps.find((x) => x.key === key)
    if (key === 'scope') router.push(`/project/${kase.project_id}/cases?settings=1`)
    else if (key === 'inventory') {
      if (!steps.length) router.push(`/project/${kase.project_id}/case/${kase.case_id}?add=step`)
      else go(inventory?.rows.length ? 'inventory' : 'tree')
    } else if (key === 'impact') {
      if (s?.done) go('results')
      else openRun()
    } else if (key === 'interpretation') go('writeup')
    else router.push(`/project/${kase.project_id}/assignments`)
  }

  const latestBuild = run ? whatBuilds(run, kase.case_type)[0] : null
  const topStep = latestBuild && latestBuild.value > 0 ? { name: latestBuild.name, share: latestBuild.share } : null
  const tabBody = (
      <div id="ws-tabpanel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="ws-body">
          {tab === 'tree' && <TreeTab {...treeProps} />}
          {tab === 'inventory' && (
            <InventoryTab
              caseId={kase.case_id}
              steps={steps}
              inventory={inventory}
              readOnly={readOnly}
              onOpenInsights={() => setInsightsOpen(true)}
              basisLine={dataBasisLine({ modeledOutput: kase.modeled_output ?? 1, referenceFlow: kase.reference_flow ?? 1 }, perUnit(kase))}
            />
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
                  editedAfter={Boolean(run && inventory?.latest_run?.run_id === run.run_id && inventory.latest_run.changed_after_run)}
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

  const body = (
    <SideSlotContext.Provider value={sideCtx}>
      <div className="ws-split">
        {tabBody}
        <SidePanel
          visible={sideVisible}
          mainTab={sideMain?.tab ?? null}
          shows={sideShows}
          onShow={(s) => (s === 'docs' ? openDocs() : setSideShows('main'))}
          onSlot={setSideSlot}
          docs={docsOpen ? <DocumentsPanel caseId={kase.case_id} projectId={kase.project_id} readOnly={readOnly} onClose={closeDocs} /> : null}
        />
      </div>
    </SideSlotContext.Provider>
  )

  return (
    <div className="ws">
      <CaseHeader
        kase={kase}
        inventory={inventory}
        siblings={siblings}
        readOnly={readOnly}
        canRun={canRun}
        ownName={ownName}
        onRun={openRun}
        running={running}
        runSeconds={seconds}
        runError={runError}
        quiet={quietRun}
        runReason={steps.length ? 'Add a counted flow first' : 'Add a step first'}
        noSteps={!steps.length}
      />
      {!readOnly && <CaseSteps steps={barSteps} onAct={actOn} />}
      {guidedStarted && <GuidedStarted onOff={() => (setGuided(false), setGuidedStarted(false))} onKeep={() => setGuidedStarted(false)} />}
      <LearnOffer asked={search.get('learn') === '1'} />
      {othersAssignment && ownerOfCase !== undefined && !caseReadOnly && (
        <div className="pc-next">
          <Callout tone="info" lead="A student's case.">
            You read it here; only the student who owns it changes it.
          </Callout>
        </div>
      )}
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
            badge: <span className="ws-tabbadge">{run ? runLabel(run) : 'not run yet'}</span>,
            controls: 'ws-tabpanel',
          },
          { id: 'writeup', label: 'Write-up', controls: 'ws-tabpanel' },
        ]}
        end={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 16 }}>
            <button
              ref={docsButton}
              type="button"
              className="ws-panel-toggle"
              aria-expanded={docsShowing}
              aria-controls={docsOpen ? 'ws-docs' : undefined}
              onClick={() => (docsShowing ? closeDocs() : openDocs())}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M7 3.5h7l4.5 4.5v12.5H7z" strokeLinejoin="round" />
                <path d="M14 3.5V8h4.5M10 12.5h5.5M10 16h5.5" strokeLinecap="round" />
              </svg>
              Documents
            </button>
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
      {readOnly ? (
        body
      ) : (
        <ExerciseProvider
          caseId={kase.case_id}
          initial={kase.learning_state}
          facts={exerciseFacts({
            referenceFlow: kase.reference_flow,
            functionalUnit: kase.project_functional_unit,
            layers,
            hasRun: !!inventory?.latest_run,
            otherCaseRan: siblings.some((x) => x.case_id !== kase.case_id && x.run_count > 0),
            interpretation: kase.interpretation,
          })}
          operations={steps.filter((x) => x.tier === 'operation').map((x) => x.name)}
          topStep={topStep}
          onSaved={reload}
        >
          {body}
        </ExerciseProvider>
      )}

      <MagicInsightsModal
        open={insightsOpen}
        onClose={() => setInsightsOpen(false)}
        caseName={kase.case_name}
        method={run?.calculation_method ?? inventory?.method ?? kase.project_lcia_method ?? ''}
        impacts={run?.impacts}
        componentBreakdown={insightsBreakdownOf(run)}
        materialBreakdown={insightsMaterialsOf(run)}
        // The run's own costs, as frozen with it: never today's beside a past run's impacts.
        totalCost={runCosts(run?.run_steps)?.total}
        stepCosts={frozenStepCosts(run?.run_steps)}
        projectId={String(kase.project_id)}
        caseId={String(kase.case_id)}
        runId={run?.run_id ?? null}
        initialCategory={run ? Object.keys(run.impacts).find((n) => /global warming|climate/i.test(n)) : undefined}
        caseType={kase.case_type}
      />
      {runOpen && (
        <form
          className="ds-scrim"
          onSubmit={(e) => {
            e.preventDefault()
            void runCase()
          }}
        >
          <div className="ds-dialog" role="dialog" aria-modal="true" aria-labelledby="run-title">
            <h2 id="run-title" className="ds-dialog-title">
              Run the case
            </h2>
            <label style={{ display: 'block', margin: '12px 0' }}>
              <span className="ds-section-label">Method</span>
              <select className="ds-input" aria-label="Method" value={runMethod} onChange={(e) => setRunMethod(e.target.value)} style={{ width: '100%', marginTop: 6 }}>
                {['CML 2001', 'ReCiPe Midpoint (H)', 'TRACI 2.1'].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'block', margin: '12px 0' }}>
              <span className="ds-section-label">Region</span>
              <select className="ds-input" aria-label="Region" value={runRegion || 'Global'} onChange={(e) => setRunRegion(e.target.value)} style={{ width: '100%', marginTop: 6 }}>
                {['Global', 'US', 'EU'].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <div className="ds-dialog-actions">
              <button type="button" className="ds-btn" onClick={() => setRunOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="ds-btn ds-btn--primary">
                Run
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}

/** UX 3: said once, on the student's first case, when Guided mode was started for them. */
function GuidedStarted({ onOff, onKeep }: { onOff: () => void; onKeep: () => void }) {
  return (
    <div style={{ padding: '0 18px' }}>
      <Callout
        tone="info"
        lead="Guided mode is on for your first case."
        action={
          <span style={{ display: 'flex', gap: 8 }}>
            <Button size="small" variant="primary" onClick={onKeep}>
              Keep it on
            </Button>
            <Button size="small" onClick={onOff}>
              Turn it off
            </Button>
          </span>
        }
      >
        Beside the tree it takes you through an LCA one step at a time: what the result is per, what goes in and out, the impact,
        and what it means. The switch in the sidebar turns it off any time.
      </Callout>
    </div>
  )
}

/**
 * P86: a case built by hand opens with ?learn=1. In the new design the help
 * is Guided mode, so the case offers it once; it is never switched on for you.
 */
function LearnOffer({ asked }: { asked: boolean }) {
  const [guided, setGuided] = useGuidedMode()
  const [gone, setGone] = useState(false)
  if (!asked || guided || gone) return null
  return (
    <div style={{ padding: '0 18px' }}>
      <Callout
        tone="info"
        lead="Building it by hand?"
        action={
          <span style={{ display: 'flex', gap: 8 }}>
            <Button size="small" variant="primary" onClick={() => setGuided(true)}>
              Turn on Guided mode
            </Button>
            <Button size="small" onClick={() => setGone(true)}>
              Not now
            </Button>
          </span>
        }
      >
        Guided mode explains each step of the tree as you build it.
      </Callout>
    </div>
  )
}
