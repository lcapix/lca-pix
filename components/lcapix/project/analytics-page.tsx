'use client'

// Analytics (E10): how far a class got, read from each case (ran, wrote up,
// ticked as hand-in); where the latest results landed, one dot per run on one
// axis with the base case marked (or as a table); the flows most often left
// with no amount; and what each count means. No scores and no grades.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { EmptyState, ErrorCard } from '@/components/lcapix/ds'
import { apiRequest } from '@/lib/api-client'
import { LMS_NAME } from '@/lib/ui-flags'
import { useShellData } from '@/lib/shell/use-shell'
import { useProjectCases } from '@/lib/project/use-project-cases'
import { perNoun } from '@/lib/compare/compare-view'
import { caseTotal, co2Unit, fixed } from '@/lib/ui/format'
import {
  axisTicks,
  classCounts,
  emptyRows,
  labelled,
  labelRows,
  landed,
  landedLine,
  studentCases,
  tickDecimals,
  type Dot,
} from '@/lib/project/analytics-view'

export function AnalyticsPage() {
  const params = useParams()
  const projectId = Number(params.projectId)
  const { profile } = useShellData()
  const me = profile?.id ?? -1
  const word = profile?.useCase === 'teaching' ? 'student' : 'member'
  const { data, error, reload } = useProjectCases(projectId)
  const [empty, setEmpty] = useState<Array<{ substance: string; direction: string; step: string; case_ids: number[] }> | null>(null)
  const [asTable, setAsTable] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const r = await apiRequest(`/api/projects/${projectId}/empty-flows`)
      const d = r.ok ? await r.json().catch(() => null) : null
      if (!cancelled) setEmpty(d?.flows ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])

  const view = useMemo(() => {
    if (!data) return null
    const staff = new Set([data.project.owner_id, ...data.members.filter((m) => m.permission_name === 'admin').map((m) => m.user_id)])
    const students = studentCases(data.cases, staff)
    const base = data.cases.find((c) => c.case_type === 'base' && c.created_by != null && staff.has(c.created_by)) ?? data.cases.find((c) => c.case_type === 'base')
    const scope = { method: base?.latest_run?.method ?? data.project.lcia_method, region: base?.latest_run?.region ?? data.project.region_code }
    return { students, counts: classCounts(students), base, scope, ...landed(students, scope) }
  }, [data])

  if (error) {
    return (
      <div className="np">
        <ErrorCard title="Analytics did not load" cause={error} onRetry={reload} />
      </div>
    )
  }
  if (!data || !view) {
    return (
      <div className="np" role="status" style={{ color: 'var(--ds-text-2)' }}>
        Loading the class…
      </div>
    )
  }

  const isStaff = data.project.owner_id === me || data.project.my_role === 'admin'
  const scopeText = [data.project.lcia_method, data.project.region_code].filter(Boolean).join(' · ')
  const { counts, dots, base, otherScope } = view
  const ofN = counts.cases
  const baseValue = base?.latest_run?.headline?.value ?? null
  const unitRaw = base?.latest_run?.headline?.unit ?? (dots[0] ? view.students.find((c) => c.case_id === dots[0].case_id)?.latest_run?.headline?.unit : null)
  const unit = co2Unit(unitRaw ?? 'kg CO2 eq')
  const ranIds = new Set(view.students.filter((c) => c.latest_run != null).map((c) => c.case_id))
  const gaps = empty ? emptyRows(empty, ranIds) : null

  return (
    <div className="np pc">
      <header className="pc-head">
        <div style={{ flex: 1, minWidth: 260 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ds-text-2)' }}>{data.project.project_name}</p>
          <h1 className="ds-title" style={{ margin: '2px 0 0', display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
            Analytics{' '}
            <span style={{ fontSize: 15, fontWeight: 400, color: 'var(--ds-text-2)' }}>
              {[`${ofN} ${word} ${ofN === 1 ? 'case' : 'cases'}`, scopeText].filter(Boolean).join(' · ')}
            </span>
          </h1>
        </div>
      </header>

      {!isStaff ? (
        <EmptyState line="Analytics is for the project's owner and the people who can share it." />
      ) : ofN === 0 ? (
        <EmptyState
          line={`No ${word} cases yet. When the people you add make their copy, how far each got shows here.`}
          action={
            <Link className="ds-btn" href={`/project/${projectId}/people`}>
              See People
            </Link>
          }
        />
      ) : (
        <>
          <section className="pp-card an-card" aria-labelledby="an-far-h">
            <div className="an-head">
              <h2 id="an-far-h" className="pp-card-h" style={{ fontSize: 20 }}>
                How far the class got
              </h2>
              <span>
                Out of {ofN} {word} {ofN === 1 ? 'case' : 'cases'}. Read from each case, not a separate tracker.
              </span>
            </div>
            <div className="an-tiles">
              <Tile label={`${word[0].toUpperCase()}${word.slice(1)} cases`} n={ofN} of={null} />
              <Tile label="Ran" n={counts.ran} of={ofN} />
              <Tile label="Wrote up" n={counts.wrote} of={ofN} />
              <Tile label="Ticked as hand-in" n={counts.ticked} of={ofN} />
            </div>
          </section>

          <section className="pp-card an-card" aria-labelledby="an-land-h">
            <div className="an-head">
              <h2 id="an-land-h" className="pp-card-h" style={{ fontSize: 20 }}>
                Where the results landed
              </h2>
              <span>
                {dots.length} {dots.length === 1 ? 'run' : 'runs'}, one dot each. Global warming, {unit} per {perNoun(data.project.functional_unit)}.
              </span>
            </div>
            {dots.length ? (
              asTable ? (
                <LandedTable dots={dots} unit={unit} />
              ) : (
                <DotPlot dots={dots} base={baseValue} unit={unit} />
              )
            ) : (
              <p className="np-sub" style={{ margin: '12px 0 0' }}>
                No {word} case has a run yet.
              </p>
            )}
            <div className="an-foot">
              <span style={{ flex: 1 }}>
                {landedLine(dots, baseValue)}
                {otherScope ? ` ${otherScope} ${otherScope === 1 ? 'run' : 'runs'} under another method or region ${otherScope === 1 ? 'is' : 'are'} left off.` : ''}
              </span>
              {dots.length > 0 && (
                <button type="button" className="ds-link" style={{ fontWeight: 600 }} aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
                  {asTable ? 'Show as dots' : 'Show as a table'}
                </button>
              )}
            </div>
          </section>

          <div className="an-grid">
            <section className="pp-card" style={{ padding: 0 }} aria-labelledby="an-empty-h">
              <div className="an-head" style={{ padding: '22px 26px 12px' }}>
                <h2 id="an-empty-h" className="pp-card-h" style={{ fontSize: 20 }}>
                  Flows most often left empty
                </h2>
                <span>
                  Marked “Needs an amount” in the {counts.ran} run {counts.ran === 1 ? 'case' : 'cases'}
                </span>
              </div>
              {gaps === null ? (
                <p role="status" className="np-sub" style={{ padding: '0 26px 22px', margin: 0 }}>
                  Counting…
                </p>
              ) : gaps.length === 0 ? (
                <p className="np-sub" style={{ padding: '0 26px 22px', margin: 0 }}>
                  {counts.ran ? 'Every flow in the run cases has an amount.' : 'Nothing to count until a case runs.'}
                </p>
              ) : (
                <table className="ds-table an-table">
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">Flow</th>
                      <th scope="col" style={{ textAlign: 'right' }}>
                        Cases
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {gaps.map((g, i) => (
                      <tr key={`${g.substance}-${g.step}-${g.direction}`}>
                        <td className="ds-mono" style={{ color: 'var(--ds-text-2)', width: 44 }}>
                          {i + 1}
                        </td>
                        <td>
                          <span style={{ fontSize: 16 }}>{g.substance}</span>
                          {g.direction === 'output' && <span className="an-out">out</span>}
                          <span style={{ marginLeft: 12, color: 'var(--ds-text-2)' }}>at {g.step}</span>
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <strong className="ds-mono" style={{ fontSize: 16 }}>
                            {g.cases}
                          </strong>
                          <span className="ds-mono" style={{ color: 'var(--ds-text-2)' }}>
                            {' '}
                            of {counts.ran}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="pp-card" aria-labelledby="an-means-h">
              <h2 id="an-means-h" className="pp-card-h" style={{ fontSize: 20 }}>
                What each count means
              </h2>
              <dl className="an-means">
                <dt>Ran</dt>
                <dd>The case has at least one completed run.</dd>
                <dt>Wrote up</dt>
                <dd>The interpretation is written.</dd>
                <dt>Ticked as hand-in</dt>
                <dd>“This is my hand-in” is ticked.</dd>
                <dt>Left empty</dt>
                <dd>No amount, so the run leaves it out.</dd>
              </dl>
              {counts.notRun > 0 && (
                <div className="an-callout">
                  <p style={{ margin: 0 }}>
                    {counts.notRun} {word} {counts.notRun === 1 ? 'case has' : 'cases have'} no run yet. They show as Not run yet on the Cases board.
                  </p>
                  <Link className="ds-btn" href={`/project/${projectId}/cases`} style={{ marginTop: 12 }}>
                    Open Cases
                  </Link>
                </div>
              )}
            </section>
          </div>

          <p className="an-note">
            <span aria-hidden>ⓘ</span> No scores and no grades.{LMS_NAME ? ` Grades stay in ${LMS_NAME}.` : ''}
          </p>
        </>
      )}
    </div>
  )
}

function Tile({ label, n, of }: { label: string; n: number; of: number | null }) {
  const pct = of ? Math.round((n / of) * 100) : 100
  return (
    <div className="an-tile">
      <span className="an-tile-label">{label}</span>
      <span className="an-tile-n">
        <span className="ds-mono">{n}</span>
        {of !== null && <span className="ds-mono an-of"> of {of}</span>}
      </span>
      <span className="an-bar" data-total={of === null || undefined} aria-hidden>
        <span style={{ width: `${pct}%` }} />
      </span>
    </div>
  )
}

const W = 1000
const PAD = 44
const AXIS_Y = 196
const DOT_R = 8
const BASE_BOX = 150

/** One dot per run on one axis; equal totals (at three decimals) stack. Names on the ticked hand-ins. */
function DotPlot({ dots, base, unit }: { dots: Dot[]; base: number | null; unit: string }) {
  const values = base == null ? dots.map((d) => d.value) : [...dots.map((d) => d.value), base]
  const { min, max, step, ticks } = axisTicks(values)
  const x = (v: number) => PAD + ((v - min) / (max - min || 1)) * (W - 2 * PAD)
  const dec = tickDecimals(step)
  const named = labelled(dots)
  const stackOf = new Map<number, number>()
  const seen = new Map<string, number>()
  for (const d of dots) {
    const k = fixed(d.value, 3)
    const n = seen.get(k) ?? 0
    stackOf.set(d.case_id, n)
    seen.set(k, n + 1)
  }
  const labels = dots
    .filter((d) => named.has(d.case_id))
    .map((d) => ({ id: d.case_id, x: x(d.value), width: (d.who.length + fixed(d.value, 3).length + 1) * 9 + 8 }))
  const rows = labelRows(labels, 3)
  const rowY = (r: number) => 26 + r * 34
  const baseBoxX = base == null ? 0 : x(base) + 8 + BASE_BOX > W ? x(base) - 8 - BASE_BOX : x(base) + 8
  const summary = `${dots.length} runs on one axis from ${fixed(min, dec)} to ${fixed(max, dec)} ${unit}${base != null ? `; the base case at ${caseTotal(base, 'base')}` : ''}.`

  return (
    <svg className="an-plot" viewBox={`0 0 ${W} 236`} role="img" aria-label={summary}>
      <line x1={PAD - 10} x2={W - PAD + 10} y1={AXIS_Y + DOT_R + 4} y2={AXIS_Y + DOT_R + 4} className="an-axis" />
      {ticks.map((t) => (
        <text key={t} x={x(t)} y={AXIS_Y + 40} textAnchor="middle" className="an-tick">
          {fixed(t, dec)}
        </text>
      ))}
      {base != null && (
        <g>
          <line x1={x(base)} x2={x(base)} y1={rowY(3) - 16} y2={AXIS_Y + DOT_R + 4} className="an-base-line" />
          {/* Its own row under the names; to the left of its line near the right edge. */}
          <rect x={baseBoxX} y={rowY(3) - 16} width={BASE_BOX} height={26} rx={6} className="an-base-box" />
          <text x={baseBoxX + 10} y={rowY(3) + 2} className="an-base-text">
            Base case <tspan className="an-mono">{caseTotal(base, 'base')}</tspan>
          </text>
        </g>
      )}
      {dots.map((d) => {
        const cx = x(d.value)
        const cy = AXIS_Y - (stackOf.get(d.case_id) ?? 0) * (DOT_R * 2 + 3)
        const row = rows.get(d.case_id)
        return (
          <g key={d.case_id}>
            {row !== undefined && (
              <>
                <line x1={cx} x2={cx} y1={rowY(row) + 8} y2={cy - DOT_R - 2} className="an-stem" />
                <text x={cx} y={rowY(row)} textAnchor="middle" className="an-label">
                  {d.who} <tspan className="an-mono">{fixed(d.value, 3)}</tspan>
                </text>
              </>
            )}
            <circle cx={cx} cy={cy} r={DOT_R} className={d.ticked ? 'an-dot an-dot--ticked' : 'an-dot'}>
              <title>{`${d.who} · ${d.case_name} · ${fixed(d.value, 3)} ${unit}${d.ticked ? ' · ticked as hand-in' : ''}`}</title>
            </circle>
          </g>
        )
      })}
    </svg>
  )
}

function LandedTable({ dots, unit }: { dots: Dot[]; unit: string }) {
  return (
    <div className="pp-wrap" style={{ marginTop: 12 }} tabIndex={0} role="region" aria-label="Results table">
      <table className="ds-table an-table">
        <thead>
          <tr>
            <th scope="col">Who</th>
            <th scope="col">Case</th>
            <th scope="col" aria-sort="ascending" style={{ textAlign: 'right' }}>
              Total ({unit}) ↑
            </th>
            <th scope="col">Hand-in</th>
          </tr>
        </thead>
        <tbody>
          {dots.map((d) => (
            <tr key={d.case_id}>
              <td>{d.who}</td>
              <td>{d.case_name}</td>
              <td className="ds-mono" style={{ textAlign: 'right' }}>
                {fixed(d.value, 3)}
              </td>
              <td>{d.ticked ? '✓ Ticked' : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
