'use client'

// The full results page (R01 to R11). The Results tab stays the short panel
// and links here. Printing shows this page, not the shell.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { EmptyState, ErrorCard, SectionLabel } from '@/components/lcapix/ds'
import { STAGES } from '@/lib/life-cycle'
import { money, result3, share } from '@/lib/ui/format'
import { isCompletedRun } from '@/lib/results/run-math'
import { runClimate, whatBuilds } from '@/lib/workspace/results-view'
import { useCaseRuns } from '@/lib/workspace/use-runs'
import { useCaseWorkspace } from '@/lib/workspace/use-workspace'
import type { WorkspaceRun } from '@/lib/workspace/use-runs'
import type { WorkspaceStep } from '@/lib/workspace/use-workspace'

export function caseRunNumber(runs: Array<{ run_id: number }>, runId: number): number {
  const ordered = [...runs].sort((a, b) => a.run_id - b.run_id)
  const i = ordered.findIndex((r) => r.run_id === runId)
  return i < 0 ? 1 : i + 1
}

export function FullResults() {
  const params = useParams()
  const router = useRouter()
  const search = useSearchParams()
  const projectId = String(params.projectId)
  const caseId = Number(params.caseId)
  const { kase, steps, inventory, siblings, status, error, reload } = useCaseWorkspace(caseId)
  const baseId =
    kase && kase.case_type !== 'base'
      ? siblings.find((s) => s.case_type === 'base')?.case_id ?? kase.copied_from?.case_id ?? 0
      : 0
  const target = kase?.copied_from
    ? { caseId: kase.copied_from.case_id, label: kase.copied_from.case_name }
    : null
  const { completed, status: runStatus } = useCaseRuns(caseId, target)
  const baseRuns = useCaseRuns(baseId > 0 ? baseId : caseId, null)
  const baseRun = baseId > 0 ? baseRuns.completed[0] ?? null : null
  const asked = Number(search.get('run'))
  const run = completed.find((r) => r.run_id === asked) ?? completed[0] ?? null
  const categories = Object.keys(run?.impacts ?? {})
  const [category, setCategory] = useState<string | null>(null)
  const chosen = category && categories.includes(category) ? category : categories.find((n) => /global warming|climate/i.test(n)) ?? categories[0] ?? null

  if (status === 'error') return <ErrorCard title="The case did not load" cause={error} onRetry={reload} />
  if (!kase || runStatus === 'loading') return <p role="status">Loading results…</p>
  if (!run) {
    return (
      <main className="ws-full-results" style={{ padding: 24 }}>
        <EmptyState line="Not run yet. Run Assessment and the answer shows here." />
        <Link className="ds-link" href={`/project/${projectId}/case/${caseId}`}>
          Back to the case
        </Link>
      </main>
    )
  }

  return (
    <FullRun
      projectId={projectId}
      caseId={caseId}
      caseName={kase.case_name}
      caseType={kase.case_type}
      goal={kase.description}
      scope={kase.assumptions}
      unit={kase.project_functional_unit}
      run={run}
      runs={completed}
      steps={steps}
      baseRun={baseRun}
      category={chosen}
      onCategory={setCategory}
      editedAfter={Boolean(inventory?.latest_run && inventory.latest_run.run_id === run.run_id && (inventory.latest_run.changed_flows ?? 0) > 0)}
      onOpenRun={(id) => router.replace(`/project/${projectId}/case/${caseId}/results?run=${id}`)}
    />
  )
}

function FullRun({
  projectId,
  caseId,
  caseName,
  caseType,
  goal,
  scope,
  unit,
  run,
  runs,
  steps,
  baseRun,
  category,
  onCategory,
  editedAfter,
  onOpenRun,
}: {
  projectId: string
  caseId: number
  caseName: string
  caseType: string
  goal: string | null
  scope: string | null
  unit: string | null
  run: WorkspaceRun
  runs: WorkspaceRun[]
  steps: WorkspaceStep[]
  baseRun: WorkspaceRun | null
  category: string | null
  onCategory: (name: string) => void
  editedAfter: boolean
  onOpenRun: (id: number) => void
}) {
  const order = caseRunNumber(runs, run.run_id)
  const impact = category ? run.impacts[category] : null
  const same = runs.filter((r) => r.calculation_method === run.calculation_method && r.regionCode === run.regionCode && r.run_id < run.run_id)
  const prev = same[same.length - 1]
  const prevValue = prev && category ? prev.impacts[category]?.value : undefined
  const change = impact && prevValue ? `${impact.value < prevValue ? 'down' : 'up'} ${share(Math.abs(impact.value - prevValue), prevValue)} from Run ${caseRunNumber(runs, prev.run_id)} (${prev.calculation_method}, ${prev.regionCode ?? 'Global'})` : null
  const top = useMemo(() => topSteps(run, category), [run, category])
  const flows = (run.flowDetail ?? []).filter((f) => !category || f.category_name === category)
  const [dir, setDir] = useState<'all' | 'IN' | 'OUT'>('all')
  const shown = flows.filter((f) => dir === 'all' || f.dir === dir)
  const uncounted = run.dataQuality?.uncharacterized_flows ?? 0

  return (
    <main className="ws-full-results" style={{ padding: '24px 28px', maxWidth: 1100 }}>
      <p style={{ margin: 0 }}>
        <Link className="ds-link" href={`/project/${projectId}/case/${caseId}?tab=results`}>
          Back to the case
        </Link>
      </p>
      <h1 className="ds-title" style={{ margin: '8px 0' }}>
        {caseName}
      </h1>
      <p style={{ margin: 0 }}>
        Run {order} of this case · {run.calculation_method} · {run.regionCode ?? 'Global'} · {run.status}
      </p>
      {editedAfter && <p role="status">This case was edited after this run. Run again to update the answer.</p>}
      {uncounted > 0 && (
        <p>
          {uncounted} {uncounted === 1 ? 'flow was' : 'flows were'} not counted: this method has no factor for them. Not counted is not the same as zero.
        </p>
      )}
      <div role="radiogroup" aria-label="Category" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '16px 0' }}>
        {Object.keys(run.impacts).map((name) => (
          <button key={name} type="button" role="radio" aria-checked={name === category} className={name === category ? 'ds-btn ds-btn--dark ds-btn--small' : 'ds-btn ds-btn--small'} onClick={() => onCategory(name)}>
            {name}
          </button>
        ))}
      </div>
      {impact && (
        <section aria-label="Total">
          <p className="ds-title" style={{ fontSize: 40, margin: 0, overflowWrap: 'anywhere' }}>
            {result3(impact.value)}
          </p>
          <p style={{ margin: '4px 0 0', overflowWrap: 'anywhere' }}>{impact.unit}</p>
          {change && <p>{change}</p>}
          <p className="ds-mono">Cost {money(run.costs.total)}</p>
        </section>
      )}
      <section aria-label="At a glance" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
        <p style={{ margin: 0 }}>{Object.keys(run.impacts).length} categories</p>
        <p style={{ margin: 0 }}>{run.componentBreakdown.length} steps</p>
        <p style={{ margin: 0 }}>Run {order}</p>
      </section>
      <section aria-label="This case" className="ds-card" style={{ marginTop: 16, padding: 16 }}>
        <SectionLabel>This case</SectionLabel>
        <p className="ds-title" style={{ margin: '8px 0' }}>{caseName}</p>
        <p>{impact ? `${result3(impact.value)} ${impact.unit}` : 'Not counted'}</p>
        <p>{baseRun && category && impact && baseRun.impacts[category] ? `Change against the base case: ${share(Math.abs(impact.value - baseRun.impacts[category].value), baseRun.impacts[category].value)}` : 'No base case run to compare.'}</p>
        <p>Total cost {money(costTotal(steps))}</p>
      </section>
      <CategoryChart impacts={run.impacts} selected={category} onSelect={onCategory} />
      <section aria-label="Cost by kind" style={{ marginTop: 20 }}>
        <SectionLabel>Cost by kind</SectionLabel>
        <ul>
          {costKinds(steps).map((row) => (
            <li key={row.kind}>
              {row.kind} {money(row.amount)}
            </li>
          ))}
        </ul>
        <p>
          Cost per unit impact:{' '}
          {impact && impact.value !== 0 ? money(costTotal(steps) / Math.abs(impact.value)) : 'not counted'}
        </p>
      </section>
      <section aria-label="Steps stacked by cost" style={{ marginTop: 20 }}>
        <SectionLabel>Where the cost sits</SectionLabel>
        <StackedCost steps={steps} />
      </section>
      <section aria-label="Step diff" style={{ marginTop: 20 }}>
        <SectionLabel>Step diff against the base case</SectionLabel>
        <StepDiff run={run} base={baseRun} category={category} />
      </section>
      <section aria-label="Top contributors" style={{ marginTop: 20 }}>
        <SectionLabel>What builds this number</SectionLabel>
        <ol>
          {top.map((row) => (
            <li key={row.id}>
              <Link href={`/project/${projectId}/case/${caseId}?componentId=${row.id}`}>{row.name}</Link> {result3(row.value)} {share(row.value, impact?.value ?? 0)}
            </li>
          ))}
        </ol>
      </section>
      <section aria-label="Goal and scope" style={{ marginTop: 20 }}>
        <SectionLabel>Goal and scope</SectionLabel>
        <p>{goal || 'No goal written yet.'}</p>
        <p>{scope || 'No scope written yet.'}</p>
        <p>Per {unit || 'one unit'}: {impact ? `${result3(impact.value)} ${impact.unit}` : 'not counted'}</p>
        {run.dataQuality && <p>{run.dataQuality.uncharacterized_flows} flows have no factor in this method. {run.dataQuality.regional_fallbacks} used a Global factor.</p>}
      </section>
      <section aria-label="Life-cycle stages" style={{ marginTop: 20 }}>
        <SectionLabel>Stages</SectionLabel>
        <ul>
          {STAGES.map((st) => {
            const steps = run.componentBreakdown.filter((c) => (c.life_cycle_stage ?? 'production') === st.id)
            return (
              <li key={st.id}>
                {st.label}: {steps.length === 0 ? 'none in this run' : steps.map((s) => s.component_name).join(', ')}
              </li>
            )
          })}
        </ul>
      </section>
      <section aria-label="Flows" style={{ marginTop: 20 }}>
        <SectionLabel>Flows</SectionLabel>
        <div role="radiogroup" aria-label="Direction">
          {(['all', 'IN', 'OUT'] as const).map((d) => (
            <button key={d} type="button" role="radio" aria-checked={dir === d} className="ds-btn ds-btn--small" onClick={() => setDir(d)}>
              {d === 'all' ? 'All' : d === 'IN' ? 'In' : 'Out'}
            </button>
          ))}
        </div>
        <table>
          <thead>
            <tr>
              <th>Step</th>
              <th>Substance</th>
              <th>Amount</th>
              <th>Factor</th>
              <th>Impact</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((f) => (
              <tr key={`${f.flow_id}-${f.category_name}`}>
                <td>{f.component}</td>
                <td>{f.substance}</td>
                <td>
                  {f.amount} {f.unit}
                </td>
                <td>
                  {f.factor} {f.scope === 'Global' ? 'Global fallback' : f.scope ?? ''} {f.source ?? ''}
                </td>
                <td>{result3(f.impact)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section aria-label="Run history" style={{ marginTop: 20 }}>
        <SectionLabel>Runs</SectionLabel>
        <ul>
          {[...runs].sort((a, b) => a.run_id - b.run_id).map((r) => (
            <li key={r.run_id}>
              <button type="button" className="ds-link" onClick={() => onOpenRun(r.run_id)}>
                Run {caseRunNumber(runs, r.run_id)}
              </button>{' '}
              {r.calculation_method} · {r.regionCode ?? 'Global'} · {r.status}
            </li>
          ))}
        </ul>
      </section>
      {(run.warnings?.length ?? 0) > 0 && (
        <section aria-label="Data quality" style={{ marginTop: 20 }}>
          <SectionLabel>Frozen with this run</SectionLabel>
          <ul>
            {run.warnings!.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      )}
      <p style={{ marginTop: 24 }}>
        <Link className="ds-link" href={`/project/${projectId}/case/${caseId}?tab=results&run=${run.run_id}`}>
          Short panel
        </Link>
      </p>
      <p className="ds-mono" style={{ fontSize: 12 }}>
        Case type {caseType}. What builds the climate total: {whatBuilds(run, caseType)[0]?.name ?? 'none'}.
      </p>
    </main>
  )
}

function costTotal(steps: WorkspaceStep[]): number {
  return costKinds(steps).reduce((t, r) => t + r.amount, 0)
}

function costKinds(steps: WorkspaceStep[]): Array<{ kind: string; amount: number }> {
  const sum = (key: keyof WorkspaceStep['costs']) => steps.reduce((t, s) => t + (s.costs[key] ?? 0), 0)
  return [
    { kind: 'Labour', amount: sum('labor') },
    { kind: 'Energy', amount: sum('energy') },
    { kind: 'Material', amount: sum('material') },
    { kind: 'Transport', amount: sum('transportation') },
    { kind: 'Equipment', amount: sum('equipment') },
    { kind: 'Overhead', amount: sum('overhead') },
  ]
}

function CategoryChart({
  impacts,
  selected,
  onSelect,
}: {
  impacts: Record<string, { value: number; unit: string }>
  selected: string | null
  onSelect: (name: string) => void
}) {
  const [view, setView] = useState<'Absolute' | 'Radar' | 'Log'>('Absolute')
  const rows = Object.entries(impacts).map(([name, v]) => ({ name, value: Math.abs(v.value), unit: v.unit }))
  const max = Math.max(...rows.map((r) => r.value), 0.00001)
  const logMax = Math.max(...rows.map((r) => Math.log10(r.value + 0.00001) + 10), 1)
  return (
    <section aria-label="Category chart" style={{ marginTop: 20 }}>
      <SectionLabel>Categories</SectionLabel>
      <div role="radiogroup" aria-label="Chart" style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
        {(['Absolute', 'Radar', 'Log'] as const).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={view === v} className="ds-btn ds-btn--small" onClick={() => setView(v)}>
            {v}
          </button>
        ))}
      </div>
      {view === 'Radar' ? (
        <Radar rows={rows} />
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {rows.map((r) => {
            const width = view === 'Log' ? ((Math.log10(r.value + 0.00001) + 10) / logMax) * 100 : (r.value / max) * 100
            return (
              <li key={r.name}>
                <button type="button" className="ds-link" aria-pressed={selected === r.name} onClick={() => onSelect(r.name)}>
                  {r.name}
                </button>
                <span className="ds-mono" style={{ display: 'inline-block', width: `${Math.max(2, width)}%`, minWidth: 8, height: 8, background: 'var(--ds-green)', marginLeft: 8 }} />
                <span style={{ marginLeft: 8 }}>{result3(r.value)} {r.unit}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function Radar({ rows }: { rows: Array<{ name: string; value: number }> }) {
  const n = rows.length || 1
  const max = Math.max(...rows.map((r) => r.value), 0.00001)
  const pts = rows.map((r, i) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2
    const rad = (r.value / max) * 40
    return `${50 + rad * Math.cos(a)},${50 + rad * Math.sin(a)}`
  })
  return (
    <svg viewBox="0 0 100 100" width="220" height="220" role="img" aria-label="Category radar">
      <polygon points={pts.join(' ')} fill="var(--ds-green)" opacity="0.35" stroke="var(--ds-green)" />
    </svg>
  )
}

function StackedCost({ steps }: { steps: WorkspaceStep[] }) {
  const rows = steps
    .map((s) => ({ name: s.name, amount: Object.values(s.costs).reduce<number>((t, v) => t + (v ?? 0), 0) }))
    .filter((r) => r.amount > 0)
  const total = rows.reduce((t, r) => t + r.amount, 0) || 1
  return (
    <div role="img" aria-label="Steps stacked by cost" style={{ display: 'flex', height: 16, width: '100%', background: 'var(--ds-surface-2, #eee)' }}>
      {rows.map((r) => (
        <span key={r.name} title={`${r.name} ${money(r.amount)}`} style={{ width: `${(r.amount / total) * 100}%`, background: 'var(--ds-green)' }} />
      ))}
    </div>
  )
}

function StepDiff({ run, base, category }: { run: WorkspaceRun; base: WorkspaceRun | null; category: string | null }) {
  if (!base || !category) return <p>No base case run to compare.</p>
  const baseOf = new Map(base.componentBreakdown.map((c) => [c.component_id, c.impacts.find((i) => i.category_name === category)?.impact_value ?? 0]))
  return (
    <table>
      <thead>
        <tr>
          <th>Step</th>
          <th>This case</th>
          <th>Base case</th>
          <th>Difference</th>
        </tr>
      </thead>
      <tbody>
        {run.componentBreakdown.map((c) => {
          const mine = c.impacts.find((i) => i.category_name === category)?.impact_value ?? 0
          const theirs = baseOf.get(c.component_id) ?? 0
          return (
            <tr key={c.component_id}>
              <td>{c.component_name}</td>
              <td>{result3(mine)}</td>
              <td>{result3(theirs)}</td>
              <td>{result3(mine - theirs)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function topSteps(run: WorkspaceRun, category: string | null): Array<{ id: number; name: string; value: number }> {
  if (!category) return []
  return run.componentBreakdown
    .map((c) => ({
      id: c.component_id,
      name: c.component_name,
      value: c.impacts.find((i) => i.category_name === category)?.impact_value ?? 0,
    }))
    .filter((r) => r.value !== 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 5)
}

export function completedRuns(runs: WorkspaceRun[]): WorkspaceRun[] {
  return runs.filter(isCompletedRun)
}
