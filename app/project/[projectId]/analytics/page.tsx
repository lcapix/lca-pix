'use client'

// Phase LI.2 — Analytics page ported from LCAPIX/pages-misc.jsx (ComparePage).
// Real-data fetching (cases → assessments → run details → categories/components)
// is PRESERVED verbatim from the prior Phase 8 Veridian implementation. Only
// the visual layer is swapped for the LCAPIX prototype shape: head-to-head
// case cards, verdict card, GroupedBarChart, and component-diff table.

import * as React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { apiRequest } from '@/lib/api-client'
import { transformCaseFromDB } from '@/lib/data-transformers'
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react'
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

import {
  Breadcrumb,
  Icon,
  StatusDot,
  MiniBar,
  GroupedBarChart,
  fmtNum,
  fmtInt,
} from '@/components/lcapix'

const SERIES_COLORS = ['#2d6a4f', '#74c69d', '#d98568', '#9f88cc', '#4f90c9']
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

interface CostBreakdown {
  /** Sum of all per-component costs (labor+energy+material+transport, or opex+capex). */
  total: number
  labor: number
  energy: number
  material: number
  transport: number
  equipment: number
  overhead: number
  opex: number
  capex: number
  currency: string
}

interface AssessmentData {
  caseId: string
  caseName: string
  caseType: string
  categories: {
    category_name: string
    impact_value: number
    unit: string
  }[]
  components: {
    component_name: string
    component_type: string
    impacts: {
      category_name: string
      impact_value: number
    }[]
  }[]
  totalScore: number
  costs: CostBreakdown
}

const EMPTY_COSTS: CostBreakdown = {
  total: 0,
  labor: 0,
  energy: 0,
  material: 0,
  transport: 0,
  equipment: 0,
  overhead: 0,
  opex: 0,
  capex: 0,
  currency: 'USD',
}

const COST_COLORS: Record<string, string> = {
  Labor: '#2d6a4f',
  Energy: '#d98568',
  Material: '#4f90c9',
  Transport: '#9f88cc',
  Equipment: '#c9a44f',
  Overhead: '#8a8f98',
}

function fmtMoney(v: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: v >= 1000 ? 0 : 2,
    }).format(v)
  } catch {
    return `$${v.toLocaleString()}`
  }
}

export default function AnalyticsPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = params.projectId as string
  const filterCaseId = searchParams.get('caseId')

  const [assessmentData, setAssessmentData] = useState<AssessmentData[]>([])
  const [cases, setCases] = useState<any[]>([])
  const [projectName, setProjectName] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [authError, setAuthError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    fetchCasesAndAssessments()
    // Fetch project name for breadcrumb (best effort, non-blocking).
    ;(async () => {
      try {
        const r = await apiRequest(`/api/projects/${projectId}`)
        const d = await r.json()
        if (d.success && d.project) setProjectName(d.project.project_name || '')
      } catch {}
    })()
  }, [projectId])

  const fetchCasesAndAssessments = async () => {
    setIsLoading(true)
    setAuthError(false)
    setErrorMessage('')

    try {
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
      if (!token) {
        setAuthError(true)
        setErrorMessage('No authentication token found. Please log in.')
        setIsLoading(false)
        return
      }

      const casesResponse = await apiRequest(`/api/projects/${projectId}/cases`)
      const casesData = await casesResponse.json()

      if (!casesData.success || !casesData.cases?.length) {
        setErrorMessage('No cases found in project')
        setIsLoading(false)
        return
      }

      const transformedCases = casesData.cases.map(transformCaseFromDB)

      // Analytics is single-case. If ?caseId= is passed, use that; otherwise
      // pick the base case (or the first case) and ignore everything else.
      // Use the dedicated /comparison page when you want multi-case overlays.
      let casesToFetch: any[]
      if (filterCaseId) {
        casesToFetch = transformedCases.filter(
          (c: any) => c.id === filterCaseId,
        )
        if (casesToFetch.length === 0) {
          setErrorMessage(`Case not found (ID: ${filterCaseId})`)
          setIsLoading(false)
          return
        }
      } else {
        const base =
          transformedCases.find((c: any) => c.type === 'base') ??
          transformedCases[0]
        casesToFetch = [base]
      }

      setCases(casesToFetch)

      const dataPromises = casesToFetch.map(async (caseItem: any) => {
        try {
          const assessmentsRes = await apiRequest(
            `/api/cases/${caseItem.id}/assessments`
          )
          const assessmentsData = await assessmentsRes.json()
          if (!assessmentsData.success || !assessmentsData.assessments?.length)
            return null

          const completedAssessments = assessmentsData.assessments.filter(
            (a: any) =>
              a.status === 'completed' ||
              a.status === undefined ||
              a.status === null
          )
          if (!completedAssessments.length) return null

          const latestRun = completedAssessments[0]
          const detailRes = await apiRequest(`/api/assessments/${latestRun.run_id}`)
          const detailData = await detailRes.json()
          if (!detailData.success) return null

          const categories = (detailData.total_impacts || []).map((cat: any) => ({
            category_name: cat.category_name,
            impact_value: parseFloat(
              Math.abs(cat.impact_value || 0).toString()
            ),
            unit: cat.unit,
          }))
          const components = (detailData.component_breakdown || []).map(
            (comp: any) => ({
              component_name: comp.component_name,
              component_type: comp.component_type,
              impacts: comp.impacts.map((imp: any) => ({
                category_name: imp.category_name,
                impact_value: parseFloat(
                  Math.abs(imp.impact_value || 0).toString()
                ),
              })),
            })
          )
          const totalScore = categories.reduce(
            (sum: number, cat: any) => sum + cat.impact_value,
            0
          )

          // Cost analysis — aggregate per-component costs for this case. LCAPIX's
          // whole point is cost ↔ impact together, so analytics must show cost
          // too, not just impact-by-category. Best-effort: an empty/failed fetch
          // just yields zeroed costs rather than breaking the page.
          const costs: CostBreakdown = { ...EMPTY_COSTS }
          try {
            const compRes = await apiRequest(`/api/cases/${caseItem.id}/components`)
            const compData = await compRes.json()
            const rows: any[] = compData?.components ?? compData?.data ?? []
            for (const r of rows) {
              const labor = Number(r.labor_cost ?? r.laborCost ?? 0) || 0
              const energy = Number(r.energy_cost ?? r.energyCost ?? 0) || 0
              const material = Number(r.material_cost ?? r.materialCost ?? 0) || 0
              const transport =
                Number(r.transportation_cost ?? r.transportationCost ?? 0) || 0
              const equipment = Number(r.equipment_cost ?? r.equipmentCost ?? 0) || 0
              const overhead = Number(r.overhead_cost ?? r.overheadCost ?? 0) || 0
              const opex = Number(r.opex ?? r.operationalCostUSD ?? 0) || 0
              const capex = Number(r.capex ?? r.capitalCostUSD ?? 0) || 0
              costs.labor += labor
              costs.energy += energy
              costs.material += material
              costs.transport += transport
              costs.equipment += equipment
              costs.overhead += overhead
              costs.opex += opex
              costs.capex += capex
              if (r.currency) costs.currency = r.currency
            }
            // Prefer the detailed ABC breakdown total; fall back to opex+capex.
            const abcTotal =
              costs.labor + costs.energy + costs.material + costs.transport +
              costs.equipment + costs.overhead
            costs.total = abcTotal > 0 ? abcTotal : costs.opex + costs.capex
          } catch {
            /* non-fatal — cost panel shows an empty state */
          }

          return {
            caseId: caseItem.id,
            caseName: caseItem.name,
            caseType: caseItem.case_type,
            categories,
            components,
            totalScore,
            costs,
          } as AssessmentData
        } catch {
          return null
        }
      })

      const results = await Promise.all(dataPromises)
      const validResults = results.filter(Boolean) as AssessmentData[]

      if (!validResults.length) {
        setErrorMessage(
          `Found ${transformedCases.length} case(s), but no completed assessments.`
        )
      }
      setAssessmentData(validResults)
    } catch (error) {
      if (error instanceof Error) {
        const msg = error.message.toLowerCase()
        if (msg.includes('unauthorized') || msg.includes('401')) {
          setAuthError(true)
          setErrorMessage('Your session has expired. Please log in again.')
        } else {
          setErrorMessage(`Error loading data: ${error.message}`)
        }
      } else {
        setErrorMessage('An unexpected error occurred.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportPDF = () => {
    window.print()
  }

  const handleExportCSV = () => {
    const csvRows: string[][] = []
    csvRows.push(['Case Name', 'Case Type', 'Category', 'Impact Value', 'Unit'])
    assessmentData.forEach((data) => {
      data.categories.forEach((cat) => {
        csvRows.push([
          data.caseName,
          data.caseType,
          cat.category_name,
          cat.impact_value.toFixed(4),
          cat.unit,
        ])
      })
    })
    const csvContent = csvRows.map((row) => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lca-assessment-analysis-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  // ——— Derivations ———

  // Baseline: prefer case_type==='base', else first.
  const baseCase =
    assessmentData.find((d) => d.caseType === 'base') ?? assessmentData[0]

  // Category union (for diff table / grouped bar).
  const allCategoryNames = Array.from(
    new Set(assessmentData.flatMap((d) => d.categories.map((c) => c.category_name)))
  )

  // Top-5 categories for the grouped bar chart.
  const topCategoryNames = allCategoryNames.slice(0, 5)

  // Bug fix: do NOT fall back to DEMO_CATEGORIES + fake "Baseline / Scenario
  // A / Scenario B" series. A brand-new analytics tab with no assessments
  // was rendering a fully-populated comparison chart with prototype numbers.
  // Empty arrays now drive a real empty state in the render below.
  const hasRealData = assessmentData.length > 0
  const barGroups = hasRealData
    ? topCategoryNames.map((catName) => ({
        label: catName,
        values: assessmentData.map((d) => {
          const c = d.categories.find((cc) => cc.category_name === catName)
          return c ? c.impact_value : 0
        }),
      }))
    : []

  const barSeriesLabels = hasRealData
    ? assessmentData.map((d) => d.caseName)
    : []

  // Component diff: union of component names across cases.
  const allComponentNames = Array.from(
    new Set(
      assessmentData.flatMap((d) => d.components.map((c) => c.component_name))
    )
  )

  // Verdict — best non-baseline case (largest negative delta = most reduction).
  const bestComparison = (() => {
    if (!baseCase || assessmentData.length < 2) return null
    const others = assessmentData.filter((d) => d !== baseCase)
    let best = others[0]
    for (const o of others) {
      if (o.totalScore < best.totalScore) best = o
    }
    if (baseCase.totalScore <= 0) return null
    const deltaPct =
      ((baseCase.totalScore - best.totalScore) / baseCase.totalScore) * 100
    return { best, deltaPct }
  })()

  // ——— Render ———

  if (isLoading) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: 'Projects', page: 'home' },
            { label: projectName || 'Project', onClick: () => router.push(`/project/${projectId}`) },
            { label: 'Analytics' },
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
            Loading analytics…
          </p>
        </div>
      </>
    )
  }

  if (authError) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: 'Projects', page: 'home' },
            { label: projectName || 'Project', onClick: () => router.push(`/project/${projectId}`) },
            { label: 'Analytics' },
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
            style={{ color: 'var(--signal-error)', margin: '0 auto 16px' }}
          />
          <h2
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 8,
            }}
          >
            Authentication required
          </h2>
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-tertiary)',
              marginBottom: 20,
            }}
          >
            {errorMessage}
          </p>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => router.push('/auth/login')}
          >
            Log in again
          </button>
        </div>
      </>
    )
  }

  const hasNoData = !isLoading && assessmentData.length === 0

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Projects', page: 'home' },
          {
            label: projectName || 'Project',
            onClick: () => router.push(`/project/${projectId}`),
          },
          { label: 'Analytics' },
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
              {projectName || 'Project Analytics'}
            </h1>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-tertiary)',
                marginTop: 4,
              }}
            >
              {hasRealData
                ? `Comparing ${assessmentData.length} case${assessmentData.length === 1 ? '' : 's'} · completed assessments`
                : 'No assessments yet · run one to populate analytics'}
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExportPDF}
          >
            <Icon name="download" size={14} /> PDF Export
          </button>
        </div>

        {hasNoData ? (
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
                fontSize: 14,
                color: 'var(--text-primary)',
                marginBottom: 8,
              }}
            >
              No assessment data
            </div>
            <div style={{ fontSize: 13 }}>
              {errorMessage ||
                'Run an assessment on any case to populate analytics.'}
            </div>
            <div style={{ marginTop: 16 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => fetchCasesAndAssessments()}
              >
                Try again
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Head-to-head case cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.max(1, assessmentData.length)}, 1fr)`,
                gap: 16,
                marginBottom: 20,
              }}
            >
              {assessmentData.map((c, i) => {
                const isBase = c === baseCase
                const hasBase = !!baseCase && baseCase.totalScore > 0
                const delta =
                  !isBase && hasBase
                    ? ((c.totalScore - baseCase!.totalScore) /
                        baseCase!.totalScore) *
                      100
                    : null
                return (
                  <div
                    key={c.caseId}
                    className="card"
                    style={{ padding: 0, overflow: 'hidden' }}
                  >
                    {/* Header band with accent colour */}
                    <div
                      style={{
                        padding: '14px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        background: `color-mix(in oklab, var(--chart-${(i % 5) + 1}) 12%, var(--surface-raised))`,
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: `var(--chart-${(i % 5) + 1})`,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {c.caseName}
                      </span>
                      <span
                        className="chip"
                        style={{
                          fontSize: 10,
                          marginLeft: 'auto',
                          padding: '3px 9px',
                        }}
                      >
                        {isBase ? 'BASE' : 'COMP'}
                      </span>
                    </div>

                    {/* Hero number */}
                    <div style={{ padding: '20px 20px 16px' }}>
                      <div
                        className="eyebrow"
                        style={{ marginBottom: 6, fontSize: 10 }}
                      >
                        TOTAL IMPACT
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
                            fontSize: 36,
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            letterSpacing: '-0.02em',
                            lineHeight: 1,
                          }}
                        >
                          {c.totalScore > 0 ? fmtNum(c.totalScore, 2) : '—'}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--text-tertiary)',
                          }}
                        >
                          {c.categories[0]?.unit || 'kg CO₂-eq'}
                        </div>
                        {!isBase && delta !== null && (
                          <span
                            className="mono"
                            style={{
                              marginLeft: 'auto',
                              fontSize: 12,
                              fontWeight: 600,
                              padding: '4px 10px',
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

                      {/* Total cost line — cost sits alongside impact, the core
                          LCAPIX cost↔impact pairing. */}
                      {c.costs.total > 0 && (
                        <div
                          style={{
                            marginTop: 12,
                            paddingTop: 12,
                            borderTop: '1px dashed var(--border-subtle)',
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 8,
                          }}
                        >
                          <span className="eyebrow" style={{ fontSize: 10 }}>
                            TOTAL COST
                          </span>
                          <span
                            className="mono"
                            style={{
                              fontSize: 18,
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              marginLeft: 'auto',
                            }}
                          >
                            {fmtMoney(c.costs.total, c.costs.currency)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Stat tiles row */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        borderTop: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div
                        style={{
                          padding: '12px 16px',
                          borderRight: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div
                          className="eyebrow"
                          style={{ fontSize: 9, marginBottom: 4 }}
                        >
                          CATEGORIES
                        </div>
                        <div
                          className="mono"
                          style={{
                            fontSize: 18,
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {fmtInt(c.categories.length)}
                        </div>
                      </div>
                      <div
                        style={{
                          padding: '12px 16px',
                          borderRight: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div
                          className="eyebrow"
                          style={{ fontSize: 9, marginBottom: 4 }}
                        >
                          COMPONENTS
                        </div>
                        <div
                          className="mono"
                          style={{
                            fontSize: 18,
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {fmtInt(c.components.length)}
                        </div>
                      </div>
                      <div style={{ padding: '12px 16px' }}>
                        <div
                          className="eyebrow"
                          style={{ fontSize: 9, marginBottom: 4 }}
                        >
                          STATUS
                        </div>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 13,
                            color: 'var(--text-primary)',
                          }}
                        >
                          <StatusDot status="success" /> Assessed
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Verdict */}
            {bestComparison && (
              <div
                className="card"
                style={{
                  padding: 24,
                  marginBottom: 20,
                  background:
                    'linear-gradient(135deg, var(--brand-subtle), transparent 70%)',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                >
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
                        {bestComparison.best.caseName}
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
                            bestComparison.deltaPct > 0
                              ? 'var(--signal-success)'
                              : 'var(--signal-error)',
                        }}
                      >
                        {bestComparison.deltaPct > 0 ? '↓' : '↑'}{' '}
                        {fmtNum(Math.abs(bestComparison.deltaPct), 1)}%
                      </span>{' '}
                      vs.{' '}
                      <span
                        style={{
                          color: 'var(--text-primary)',
                          fontWeight: 500,
                        }}
                      >
                        {baseCase?.caseName}
                      </span>
                      .
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Category visualizations: radar + normalized comparison */}
            <CategoryComparisonPanel
              groups={barGroups}
              seriesLabels={barSeriesLabels}
              demo={!hasRealData}
            />

            {/* Cost analysis — cost breakdown + cost-vs-impact. Cost must appear
                in analytics, not just on the summary. */}
            {hasRealData && (
              <CostAnalysisPanel assessmentData={assessmentData} />
            )}

            {/* Delta vs baseline */}
            {hasRealData && assessmentData.length >= 2 && (
              <DeltaChartPanel
                groups={barGroups}
                seriesLabels={barSeriesLabels}
              />
            )}

            {/* Component contribution — stacked horizontal bar per scenario */}
            {allComponentNames.length > 0 && (
              <ComponentBreakdownPanel
                assessmentData={assessmentData}
                allComponentNames={allComponentNames}
              />
            )}

            {/* Component diff table */}
            {allComponentNames.length > 0 && (
              <div
                className="card"
                style={{ padding: 0, overflow: 'hidden', marginTop: 20 }}
              >
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border-subtle)',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  Component-level difference
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `2fr repeat(${assessmentData.length}, 1fr)`,
                    padding: '10px 20px',
                    background: 'var(--surface-overlay)',
                    fontSize: 10,
                    color: 'var(--text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    fontWeight: 600,
                  }}
                >
                  <div>Component</div>
                  {assessmentData.map((d) => (
                    <div key={d.caseId} style={{ textAlign: 'right' }}>
                      {d.caseName.split(' ')[0]}
                    </div>
                  ))}
                </div>
                {allComponentNames.map((name) => {
                  const baseComp = baseCase?.components.find(
                    (c) => c.component_name === name
                  )
                  const baseVal = baseComp
                    ? baseComp.impacts.reduce(
                        (s, i) => s + i.impact_value,
                        0
                      )
                    : 0
                  return (
                    <div
                      key={name}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `2fr repeat(${assessmentData.length}, 1fr)`,
                        padding: '12px 20px',
                        borderTop: '1px solid var(--border-subtle)',
                        fontSize: 13,
                      }}
                    >
                      <div style={{ color: 'var(--text-primary)' }}>
                        {name}
                      </div>
                      {assessmentData.map((d) => {
                        const comp = d.components.find(
                          (c) => c.component_name === name
                        )
                        const val = comp
                          ? comp.impacts.reduce(
                              (s, i) => s + i.impact_value,
                              0
                            )
                          : 0
                        const isBase = d === baseCase
                        const delta =
                          !isBase && baseVal > 0
                            ? ((val - baseVal) / baseVal) * 100
                            : null
                        return (
                          <div
                            key={d.caseId}
                            className="mono"
                            style={{
                              textAlign: 'right',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {val > 0 ? fmtNum(val, 1) : '—'}
                            {delta !== null && val > 0 && (
                              <span
                                style={{
                                  marginLeft: 6,
                                  fontSize: 11,
                                  color:
                                    delta < 0
                                      ? 'var(--signal-success)'
                                      : 'var(--signal-error)',
                                }}
                              >
                                {delta < 0 ? '↓' : '↑'}
                                {fmtNum(Math.abs(delta), 0)}%
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Category visualisations — radar + normalised view + magnitude toggle
// ─────────────────────────────────────────────────────────────────────────────

interface BarGroup {
  label: string
  values: number[]
}

function CategoryComparisonPanel({
  groups,
  seriesLabels,
  demo,
}: {
  groups: BarGroup[]
  seriesLabels: string[]
  demo?: boolean
}) {
  const singleScenario = seriesLabels.length < 2
  const [view, setView] = useState<'radar' | 'normalized' | 'log' | 'absolute'>(
    singleScenario ? 'absolute' : 'radar',
  )

  const absoluteData = useMemo(() => {
    return groups.map((g) => {
      const point: Record<string, number | string> = { category: g.label }
      seriesLabels.forEach((name, i) => {
        point[name] = g.values[i]
        point[`${name}__raw`] = g.values[i]
      })
      return point
    })
  }, [groups, seriesLabels])

  const radarData = useMemo(() => {
    // For radar, normalise each category to its max across scenarios so the
    // shape reads at a glance (otherwise one giant category dwarfs the rest).
    return groups.map((g) => {
      const max = Math.max(...g.values, 1e-9)
      const point: Record<string, number | string> = { category: g.label }
      seriesLabels.forEach((name, i) => {
        point[name] = (g.values[i] / max) * 100
        point[`${name}__raw`] = g.values[i]
      })
      return point
    })
  }, [groups, seriesLabels])

  const normalizedData = useMemo(() => {
    return groups.map((g) => {
      const max = Math.max(...g.values, 1e-9)
      const point: Record<string, number | string> = { category: g.label }
      seriesLabels.forEach((name, i) => {
        point[name] = (g.values[i] / max) * 100
        point[`${name}__raw`] = g.values[i]
      })
      return point
    })
  }, [groups, seriesLabels])

  const logData = useMemo(() => {
    return groups.map((g) => {
      const point: Record<string, number | string> = { category: g.label }
      seriesLabels.forEach((name, i) => {
        const v = g.values[i]
        point[name] = v > 0 ? Math.log10(v + 1) : 0
        point[`${name}__raw`] = v
      })
      return point
    })
  }, [groups, seriesLabels])

  // No real data → render a proper empty state instead of an empty chart
  // shell. Prevents the "demo bars looked real" failure mode.
  if (groups.length === 0) {
    return (
      <div className="card" style={{ padding: 32, marginBottom: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          Impact by category · across scenarios
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
          Run an assessment on at least one case to populate this chart.
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 24, marginBottom: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 20,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          Impact by category · across scenarios
          {demo && (
            <span className="chip" style={{ marginLeft: 8, fontSize: 10 }}>
              DEMO
            </span>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            display: 'inline-flex',
            background: 'var(--surface-overlay)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: 3,
            gap: 2,
          }}
        >
          {(
            [
              { id: 'absolute', label: 'Absolute' },
              { id: 'radar', label: 'Radar' },
              { id: 'log', label: 'Log scale' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setView(opt.id)}
              style={{
                padding: '5px 12px',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
                fontSize: 12,
                fontWeight: view === opt.id ? 600 : 450,
                background:
                  view === opt.id ? 'var(--surface-raised)' : 'transparent',
                color:
                  view === opt.id
                    ? 'var(--text-primary)'
                    : 'var(--text-tertiary)',
                boxShadow:
                  view === opt.id
                    ? '0 1px 2px rgba(15,23,42,0.06)'
                    : 'none',
                transition: 'all 160ms ease',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', height: 340 }}>
        <ResponsiveContainer width="100%" height="100%">
          {view === 'radar' ? (
            <RadarChart data={radarData} outerRadius="78%">
              <PolarGrid stroke="var(--border-subtle)" />
              <PolarAngleAxis
                dataKey="category"
                tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              />
              <PolarRadiusAxis
                tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                tickFormatter={(v) => `${v}%`}
              />
              {seriesLabels.map((name, i) => (
                <Radar
                  key={name}
                  name={name}
                  dataKey={name}
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
                formatter={(_v: any, name: string, props: any) =>
                  [
                    fmtNum(props.payload[`${name}__raw`] ?? 0, 3),
                    name,
                  ] as any
                }
                contentStyle={{
                  background: '#fff',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </RadarChart>
          ) : (
            <BarChart
              data={
                view === 'log'
                  ? logData
                  : view === 'normalized'
                    ? normalizedData
                    : absoluteData
              }
              margin={{ top: 24, right: 16, bottom: 8, left: -8 }}
            >
              <XAxis
                dataKey="category"
                tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                axisLine={false}
                tickLine={false}
                scale={view === 'log' ? 'linear' : 'auto'}
                tickFormatter={(v) =>
                  view === 'normalized'
                    ? `${v}%`
                    : view === 'log'
                      ? `10^${v.toFixed(1)}`
                      : fmtNum(v, 2)
                }
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
                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
                iconType="circle"
              />
              {seriesLabels.map((name, i) => (
                <Bar
                  key={name}
                  dataKey={name}
                  fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                  label={
                    view === 'absolute'
                      ? {
                          position: 'top',
                          fontSize: 10,
                          fill: 'var(--text-secondary)',
                          formatter: (v: number) =>
                            v === 0 ? '' : v < 0.01 ? v.toExponential(1) : fmtNum(v, 2),
                        }
                      : undefined
                  }
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-tertiary)',
          marginTop: 8,
        }}
      >
        {view === 'absolute' &&
          'Raw impact values per category. A single huge bar means that category dominates — switch to Log scale or Normalised to see smaller ones.'}
        {view === 'radar' &&
          'Each axis is normalised to the highest scenario in that category — bigger polygon = larger overall footprint.'}
        {view === 'normalized' &&
          'Each category is scaled 0–100% of its own maximum so small-magnitude categories stay visible.'}
        {view === 'log' &&
          'Values shown on a log scale (log₁₀ of value + 1) so categories spanning orders of magnitude all fit.'}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Cost analysis — cost breakdown by category + cost-vs-impact pairing
// ─────────────────────────────────────────────────────────────────────────────

function CostAnalysisPanel({
  assessmentData,
}: {
  assessmentData: AssessmentData[]
}) {
  const currency = assessmentData[0]?.costs.currency || 'USD'
  const hasAnyCost = assessmentData.some((d) => d.costs.total > 0)

  // Stacked cost-breakdown bar — one bar per scenario, segmented by cost type.
  const breakdownData = useMemo(
    () =>
      assessmentData.map((d) => ({
        scenario: d.caseName,
        Labor: d.costs.labor,
        Energy: d.costs.energy,
        Material: d.costs.material,
        Transport: d.costs.transport,
        Equipment: d.costs.equipment,
        Overhead: d.costs.overhead,
      })),
    [assessmentData],
  )

  // Cost-vs-impact — pairs each scenario's total cost with its total impact so
  // the user can see the trade-off LCAPIX exists to surface.
  const costVsImpact = useMemo(
    () =>
      assessmentData.map((d) => ({
        scenario: d.caseName,
        cost: d.costs.total,
        impact: d.totalScore,
        // $ per unit of environmental load — lower is more cost-efficient.
        intensity: d.totalScore > 0 ? d.costs.total / d.totalScore : 0,
      })),
    [assessmentData],
  )

  if (!hasAnyCost) {
    return (
      <div className="card" style={{ padding: 32, marginBottom: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          Cost analysis
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
          No costs entered yet. Add labor / energy / material / transport costs on
          components (or use Suggest in the inspector) to populate cost analysis.
        </div>
      </div>
    )
  }

  const COST_TYPES = ['Labor', 'Energy', 'Material', 'Transport', 'Equipment', 'Overhead'] as const

  return (
    <div className="card" style={{ padding: 24, marginBottom: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        Cost analysis · per scenario
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-tertiary)',
          marginBottom: 16,
        }}
      >
        Activity-based cost broken down by type, paired with environmental impact
        so you can weigh the cost ↔ impact trade-off.
      </div>

      {/* Stacked cost breakdown */}
      <div style={{ width: '100%', height: Math.max(160, assessmentData.length * 64 + 60) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={breakdownData}
            layout="vertical"
            margin={{ top: 8, right: 16, bottom: 8, left: 24 }}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => fmtMoney(v, currency)}
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
              formatter={(v: any, name: string) => [fmtMoney(Number(v), currency), name]}
              contentStyle={{
                background: '#fff',
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                fontSize: 12,
              }}
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="circle" />
            {COST_TYPES.map((name) => (
              <Bar
                key={name}
                dataKey={name}
                stackId="cost"
                fill={COST_COLORS[name]}
                radius={[0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Cost-vs-impact table */}
      <div
        style={{
          marginTop: 20,
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1.2fr',
            padding: '10px 16px',
            background: 'var(--surface-overlay)',
            fontSize: 10,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: 600,
          }}
        >
          <div>Scenario</div>
          <div style={{ textAlign: 'right' }}>Total cost</div>
          <div style={{ textAlign: 'right' }}>Total impact</div>
          <div style={{ textAlign: 'right' }}>Cost / impact</div>
        </div>
        {costVsImpact.map((r) => (
          <div
            key={r.scenario}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1.2fr',
              padding: '12px 16px',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: 13,
            }}
          >
            <div style={{ color: 'var(--text-primary)' }}>{r.scenario}</div>
            <div className="mono" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
              {r.cost > 0 ? fmtMoney(r.cost, currency) : '—'}
            </div>
            <div className="mono" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
              {r.impact > 0 ? fmtNum(r.impact, 2) : '—'}
            </div>
            <div
              className="mono"
              style={{ textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600 }}
              title="Cost per unit of total environmental impact — lower is more cost-efficient"
            >
              {r.intensity > 0 ? fmtMoney(r.intensity, currency) : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Delta chart — diverging bars showing % difference vs baseline per category
// ─────────────────────────────────────────────────────────────────────────────

function DeltaChartPanel({
  groups,
  seriesLabels,
}: {
  groups: BarGroup[]
  seriesLabels: string[]
}) {
  const baseIndex = 0
  const others = seriesLabels.slice(1)

  const data = useMemo(() => {
    return groups.map((g) => {
      const base = g.values[baseIndex] || 0
      const point: Record<string, number | string> = { category: g.label }
      others.forEach((name, i) => {
        const v = g.values[i + 1] || 0
        point[name] = base > 0 ? ((v - base) / base) * 100 : 0
      })
      return point
    })
  }, [groups, others])

  if (others.length === 0) return null

  return (
    <div className="card" style={{ padding: 24, marginBottom: 20 }}>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
        Change vs baseline · per category
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-tertiary)',
          marginBottom: 16,
        }}
      >
        Green = improvement, red = regression vs{' '}
        <strong>{seriesLabels[baseIndex]}</strong>.
      </div>
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
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
              formatter={(v: any) => [`${v > 0 ? '+' : ''}${v.toFixed(1)}%`, '']}
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
            {others.map((name, i) => (
              <Bar key={name} dataKey={name} radius={[0, 4, 4, 0]}>
                {data.map((entry, idx) => {
                  const v = entry[name] as number
                  return (
                    <Cell
                      key={idx}
                      fill={v <= 0 ? '#2d6a4f' : '#d98568'}
                    />
                  )
                })}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component breakdown — one stacked horizontal bar per scenario
// ─────────────────────────────────────────────────────────────────────────────

function ComponentBreakdownPanel({
  assessmentData,
  allComponentNames,
}: {
  assessmentData: AssessmentData[]
  allComponentNames: string[]
}) {
  const data = useMemo(() => {
    return assessmentData.map((d) => {
      const point: Record<string, number | string> = { scenario: d.caseName }
      allComponentNames.forEach((name) => {
        const c = d.components.find((cc) => cc.component_name === name)
        const v = c ? c.impacts.reduce((s, i) => s + i.impact_value, 0) : 0
        point[name] = v
      })
      return point
    })
  }, [assessmentData, allComponentNames])

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
          height: Math.max(140, assessmentData.length * 70 + 60),
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
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
              formatter={(v: any, name: string) => [fmtNum(v, 2), name]}
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
            {allComponentNames.map((name, i) => (
              <Bar
                key={name}
                dataKey={name}
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
