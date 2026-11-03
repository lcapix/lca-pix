'use client'

// The full results page (R01 to R11, and classic Analytics P50 to P56). The
// Results tab stays the short panel and links here. Every number on the page
// is the run's own, as it was frozen: impacts, steps, costs, goal and scope.
// Printing shows this page, not the shell.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { BigValue, Button, Callout, Card, EmptyState, ErrorCard, KeyValue, SectionLabel, Segmented } from '@/components/lcapix/ds'
import { MagicInsightsModal } from '@/components/lcapix/magic-insights-modal'
import { insightsBreakdownOf, insightsMaterialsOf } from '@/lib/results/insights-inputs'
import { boundaryGaps, groupByStage, stageLabel, stageRowsFromFlows, STAGES, type StageId } from '@/lib/life-cycle'
import { amount, grouped, money, result3, share } from '@/lib/ui/format'
import { categoryNumber, headlineNumber } from '@/lib/results/number-view'
import { howSure } from '@/lib/workspace/results-view'
import { HowSure } from './results-panel'
import { isCompletedRun } from '@/lib/results/run-math'
import { factorTitle, isGlobalFallback, factorSourceNote, safeRunDate } from '@/lib/results/results-view'
import { caseRunNumber, changeWords, CLIMATE, climateOnlyFlows, comparableRun, frozenStepCosts, previousComparable, runCosts, stepDiffRows } from '@/lib/results/full-results-view'
import { notCounted } from '@/lib/runs/method-categories-view'
import { useCaseRuns } from '@/lib/workspace/use-runs'
import { useCaseWorkspace } from '@/lib/workspace/use-workspace'
import type { WorkspaceRun } from '@/lib/workspace/use-runs'

export { caseRunNumber }

const BOUNDARY_LABEL: Record<string, string> = {
  'cradle-to-gate': 'Cradle to gate',
  'cradle-to-grave': 'Cradle to grave',
  'gate-to-gate': 'Gate to gate',
}

export function FullResults() {
  const params = useParams()
  const router = useRouter()
  const search = useSearchParams()
  const projectId = String(params.projectId)
  const caseId = Number(params.caseId)
  const { kase, siblings, inventory, status, error, reload } = useCaseWorkspace(caseId)
  const baseId =
    kase && kase.case_type !== 'base'
      ? siblings.find((s) => s.case_type === 'base')?.case_id ?? kase.copied_from?.case_id ?? 0
      : 0
  const { runs: allRuns, completed, status: runStatus } = useCaseRuns(caseId, null)
  const baseRuns = useCaseRuns(baseId, null)
  const asked = Number(search.get('run'))
  const run = completed.find((r) => r.run_id === asked) ?? completed[0] ?? null
  const [category, setCategory] = useState<string | null>(null)
  const categories = Object.keys(run?.impacts ?? {})
  const chosen =
    category && categories.includes(category)
      ? category
      : categories.find((n) => /global warming|climate/i.test(n)) ?? categories[0] ?? null

  if (status === 'error') return <ErrorCard title="The case did not load" cause={error} onRetry={reload} />
  if (!kase || runStatus === 'loading') return <p role="status">Loading results…</p>
  if (!run) {
    return (
      <div className="ws-full-results" style={{ padding: 24 }}>
        <EmptyState line="Not run yet. Run the case and the answer shows here." />
        <Link className="ds-link" href={`/project/${projectId}/case/${caseId}`}>
          Back to the case
        </Link>
      </div>
    )
  }

  const baseRun = baseId > 0 ? comparableRun(baseRuns.completed, run) : null
  return (
    <FullRun
      projectId={projectId}
      caseId={caseId}
      caseName={kase.case_name}
      caseType={kase.case_type}
      run={run}
      runs={completed}
      allRuns={allRuns}
      baseRun={baseRun}
      baseRuns={baseRuns.completed}
      baseLoading={baseId > 0 && baseRuns.status === 'loading'}
      category={chosen}
      onCategory={setCategory}
      editedAfter={Boolean(inventory?.latest_run && inventory.latest_run.run_id === run.run_id && inventory.latest_run.changed_after_run)}
      onOpenRun={(id) => router.replace(`/project/${projectId}/case/${caseId}/results?run=${id}`)}
    />
  )
}

function FullRun({
  projectId,
  caseId,
  caseName,
  caseType,
  run,
  runs,
  baseRun,
  baseRuns,
  baseLoading,
  allRuns,
  category,
  onCategory,
  editedAfter,
  onOpenRun,
}: {
  projectId: string
  caseId: number
  caseName: string
  caseType: string
  run: WorkspaceRun
  runs: WorkspaceRun[]
  baseRun: WorkspaceRun | null
  baseRuns: WorkspaceRun[]
  baseLoading: boolean
  /** Every run of the case, failed ones too, for the history (R10). */
  allRuns: WorkspaceRun[]
  category: string | null
  onCategory: (name: string) => void
  editedAfter: boolean
  onOpenRun: (id: number) => void
}) {
  const isBase = caseType === 'base'
  const [insightsOpen, setInsightsOpen] = useState(false)
  const order = caseRunNumber(runs, run.run_id)
  const region = run.regionCode ?? 'Global'
  const impact = category ? run.impacts[category] ?? null : null
  const prev = previousComparable(runs, run)
  const prevValue = prev && category ? prev.impacts[category]?.value : undefined
  const costs = runCosts(run.run_steps)
  const stepHref = (id: number) => `/project/${projectId}/case/${caseId}?componentId=${id}`
  const top = useMemo(() => topSteps(run, category), [run, category])

  return (
    <div className="ws-full-results" style={{ padding: '24px 28px', maxWidth: 1100, display: 'grid', gap: 20 }}>
      <header style={{ display: 'grid', gap: 6 }}>
        <p style={{ margin: 0 }}>
          <Link className="ds-link" href={`/project/${projectId}/case/${caseId}?tab=results`}>
            Back to the case
          </Link>
        </p>
        <h1 className="ds-title" style={{ margin: 0 }}>
          {caseName}
        </h1>
        <p style={{ margin: 0 }}>
          Run {order} of this case · {run.calculation_method} · {region} · {run.status} · {safeRunDate(run.run_date)}
        </p>
        {editedAfter && <Callout lead="Edited after this run.">Run again to update the answer.</Callout>}
        <Coverage run={run} />
      </header>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Segmented
          label="Category"
          value={category ?? ''}
          onChange={onCategory}
          options={Object.keys(run.impacts).map((name) => ({ value: name, label: name }))}
        />
        <Button onClick={() => setInsightsOpen(true)}>Magic Insights</Button>
      </div>
      <MagicInsightsModal
        open={insightsOpen}
        onClose={() => setInsightsOpen(false)}
        caseName={caseName}
        method={run.calculation_method}
        impacts={run.impacts}
        componentBreakdown={insightsBreakdownOf(run)}
        materialBreakdown={insightsMaterialsOf(run)}
        totalCost={costs?.total}
        stepCosts={frozenStepCosts(run.run_steps)}
        projectId={projectId}
        caseId={String(caseId)}
        runId={run.run_id}
        initialCategory={category ?? undefined}
        caseType={caseType}
      />

      <section aria-label="Total" style={{ display: 'grid', gap: 4 }}>
        {/* A8: the same number the Results tab prints, the same way. */}
        {impact && category ? <BigValue value={headlineNumber(impact.value, category, caseType)} unit={impact.unit} /> : <p>Not counted in {category}.</p>}
        <p style={{ margin: 0 }}>
          {impact && prev && prevValue !== undefined
            ? `${changeWords(impact.value, prevValue)} from Run ${caseRunNumber(runs, prev.run_id)} (${prev.calculation_method}, ${prev.regionCode ?? 'Global'})`
            : prev
              ? `Run ${caseRunNumber(runs, prev.run_id)} (${prev.calculation_method}, ${prev.regionCode ?? 'Global'}) has no value in ${category}.`
              : `No earlier run of this case with ${run.calculation_method} · ${region} to compare.`}
        </p>
        <p className="ds-mono" style={{ margin: 0 }}>
          Cost {costs ? money(costs.total, costs.currency) : 'not entered for this run'}
        </p>
      </section>

      <section aria-label="At a glance" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <p style={{ margin: 0 }}>{Object.keys(run.impacts).length} categories</p>
        <p style={{ margin: 0 }}>{run.componentBreakdown.length} steps with a result</p>
        <p style={{ margin: 0 }}>Last run {safeRunDate([...runs].sort((a, b) => b.run_id - a.run_id)[0]?.run_date)}</p>
      </section>

      <section aria-label="This case">
        <Card>
          <SectionLabel>This case</SectionLabel>
          <KeyValue
            rows={[
              [category ?? 'Category', impact && category ? `${headlineNumber(impact.value, category, caseType)} ${impact.unit}` : 'Not counted'],
              [
                'Against the base case',
                isBase
                  ? 'This is the base case.'
                  : baseRun && category && impact && baseRun.impacts[category]
                    ? `${changeWords(impact.value, baseRun.impacts[category].value)} (base case Run ${caseRunNumber(baseRuns, baseRun.run_id)}, ${baseRun.calculation_method} · ${baseRun.regionCode ?? 'Global'})`
                    : baseLoading
                      ? 'Reading the base case\u2019s runs…'
                      : baseRuns.length > 0
                      ? `The base case has no run with ${run.calculation_method} · ${region}.`
                      : 'The base case has no run yet.',
              ],
              ['Total cost', costs ? money(costs.total, costs.currency) : 'Not entered for this run'],
            ]}
          />
        </Card>
      </section>

      <CategoryChart impacts={run.impacts} selected={category} onSelect={onCategory} />

      <SureCard run={run} caseType={caseType} />

      <section aria-label="Cost by kind">
        <SectionLabel>Cost by kind</SectionLabel>
        {costs ? (
          <>
            {costs.kinds.length > 0 ? (
              <div className="ds-table-wrap">
                <table className="ds-table">
                  <tbody>
                    {costs.kinds.map((row) => (
                      <tr key={row.kind}>
                        <td>{row.kind}</td>
                        <td className="ds-num">{money(row.amount, costs.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>This run froze the total only; run again to see it by kind.</p>
            )}
            <p>
              Cost per unit impact:{' '}
              {impact && impact.value !== 0
                ? `${perUnitMoney(costs.total / Math.abs(impact.value))} per ${impact.unit}`
                : 'not counted'}
            </p>
          </>
        ) : (
          <p>No cost was entered when this run was made.</p>
        )}
      </section>

      <ImpactStack run={run} base={baseRun} category={category} unit={impact?.unit ?? ''} />

      <section aria-label="Step diff">
        <SectionLabel>Step by step against the base case</SectionLabel>
        <StepDiff run={run} base={baseRun} category={category} isBase={isBase} />
      </section>

      <section aria-label="Top contributors">
        <SectionLabel>What builds this number</SectionLabel>
        {top.length ? (
          <ol>
            {top.map((row) => (
              <li key={row.id}>
                <Link className="ds-link" href={stepHref(row.id)}>
                  {row.name}
                </Link>{' '}
                {result3(row.value)} ({share(row.value, impact?.value ?? 0)})
              </li>
            ))}
          </ol>
        ) : (
          <p>No step carries a value in {category}.</p>
        )}
      </section>

      <IsoSummary run={run} />
      <StagePanel run={run} category={category} unit={impact?.unit ?? ''} />
      <FlowTable run={run} category={category} stepHref={stepHref} />

      <section aria-label="Run history">
        <SectionLabel>Runs of this case</SectionLabel>
        <div className="ds-table-wrap">
          <table className="ds-table">
            <thead>
              <tr>
                <th>Run</th>
                <th>When</th>
                <th>Method</th>
                <th>Region</th>
                <th>Status</th>
                <th className="ds-num">{category ?? 'Value'}</th>
              </tr>
            </thead>
            <tbody>
              {[...allRuns]
                .sort((a, b) => a.run_id - b.run_id)
                .map((r) => {
                  const done = runs.some((x) => x.run_id === r.run_id)
                  return (
                    <tr key={r.run_id} aria-current={r.run_id === run.run_id ? 'true' : undefined}>
                      <td>
                        {done ? (
                          <button type="button" className="ds-link" onClick={() => onOpenRun(r.run_id)}>
                            Run {caseRunNumber(runs, r.run_id)}
                          </button>
                        ) : (
                          'Did not finish'
                        )}
                      </td>
                      <td>{safeRunDate(r.run_date)}</td>
                      <td>{r.calculation_method}</td>
                      <td>{r.regionCode ?? 'Global'}</td>
                      <td>{r.status}</td>
                      <td className="ds-num">{done && category && r.impacts[category] ? result3(r.impacts[category].value) : 'not counted'}</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="Data quality warnings">
        <SectionLabel>Warnings frozen with this run</SectionLabel>
        {(run.warnings?.length ?? 0) > 0 ? (
          <ul>
            {run.warnings!.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : (
          <p>This run raised no warnings.</p>
        )}
      </section>

      <p>
        <Link className="ds-link" href={`/project/${projectId}/case/${caseId}?tab=results&run=${run.run_id}`}>
          Short panel
        </Link>
      </p>
    </div>
  )
}

/**
 * Which categories left something out, and why (1.8, 2.11). "Not counted" is
 * a different thing from zero, so it is said in words, never shown as 0.
 */
function Coverage({ run }: { run: WorkspaceRun }) {
  // Categories with no value are named for every run, an older one without a data-quality record too.
  const missing = notCounted(run.method_categories, run.impacts)
  const dq = run.dataQuality
  const partial = (dq?.category_coverage ?? []).filter((c) => c.covered < c.total)
  const none = dq?.uncharacterized_flows ?? 0
  if (!partial.length && !none && !missing.length) return null
  return (
    <section aria-label="Left out">
      <Callout lead="Not everything is counted.">
        {none > 0 && (
          <>
            {none} {none === 1 ? 'flow has' : 'flows have'} no factor in {run.calculation_method}
            {dq?.uncharacterized_examples?.length ? ` (${dq.uncharacterized_examples.slice(0, 3).join(', ')})` : ''}, so{' '}
            {none === 1 ? 'it adds' : 'they add'} nothing to any category.{' '}
          </>
        )}
        {missing.length > 0 && (
          <>
            No value in {missing.join(', ')}: no flow in this case has a {run.calculation_method} factor for{' '}
            {missing.length === 1 ? 'that category' : 'those categories'}.{' '}
          </>
        )}
        {partial.map((c) => (
          <span key={c.category}>
            {c.category} counts {c.covered} of {c.total} inputs
            {c.missing_examples.length ? `; left out: ${c.missing_examples.slice(0, 3).join(', ')}` : ''}.{' '}
          </span>
        ))}
        Not counted is not the same as zero.
      </Callout>
    </section>
  )
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
  // The bar is the size; the number keeps its sign (a credit reads negative).
  const rows = Object.entries(impacts).map(([name, v]) => ({ name, value: Math.abs(v.value), signed: v.value, unit: v.unit }))
  const max = Math.max(...rows.map((r) => r.value), Number.MIN_VALUE)
  // Log view: each bar is log10 of the value, from the smallest value shown.
  const logs = rows.filter((r) => r.value > 0).map((r) => Math.log10(r.value))
  const lo = logs.length ? Math.min(...logs) - 1 : 0
  const hi = logs.length ? Math.max(...logs) : 1
  const width = (v: number) =>
    view === 'Log' ? (v > 0 ? ((Math.log10(v) - lo) / Math.max(hi - lo, 1e-9)) * 100 : 0) : (v / max) * 100
  return (
    <section aria-label="Category chart" style={{ display: 'grid', gap: 8 }}>
      <SectionLabel>Every category</SectionLabel>
      <Segmented
        label="Chart"
        value={view}
        onChange={setView}
        options={(['Absolute', 'Radar', 'Log'] as const).map((v) => ({ value: v, label: v === 'Log' ? 'Log scale' : v }))}
      />
      {view === 'Radar' ? (
        <Radar rows={rows} />
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
          {rows.map((r) => (
            <li key={r.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 220px) 1fr minmax(120px, auto)', gap: 8, alignItems: 'center' }}>
              <button type="button" className="ds-link" aria-pressed={selected === r.name} onClick={() => onSelect(r.name)} style={{ textAlign: 'left' }}>
                {r.name}
              </button>
              <span aria-hidden style={{ display: 'block', height: 8, width: `${Math.max(1, width(r.value))}%`, background: 'var(--ds-green)' }} />
              <span className="ds-num" style={{ overflowWrap: 'anywhere' }}>
                {categoryNumber(r.signed)} {r.unit}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Each category as a share of the largest, so units that differ can share one picture. */
function Radar({ rows }: { rows: Array<{ name: string; value: number }> }) {
  const n = rows.length || 1
  const max = Math.max(...rows.map((r) => r.value), Number.MIN_VALUE)
  const at = (i: number, rad: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2
    return [50 + rad * Math.cos(a), 50 + rad * Math.sin(a)] as const
  }
  const pts = rows.map((r, i) => at(i, (r.value / max) * 36).join(','))
  return (
    <svg viewBox="0 0 100 100" width="260" height="260" role="img" aria-label={`Category radar: ${rows.map((r) => `${r.name} ${share(r.value, max)} of the largest`).join(', ')}`}>
      {rows.map((r, i) => {
        const [x, y] = at(i, 36)
        const [lx, ly] = at(i, 44)
        return (
          <g key={r.name}>
            <line x1="50" y1="50" x2={x} y2={y} stroke="var(--ds-line, #ccc)" strokeWidth="0.3" />
            <text x={lx} y={ly} fontSize="3.2" textAnchor="middle" dominantBaseline="middle">
              {r.name}
            </text>
          </g>
        )
      })}
      <polygon points={pts.join(' ')} fill="var(--ds-green)" opacity="0.35" stroke="var(--ds-green)" strokeWidth="0.6" />
    </svg>
  )
}

/** One stacked bar per case: how much each step adds to the chosen category (P55). */
function ImpactStack({ run, base, category, unit }: { run: WorkspaceRun; base: WorkspaceRun | null; category: string | null; unit: string }) {
  if (!category) return null
  const bars = [{ label: 'This case', run }, ...(base ? [{ label: 'Base case', run: base }] : [])]
  return (
    <section aria-label="Steps stacked by impact" style={{ display: 'grid', gap: 8 }}>
      <SectionLabel>Where the impact sits</SectionLabel>
      {bars.map((b) => {
        const parts = b.run.componentBreakdown
          .map((c) => ({ name: c.component_name, value: Math.max(0, c.impacts.find((i) => i.category_name === category)?.impact_value ?? 0) }))
          .filter((p) => p.value > 0)
          .sort((x, y) => y.value - x.value)
        const total = parts.reduce((t, p) => t + p.value, 0)
        return (
          <div key={b.label} style={{ display: 'grid', gap: 4 }}>
            <span>
              {b.label}: {result3(total)} {unit}
            </span>
            <div role="img" aria-label={`${b.label}: ${parts.map((p) => `${p.name} ${share(p.value, total)}`).join(', ') || 'no step carries a value'}`} style={{ display: 'flex', height: 14, width: '100%', background: 'var(--ds-grey-bg)' }}>
              {parts.map((p, i) => (
                <span key={`${p.name}-${i}`} title={`${p.name} ${result3(p.value)} ${unit}`} style={{ width: `${(p.value / (total || 1)) * 100}%`, background: `var(--ds-chart-${(i % 6) + 1})`, borderRight: '1px solid var(--ds-card)' }} />
              ))}
            </div>
          </div>
        )
      })}
    </section>
  )
}

function StepDiff({ run, base, category, isBase }: { run: WorkspaceRun; base: WorkspaceRun | null; category: string | null; isBase: boolean }) {
  if (isBase) return <p>This is the base case; a copy of it shows its steps against this one.</p>
  if (!base || !category) return <p>No base case run with {run.calculation_method} · {run.regionCode ?? 'Global'} to compare.</p>
  const rows = stepDiffRows(run, base, category)
  return (
    <div className="ds-table-wrap">
      <table className="ds-table">
        <thead>
          <tr>
            <th>Step</th>
            <th className="ds-num">This case</th>
            <th className="ds-num">Base case</th>
            <th className="ds-num">Difference</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.path}>
              <td title={r.path}>{r.name}</td>
              <td className="ds-num">{r.mine === null ? 'not in this case' : result3(r.mine)}</td>
              <td className="ds-num">{r.theirs === null ? 'not in the base case' : result3(r.theirs)}</td>
              <td className="ds-num">{r.diff === 0 ? 'same' : `${r.diff > 0 ? '+' : '−'}${result3(Math.abs(r.diff))}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Goal and scope, the per functional unit table and the data-quality statement, frozen with the run (R07). */
function IsoSummary({ run }: { run: WorkspaceRun }) {
  const gs = run.goalScope
  const dq = run.dataQuality
  const scale = gs?.per_fu_scale ?? 1
  return (
    <section aria-label="ISO summary" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
      <Card>
        <SectionLabel>Goal and scope</SectionLabel>
        {gs ? (
          <>
            <KeyValue
              rows={[
                ['Functional unit', gs.functional_unit || 'Not set when this run was made'],
                [
                  'Reference flow',
                  `${grouped(amount(gs.reference_flow))} ${gs.reference_flow_unit ?? ''}${gs.modeled_output !== 1 ? ` (data basis ${grouped(amount(gs.modeled_output))} ${gs.reference_flow_unit ?? ''})` : ''}`,
                ],
                ['System boundary', BOUNDARY_LABEL[gs.system_boundary] ?? gs.system_boundary],
                ...(gs.boundary_notes ? ([['Exclusions', gs.boundary_notes]] as Array<[string, string]>) : []),
                ...(gs.goal_statement ? ([['Goal', gs.goal_statement]] as Array<[string, string]>) : []),
              ]}
            />
            <SectionLabel>Per functional unit</SectionLabel>
            {scale === 1 ? (
              <p>The totals are already per functional unit: the reference flow equals the data basis.</p>
            ) : (
              <div className="ds-table-wrap">
                <table className="ds-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th className="ds-num">Per functional unit</th>
                      <th className="ds-num">For the whole inventory (÷ {grouped(amount(scale))})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(run.impacts).map(([name, v]) => (
                      <tr key={name}>
                        <td>{name}</td>
                        <td className="ds-num">
                          {result3(v.value)} {v.unit}
                        </td>
                        <td className="ds-num">{result3(v.value / scale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <p>This run was made before goal and scope were frozen with results. Run again to record them.</p>
        )}
      </Card>
      <Card>
        <SectionLabel>Data quality</SectionLabel>
        {dq?.statement?.length ? (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {dq.statement.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        ) : (
          <p>This run was made before a data-quality statement was recorded.</p>
        )}
      </Card>
    </section>
  )
}

/** The chosen category by life-cycle stage, and what the declared boundary says is missing (R08). */
function StagePanel({ run, category, unit }: { run: WorkspaceRun; category: string | null; unit: string }) {
  if (!category) return null
  // Each flow in its own stage (a material going in under Materials); a run
  // made before flows had stages splits by step, as it always did.
  const byFlow = stageRowsFromFlows((run.flowDetail ?? []) as any[], category)
  const rows =
    byFlow ??
    run.componentBreakdown.map((c) => ({
      stage: c.life_cycle_stage ?? null,
      value: Number(c.impacts.find((i) => i.category_name === category)?.impact_value ?? 0) || 0,
      flows: Number(c.flows_processed ?? 0),
    }))
  const totals = groupByStage(rows)
  const presence = STAGES.map((s) => {
    const mine = rows.filter((r) => (r.stage ?? 'production') === s.id)
    return { stage: s.id as StageId, steps: mine.length, flows: mine.reduce((n, r) => n + r.flows, 0) }
  })
  // Older runs froze no boundary, so they have nothing to check against.
  const gaps = run.goalScope ? boundaryGaps(run.goalScope.system_boundary, presence) : { missing: [], outside: [] }
  return (
    <section aria-label="Life-cycle stages" style={{ display: 'grid', gap: 6 }}>
      <SectionLabel>
        By life-cycle stage, {category}
        {unit ? `, ${unit}` : ''}
      </SectionLabel>
      {totals.length === 1 && (
        <p style={{ margin: 0 }}>Everything in this run sits in one stage: {totals[0].label}. Put steps in other stages to widen the study.</p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 4 }}>
        {totals.map((t) => (
          <li key={t.stage} style={{ display: 'grid', gridTemplateColumns: '120px 1fr minmax(140px, auto)', gap: 8, alignItems: 'center' }}>
            <span>{t.label}</span>
            <span aria-hidden style={{ display: 'block', height: 8, width: `${Math.max(1, t.share * 100)}%`, background: 'var(--ds-green)' }} />
            <span className="ds-num">
              {result3(t.value)} ({share(t.share, 1)})
            </span>
          </li>
        ))}
      </ul>
      {gaps.missing.length > 0 && (
        <Callout>
          Your boundary claims {gaps.missing.map((s) => stageLabel(s)).join(', ')}, and nothing in this run sits there. Either model
          those steps or narrow the boundary in Goal and scope.
        </Callout>
      )}
      {gaps.outside.length > 0 && (
        <Callout>
          {gaps.outside.map((s) => stageLabel(s)).join(', ')} {gaps.outside.length === 1 ? 'is' : 'are'} modelled but outside the
          boundary you declared, so the total counts something the scope says is excluded.
        </Callout>
      )}
    </section>
  )
}

/** Amount × factor = impact for every flow in the chosen category (R09). */
function FlowTable({ run, category, stepHref }: { run: WorkspaceRun; category: string | null; stepHref: (id: number) => string }) {
  const [dir, setDir] = useState<'all' | 'IN' | 'OUT'>('all')
  const region = run.regionCode ?? 'Global'
  // Steps by name only for older rows without an id; two steps may share a name.
  const idOf = new Map(run.componentBreakdown.map((c) => [c.component_name, c.component_id]))
  const rows = (run.flowDetail ?? []).filter((f) => (!category || f.category_name === category) && (dir === 'all' || f.dir === dir))
  // K03: materials have a climate factor only; in any other category they say so.
  const climateOnly =
    category && category.toLowerCase() !== CLIMATE.toLowerCase() && dir !== 'OUT' ? climateOnlyFlows(run.flowDetail) : []
  return (
    <section aria-label="Flows" style={{ display: 'grid', gap: 8 }}>
      <SectionLabel>
        Flows in {category}: {rows.length}
        {climateOnly.length > 0 ? `, and ${climateOnly.length} with a climate factor only` : ''}
      </SectionLabel>
      <Segmented
        label="Direction"
        value={dir}
        onChange={setDir}
        options={[
          { value: 'all', label: 'All' },
          { value: 'IN', label: 'Inputs' },
          { value: 'OUT', label: 'Outputs' },
        ]}
      />
      <div className="ds-table-wrap">
        <table className="ds-table">
          <thead>
            <tr>
              <th>Step</th>
              <th>Substance</th>
              <th>In or out</th>
              <th className="ds-num">Amount</th>
              <th className="ds-num">Factor</th>
              <th>Scope</th>
              <th className="ds-num">Impact</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => {
              const id = f.component_id ?? idOf.get(f.component)
              return (
                <tr key={`${f.flow_id}-${f.category_name}`}>
                  <td>
                    {id ? (
                      <Link className="ds-link" href={stepHref(id)}>
                        {f.component}
                      </Link>
                    ) : (
                      f.component
                    )}
                  </td>
                  <td>{f.substance}</td>
                  <td>{f.dir === 'IN' ? 'Input' : 'Output'}</td>
                  <td className="ds-num">
                    {grouped(amount(f.amount))} {f.unit}
                    {f.conversion ? ` (${f.conversion})` : ''}
                  </td>
                  <td className="ds-num" title={factorTitle(f.source ?? null, f.source_tier ?? null)}>
                    {grouped(amount(f.factor))}
                    {factorSourceNote(f.source_tier ?? null, f.source ?? null)}
                  </td>
                  <td>
                    {f.scope ? (
                      isGlobalFallback(f.scope, region) ? (
                        <span className="ds-tag ds-tag--global" title="No factor for this region on file, so the Global factor was used.">
                          Global fallback
                        </span>
                      ) : (
                        f.scope
                      )
                    ) : (
                      '–'
                    )}
                  </td>
                  <td className="ds-num">
                    {result3(f.impact)}
                    {f.allocation != null && f.allocation < 1 ? ` (allocated ${Math.round(f.allocation * 100)}%)` : ''}
                  </td>
                </tr>
              )
            })}
            {climateOnly.map((f) => {
              const id = f.component_id ?? idOf.get(f.component)
              return (
                <tr key={`${f.flow_id}-climate-only`} data-climate-only="true">
                  <td>
                    {id ? (
                      <Link className="ds-link" href={stepHref(id)}>
                        {f.component}
                      </Link>
                    ) : (
                      f.component
                    )}
                  </td>
                  <td>{f.substance}</td>
                  <td>Input</td>
                  <td className="ds-num">
                    {grouped(amount(f.amount))} {f.unit}
                  </td>
                  <td colSpan={3}>
                    <span className="ds-tag" title={`This material has a ${CLIMATE} factor and no ${category} factor, so it is not counted here.`}>
                      climate only
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
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

/** A cost per unit of impact can be a fraction of a cent: shown to 4 significant figures then, never "$0.00". */
function perUnitMoney(x: number): string {
  if (!Number.isFinite(x)) return '–'
  return Math.abs(x) >= 0.01 ? money(x) : `$${Number(x.toPrecision(4))}`
}

/** A8: the Results tab's "How sure", from the same computation, so the two never disagree. */
function SureCard({ run, caseType }: { run: WorkspaceRun; caseType: string }) {
  const sure = howSure(run, caseType)
  if (!sure) return null
  return (
    <Card>
      <HowSure sure={sure} />
      <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--ds-text-2)' }}>
        This splits the climate total by where each factor applies. The data quality statement below grades the same factors by who published them.
      </p>
    </Card>
  )
}
