'use client'

// Phase LI.3 — Comparison detail page ported from LCAPIX/pages-misc.jsx
// (ComparePage). Real-data fetching (comparison payload + optional per-case
// component trees) and mutation handlers (delete, export) are PRESERVED from
// the prior Phase 8 implementation. Only the visual layer is swapped to the
// LCAPIX prototype shape: head-to-head cards, verdict, GroupedBarChart, and
// the category diff table.

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, AlertCircle, ArrowLeft, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { apiRequest } from '@/lib/api-client'
import {
  Breadcrumb,
  Icon,
  StatusDot,
  GroupedBarChart,
  fmtNum,
  fmtInt,
} from '@/components/lcapix'

// ============================================================================
// TYPE DEFINITIONS (preserved)
// ============================================================================

interface Component {
  component_id: number
  case_id: number
  parent_component_id: number | null
  component_type: string
  component_name: string
  description: string | null
  quantity: number
  unit: string
}

interface CaseValue {
  case_id: number
  case_name: string
  absolute_value: number
  delta_from_base: number
  delta_percentage: number
  rank: number
}

interface CategoryComparison {
  result_id: number
  category_id: number
  category_name: string
  case_results: CaseValue[]
  best_case_id: number
  worst_case_id: number
}

interface CaseInfo {
  case_id: number
  case_name: string
  case_description?: string
}

interface ComparisonData {
  comparison_id: number
  comparison_name: string
  project_id: number
  project_name: string
  case_ids: number[]
  base_case_id: number
  comparison_type: string
  created_at: string
  created_by_username: string
  cases: CaseInfo[]
  category_comparisons: CategoryComparison[]
  metadata: {
    total_cases_compared: number
    total_categories_analyzed: number
    overall_best_case_id: number
    overall_worst_case_id: number
    calculation_time_ms?: number
  }
}

export default function ComparisonResultsPage() {
  const params = useParams()
  const router = useRouter()
  const comparisonId = params.comparisonId as string
  const projectId = params.projectId as string

  const [comparison, setComparison] = useState<ComparisonData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [projectName, setProjectName] = useState<string>('')
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await apiRequest(`/api/projects/${projectId}`)
        const d = await r.json()
        if (!cancelled && d?.success)
          setProjectName(d.project?.project_name ?? '')
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])
  const [isDeleting, setIsDeleting] = useState(false)
  const [baseCaseComponents, setBaseCaseComponents] = useState<Component[]>([])
  const [comparativeCaseComponents, setComparativeCaseComponents] = useState<
    Component[]
  >([])
  const [loadingComponents, setLoadingComponents] = useState(false)

  useEffect(() => {
    fetchComparison()
  }, [comparisonId])

  const fetchComparison = async () => {
    try {
      setIsLoading(true)
      const response = await apiRequest(`/api/comparisons/${comparisonId}`)

      if (response.success) {
        const comparisonData = response.comparison
        comparisonData.category_comparisons =
          comparisonData.category_comparisons.map((cc: any) => ({
            ...cc,
            case_results:
              typeof cc.case_results === 'string'
                ? JSON.parse(cc.case_results)
                : cc.case_results,
          }))
        setComparison(comparisonData)

        if (comparisonData.cases.length === 2) {
          fetchComponentHierarchies(
            comparisonData.base_case_id,
            comparisonData.case_ids
          )
        }
      } else {
        toast.error('Failed to load comparison')
        router.push(`/project/${projectId}`)
      }
    } catch (error) {
      console.error('Error fetching comparison:', error)
      toast.error('Failed to load comparison')
      router.push(`/project/${projectId}`)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchComponentHierarchies = async (
    baseCaseId: number,
    caseIds: number[]
  ) => {
    try {
      setLoadingComponents(true)

      const baseResponse = await apiRequest(
        `/api/cases/${baseCaseId}/components`
      )
      if (baseResponse.success) {
        setBaseCaseComponents(baseResponse.components || [])
      }

      const comparativeCaseId = caseIds.find((id) => id !== baseCaseId)
      if (comparativeCaseId) {
        const compResponse = await apiRequest(
          `/api/cases/${comparativeCaseId}/components`
        )
        if (compResponse.success) {
          setComparativeCaseComponents(compResponse.components || [])
        }
      }
    } catch (error) {
      console.error('Error fetching component hierarchies:', error)
      toast.error('Failed to load component trees')
    } finally {
      setLoadingComponents(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this comparison?')) return

    try {
      setIsDeleting(true)
      const response = await apiRequest(`/api/comparisons/${comparisonId}`, {
        method: 'DELETE',
      })

      if (response.success) {
        toast.success('Comparison deleted')
        router.push(`/project/${projectId}`)
      } else {
        toast.error(response.error || 'Failed to delete comparison')
      }
    } catch (error) {
      console.error('Error deleting comparison:', error)
      toast.error('Failed to delete comparison')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleExportPDF = () => {
    window.print()
  }

  const handleExportCSV = () => {
    if (!comparison) return
    const rows: string[][] = []
    rows.push(['Category', ...comparison.cases.map((c) => c.case_name), 'Best'])
    comparison.category_comparisons.forEach((cc) => {
      const best = comparison.cases.find((c) => c.case_id === cc.best_case_id)
      rows.push([
        cc.category_name,
        ...comparison.cases.map((c) => {
          const cv = cc.case_results.find((cr) => cr.case_id === c.case_id)
          return cv ? String(cv.absolute_value) : ''
        }),
        best?.case_name ?? '',
      ])
    })
    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `comparison-${comparisonId}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  // ——— Loading / empty states ———

  if (isLoading) {
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
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '120px 24px',
            gap: 16,
          }}
        >
          <Loader2
            className="h-8 w-8 animate-spin"
            style={{ color: 'var(--brand-primary)' }}
          />
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
            Loading comparison…
          </p>
        </div>
      </>
    )
  }

  if (!comparison) {
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
          style={{
            padding: '80px 32px',
            maxWidth: 560,
            margin: '0 auto',
            textAlign: 'center',
          }}
        >
          <AlertCircle
            className="h-10 w-10"
            style={{ color: 'var(--text-tertiary)', margin: '0 auto 16px' }}
          />
          <h2
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 8,
            }}
          >
            Comparison not found
          </h2>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => router.push(`/project/${projectId}`)}
          >
            Back to project
          </button>
        </div>
      </>
    )
  }

  // ——— Derivations ———

  const baseCase = comparison.cases.find(
    (c) => c.case_id === comparison.base_case_id
  )

  // Per-case totals summed across categories (abs).
  const caseTotals = new Map<number, number>()
  comparison.cases.forEach((ci) => {
    const total = comparison.category_comparisons.reduce((sum, cat) => {
      const cv = cat.case_results.find((cr) => cr.case_id === ci.case_id)
      return sum + Math.abs(cv?.absolute_value || 0)
    }, 0)
    caseTotals.set(ci.case_id, total)
  })

  const baseCaseTotal = baseCase ? caseTotals.get(baseCase.case_id) || 0 : 0

  // Grouped bar chart: up to 5 categories × all cases.
  const topCats = comparison.category_comparisons.slice(0, 5)
  const barGroups = topCats.map((cc) => ({
    label: cc.category_name,
    values: comparison.cases.map((ci) => {
      const cv = cc.case_results.find((cr) => cr.case_id === ci.case_id)
      return cv ? Math.abs(cv.absolute_value) : 0
    }),
  }))
  const barSeriesLabels = comparison.cases.map((c) => c.case_name)

  // Best-scenario verdict.
  const bestVerdict = (() => {
    if (!baseCase || comparison.cases.length < 2) return null
    const others = comparison.cases.filter((c) => c.case_id !== baseCase.case_id)
    let best = others[0]
    let bestTotal = caseTotals.get(best.case_id) || 0
    for (const o of others) {
      const t = caseTotals.get(o.case_id) || 0
      if (t < bestTotal) {
        best = o
        bestTotal = t
      }
    }
    if (baseCaseTotal <= 0) return null
    const deltaPct = ((baseCaseTotal - bestTotal) / baseCaseTotal) * 100
    const winCount = comparison.category_comparisons.filter(
      (cc) => cc.best_case_id === best.case_id
    ).length
    return {
      best,
      deltaPct,
      winCount,
      totalCats: comparison.category_comparisons.length,
    }
  })()

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Projects', page: 'home' },
          {
            label: comparison.project_name,
            onClick: () => router.push(`/project/${projectId}`),
          },
          { label: comparison.comparison_name },
        ]}
      />

      <div
        style={{
          padding: '24px 32px 80px',
          maxWidth: 1440,
          margin: '0 auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 24,
            gap: 12,
          }}
        >
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => router.push(`/project/${projectId}`)}
            aria-label="Back to project"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <div style={{ flex: 1 }}>
            <h1
              className="display"
              style={{
                fontSize: 26,
                fontWeight: 600,
                margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              {comparison.comparison_name}
            </h1>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-tertiary)',
                marginTop: 4,
              }}
            >
              Comparing {comparison.cases.length} cases ·{' '}
              {new Date(comparison.created_at).toLocaleDateString()} ·{' '}
              {comparison.created_by_username}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleExportPDF}>
            <Icon name="download" size={14} /> PDF Export
          </button>
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: 8 }}
            onClick={handleExportCSV}
          >
            <Icon name="share" size={14} /> Export CSV
          </button>
          <button
            className="btn btn-secondary btn-sm"
            style={{
              marginLeft: 8,
              color: 'var(--signal-error)',
              borderColor: 'var(--signal-error)',
            }}
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>

        {/* Head-to-head cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${comparison.cases.length}, 1fr)`,
            gap: 16,
            marginBottom: 20,
          }}
        >
          {comparison.cases.map((ci, i) => {
            const isBase = ci.case_id === comparison.base_case_id
            const total = caseTotals.get(ci.case_id) || 0
            const delta =
              !isBase && baseCaseTotal > 0
                ? ((total - baseCaseTotal) / baseCaseTotal) * 100
                : null
            const wins = comparison.category_comparisons.filter(
              (cc) => cc.best_case_id === ci.case_id
            ).length
            return (
              <div
                key={ci.case_id}
                className="card"
                style={{
                  padding: 24,
                  borderLeft: `3px solid var(--chart-${(i % 5) + 1})`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: `var(--chart-${(i % 5) + 1})`,
                    }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {ci.case_name}
                  </span>
                  <span
                    className="chip"
                    style={{ fontSize: 10, marginLeft: 'auto' }}
                  >
                    {isBase ? 'BASE' : 'COMP'}
                  </span>
                </div>
                <div className="eyebrow" style={{ marginBottom: 6 }}>
                  TOTAL IMPACT
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 34,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {total > 0 ? fmtNum(total, 2) : '—'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  aggregate across {comparison.category_comparisons.length}{' '}
                  categories
                </div>
                {!isBase && delta !== null && (
                  <div
                    style={{
                      marginTop: 10,
                      display: 'flex',
                      gap: 10,
                      fontSize: 12,
                    }}
                  >
                    <span
                      className="mono"
                      style={{
                        color:
                          delta < 0
                            ? 'var(--signal-success)'
                            : 'var(--signal-error)',
                        fontWeight: 500,
                      }}
                    >
                      {delta < 0 ? '↓' : '↑'} {fmtNum(Math.abs(delta), 1)}%
                    </span>
                    <span
                      className="mono"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      vs. {baseCase?.case_name}
                    </span>
                  </div>
                )}
                <div
                  style={{
                    marginTop: 16,
                    paddingTop: 16,
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    rowGap: 6,
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Category wins
                  </span>
                  <span
                    className="mono"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {fmtInt(wins)} / {fmtInt(comparison.category_comparisons.length)}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>Rank</span>
                  <span
                    className="mono"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    #
                    {[...caseTotals.entries()]
                      .sort((a, b) => a[1] - b[1])
                      .findIndex(([id]) => id === ci.case_id) + 1}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>Status</span>
                  <span>
                    <StatusDot status="success" />
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Verdict */}
        {bestVerdict && (
          <div
            className="card"
            style={{
              padding: 24,
              marginBottom: 20,
              background:
                'linear-gradient(135deg, var(--brand-subtle), transparent 70%)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: 'var(--brand-primary)',
                  color: 'oklch(0.15 0.01 240)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="target" size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  Your best-case scenario is{' '}
                  <span style={{ color: 'var(--brand-primary)' }}>
                    {bestVerdict.best.case_name}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    marginTop: 2,
                  }}
                >
                  Reduces total impact by{' '}
                  <span
                    className="mono"
                    style={{
                      color:
                        bestVerdict.deltaPct > 0
                          ? 'var(--signal-success)'
                          : 'var(--signal-error)',
                    }}
                  >
                    {bestVerdict.deltaPct > 0 ? '↓' : '↑'}{' '}
                    {fmtNum(Math.abs(bestVerdict.deltaPct), 1)}%
                  </span>{' '}
                  vs.{' '}
                  <span
                    style={{ color: 'var(--text-primary)', fontWeight: 500 }}
                  >
                    {baseCase?.case_name}
                  </span>
                  . Wins{' '}
                  <span className="mono">
                    {fmtInt(bestVerdict.winCount)} / {fmtInt(bestVerdict.totalCats)}
                  </span>{' '}
                  categories.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Grouped bar chart */}
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>
            Impact by category · across scenarios
          </div>
          <GroupedBarChart groups={barGroups} seriesLabels={barSeriesLabels} />
        </div>

        {/* Category diff table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Category-level difference
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `2fr repeat(${comparison.cases.length}, 1fr) 1fr`,
              padding: '10px 20px',
              background: 'var(--surface-overlay)',
              fontSize: 10,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontWeight: 600,
            }}
          >
            <div>Category</div>
            {comparison.cases.map((ci) => (
              <div key={ci.case_id} style={{ textAlign: 'right' }}>
                {ci.case_id === comparison.base_case_id ? '★ ' : ''}
                {ci.case_name.split(' ')[0]}
              </div>
            ))}
            <div style={{ textAlign: 'right' }}>Best</div>
          </div>
          {comparison.category_comparisons.map((cc) => {
            const bestCaseObj = comparison.cases.find(
              (c) => c.case_id === cc.best_case_id
            )
            return (
              <div
                key={cc.result_id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: `2fr repeat(${comparison.cases.length}, 1fr) 1fr`,
                  padding: '12px 20px',
                  borderTop: '1px solid var(--border-subtle)',
                  fontSize: 13,
                }}
              >
                <div style={{ color: 'var(--text-primary)' }}>
                  {cc.category_name}
                </div>
                {comparison.cases.map((ci) => {
                  const cv = cc.case_results.find(
                    (cr) => cr.case_id === ci.case_id
                  )
                  const isBase = ci.case_id === comparison.base_case_id
                  const isBest = ci.case_id === cc.best_case_id
                  const val = cv ? Math.abs(cv.absolute_value) : 0
                  const deltaPct = cv?.delta_percentage
                  return (
                    <div
                      key={ci.case_id}
                      className="mono"
                      style={{
                        textAlign: 'right',
                        color: isBest
                          ? 'var(--signal-success)'
                          : 'var(--text-secondary)',
                      }}
                    >
                      {val > 0 ? fmtNum(val, 2) : '—'}
                      {!isBase && deltaPct !== undefined && deltaPct !== 0 && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 11,
                            color:
                              deltaPct < 0
                                ? 'var(--signal-success)'
                                : 'var(--signal-error)',
                          }}
                        >
                          {deltaPct < 0 ? '↓' : '↑'}
                          {fmtNum(Math.abs(deltaPct), 0)}%
                        </span>
                      )}
                    </div>
                  )
                })}
                <div
                  style={{
                    textAlign: 'right',
                    fontSize: 11,
                    color: 'var(--brand-primary)',
                  }}
                >
                  {bestCaseObj?.case_name.split(' ')[0] ?? '—'}
                </div>
              </div>
            )
          })}
        </div>

        {/* Metadata footer */}
        <div
          style={{
            marginTop: 20,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
          }}
        >
          {[
            {
              label: 'Cases Compared',
              value: fmtInt(comparison.metadata.total_cases_compared),
            },
            {
              label: 'Categories',
              value: fmtInt(comparison.metadata.total_categories_analyzed),
            },
            {
              label: 'Base Components',
              value: fmtInt(baseCaseComponents.length),
            },
            {
              label: 'Calc Time',
              value:
                fmtInt(comparison.metadata.calculation_time_ms || 0) + ' ms',
            },
          ].map((k) => (
            <div
              key={k.label}
              className="card"
              style={{ padding: 16, textAlign: 'center' }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                {k.value}
              </div>
              <div
                className="eyebrow"
                style={{ marginTop: 4, fontSize: 10 }}
              >
                {k.label}
              </div>
            </div>
          ))}
        </div>

        {loadingComponents && (
          <div
            style={{
              marginTop: 16,
              fontSize: 12,
              color: 'var(--text-tertiary)',
              textAlign: 'center',
            }}
          >
            Loading component trees…
          </div>
        )}
        {!loadingComponents && comparativeCaseComponents.length > 0 && (
          <div
            style={{
              marginTop: 16,
              fontSize: 12,
              color: 'var(--text-tertiary)',
              textAlign: 'center',
            }}
          >
            {fmtInt(baseCaseComponents.length)} base ·{' '}
            {fmtInt(comparativeCaseComponents.length)} comparative components
            loaded
          </div>
        )}
      </div>
    </>
  )
}
