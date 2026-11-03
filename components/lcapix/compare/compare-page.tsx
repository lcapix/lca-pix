'use client'

// Compare (E09, E09b): the base case against its copies. Four checks decide
// whether the numbers may be read side by side (same method, region and
// functional unit; every run current). When they pass: the totals, change by
// step, and what changed in the copy. When one fails: the totals greyed,
// change by step held back with the reason, and the run that fixes it, under
// A's method and region. Under the totals, the verdict and the change by
// category for A against B. Any check that is not ok, a region difference
// included, holds back every percentage on the page (the totals chip, the
// Ranking, the verdict, the change by category): one rule, whyNoNumber in
// lib/project/comparison-banner.ts. The absolute totals stay, labelled as not
// comparable. The fuller views (every category,
// hotspots, cost, where the change comes from by step or material, what
// differs in every copy, data quality) are tabs below; when the checks fail,
// each says why. ?tab=saved lists the project's saved comparisons.

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useParams, useSearchParams } from 'next/navigation'
import { Button, EmptyState, ErrorCard, SourceTag, Tabs } from '@/components/lcapix/ds'
import { apiRequest } from '@/lib/api-client'
import { rankCases } from '@/lib/compare/analytics'
import { safeRunDate } from '@/lib/results/results-view'
import { useShellData } from '@/lib/shell/use-shell'
import { useCompare } from '@/lib/compare/use-compare'
import { comparability, COMPARE_MAX_CASES } from '@/lib/compare/comparability'
import {
  cellValue,
  changeCell,
  changeSummary,
  changeWords,
  checkAction,
  checkLabel,
  headerLine,
  LETTERS,
  perNoun,
  sentenceCase,
  stepRows,
  totalChip,
  verdict,
  whatChanged,
} from '@/lib/compare/compare-view'
import { caseTotal, amountBox, co2Unit, fixed, result3 } from '@/lib/ui/format'
import { whyNoNumber } from '@/lib/project/comparison-banner'
import { sourceKindOf } from '@/lib/workspace/inventory'
import type { CompareCase } from './types'
import { DeltaCard, VerdictCard } from './verdict-cards'
// The fuller views load only when "More ways to compare" opens: they carry the chart code.
const ResultsPanel = dynamic(() => import('./results-panel').then((m) => m.ResultsPanel))
const HotspotPanel = dynamic(() => import('./hotspot-panel').then((m) => m.HotspotPanel))
const CostPanel = dynamic(() => import('./cost-panel').then((m) => m.CostPanel))
const QualityPanel = dynamic(() => import('./quality-panel').then((m) => m.QualityPanel))
const ChangePanel = dynamic(() => import('./change-panel').then((m) => m.ChangePanel))
const WhatDiffersPanel = dynamic(() => import('./what-differs').then((m) => m.WhatDiffersPanel))

const CLIMATE = 'Global Warming'
type More = 'results' | 'hotspots' | 'cost' | 'change' | 'differs' | 'quality'

/** Why this run was compared, in words (P69). */
const RUN_REASON: Record<string, string> = {
  picked: 'you picked it',
  'matches-copies': 'it matches the copies\u2019 method and region',
  'matches-study': 'it matches the study\u2019s method and region',
  latest: 'it is the latest',
}
const NOT_RANKED: Record<string, string> = {
  incomplete: 'it has no complete run',
  stale: 'it changed after its run',
  method: 'its run used another method',
  'functional-unit': 'its run used another functional unit',
  'no-result': 'it has no result in this category',
}

export function ComparePage() {
  const params = useParams()
  const projectId = Number(params.projectId)
  const { profile } = useShellData()
  const { cases, byId, selected, setSelected, toggle, data, error, loading, runAgain, reload, pickRun } = useCompare(projectId, profile?.id ?? -1)
  const search = useSearchParams()
  const [view, setView] = useState<'compare' | 'saved'>(search?.get('tab') === 'saved' ? 'saved' : 'compare')
  // Saving a comparison was retired (CMP-7): the Saved tab only lists older
  // saves, so it shows only in a project that has some (or when asked for).
  const [savedCount, setSavedCount] = useState<number | null>(null)
  useEffect(() => {
    let live = true
    apiRequest(`/api/comparisons?project_id=${projectId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setSavedCount(Array.isArray(d?.comparisons) ? d.comparisons.length : 0))
      .catch(() => live && setSavedCount(0))
    return () => {
      live = false
    }
  }, [projectId])
  const showSavedTab = view === 'saved' || (savedCount ?? 0) > 0
  const [category, setCategory] = useState(CLIMATE)
  const [vs, setVs] = useState<string | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [more, setMore] = useState<More>('results')

  // In the order chosen: A is the first case picked (the base by default), so
  // the letters on the page match the pickers (2.10).
  const compared: CompareCase[] = useMemo(() => {
    const all = data?.cases ?? []
    const byCase = new Map(all.map((c) => [c.caseId, c]))
    const ordered = selected.map((id) => byCase.get(id)).filter((c): c is CompareCase => !!c)
    const rest = all.filter((c) => !selected.includes(c.caseId))
    if (ordered.length) return [...ordered, ...rest]
    const base = all.find((c) => c.caseId === data?.baseCaseId)
    return base ? [base, ...all.filter((c) => c !== base)] : all
  }, [data, selected])
  const togglePair = (index: number, id: string) => {
    setSelected((cur) => {
      const next = [...cur]
      if (!id) {
        next.splice(index, 1)
        return next.filter(Boolean)
      }
      // A case already picked elsewhere moves here and the two swap: a case is never in the list twice.
      const was = next.indexOf(id)
      if (was !== -1 && was !== index) next[was] = next[index]
      next[index] = id
      return next.filter(Boolean)
    })
  }
  const base = compared[0]
  const checks = useMemo(
    () =>
      comparability(
        compared.map((c) => ({
          caseId: c.caseId,
          name: c.name,
          run: c.run ? { runId: c.run.runId, method: c.run.method, region: c.run.region, functionalUnit: c.run.functionalUnit } : null,
          editedSinceRun: c.status === 'stale' || !!c.run?.stale,
        })),
      ),
    [compared],
  )
  const categories = useMemo(() => Array.from(new Set(compared.flatMap((c) => c.totals.map((t) => t.category)))), [compared])
  useEffect(() => {
    if (categories.length && !categories.includes(category)) setCategory(categories.includes(CLIMATE) ? CLIMATE : categories[0])
  }, [categories, category])

  if (error && !data) {
    return (
      <div className="np">
        <ErrorCard title="The comparison did not load" cause={error} onRetry={reload} />
      </div>
    )
  }
  if (!cases) {
    return (
      <div className="np" role="status" style={{ color: 'var(--ds-text-2)' }}>
        Loading the cases…
      </div>
    )
  }

  const letterOf = (id: string) => LETTERS[Math.max(0, compared.findIndex((c) => c.caseId === id))]
  const nameOf = (id: string) => compared.find((c) => c.caseId === id)?.name ?? byId.get(id)?.name ?? `Case ${id}`
  const baseScope = { method: base?.run?.method ?? null, region: base?.run?.region ?? null }
  const v = verdict(checks, compared.length)
  const fair = compared.length >= 2 && checks.fair
  const unitRaw = base?.totals.find((t) => t.category === category)?.unit ?? 'kg CO2 eq'
  const unit = /co2/i.test(unitRaw) ? co2Unit(unitRaw) : unitRaw
  const fu = base?.run?.functionalUnit ?? data?.project.functionalUnit ?? null
  const other = compared.find((c) => c.caseId === vs) ?? compared[1]
  const diff = other ? data?.diffs.find((d) => d.caseId === other.caseId)?.inventory ?? null : null
  const pair = base && other ? [base, other] : []
  const showAmounts = pair.every((c) => (c.run?.perFuScale ?? 1) === 1)
  const rows = fair && pair.length === 2 ? stepRows(pair, category, diff, showAmounts) : []
  const scopeDiff = other ? data?.diffs.find((d) => d.caseId === other.caseId)?.scope ?? [] : []
  const changed = other && other !== base ? whatChanged(diff, other, category, unit, { scope: scopeDiff, base }) : null
  const summary = changeSummary(rows, unit)
  const scopeOf = (id: string) => {
    const c = compared.find((x) => x.caseId === id)
    return c?.run ? { method: c.run.method, region: c.run.region } : null
  }
  const failedAction = checks.checks.map((k) => checkAction(k, nameOf, baseScope, scopeOf)).find(Boolean) ?? null
  // Why no percentage is shown anywhere on the page, or null when every check passes.
  const noPct = fair ? null : checks.checks.filter((k) => !k.ok).map((k) => k.label).join('. ') || 'Run both cases to compare them'

  const run = async (caseId: string) => {
    setRunning(caseId)
    setRunError(null)
    try {
      // A run picked by hand for this case would hide the new one: the comparison reads its latest run after.
      pickRun(caseId, '')
      await runAgain(caseId, baseScope)
    } catch (e: any) {
      setRunError(e?.message ?? 'The run did not start.')
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="np cmp">
      <header className="pc-head">
        <div style={{ flex: 1, minWidth: 260 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ds-text-2)' }}>{data?.project.name ?? ''}</p>
          <h1 className="ds-title" style={{ margin: '2px 0 0', display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
            Compare{' '}
            {compared.length > 0 && (
              <span style={{ fontSize: 15, fontWeight: 400, color: 'var(--ds-text-2)' }}>{headerLine(compared.map((c) => c.name), checks)}</span>
            )}
          </h1>
        </div>
        {compared.length > 0 && <ResultsMenu projectId={projectId} cases={compared} />}
      </header>
      {showSavedTab && (
      <Tabs<'compare' | 'saved'>
        label="Compare or saved comparisons"
        selected={view}
        onSelect={(t) => {
          setView(t)
          const q = new URLSearchParams(window.location.search)
          if (t === 'saved') q.set('tab', 'saved')
          else q.delete('tab')
          window.history.replaceState(null, '', `${window.location.pathname}?${q.toString()}`)
        }}
        tabs={[
          { id: 'compare', label: 'Compare' },
          { id: 'saved', label: 'Saved comparisons' },
        ]}
      />
      )}

      <div className="cmp-bar">
        {/* P59: any case, the base included, in or out with one click; no cap of 8. */}
        <span role="group" aria-label="Cases to compare" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(cases ?? []).map((c) => {
            const i = compared.findIndex((x) => x.caseId === c.id)
            const on = selected.includes(c.id)
            const cc = i >= 0 ? compared[i] : null
            return (
              <button
                key={c.id}
                type="button"
                className="cmp-chip"
                aria-pressed={on}
                disabled={on && selected.length === 1}
                title={on && selected.length === 1 ? 'Keep one case in the comparison' : undefined}
                onClick={() => toggle(c.id)}
              >
                {on && i >= 0 && (
                  <span className="cmp-letter" data-l={LETTERS[i]} aria-hidden>
                    {LETTERS[i]}
                  </span>
                )}
                <span>{c.name}</span>
                {on && cc && (
                  <span className="ds-mono cmp-chip-run">
                    {!cc.run ? 'not run' : cc.status === 'stale' || cc.run.stale ? 'run out of date' : `Run ${runNumber(cc, cc.run.runId)}`}
                  </span>
                )}
              </button>
            )
          })}
        </span>
        {/* 2.10: any two cases as A and B, without editing the address. */}
        <label className="cmp-pick">
          <span>A</span>
          <select className="ds-input" aria-label="Case A" value={selected[0] ?? ''} onChange={(e) => togglePair(0, e.target.value)}>
            {(cases ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="cmp-pick">
          <span>B</span>
          <select className="ds-input" aria-label="Case B" value={selected[1] ?? ''} onChange={(e) => togglePair(1, e.target.value)}>
            <option value="">None</option>
            {(cases ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <span style={{ flex: 1 }} />
        {categories.length > 0 && (
          <label className="cmp-cat">
            <span className="ds-sr-only">Impact category</span>
            <select className="ds-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((k) => (
                <option key={k} value={k}>
                  {sentenceCase(k)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {data?.limit?.leftOut ? (
        <p className="pp-alert">
          {data.limit.leftOut} more {data.limit.leftOut === 1 ? 'case was' : 'cases were'} left out: Compare holds {COMPARE_MAX_CASES}.
        </p>
      ) : null}

      {loading && !data && (
        <p role="status" style={{ color: 'var(--ds-text-2)' }}>
          Reading the runs…
        </p>
      )}

      {view === 'saved' && <SavedComparisons projectId={projectId} onCompare={(ids) => { setSelected(ids); setView('compare') }} />}

      {view === 'compare' && data && compared.length === 1 && <OneCase c={compared[0]} projectId={projectId} />}
      {view === 'compare' && data && compared.length < 2 && (
        <div className="pp-card" style={{ textAlign: 'center', padding: '40px 24px', marginTop: 12 }}>
          <strong style={{ display: 'block', fontSize: 18 }}>Add a second case to compare</strong>
          <p className="np-sub" style={{ margin: '6px 0 14px' }}>
            Make a copy of the base case, change one input, run it, then add it here.
          </p>
          <AddCaseMenu cases={cases} selected={selected} baseId={null} onToggle={toggle} primary />
        </div>
      )}

      {view === 'compare' && data && compared.length >= 2 && (
        <>
          <section className="cmp-checks" data-ok={v.ok || undefined} aria-label="Whether these cases compare fairly">
            <div className="cmp-verdict">
              <strong>{v.title}</strong>
              <span>{v.sub}</span>
            </div>
            {checks.checks.map((k) => {
              const act = checkAction(k, nameOf, baseScope, scopeOf)
              return (
                <div key={k.key} className="cmp-check" data-fail={!k.ok || undefined}>
                  <span className="cmp-check-icon" aria-hidden>
                    {k.ok ? '✓' : '✕'}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <strong>
                      <span className="ds-sr-only">{k.ok ? 'Passes: ' : 'Fails: '}</span>
                      {checkLabel(k, compared.length)}
                    </strong>
                    {k.ok ? (
                      <span>{k.detail}</span>
                    ) : act ? (
                      <button type="button" className="cmp-check-act" disabled={!!running} onClick={() => void run(act.caseId)}>
                        {running === act.caseId ? 'Running…' : act.label}
                      </button>
                    ) : (
                      <span>{k.detail}</span>
                    )}
                  </span>
                </div>
              )
            })}
          </section>
          {runError && (
            <p role="alert" className="pp-alert" style={{ marginTop: 10 }}>
              {runError}
            </p>
          )}

          <ul aria-label="Cases in this comparison" className="cmp-cases">
            {compared.map((c, i) => (
              <li key={c.caseId} className="ds-card ds-card-pad">
                <span className="cmp-total-name">
                  <span className="cmp-letter cmp-letter--sq" data-l={LETTERS[i]} aria-hidden>
                    {LETTERS[i]}
                  </span>
                  <strong>{c.name}</strong>
                </span>
                <span className="ds-mono">
                  {c.inventory?.steps ?? 0} steps · {c.inventory?.flows ?? 0} flows
                </span>
                {c.runs?.length > 0 && (
                  <label className="cmp-pick">
                    <span>Run</span>
                    <select className="ds-input" aria-label={`Run for ${c.name}`} value={String(c.run?.runId ?? '')} onChange={(e) => pickRun(c.caseId, e.target.value)}>
                      {[...c.runs]
                        .sort((a, b) => a.runId - b.runId)
                        .map((r) => (
                          <option key={r.runId} value={r.runId}>
                            Run {runNumber(c, r.runId)} · {r.method ?? 'method not set'} · {r.region ?? 'Global'} · {safeRunDate(r.runDate)}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                {c.run && c.run.reason !== 'latest' && (
                  <span>
                    Compared on Run {runNumber(c, c.run.runId)} because {RUN_REASON[c.run.reason] ?? c.run.reason}.
                  </span>
                )}
                {c.run?.stale && <span>The case changed after this run. Run it again to compare what it is now.</span>}
                {c.run && c.run.resultsSource !== 'snapshot' && (
                  <span>An older run: made before results were saved with each run, so its step names are read from the case as it is now.</span>
                )}
                {(!c.run || c.status === 'incomplete') && (
                  <span>
                    {c.statusReason ?? 'Not run yet.'}{' '}
                    <Link className="ds-link" href={`/project/${projectId}/case/${c.caseId}`}>
                      Open the case
                    </Link>
                  </span>
                )}
              </li>
            ))}
          </ul>
          <Ranking cases={compared} baseId={base.caseId} category={category} unit={unit} blocked={noPct} />
          <p>
            <Link className="ds-btn" href={`/project/${projectId}/case/new?kind=whatif&from=${base.caseId}`}>
              Make a what-if of the base
            </Link>
          </p>

          <section className="cmp-totals" aria-label="Totals">
            <div className="cmp-totals-grid" style={{ gridTemplateColumns: `repeat(${Math.min(compared.length, 4)}, minmax(0, 1fr))` }}>
              {compared.map((c, i) => {
                const t = c.totals.find((x) => x.category === category)
                const stale = c.status === 'stale' || !!c.run?.stale
                const baseT = base.totals.find((x) => x.category === category)
                // The same rule for the chip as for every other percentage: the pair must pass every check.
                const chip = i > 0 && fair && t && baseT && !whyNoNumber(base, c) ? totalChip(t.value, baseT.value) : null
                return (
                  <div key={c.caseId} className="cmp-total" data-grey={!fair || undefined}>
                    <span className="cmp-total-name">
                      <span className="cmp-letter cmp-letter--sq" data-l={LETTERS[i]} aria-hidden>
                        {LETTERS[i]}
                      </span>
                      {c.name}
                    </span>
                    {!c.run ? (
                      <span className="cmp-total-none">Not run yet</span>
                    ) : stale ? (
                      <span className="cmp-total-none">Last run out of date</span>
                    ) : c.status === 'incomplete' || !t ? (
                      <span className="cmp-total-none">{c.statusReason ?? 'No result in this category'}</span>
                    ) : (
                      <span className="cmp-total-row">
                        {/* 2.9: every case at the same decimals, so A and B read alike. */}
                        <span className="cmp-total-num ds-mono">{caseTotal(t.value, 'comparative')}</span>
                        <span className="cmp-total-unit">
                          {unit} per {perNoun(fu)}
                        </span>
                        {chip && <span className="cmp-delta">{chip}</span>}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            <p className="cmp-totals-foot">
              {fair
                ? `${sentenceCase(category)}, per ${fu ?? 'functional unit'}.`
                : `Not comparable: ${noPct}. Each total is shown as its own run computed it, with no percentage between them, until every check passes.`}
            </p>
          </section>

          {/* P51, P54: A against the case "Change by step" reads (B, or the one picked there). */}
          {other && (
            <div className="cmp-vd">
              <VerdictCard a={base} b={other} letterB={letterOf(other.caseId)} category={category} />
              <DeltaCard a={base} b={other} letterB={letterOf(other.caseId)} />
            </div>
          )}

          {fair ? (
            <div className="cmp-main">
              <section className="pp-card cmp-steps" aria-labelledby="cmp-steps-h" style={{ padding: 0 }}>
                <div className="cmp-steps-head">
                  <h2 id="cmp-steps-h" className="pp-card-h" style={{ fontSize: 20 }}>
                    Change by step
                  </h2>
                  <span style={{ fontSize: 15, color: 'var(--ds-text-2)', flex: 1 }}>
                    {sentenceCase(category)}, per {perNoun(fu)}
                  </span>
                  {compared.length > 2 && (
                    <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                      A against
                      <select className="ds-input" value={other?.caseId} onChange={(e) => setVs(e.target.value)}>
                        {compared.slice(1).map((c) => (
                          <option key={c.caseId} value={c.caseId}>
                            {letterOf(c.caseId)} · {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                {/* Scrolls sideways when narrow: a keyboard can reach and scroll it. */}
                <div className="pp-wrap" tabIndex={0} role="region" aria-label="Change by step table">
                  <table className="ds-table cmp-table">
                    <thead>
                      <tr>
                        <th scope="col">Step</th>
                        <th scope="col" className="cmp-num">
                          A
                        </th>
                        <th scope="col" className="cmp-num">
                          {letterOf(other.caseId)}
                        </th>
                        <th scope="col" className="cmp-num">
                          Change
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.step} data-changed={r.changed || undefined}>
                          <th scope="row" style={{ fontWeight: 400, textAlign: 'left' }}>
                            <span className="cmp-step">
                              {r.num ? <span className="cmp-step-num ds-mono">{r.num}</span> : <span className="cmp-step-num" aria-hidden />}
                              <span style={{ minWidth: 0 }}>
                                <strong style={{ display: 'block', fontSize: 14 }}>{r.label}</strong>
                                {r.line && <span style={{ fontSize: 12, color: 'var(--ds-text-2)' }}>{r.line}</span>}
                              </span>
                            </span>
                          </th>
                          <td className="cmp-num ds-mono">{cellValue(r.values[0], unit)}</td>
                          <td className="cmp-num ds-mono">{cellValue(r.values[1], unit)}</td>
                          <td className="cmp-num" data-down={(r.changed && r.delta < 0) || undefined} data-up={(r.changed && r.delta > 0) || undefined}>
                            <span className={r.changed ? 'ds-mono' : undefined}>{changeCell(r.delta, unit, r.changed)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <aside className="pp-card cmp-what" aria-labelledby="cmp-what-h">
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <span className="cmp-what-icon" aria-hidden>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
                    </svg>
                  </span>
                  <span>
                    <h2 id="cmp-what-h" className="pp-card-h" style={{ fontSize: 22 }}>
                      What changed
                    </h2>
                    <span style={{ fontSize: 14, color: 'var(--ds-text-2)' }}>Inputs in {letterOf(other.caseId)} that differ from A</span>
                  </span>
                </div>
                {!changed || !changed.lines.length ? (
                  <p style={{ margin: '18px 0 0', fontSize: 15 }}>
                    Nothing in {other.name} differs from {base.name}. Change one input in the copy, run it, and the change shows here.
                  </p>
                ) : (
                  <>
                    {changed.main && (
                      <>
                        <p className="cmp-what-big">
                          <span className="ds-mono">{amountBox(Number(changed.main.from)) || changed.main.from}</span>
                          <span aria-label="to"> → </span>
                          <span className="ds-mono">{amountBox(Number(changed.main.to)) || changed.main.to}</span>
                          <small> {changed.main.unit}</small>
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 15 }}>
                          {changed.main.substance} at {changed.main.where}
                        </p>
                      </>
                    )}
                    {changed.factor && (
                      <>
                        <p style={{ margin: '16px 0 4px', fontSize: 15 }}>
                          {changed.factor.scope ? `${changed.factor.scope} factor` : 'Factor'} <SourceTag kind={sourceKindOf({ scope: changed.factor.scope })} />
                        </p>
                        <dl className="cmp-what-kv">
                          <dt>Factor</dt>
                          <dd className="ds-mono">
                            {result3(changed.factor.value)} {changed.factor.unit}
                          </dd>
                          <dt>Everything else</dt>
                          <dd>{changed.nothingElse ? 'Nothing else changed.' : `${changed.lines.length - 1} more ${changed.lines.length === 2 ? 'change' : 'changes'}, below.`}</dd>
                        </dl>
                      </>
                    )}
                    {!changed.nothingElse && (
                      <ul className="cmp-what-list">
                        {changed.lines.slice(changed.main ? 1 : 0, 8).map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                        {changed.lines.length > 8 && <li>and {changed.lines.length - 8} more</li>}
                      </ul>
                    )}
                    {summary && <p className="cmp-what-sum">{summary}</p>}
                  </>
                )}
              </aside>
            </div>
          ) : (
            <section className="pp-card cmp-held" aria-labelledby="cmp-held-h">
              <span className="cmp-held-icon" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 7h16M4 12h10M4 17h7" />
                </svg>
              </span>
              <h2 id="cmp-held-h" className="pp-card-h" style={{ fontSize: 20 }}>
                Change by step shows once every check passes
              </h2>
              <p style={{ margin: '6px 0 16px', fontSize: 15, color: 'var(--ds-text-2)' }}>
                {checks.checks
                  .filter((k) => !k.ok)
                  .map((k) => `${k.label}.`)
                  .join(' ')}
              </p>
              {failedAction && (
                <Button variant="primary" busy={running === failedAction.caseId} disabled={!!running} onClick={() => void run(failedAction.caseId)}>
                  ▶ {failedAction.label}
                </Button>
              )}
              {changed && changed.lines.length > 0 && (
                <div className="cmp-held-what">
                  <h3 style={{ margin: '18px 0 6px', fontSize: 16 }}>
                    What changed in {letterOf(other.caseId)} against A
                  </h3>
                  <ul aria-label={`What changed in ${other.name}`} className="cmp-what-list">
                    {changed.lines.slice(0, 8).map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                    {changed.lines.length > 8 && <li>and {changed.lines.length - 8} more</li>}
                  </ul>
                </div>
              )}
            </section>
          )}

          <section className="cmp-more" aria-label="More ways to compare">
            <div style={{ marginTop: 12 }}>
                <Tabs<More>
                  label="Results, hotspots and cost"
                  selected={more}
                  onSelect={setMore}
                  tabs={[
                    { id: 'results', label: 'Every category' },
                    { id: 'hotspots', label: 'Hotspots' },
                    { id: 'cost', label: 'Cost' },
                    { id: 'change', label: 'By step or material' },
                    { id: 'differs', label: 'What differs' },
                    { id: 'quality', label: 'Data quality' },
                  ]}
                />
                <div className="pp-card" style={{ marginTop: 12 }}>
                  {!fair && more !== 'quality' && more !== 'differs' ? (
                    <p style={{ margin: 0, fontSize: 15, color: 'var(--ds-text-2)' }}>
                      This view shows once every check passes. Now:{' '}
                      {checks.checks
                        .filter((k) => !k.ok && !k.warn)
                        .map((k) => `${k.label}.`)
                        .join(' ') || 'it needs two cases with a run.'}
                    </p>
                  ) : more === 'change' ? (
                    <ChangePanel base={base} cases={compared} category={category} />
                  ) : more === 'differs' ? (
                    <WhatDiffersPanel base={base} cases={compared} diffs={data.diffs} category={category} />
                  ) : more === 'results' ? (
                    <ResultsPanel cases={compared} baseId={base.caseId} />
                  ) : more === 'hotspots' ? (
                    <HotspotPanel cases={compared} category={category} />
                  ) : more === 'cost' ? (
                    <CostPanel base={base} cases={compared} diffs={data.diffs} category={category} />
                  ) : (
                    <QualityPanel base={base} cases={compared} />
                  )}
                </div>
              </div>
          </section>
        </>
      )}

    </div>
  )
}

/** "Open in each case's Results": one link per compared case. */
function ResultsMenu({ projectId, cases }: { projectId: number; cases: CompareCase[] }) {
  const [open, setOpen] = useMenu()
  return (
    <span ref={open.ref} style={{ position: 'relative' }}>
      <button type="button" className="ds-btn" aria-haspopup="menu" aria-expanded={open.on} onClick={() => setOpen(!open.on)}>
        Open in each case&apos;s Results
      </button>
      {open.on && (
        <span className="ws-menu" role="menu" style={{ right: 0, top: 'calc(100% + 6px)' }}>
          {cases.map((c, i) => (
            <Link key={c.caseId} role="menuitem" href={`/project/${projectId}/case/${c.caseId}/results`} onClick={() => setOpen(false)}>
              <span className="cmp-letter cmp-letter--sq" data-l={LETTERS[i]} aria-hidden>
                {LETTERS[i]}
              </span>
              {c.name}
            </Link>
          ))}
        </span>
      )}
    </span>
  )
}

/** "+ Add a case": every case of the project, ticked when compared; the base case stays. */
function AddCaseMenu({
  cases,
  selected,
  baseId,
  onToggle,
  primary,
}: {
  cases: Array<{ id: string; name: string; type: string; runs: number }>
  selected: string[]
  baseId: string | null
  onToggle: (id: string) => void
  primary?: boolean
}) {
  const [open, setOpen] = useMenu()
  const full = selected.length >= COMPARE_MAX_CASES
  return (
    <span ref={open.ref} style={{ position: 'relative' }}>
      <button type="button" className={primary ? 'ds-btn ds-btn--primary' : 'cmp-add'} aria-haspopup="menu" aria-expanded={open.on} onClick={() => setOpen(!open.on)}>
        + Add a case
      </button>
      {open.on && (
        <span className="ws-menu cmp-add-menu" role="menu" aria-label="Cases to compare">
          {cases.map((c) => {
            const on = selected.includes(c.id)
            const locked = c.id === baseId
            return (
              <button
                key={c.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={on}
                disabled={locked || (!on && full)}
                onClick={() => onToggle(c.id)}
              >
                <span aria-hidden style={{ width: 16 }}>
                  {on ? '✓' : ''}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>{c.name}</span>
                <span style={{ fontSize: 12, color: 'var(--ds-text-2)' }}>{locked ? 'base' : c.runs ? `${c.runs} ${c.runs === 1 ? 'run' : 'runs'}` : 'not run'}</span>
              </button>
            )
          })}
          {full && <span style={{ display: 'block', padding: '6px 12px', fontSize: 13, color: 'var(--ds-text-2)' }}>Compare holds {COMPARE_MAX_CASES} cases.</span>}
        </span>
      )}
    </span>
  )
}

/** A menu's open state: closes on Escape (focus back to the button) and on a click outside. */
function useMenu(): [{ on: boolean; ref: RefObject<HTMLSpanElement | null> }, (on: boolean) => void] {
  const [on, setOn] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!on) return
    ref.current?.querySelector<HTMLElement>('[role^="menuitem"]:not([disabled])')?.focus()
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOn(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOn(false)
        ref.current?.querySelector<HTMLElement>('[aria-haspopup]')?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [on])
  return [{ on, ref }, setOn]
}

/** A run's place in its own case among the runs Compare lists for it (2.8). */
function runNumber(c: CompareCase, runId: number): number {
  const ids = (c.runs ?? []).map((r) => r.runId).sort((a, b) => a - b)
  const i = ids.indexOf(runId)
  return i < 0 ? ids.length + 1 : i + 1
}

/**
 * P74: the copies ranked against A in this category, lowest first, and why any
 * is not ranked. When a comparability check fails nothing is ranked and no
 * percentage shows (the same rule as the totals chip and the verdict); the
 * percentage is the one the chip prints (changeWords, from the run values).
 */
function Ranking({ cases, baseId, category, unit, blocked }: { cases: CompareCase[]; baseId: string; category: string; unit: string; blocked: string | null }) {
  const r = rankCases(
    cases.map((c) => ({ ...c, method: c.run?.method ?? null, functionalUnit: c.run?.functionalUnit ?? null })) as any,
    baseId,
    category,
  )
  const nameOf = (id: string) => cases.find((c) => c.caseId === id)?.name ?? id
  return (
    <section aria-label="Ranking" className="ds-card ds-card-pad" style={{ margin: '12px 0' }}>
      <span className="ds-section-label">Ranking · {sentenceCase(category)}, lowest first</span>
      {blocked ? (
        <p style={{ margin: '6px 0 0' }}>Nothing is ranked: not comparable. {blocked}.</p>
      ) : r.baseExcluded ? (
        <p style={{ margin: '6px 0 0' }}>Nothing is ranked: {nameOf(baseId)} cannot anchor it because {NOT_RANKED[r.baseExcluded]}.</p>
      ) : (
        <ol style={{ margin: '6px 0 0', paddingLeft: 20 }}>
          {r.ranked.map((x) => {
            const words = r.baseValue !== null ? changeWords(x.value, r.baseValue) : null
            return (
              <li key={x.caseId}>
                {nameOf(x.caseId)} <span className="ds-mono">{result3(x.value)}</span> {unit}
                {words ? ` (${words})` : ''}
              </li>
            )
          })}
        </ol>
      )}
      {!blocked &&
        r.excluded.map((x) => (
          <p key={x.caseId} style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--ds-text-2)' }}>
            {nameOf(x.caseId)} is not ranked: {NOT_RANKED[x.reason]}.
          </p>
        ))}
    </section>
  )
}

/** P84: one case reads on its own: its run and every category. */
function OneCase({ c, projectId }: { c: CompareCase; projectId: number }) {
  return (
    <section aria-label="One case" className="ds-card ds-card-pad" style={{ marginTop: 12 }}>
      <strong style={{ display: 'block', fontSize: 18 }}>{c.name}, on its own</strong>
      {!c.run ? (
        <p>
          Not run yet.{' '}
          <Link className="ds-link" href={`/project/${projectId}/case/${c.caseId}`}>
            Open the case
          </Link>
        </p>
      ) : (
        <>
          <p className="np-sub" style={{ margin: '4px 0 10px' }}>
            Run {runNumber(c, c.run.runId)} · {c.run.method ?? 'method not set'} · {c.run.region ?? 'Global'} · {c.inventory?.steps ?? 0} steps · {c.inventory?.flows ?? 0} flows
          </p>
          <table className="ds-table">
            <tbody>
              {c.totals.map((t) => (
                <tr key={t.category}>
                  <td>{sentenceCase(t.category)}</td>
                  <td className="ds-num">
                    {result3(t.value)} {t.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}

/** P63, G126: the project's saved comparisons, each with Compare these. */
function SavedComparisons({ projectId, onCompare }: { projectId: number; onCompare: (ids: string[]) => void }) {
  const [rows, setRows] = useState<Array<{ comparison_id: number; comparison_name: string; case_ids: number[]; base_case_id: number | null; created_at?: string }> | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    apiRequest(`/api/comparisons?project_id=${projectId}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d?.error ?? `error ${r.status}`)
        if (live) setRows(d.comparisons ?? [])
      })
      .catch((e) => live && setError(e?.message ?? 'the saved comparisons did not load'))
    return () => {
      live = false
    }
  }, [projectId])
  if (error) return <ErrorCard title="The saved comparisons did not load" cause={error} />
  if (!rows) return <p role="status">Loading the saved comparisons…</p>
  if (!rows.length) return <EmptyState line="No saved comparisons in this project yet." />
  return (
    <ul aria-label="Saved comparisons" className="cmp-cases" style={{ marginTop: 12 }}>
      {rows.map((r) => {
        const ids = [r.base_case_id, ...r.case_ids].filter((x, i, a): x is number => x != null && a.indexOf(x) === i).map(String)
        return (
          <li key={r.comparison_id} className="ds-card ds-card-pad">
            <strong>{r.comparison_name}</strong>
            <span className="ds-mono">{ids.length} cases{r.created_at ? ` · ${safeRunDate(r.created_at)}` : ''}</span>
            <Button size="small" onClick={() => onCompare(ids)}>
              Compare these
            </Button>
          </li>
        )
      })}
    </ul>
  )
}
