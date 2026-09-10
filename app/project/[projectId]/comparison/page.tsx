'use client'

// /project/[id]/comparison — multi-case comparison.
// Mirrors the visual language of /analytics (cards, radar, delta bars,
// component breakdown) but with an explicit case picker so the user chooses
// which scenarios to overlay. Analytics is single-case; this is multi-case.

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { apiRequest } from '@/lib/api-client'
import { transformCaseFromDB } from '@/lib/data-transformers'
import {
  Breadcrumb,
  Icon,
  StatusDot,
  fmtNum,
  fmtInt,
} from '@/components/lcapix'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'

const SERIES_COLORS = ['#2d6a4f', '#74c69d', '#d98568', '#9f88cc', '#4f90c9']

const cycleBtn: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 6,
  border: '1px solid var(--border-subtle)',
  background: 'var(--surface-raised)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 16,
  lineHeight: 1,
  padding: 0,
}

const COMPONENT_COLORS = [
  '#2d6a4f',
  '#52796f',
  '#84a98c',
  '#d98568',
  '#f0a68a',
  '#f5c971',
  '#9f88cc',
  '#4f90c9',
]

interface CaseSummary {
  id: string
  name: string
  type: 'base' | 'comparative'
  description?: string
}

interface AssessmentData {
  caseId: string
  caseName: string
  caseType: string
  description?: string
  categories: { category_name: string; impact_value: number; unit: string }[]
  components: {
    component_name: string
    impacts: { category_name: string; impact_value: number }[]
  }[]
  totalScore: number
}

export default function ComparisonPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = params.projectId as string

  const [projectName, setProjectName] = useState('')
  const [cases, setCases] = useState<CaseSummary[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [data, setData] = useState<AssessmentData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingData, setIsLoadingData] = useState(false)
  // Bumped on window focus so returning from a fresh assessment re-pulls the
  // latest runs instead of showing the numbers from page load.
  const [refreshTick, setRefreshTick] = useState(0)
  useEffect(() => {
    const onFocus = () => setRefreshTick((t) => t + 1)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  // Load project name + cases.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setIsLoading(true)
      try {
        const [pr, cr] = await Promise.all([
          apiRequest(`/api/projects/${projectId}`),
          apiRequest(`/api/projects/${projectId}/cases`),
        ])
        const pd = await pr.json()
        const cd = await cr.json()
        if (cancelled) return
        if (pd.success) setProjectName(pd.project?.project_name ?? '')
        const list: CaseSummary[] = (cd.cases ?? []).map((c: any) => {
          const t = transformCaseFromDB(c)
          return {
            id: t.id,
            name: t.name,
            type: t.type,
            description: (t as any).description ?? '',
          }
        })
        setCases(list)
        // A comparison is always base + exactly one comp. Default: base + the
        // first comp (or whatever the URL says, restricted to base + one comp).
        const base = list.find((c) => c.type === 'base')
        const comps = list.filter((c) => c.type === 'comparative')
        const urlIds = (searchParams.get('cases') ?? '').split(',').filter(Boolean)
        const urlComp = comps.find((c) => urlIds.includes(c.id))
        const initialComp = urlComp ?? comps[0]
        const ids = new Set<string>()
        if (base) ids.add(base.id)
        if (initialComp) ids.add(initialComp.id)
        setSelected(ids)
      } catch {
        // ignore
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId, searchParams])

  // Load assessment data for the selected cases.
  useEffect(() => {
    if (selected.size === 0) {
      setData([])
      return
    }
    let cancelled = false
    setIsLoadingData(true)
    ;(async () => {
      const results: AssessmentData[] = []
      for (const id of selected) {
        const meta = cases.find((c) => c.id === id)
        if (!meta) continue
        try {
          const ar = await apiRequest(`/api/cases/${id}/assessments`)
          const ad = await ar.json()
          const runs = (ad.assessments || []).filter(
            (a: any) => !a.status || a.status === 'completed',
          )
          if (!runs.length) {
            results.push({
              caseId: id,
              caseName: meta.name,
              caseType: meta.type,
              description: meta.description ?? '',
              categories: [],
              components: [],
              totalScore: 0,
            })
            continue
          }
          const latest = runs[0]
          const dr = await apiRequest(`/api/assessments/${latest.run_id}`)
          const dd = await dr.json()
          if (!dd.success) continue
          const categories = (dd.total_impacts || []).map((c: any) => ({
            category_name: c.category_name,
            impact_value: Math.abs(Number(c.impact_value || 0)),
            unit: c.unit,
          }))
          const components = (dd.component_breakdown || []).map((c: any) => ({
            component_name: c.component_name,
            impacts: (c.impacts || []).map((i: any) => ({
              category_name: i.category_name,
              impact_value: Math.abs(Number(i.impact_value || 0)),
            })),
          }))
          const totalScore = categories.reduce(
            (s: number, c: any) => s + c.impact_value,
            0,
          )
          results.push({
            caseId: id,
            caseName: meta.name,
            caseType: meta.type,
            description: meta.description ?? '',
            categories,
            components,
            totalScore,
          })
        } catch {
          // skip
        }
      }
      if (!cancelled) {
        setData(results)
        setIsLoadingData(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selected, cases, refreshTick])

  const baseCaseId = useMemo(
    () => cases.find((c) => c.type === 'base')?.id ?? null,
    [cases],
  )
  const compCases = useMemo(
    () => cases.filter((c) => c.type === 'comparative'),
    [cases],
  )
  // The currently selected COMP case (only one allowed at a time).
  const selectedCompId = useMemo(() => {
    for (const c of compCases) if (selected.has(c.id)) return c.id
    return null
  }, [compCases, selected])
  const compIdx = useMemo(
    () => compCases.findIndex((c) => c.id === selectedCompId),
    [compCases, selectedCompId],
  )

  const setActiveComp = (id: string | null) => {
    setSelected(() => {
      const next = new Set<string>()
      if (baseCaseId) next.add(baseCaseId)
      if (id) next.add(id)
      return next
    })
  }

  const cycleComp = (dir: 1 | -1) => {
    if (compCases.length === 0) return
    const i =
      (compIdx === -1 ? 0 : compIdx + dir + compCases.length) %
      compCases.length
    setActiveComp(compCases[i].id)
  }

  // Ensure the base case is always in the selection set.
  useEffect(() => {
    if (!baseCaseId) return
    setSelected((prev) => {
      if (prev.has(baseCaseId)) return prev
      const next = new Set(prev)
      next.add(baseCaseId)
      return next
    })
  }, [baseCaseId])

  // Update URL when selection changes.
  useEffect(() => {
    if (cases.length === 0) return
    const ids = [...selected].join(',')
    const url = ids
      ? `/project/${projectId}/comparison?cases=${ids}`
      : `/project/${projectId}/comparison`
    window.history.replaceState(null, '', url)
  }, [selected, projectId, cases.length])

  const allCategoryNames = useMemo(
    () =>
      Array.from(
        new Set(
          data.flatMap((d) => d.categories.map((c) => c.category_name)),
        ),
      ),
    [data],
  )
  const topCategoryNames = allCategoryNames.slice(0, 5)
  const barGroups = topCategoryNames.map((name) => ({
    label: name,
    values: data.map((d) => {
      const c = d.categories.find((cc) => cc.category_name === name)
      return c ? c.impact_value : 0
    }),
  }))
  const seriesLabels = data.map((d) => d.caseName)
  const allComponentNames = useMemo(
    () =>
      Array.from(
        new Set(data.flatMap((d) => d.components.map((c) => c.component_name))),
      ),
    [data],
  )

  const baseCase = data.find((d) => d.caseType === 'base') ?? data[0]
  // Headline deltas are computed on ONE category with ONE unit (Global
  // Warming when present) — the old cross-category sum added kg CO2-eq to
  // kg Sb-eq and let GW magnitude fake an "overall" number.
  const headlineValue = (d: AssessmentData): number => {
    const gw = d.categories.find((c) => c.category_name === 'Global Warming')
    return gw ? gw.impact_value : (d.categories[0]?.impact_value ?? 0)
  }
  const verdict = (() => {
    if (!baseCase || data.length < 2 || headlineValue(baseCase) <= 0) return null
    const others = data.filter((d) => d !== baseCase)
    let best = others[0]
    for (const o of others) if (headlineValue(o) < headlineValue(best)) best = o
    return {
      best,
      deltaPct:
        ((headlineValue(baseCase) - headlineValue(best)) / headlineValue(baseCase)) * 100,
    }
  })()

  return (
    <>
      <Breadcrumb
          items={[
            { label: 'Projects', page: 'home' },
            {
              label: projectName || 'Project',
              onClick: () => router.push(`/project/${projectId}`),
            },
            { label: 'Comparison' },
          ]}
        />
        <div
          style={{ padding: '8px 32px 80px', maxWidth: 1280, margin: '0 auto' }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 24,
            }}
          >
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => router.push(`/project/${projectId}`)}
              aria-label="Back to project"
              style={{ padding: '6px 10px' }}
            >
              ←
            </button>
            <div style={{ flex: 1 }}>
              <h1
                className="display-md"
                style={{
                  margin: 0,
                  fontSize: 26,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                }}
              >
                {projectName || 'Comparison'}
              </h1>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-tertiary)',
                  marginTop: 2,
                }}
              >
                Pick the cases you want to compare side-by-side.
              </div>
            </div>
          </div>

          {/* Case picker — base (fixed) vs one selectable comp */}
          <div className="card" style={{ padding: 18, marginBottom: 20 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 4,
              }}
            >
              Compare against baseline
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-tertiary)',
                marginBottom: 14,
              }}
            >
              The base case is always the reference. Cycle through comparative
              cases to switch which alternative is being compared.
            </div>
            {isLoading ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: 'var(--text-tertiary)',
                  fontSize: 13,
                }}
              >
                <Loader2 className="animate-spin" size={14} /> Loading cases…
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                {/* Base pill (pinned) */}
                {baseCaseId &&
                  (() => {
                    const base = cases.find((c) => c.id === baseCaseId)!
                    return (
                      <div
                        title="Base case is always the reference"
                        style={{
                          padding: '10px 16px',
                          borderRadius: 999,
                          border:
                            '1px solid color-mix(in oklab, var(--brand-primary) 60%, transparent)',
                          background:
                            'color-mix(in oklab, var(--brand-primary) 10%, var(--surface-raised))',
                          color: 'var(--text-primary)',
                          fontSize: 13,
                          fontFamily: 'var(--font-ui)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          cursor: 'default',
                        }}
                      >
                        <Icon
                          name="check"
                          size={12}
                          style={{ color: 'var(--brand-primary)' }}
                        />
                        <span style={{ fontWeight: 500 }}>{base.name}</span>
                        <span
                          className="eyebrow"
                          style={{
                            fontSize: 9,
                            color: 'var(--text-tertiary)',
                            letterSpacing: '0.1em',
                          }}
                        >
                          BASE
                        </span>
                        <span style={{ fontSize: 10 }}>🔒</span>
                      </div>
                    )
                  })()}

                <span
                  style={{
                    fontSize: 13,
                    color: 'var(--text-tertiary)',
                    padding: '0 4px',
                  }}
                >
                  vs
                </span>

                {/* COMP toggle */}
                {compCases.length === 0 ? (
                  <span
                    style={{
                      fontSize: 13,
                      color: 'var(--text-tertiary)',
                      fontStyle: 'italic',
                    }}
                  >
                    No comparative cases yet. Add one from the project page.
                  </span>
                ) : (
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px 6px 14px',
                      borderRadius: 999,
                      border:
                        '1px solid color-mix(in oklab, var(--brand-primary) 60%, transparent)',
                      background:
                        'color-mix(in oklab, var(--brand-primary) 10%, var(--surface-raised))',
                      cursor: 'pointer',
                    }}
                  >
                    <select
                      value={selectedCompId ?? compCases[0].id}
                      onChange={(e) => setActiveComp(e.target.value)}
                      style={{
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        fontFamily: 'var(--font-ui)',
                        fontSize: 13,
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        paddingRight: 4,
                        maxWidth: 280,
                      }}
                    >
                      {compCases.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <span
                      className="eyebrow"
                      style={{
                        fontSize: 9,
                        color: 'var(--text-tertiary)',
                        letterSpacing: '0.1em',
                      }}
                    >
                      COMP
                    </span>
                    <span
                      aria-hidden
                      style={{
                        fontSize: 11,
                        color: 'var(--text-tertiary)',
                        marginRight: 4,
                      }}
                    >
                      ▾
                    </span>
                  </label>
                )}
              </div>
            )}
          </div>

          {selected.size === 0 ? (
            <EmptyState
              title="Pick at least one case"
              body="Use the chips above to choose which cases to compare."
            />
          ) : isLoadingData ? (
            <div
              style={{
                padding: 60,
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                fontSize: 13,
              }}
            >
              <Loader2
                className="animate-spin"
                size={18}
                style={{ display: 'inline-block', marginRight: 8 }}
              />
              Loading assessment data…
            </div>
          ) : data.length === 0 ? (
            <EmptyState
              title="No assessment data"
              body="None of the selected cases have a completed assessment."
            />
          ) : (
            <>
              {/* Case summary cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.min(data.length, 3)}, 1fr)`,
                  gap: 16,
                  marginBottom: 20,
                }}
              >
                {data.map((c, i) => {
                  const isBase = c === baseCase
                  const delta =
                    !isBase && baseCase && headlineValue(baseCase) > 0
                      ? ((headlineValue(c) - headlineValue(baseCase)) /
                          headlineValue(baseCase)) *
                        100
                      : null
                  return (
                    <div
                      key={c.caseId}
                      className="card"
                      style={{ padding: 0, overflow: 'hidden' }}
                    >
                      <div
                        style={{
                          padding: '14px 18px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          background: `color-mix(in oklab, ${SERIES_COLORS[i % SERIES_COLORS.length]} 12%, var(--surface-raised))`,
                          borderBottom: '1px solid var(--border-subtle)',
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background:
                              SERIES_COLORS[i % SERIES_COLORS.length],
                          }}
                        />
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {c.caseName}
                        </span>
                        <span
                          className="chip"
                          style={{
                            marginLeft: 'auto',
                            fontSize: 10,
                            padding: '3px 9px',
                          }}
                        >
                          {isBase ? 'BASE' : 'COMP'}
                        </span>
                      </div>
                      <div style={{ padding: '16px 18px 14px' }}>
                        <div
                          className="eyebrow"
                          style={{ fontSize: 10, marginBottom: 4 }}
                        >
                          {/* One category, one unit — same rule as the
                              verdict. The old "TOTAL IMPACT" here rendered
                              totalScore (a cross-unit sum) labeled kg CO2 eq. */}
                          {(
                            c.categories.find((k) => k.category_name === 'Global Warming') ??
                            c.categories[0]
                          )?.category_name?.toUpperCase() || 'TOTAL IMPACT'}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 8,
                            flexWrap: 'wrap',
                          }}
                        >
                          <div
                            className="mono"
                            style={{
                              fontSize: 28,
                              fontWeight: 600,
                              letterSpacing: '-0.02em',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {headlineValue(c) > 0
                              ? fmtNum(headlineValue(c), 2)
                              : '—'}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--text-tertiary)',
                            }}
                          >
                            {(
                              c.categories.find((k) => k.category_name === 'Global Warming') ??
                              c.categories[0]
                            )?.unit || 'kg CO₂-eq'}
                          </div>
                          {delta !== null && (
                            <span
                              className="mono"
                              style={{
                                marginLeft: 'auto',
                                fontSize: 11,
                                fontWeight: 600,
                                padding: '3px 8px',
                                borderRadius: 999,
                                color:
                                  delta < 0
                                    ? 'var(--signal-success, #16a34a)'
                                    : '#b45309',
                                background:
                                  delta < 0
                                    ? 'color-mix(in oklab, var(--signal-success, #16a34a) 14%, transparent)'
                                    : 'color-mix(in oklab, #d98568 18%, transparent)',
                              }}
                            >
                              {delta < 0 ? '↓' : '↑'}{' '}
                              {fmtNum(Math.abs(delta), 1)}%
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            marginTop: 10,
                            fontSize: 11,
                            color: 'var(--text-tertiary)',
                            display: 'flex',
                            gap: 12,
                          }}
                        >
                          <span>
                            <span className="mono">
                              {fmtInt(c.categories.length)}
                            </span>{' '}
                            categories
                          </span>
                          <span>·</span>
                          <span>
                            <span className="mono">
                              {fmtInt(c.components.length)}
                            </span>{' '}
                            components
                          </span>
                          <span
                            style={{
                              marginLeft: 'auto',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <StatusDot
                              status={
                                c.totalScore > 0 ? 'success' : 'warn'
                              }
                            />
                            {c.totalScore > 0
                              ? 'Assessed'
                              : 'Not assessed'}
                          </span>
                        </div>
                        {c.description && (
                          <div
                            style={{
                              marginTop: 10,
                              padding: '8px 10px',
                              borderTop: '1px dashed var(--border-subtle)',
                              paddingTop: 10,
                              fontSize: 11.5,
                              lineHeight: 1.55,
                              color: 'var(--text-tertiary)',
                            }}
                          >
                            {c.description}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {verdict && (
                <div
                  className="card"
                  style={{
                    padding: 18,
                    marginBottom: 20,
                    background:
                      'linear-gradient(135deg, var(--brand-subtle), transparent 70%)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      background: 'var(--brand-primary)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name="target" size={20} />
                  </div>
                  <div style={{ flex: 1, fontSize: 14 }}>
                    Best-case scenario:{' '}
                    <strong style={{ color: 'var(--brand-primary)' }}>
                      {verdict.best.caseName}
                    </strong>{' '}
                    — reduces Global Warming impact by{' '}
                    <span className="mono" style={{ fontWeight: 600 }}>
                      ↓ {fmtNum(verdict.deltaPct, 1)}%
                    </span>{' '}
                    vs {baseCase!.caseName}.
                  </div>
                </div>
              )}

              {/* Radar */}
              {data.length > 0 && barGroups.length > 0 && (
                <RadarPanel groups={barGroups} seriesLabels={seriesLabels} />
              )}

              {/* Delta */}
              {data.length >= 2 && (
                <DeltaPanel groups={barGroups} seriesLabels={seriesLabels} />
              )}

              {/* Component breakdown */}
              {allComponentNames.length > 0 && (
                <ComponentBreakdownPanel
                  data={data}
                  componentNames={allComponentNames}
                />
              )}
            </>
          )}
        </div>
    </>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="card"
      style={{
        padding: 48,
        textAlign: 'center',
        color: 'var(--text-tertiary)',
      }}
    >
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 13 }}>{body}</div>
    </div>
  )
}

interface BarGroup {
  label: string
  values: number[]
}

function RadarPanel({
  groups,
  seriesLabels,
}: {
  groups: BarGroup[]
  seriesLabels: string[]
}) {
  const data = groups.map((g) => {
    const max = Math.max(...g.values, 1e-9)
    const p: Record<string, number | string> = { category: g.label }
    seriesLabels.forEach((n, i) => {
      p[n] = (g.values[i] / max) * 100
      p[`${n}__raw`] = g.values[i]
    })
    return p
  })
  return (
    <div className="card" style={{ padding: 24, marginBottom: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        Impact by category · radar overlay
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-tertiary)',
          marginBottom: 16,
        }}
      >
        Each axis is scaled to the highest-scoring scenario in that category —
        smaller polygon means a better footprint.
      </div>
      <div style={{ width: '100%', height: 340 }}>
        <ResponsiveContainer>
          <RadarChart data={data} outerRadius="78%">
            <PolarGrid stroke="var(--border-subtle)" />
            <PolarAngleAxis
              dataKey="category"
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
            />
            <PolarRadiusAxis
              tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
              tickFormatter={(v) => `${v}%`}
            />
            {seriesLabels.map((n, i) => (
              <Radar
                key={n}
                name={n}
                dataKey={n}
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                fillOpacity={0.22}
                strokeWidth={2}
              />
            ))}
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              iconType="circle"
            />
            <Tooltip
              formatter={(_v: any, name: string, props: any) => [
                fmtNum(props.payload[`${name}__raw`] ?? 0, 3),
                name,
              ]}
              contentStyle={{
                background: '#fff',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function DeltaPanel({
  groups,
  seriesLabels,
}: {
  groups: BarGroup[]
  seriesLabels: string[]
}) {
  const baseIndex = 0
  const others = seriesLabels.slice(1)
  if (others.length === 0) return null
  const data = groups.map((g) => {
    const base = g.values[baseIndex] || 0
    const p: Record<string, number | string> = { category: g.label }
    others.forEach((n, i) => {
      const v = g.values[i + 1] || 0
      p[n] = base > 0 ? ((v - base) / base) * 100 : 0
    })
    return p
  })
  return (
    <div className="card" style={{ padding: 24, marginBottom: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        Change vs baseline · per category
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-tertiary)',
          marginBottom: 16,
        }}
      >
        Green = improvement, amber = regression vs{' '}
        <strong>{seriesLabels[baseIndex]}</strong>.
      </div>
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 24, bottom: 8, left: 24 }}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
              tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="category"
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              axisLine={false}
              tickLine={false}
              width={120}
            />
            <ReferenceLine x={0} stroke="var(--border-subtle)" />
            <Tooltip
              formatter={(v: any) => [
                `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
                '',
              ]}
              contentStyle={{
                background: '#fff',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                fontSize: 12,
              }}
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
              iconType="circle"
            />
            {others.map((n) => (
              <Bar key={n} dataKey={n} radius={[0, 4, 4, 0]}>
                {data.map((e, idx) => (
                  <Cell
                    key={idx}
                    fill={(e[n] as number) <= 0 ? '#2d6a4f' : '#d98568'}
                  />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function ComponentBreakdownPanel({
  data,
  componentNames,
}: {
  data: AssessmentData[]
  componentNames: string[]
}) {
  const rows = data.map((d) => {
    const row: Record<string, number | string> = { scenario: d.caseName }
    componentNames.forEach((n) => {
      const c = d.components.find((cc) => cc.component_name === n)
      const v = c ? c.impacts.reduce((s, i) => s + i.impact_value, 0) : 0
      row[n] = v
    })
    return row
  })
  return (
    <div className="card" style={{ padding: 24, marginBottom: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        Component contribution · per scenario
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-tertiary)',
          marginBottom: 16,
        }}
      >
        Each bar is a scenario; segments show how much each component
        contributes to its total impact.
      </div>
      <div
        style={{
          width: '100%',
          height: Math.max(160, data.length * 70 + 70),
        }}
      >
        <ResponsiveContainer>
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 8, right: 16, bottom: 8, left: 24 }}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="scenario"
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              axisLine={false}
              tickLine={false}
              width={160}
            />
            <Tooltip
              formatter={(v: any, n: string) => [fmtNum(v, 2), n]}
              contentStyle={{
                background: '#fff',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                fontSize: 12,
              }}
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
              iconType="circle"
            />
            {componentNames.map((n, i) => (
              <Bar
                key={n}
                dataKey={n}
                stackId="components"
                fill={COMPONENT_COLORS[i % COMPONENT_COLORS.length]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
