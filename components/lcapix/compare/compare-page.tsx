'use client'

// Compare (E09, E09b): the base case against its copies. Four checks decide
// whether the numbers may be read side by side (same method, region and
// functional unit; every run current). When they pass: the totals, change by
// step, and what changed in the copy. When one fails: the totals greyed,
// change by step held back with the reason, and the run that fixes it, under
// the base case's method and region. The fuller views (every category,
// hotspots, cost, data quality) sit behind "More ways to compare".

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { Button, ComingSoon, ErrorCard, SourceTag, Tabs } from '@/components/lcapix/ds'
import { useShellData } from '@/lib/shell/use-shell'
import { useCompare } from '@/lib/compare/use-compare'
import { comparability, COMPARE_MAX_CASES } from '@/lib/compare/comparability'
import {
  cellValue,
  changeCell,
  changeSummary,
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
import { caseTotal, amountBox, co2Unit, fixed } from '@/lib/ui/format'
import { sourceKindOf } from '@/lib/workspace/inventory'
import type { CompareCase } from './types'
// The fuller views load only when "More ways to compare" opens: they carry the chart code.
const ResultsPanel = dynamic(() => import('./results-panel').then((m) => m.ResultsPanel))
const HotspotPanel = dynamic(() => import('./hotspot-panel').then((m) => m.HotspotPanel))
const CostPanel = dynamic(() => import('./cost-panel').then((m) => m.CostPanel))
const QualityPanel = dynamic(() => import('./quality-panel').then((m) => m.QualityPanel))

const CLIMATE = 'Global Warming'
type More = 'results' | 'hotspots' | 'cost' | 'quality'

export function ComparePage() {
  const params = useParams()
  const projectId = Number(params.projectId)
  const { profile } = useShellData()
  const { cases, byId, selected, toggle, data, error, loading, runAgain, reload } = useCompare(projectId, profile?.id ?? -1)
  const [category, setCategory] = useState(CLIMATE)
  const [vs, setVs] = useState<string | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [more, setMore] = useState<More | null>(null)

  // Base first, then the copies in the order they were added.
  const compared: CompareCase[] = useMemo(() => {
    const all = data?.cases ?? []
    const base = all.find((c) => c.caseId === data?.baseCaseId)
    return base ? [base, ...all.filter((c) => c !== base)] : all
  }, [data])
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
  const changed = other && fair ? whatChanged(diff, other, category, unit) : null
  const summary = changeSummary(rows, unit)
  const failedAction = checks.checks.map((k) => checkAction(k, nameOf, baseScope)).find(Boolean) ?? null

  const run = async (caseId: string) => {
    setRunning(caseId)
    setRunError(null)
    try {
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

      <div className="cmp-bar">
        {compared.map((c, i) => (
          <span key={c.caseId} className="cmp-chip">
            <span className="cmp-letter" data-l={LETTERS[i]} aria-hidden>
              {LETTERS[i]}
            </span>
            <span>{c.name}</span>
            <span className="ds-mono cmp-chip-run">
              {!c.run ? 'not run' : c.status === 'stale' || c.run.stale ? 'run out of date' : `#${c.run.runId}`}
            </span>
          </span>
        ))}
        <AddCaseMenu cases={cases} selected={selected} baseId={base?.caseId ?? null} onToggle={toggle} />
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

      {data && compared.length < 2 && (
        <div className="pp-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <strong style={{ display: 'block', fontSize: 18 }}>Add a second case to compare</strong>
          <p className="np-sub" style={{ margin: '6px 0 14px' }}>
            Make a copy of the base case, change one input, run it, then add it here.
          </p>
          <AddCaseMenu cases={cases} selected={selected} baseId={base?.caseId ?? null} onToggle={toggle} primary />
        </div>
      )}

      {data && compared.length >= 2 && (
        <>
          <section className="cmp-checks" data-ok={v.ok || undefined} aria-label="Whether these cases compare fairly">
            <div className="cmp-verdict">
              <strong>{v.title}</strong>
              <span>{v.sub}</span>
            </div>
            {checks.checks.map((k) => {
              const act = checkAction(k, nameOf, baseScope)
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

          <section className="cmp-totals" aria-label="Totals">
            <div className="cmp-totals-grid" style={{ gridTemplateColumns: `repeat(${Math.min(compared.length, 4)}, minmax(0, 1fr))` }}>
              {compared.map((c, i) => {
                const t = c.totals.find((x) => x.category === category)
                const stale = c.status === 'stale' || !!c.run?.stale
                const baseT = base.totals.find((x) => x.category === category)
                const chip = i > 0 && fair && t && baseT ? totalChip(t.value, baseT.value) : null
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
                        <span className="cmp-total-num ds-mono">{caseTotal(t.value, i === 0 ? 'base' : 'comparative')}</span>
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
                : 'Not comparable yet. The totals are greyed until every check passes.'}
            </p>
          </section>

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
                            {fixed(changed.factor.value, 3)} {changed.factor.unit}
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
            </section>
          )}

          <section className="cmp-more" aria-label="More ways to compare">
            <button type="button" className="pc-more" aria-expanded={!!more} onClick={() => setMore((m) => (m ? null : 'results'))}>
              {more ? 'Hide the other views' : 'More ways to compare: every category, hotspots, cost, data quality'}
            </button>
            {more && (
              <div style={{ marginTop: 12 }}>
                <Tabs<More>
                  label="More ways to compare"
                  selected={more}
                  onSelect={setMore}
                  tabs={[
                    { id: 'results', label: 'Every category' },
                    { id: 'hotspots', label: 'Hotspots' },
                    { id: 'cost', label: 'Cost' },
                    { id: 'quality', label: 'Data quality' },
                  ]}
                />
                <div className="pp-card" style={{ marginTop: 12 }}>
                  {!fair && more !== 'quality' ? (
                    <p style={{ margin: 0, fontSize: 15, color: 'var(--ds-text-2)' }}>This view shows once every check passes.</p>
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
            )}
          </section>
        </>
      )}

      <div style={{ marginTop: 18 }}>
        <ComingSoon>Pin as a finding, compare across projects</ComingSoon>
      </div>
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
