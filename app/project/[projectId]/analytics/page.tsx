'use client'

// Phase LI.2 — Analytics page ported from LCAPIX/pages-misc.jsx (ComparePage).
// Real-data fetching (cases → assessments → run details → categories/components)
// is PRESERVED verbatim from the prior Phase 8 Veridian implementation. Only
// the visual layer is swapped for the LCAPIX prototype shape: head-to-head
// case cards, verdict card, GroupedBarChart, and component-diff table.

import * as React from 'react'
import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { apiRequest } from '@/lib/api-client'
import { transformCaseFromDB } from '@/lib/data-transformers'
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react'

import {
  Breadcrumb,
  Icon,
  StatusDot,
  MiniBar,
  GroupedBarChart,
  fmtNum,
  fmtInt,
} from '@/components/lcapix'
import { DEMO_CATEGORIES, DEMO_CONTRIBUTORS } from '@/lib/lcapix-demo'

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

      let casesToFetch = transformedCases
      if (filterCaseId) {
        casesToFetch = transformedCases.filter((c: any) => c.id === filterCaseId)
        if (casesToFetch.length === 0) {
          setErrorMessage(`Case not found (ID: ${filterCaseId})`)
          setIsLoading(false)
          return
        }
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
          return {
            caseId: caseItem.id,
            caseName: caseItem.name,
            caseType: caseItem.case_type,
            categories,
            components,
            totalScore,
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

  // If we have no real data, show DEMO_CATEGORIES as a visual placeholder.
  const hasRealData = assessmentData.length > 0
  const barGroups = hasRealData
    ? topCategoryNames.map((catName) => ({
        label: catName,
        values: assessmentData.map((d) => {
          const c = d.categories.find((cc) => cc.category_name === catName)
          return c ? c.impact_value : 0
        }),
      }))
    : DEMO_CATEGORIES.slice(0, 5).map((c, i) => ({
        label: c.name,
        // Demo values scale like the prototype factors (1, 0.72, 0.62).
        values: [1, 0.72, 0.62].map((f) => c.value * f),
      }))

  const barSeriesLabels = hasRealData
    ? assessmentData.map((d) => d.caseName)
    : ['Baseline', 'Scenario A', 'Scenario B']

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
                : 'No assessments yet · showing demo scaffolding'}
            </div>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExportPDF}
          >
            <Icon name="download" size={14} /> PDF Export
          </button>
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: 8 }}
            onClick={handleExportCSV}
          >
            <Icon name="share" size={14} /> Share
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
                        {c.caseName}
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
                      {c.totalScore > 0 ? fmtNum(c.totalScore, 2) : '—'}
                    </div>
                    <div
                      style={{ fontSize: 12, color: 'var(--text-tertiary)' }}
                    >
                      {c.categories[0]?.unit || 'kg CO₂-eq'}
                    </div>
                    {!isBase && (
                      <div
                        style={{
                          marginTop: 10,
                          display: 'flex',
                          gap: 10,
                          fontSize: 12,
                        }}
                      >
                        {delta !== null ? (
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
                            {delta < 0 ? '↓' : '↑'}{' '}
                            {fmtNum(Math.abs(delta), 1)}%
                          </span>
                        ) : (
                          <span
                            className="mono"
                            style={{ color: 'var(--text-tertiary)' }}
                          >
                            —
                          </span>
                        )}
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
                        Categories
                      </span>
                      <span
                        className="mono"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {fmtInt(c.categories.length)}
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        Components
                      </span>
                      <span
                        className="mono"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {fmtInt(c.components.length)}
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        Status
                      </span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <StatusDot status="success" />
                      </span>
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

            {/* Grouped bar chart */}
            <div
              className="card"
              style={{ padding: 24, marginBottom: 20 }}
            >
              <div
                style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}
              >
                Impact by category · across scenarios
                {!hasRealData && (
                  <span
                    className="chip"
                    style={{ marginLeft: 8, fontSize: 10 }}
                  >
                    DEMO
                  </span>
                )}
              </div>
              <GroupedBarChart
                groups={barGroups}
                seriesLabels={barSeriesLabels}
              />
            </div>

            {/* Component diff table */}
            {allComponentNames.length > 0 && (
              <div
                className="card"
                style={{ padding: 0, overflow: 'hidden' }}
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
