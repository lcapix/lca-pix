'use client'

// Phase LG.2 — Results page ported from LCAPIX/pages-misc.jsx (ResultsPage).
// Business logic (case fetch, assessments fetch, Run Assessment modal,
// category selection, assessment-result building) is PRESERVED from the
// prior Phase 6 implementation. The visual layer mirrors the LCAPIX
// prototype: KPI strip, impact-overview card with chips + big number,
// CategoryBarChart + top-contributors, flow table with direction filter,
// and historical-runs timeline.

import { useParams, useRouter } from 'next/navigation'
import { useMemo, useState, useEffect } from 'react'
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { apiRequest } from '@/lib/api-client'
import { transformCaseFromDB } from '@/lib/data-transformers'
import { type Case } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { RunAssessmentModal } from '@/components/assessments/run-assessment-modal'

import {
  Breadcrumb,
  Icon,
  MiniBar,
  fmtNum,
  CategoryBarChart,
  RunTimeline,
  type CategoryBarChartItem,
  type RunTimelineRun,
  type RunTimelineStatus,
} from '@/components/lcapix'
import { DEMO_CONTRIBUTORS, DEMO_FLOWS, DEMO_RUNS } from '@/lib/lcapix-demo'
import { useNotificationsStore } from '@/lib/notifications-store'
import { AnimatedNumber } from '@/components/lcapix/animated-number'
import { MagicInsightsModal } from '@/components/lcapix/magic-insights-modal'

// Impact categories supported (preserved from prior page for unit lookup).
const IMPACT_CATEGORIES: Record<string, { unit: string }> = {
  'Global warming': { unit: 'kg CO₂-eq' },
  'Ozone depletion': { unit: 'kg CFC-11-eq' },
  'Smog formation': { unit: 'kg NOₓ-eq' },
  'Freshwater ecotoxicity': { unit: 'CTUe' },
  Acidification: { unit: 'kg SO₂-eq' },
}

// API Response Types (preserved).
interface APIComponentBreakdown {
  component_id: number
  component_name: string
  component_type: string
  flows_processed: number
  impacts: Array<{
    category_id: number
    category_name: string
    impact_value: number
    unit: string
  }>
}

interface AssessmentResult {
  run_id: number
  run_name: string
  calculation_method: string
  status: string
  run_date: string
  executed_by_username: string
  impacts: Record<string, { value: number; unit: string }>
  costs: { operational: number; capital: number; total: number }
  componentBreakdown: APIComponentBreakdown[]
  algorithmSteps?: string[]
}

type FilterDir = 'all' | 'in' | 'out'

export default function ResultsPage() {
  const params = useParams()
  const router = useRouter()

  const projectId = params.projectId as string
  const caseId = params.caseId as string

  // Case data
  const [currentCase, setCurrentCase] = useState<Case | null>(null)
  const [projectName, setProjectName] = useState<string>('Project')
  const [isLoadingCase, setIsLoadingCase] = useState(true)

  // Assessment state (PRESERVED)
  const [isRunningAssessment] = useState(false)
  const [assessmentResults, setAssessmentResults] = useState<AssessmentResult[]>([])
  const [currentAssessment, setCurrentAssessment] = useState<AssessmentResult | null>(
    null,
  )
  const [assessOpen, setAssessOpen] = useState(false)
  const [magicOpen, setMagicOpen] = useState(false)
  const [flagshipGlow, setFlagshipGlow] = useState(false)
  const [magicPulse, setMagicPulse] = useState(false)
  const pushNotification = useNotificationsStore((s) => s.push)

  // LCAPIX UI state
  const [activeCategoryKey, setActiveCategoryKey] = useState<string | null>(null)
  const [method, setMethod] = useState('CML 2001')
  const [region, setRegion] = useState('US Grid')
  const [flowFilter, setFlowFilter] = useState<FilterDir>('all')

  // Fetch case + components (PRESERVED)
  useEffect(() => {
    const fetchCaseData = async () => {
      setIsLoadingCase(true)
      try {
        const [caseResponse, componentsResponse] = await Promise.all([
          apiRequest(`/api/cases/${caseId}`),
          apiRequest(`/api/cases/${caseId}/components`),
        ])

        if (caseResponse.ok) {
          const caseData = await caseResponse.json()
          const componentsData = await componentsResponse.json()

          if (caseData.success && caseData.case) {
            const transformedCase = transformCaseFromDB(caseData.case)

            if (componentsData.success && componentsData.components) {
              const { transformComponentFromDB } = await import(
                '@/lib/data-transformers'
              )
              transformedCase.components = componentsData.components.map((c: any) =>
                transformComponentFromDB(c),
              )
            }

            setCurrentCase(transformedCase)
          }
        }
        // Also fetch the parent project to populate the breadcrumb correctly
        try {
          const projRes = await apiRequest(`/api/projects/${projectId}`)
          const projData = await projRes.json()
          if (projData?.success && projData?.project?.project_name) {
            setProjectName(projData.project.project_name)
          }
        } catch {}
      } catch (error) {
        console.error('Failed to fetch case:', error)
      } finally {
        setIsLoadingCase(false)
      }
    }

    if (caseId) {
      fetchCaseData()
    }
  }, [caseId, projectId])

  // Load historical assessments (PRESERVED)
  useEffect(() => {
    const fetchAssessments = async () => {
      try {
        const response = await apiRequest(`/api/cases/${caseId}/assessments`)
        if (response.ok) {
          const data = await response.json()
          if (data.assessments && data.assessments.length > 0) {
            const transformedAssessments: AssessmentResult[] = data.assessments.map(
              (assessment: any) => ({
                run_id: assessment.run_id,
                run_name: assessment.run_name,
                calculation_method: assessment.calculation_method,
                status: assessment.status,
                run_date: assessment.run_date,
                executed_by_username: assessment.executed_by_username,
                impacts: assessment.impacts || {},
                costs: assessment.costs || {
                  operational: 0,
                  capital: 0,
                  total: 0,
                },
                componentBreakdown: assessment.componentBreakdown || [],
              }),
            )
            setAssessmentResults(transformedAssessments)
            if (transformedAssessments.length > 0) {
              setCurrentAssessment(transformedAssessments[0])
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch assessments:', error)
      }
    }

    if (caseId) {
      fetchAssessments()
    }
  }, [caseId])

  // Build assessment result (PRESERVED)
  const buildAssessmentResult = (data: any): AssessmentResult => {
    const impacts: Record<string, { value: number; unit: string }> = {}
    if (data.total_impacts) {
      data.total_impacts.forEach((impact: any) => {
        impacts[impact.category_name] = {
          value: impact.impact_value,
          unit: impact.unit,
        }
      })
    }

    const componentsWithDrivers =
      currentCase?.components?.filter(
        (c) => c.driverCategory && c.drivers && c.drivers.length > 0,
      ) || []
    const totalOperationalCost = componentsWithDrivers.reduce(
      (sum, c) => sum + (c.operationalCostUSD || 0),
      0,
    )
    const totalCapitalCost = componentsWithDrivers.reduce(
      (sum, c) => sum + (c.capitalCostUSD || 0),
      0,
    )

    return {
      run_id: data.assessment.run_id,
      run_name: data.assessment.run_name,
      calculation_method: data.assessment.calculation_method,
      status: data.assessment.status,
      run_date: data.assessment.run_date,
      executed_by_username: data.assessment.executed_by_username,
      impacts,
      costs: {
        operational: totalOperationalCost,
        capital: totalCapitalCost,
        total: totalOperationalCost + totalCapitalCost,
      },
      componentBreakdown: data.component_breakdown || [],
      algorithmSteps: data.algorithm_steps || [],
    }
  }

  // PRESERVED handler — open modal
  const handleRunAssessment = () => setAssessOpen(true)

  // PRESERVED handler — assessment completed
  const handleAssessmentCompleted = (data: any) => {
    try {
      const result = buildAssessmentResult(data)
      setAssessmentResults((prev) => [result, ...prev])
      setCurrentAssessment(result)
      toast.success(`Assessment completed! Run ID: ${result.run_id}`)
      pushNotification({
        kind: 'assessment',
        status: 'success',
        actor: 'You',
        text: `Assessment completed for ${currentCase?.name ?? 'case'} (${result.calculation_method})`,
        href: `/project/${projectId}/case/${caseId}/results`,
      })
      // Flagship moment sequence
      setFlagshipGlow(true)
      setTimeout(() => setFlagshipGlow(false), 1100)
      setTimeout(() => {
        setMagicPulse(true)
        setTimeout(() => setMagicPulse(false), 1500)
      }, 800)
    } catch (error: any) {
      console.error('Failed to process assessment result:', error)
      toast.error(`Failed to process assessment result: ${error.message}`)
    }
  }

  // PRESERVED handler — export PDF (wire existing handler if any; fallback to print)
  const handleExportPDF = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  // Loading state
  if (isLoadingCase) {
    return (
      <div className="app-shell" style={{ minHeight: '100vh' }}>
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
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--brand-primary)' }} />
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Loading case data…</p>
        </div>
      </div>
    )
  }

  // Case not found
  if (!currentCase) {
    return (
      <div className="app-shell" style={{ minHeight: '100vh' }}>
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
          <AlertCircle className="h-10 w-10" style={{ color: 'var(--text-tertiary)' }} />
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>
            Case not found
          </h2>
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
          </Button>
        </div>
      </div>
    )
  }

  const mostRecentAssessment = currentAssessment || assessmentResults[0]

  // Real impact entries from the most-recent assessment (preserved).
  const impactEntries: Array<[string, { value: number; unit: string }]> =
    mostRecentAssessment ? Object.entries(mostRecentAssessment.impacts) : []

  // Category items for the chip row + CategoryBarChart. Prefer real data,
  // fall back to the canonical IMPACT_CATEGORIES ordering.
  const categoryItems: CategoryBarChartItem[] = impactEntries.length
    ? impactEntries.map(([name, imp]) => ({
        key: name,
        label: name,
        value: imp.value,
        unit: imp.unit,
      }))
    : Object.entries(IMPACT_CATEGORIES).map(([name, info]) => ({
        key: name,
        label: name,
        value: 0,
        unit: info.unit,
      }))

  // Default active category — primary (global-warming-ish) if possible.
  const primaryKey =
    categoryItems.find((c) => /global\s*warming|carbon|co2/i.test(c.key))?.key ||
    categoryItems[0]?.key ||
    ''
  const activeKey = activeCategoryKey ?? primaryKey
  const activeCat = categoryItems.find((c) => c.key === activeKey) ?? categoryItems[0]

  // Contributors (real if available, else DEMO).
  const realContributors =
    mostRecentAssessment && activeCat
      ? (mostRecentAssessment.componentBreakdown || [])
          .map((c) => {
            const match = c.impacts.find((i) => i.category_name === activeCat.key)
            return {
              id: String(c.component_id),
              name: c.component_name,
              value: match?.impact_value || 0,
              unit: match?.unit || activeCat.unit,
            }
          })
          .filter((c) => c.value > 0)
          .sort((a, b) => b.value - a.value)
      : []

  const contributors = realContributors.length
    ? (() => {
        const sum = realContributors.reduce((s, c) => s + c.value, 0) || 1
        return realContributors.slice(0, 5).map((c) => ({
          id: c.id,
          name: c.name,
          value: c.value,
          pct: (c.value / sum) * 100,
        }))
      })()
    : DEMO_CONTRIBUTORS.map((c) => ({
        id: c.id,
        name: c.name,
        value: c.value,
        pct: c.pct,
      }))

  const usingDemoContributors = !realContributors.length

  // Flow table rows — real flows not present on assessment payload; fall back to DEMO.
  const flowRows = DEMO_FLOWS.filter((f) => {
    if (flowFilter === 'in') return f.dir === 'IN'
    if (flowFilter === 'out') return f.dir === 'OUT'
    return true
  })

  // Historical runs — real if at least two with active-category values, else DEMO.
  const realRuns: RunTimelineRun[] = activeCat
    ? assessmentResults
        .filter((r) => typeof r.impacts?.[activeCat.key]?.value === 'number')
        .map((r) => {
          const d = new Date(r.run_date)
          return {
          id: r.run_id,
          timestamp: isNaN(d.getTime()) ? 'recent' : d.toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
          }),
          totalImpact: r.impacts[activeCat.key].value,
          status:
            (r.status === 'completed' || r.status === 'success'
              ? 'success'
              : r.status === 'partial'
                ? 'partial'
                : 'error') as RunTimelineStatus,
          }
        })
        .reverse()
    : []

  const historyRuns: RunTimelineRun[] = realRuns.length >= 2
    ? realRuns
    : DEMO_RUNS.map((r) => ({
        id: r.id,
        timestamp: r.date,
        totalImpact: r.value,
        status: r.status as RunTimelineStatus,
      }))

  const usingDemoRuns = realRuns.length < 2

  // KPIs — real component + category counts, plus optional run duration.
  const allComponents = currentCase.components || []
  const runDuration = mostRecentAssessment
    ? '—'
    : '—'
  const activeCategoriesCount = impactEntries.length || Object.keys(IMPACT_CATEGORIES).length
  const lastRunLabel = mostRecentAssessment
    ? (isNaN(new Date(mostRecentAssessment.run_date).getTime()) ? 'Recent' : new Date(mostRecentAssessment.run_date).toLocaleString())
    : 'Never'

  const totalImpactDisplay = activeCat
    ? activeCat.value < 0.01 && activeCat.value > 0
      ? activeCat.value.toExponential(2)
      : fmtNum(activeCat.value, activeCat.value < 1 ? 4 : 2)
    : '—'

  // Breadcrumb items — plain const; this sits after two early returns
  // (isLoadingCase / !currentCase) so it cannot be a hook without
  // violating rules-of-hooks.
  const safeDate = (raw?: string | null): string => {
    if (!raw) return 'Recent'
    const d = new Date(raw)
    if (isNaN(d.getTime())) return 'Recent'
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  // Breadcrumb: Projects → <project> → Results · <case>.
  // We dropped the standalone case-name level (it routed to an editor most
  // users don't expect from a breadcrumb) and keep the case name on the page
  // title row instead.
  const breadcrumbItems = [
    { label: 'Projects', page: 'home' },
    {
      label: projectName || 'Project',
      onClick: () => router.push(`/project/${projectId}`),
    },
    { label: 'Results' },
  ]

  return (
    <div className="app-shell" style={{ minHeight: '100vh' }}>
      <Breadcrumb items={breadcrumbItems} />

      <div style={{ padding: '24px 32px 80px', maxWidth: 1440, margin: '0 auto' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 24,
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 280 }}>
            <h1
              className="display"
              style={{
                fontSize: 26,
                fontWeight: 600,
                margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              {currentCase.name || 'Assessment Results'}
            </h1>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-tertiary)',
                marginTop: 4,
              }}
            >
              {mostRecentAssessment ? (
                <>
                  <span
                    className="mono"
                    style={{
                      padding: '2px 6px',
                      borderRadius: 3,
                      background: 'var(--surface-overlay)',
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      color: 'var(--brand-primary)',
                      marginRight: 8,
                    }}
                  >
                    LATEST RUN
                  </span>
                  Run #{mostRecentAssessment.run_id} ·{' '}
                  {safeDate(mostRecentAssessment.run_date)}
                </>
              ) : (
                'No assessments yet — run one to see results.'
              )}
            </div>
          </div>

          {/* Method selector */}
          <label
            className="chip"
            style={{
              padding: 0,
              background: 'var(--surface-overlay)',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span
              style={{
                paddingLeft: 10,
                display: 'flex',
                alignItems: 'center',
                color: 'var(--text-tertiary)',
              }}
            >
              <Icon name="layers" size={12} />
            </span>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              style={{
                appearance: 'none',
                WebkitAppearance: 'none',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                padding: '6px 10px',
                cursor: 'pointer',
              }}
            >
              <option value="CML 2001">CML 2001</option>
              <option value="ReCiPe Midpoint (H)">ReCiPe Midpoint (H)</option>
              <option value="TRACI 2.1">TRACI 2.1</option>
            </select>
          </label>

          {/* Region selector */}
          <label
            className="chip"
            style={{
              padding: 0,
              background: 'var(--surface-overlay)',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span
              style={{
                paddingLeft: 10,
                display: 'flex',
                alignItems: 'center',
                color: 'var(--text-tertiary)',
              }}
            >
              <Icon name="globe" size={12} />
            </span>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              style={{
                appearance: 'none',
                WebkitAppearance: 'none',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                padding: '6px 10px',
                cursor: 'pointer',
              }}
            >
              <option value="US Grid">US Grid</option>
              <option value="EU Average">EU Average</option>
              <option value="Global">Global</option>
            </select>
          </label>

          <button className="btn btn-secondary btn-sm" onClick={handleExportPDF}>
            <Icon name="download" size={14} /> Export PDF
          </button>
          <button
            type="button"
            className={`btn btn-secondary btn-sm ${magicPulse ? 'bell-pulse' : ''}`}
            onClick={() => setMagicPulse(false) || setMagicOpen(true)}
            style={{
              background:
                'linear-gradient(135deg, oklch(from var(--brand-primary) l c h / 0.12), oklch(from var(--chart-2, var(--brand-primary)) l c h / 0.12))',
              color: 'var(--brand-primary)',
              borderColor: 'var(--brand-primary)',
            }}
            title="AI summary of this assessment"
          >
            <Icon name="sparkle" size={14} /> Magic Insights
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleRunAssessment}
            disabled={isRunningAssessment}
          >
            <Icon name="run" size={14} />{' '}
            {mostRecentAssessment ? 'Re-run' : 'Run new'}
          </button>
          {assessmentResults.length > 1 && (
            <button
              className="chip chip-active"
              style={{ fontSize: 11, cursor: 'pointer', border: 'none' }}
            >
              Compare to last run
            </button>
          )}
        </div>

        {/* KPI strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
            marginBottom: 20,
          }}
        >
          {[
            {
              label: 'TOTAL IMPACT',
              value: activeCat ? totalImpactDisplay : '—',
              suffix: activeCat?.unit || '',
            },
            {
              label: 'ACTIVE CATEGORIES',
              value: String(activeCategoriesCount),
              suffix: '',
            },
            {
              label: 'COMPONENTS ASSESSED',
              value: String(allComponents.length),
              suffix: '',
            },
            {
              label: 'LAST RUN',
              value: lastRunLabel,
              suffix: '',
            },
          ].map((k) => (
            <div key={k.label} className="card" style={{ padding: 18 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                {k.label}
              </div>
              <div
                className="mono"
                style={{
                  fontSize: k.label === 'LAST RUN' ? 14 : 26,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  lineHeight: 1.2,
                }}
              >
                {k.value}
                {k.suffix && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 400,
                      color: 'var(--text-tertiary)',
                      marginLeft: 6,
                    }}
                  >
                    {k.suffix}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Row 1 — Impact overview */}
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <div
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              marginBottom: 20,
              paddingBottom: 4,
            }}
          >
            {categoryItems.map((ct) => (
              <button
                key={ct.key}
                onClick={() => setActiveCategoryKey(ct.key)}
                className={'chip ' + (activeKey === ct.key ? 'chip-active' : '')}
                style={{
                  cursor: 'pointer',
                  border: 'none',
                  fontFamily: 'var(--font-ui)',
                  whiteSpace: 'nowrap',
                }}
              >
                {ct.label}
              </button>
            ))}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '360px 1fr',
              gap: 32,
              alignItems: 'center',
            }}
          >
            <div>
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                TOTAL · {activeCat?.label.toUpperCase() || '—'}
              </div>
              <div
                className={`mono success-glow-host ${flagshipGlow ? 'is-glowing' : ''}`}
                style={{
                  fontSize: 56,
                  fontWeight: 600,
                  color: 'var(--brand-primary)',
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  display: 'inline-block',
                }}
              >
                {activeCat && typeof activeCat.value === 'number' && activeCat.value >= 0.01 ? (
                  <AnimatedNumber
                    value={activeCat.value}
                    decimals={activeCat.value < 1 ? 4 : 2}
                    duration={900}
                  />
                ) : (
                  totalImpactDisplay
                )}
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: 'var(--text-tertiary)',
                  marginTop: 6,
                }}
              >
                {activeCat?.unit || ''}
              </div>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                COMPONENT CONTRIBUTION
                {usingDemoContributors && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 10,
                      color: 'var(--text-tertiary)',
                      textTransform: 'none',
                      letterSpacing: 0,
                    }}
                  >
                    (sample)
                  </span>
                )}
              </div>
              <div
                style={{
                  display: 'flex',
                  height: 44,
                  borderRadius: 6,
                  overflow: 'hidden',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {contributors.map((c, i) => (
                  <div
                    key={c.id}
                    style={{
                      flex: c.pct,
                      background: `var(--chart-${(i % 5) + 1})`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      borderRight:
                        i < contributors.length - 1
                          ? '1px solid var(--surface-base)'
                          : 'none',
                    }}
                    title={`${c.name}: ${c.pct.toFixed(1)}%`}
                  >
                    <span
                      className="mono"
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'oklch(0.15 0.01 240)',
                      }}
                    >
                      {fmtNum(c.pct, 0)}%
                    </span>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: 10,
                  display: 'flex',
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                {contributors.map((c, i) => (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        background: `var(--chart-${(i % 5) + 1})`,
                      }}
                    />
                    <span style={{ color: 'var(--text-secondary)' }}>{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Row 2 — chart + top contributors */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr',
            gap: 20,
            marginBottom: 20,
          }}
        >
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Impact by category</span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                }}
                className="mono"
              >
                log scale
              </span>
            </div>
            <CategoryBarChart
              categories={categoryItems}
              selectedKey={activeKey}
              onSelect={setActiveCategoryKey}
            />
          </div>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
              Top contributors
              {usingDemoContributors && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 10,
                    fontWeight: 400,
                    color: 'var(--text-tertiary)',
                  }}
                >
                  (sample)
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {contributors.map((c, i) => (
                <div key={c.id}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      fontSize: 12,
                      marginBottom: 4,
                    }}
                  >
                    <span
                      className="mono"
                      style={{
                        color: 'var(--text-tertiary)',
                        marginRight: 6,
                        width: 16,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', flex: 1 }}>
                      {c.name}
                    </span>
                    <span
                      className="mono"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {fmtNum(c.value, 1)}
                    </span>
                  </div>
                  <MiniBar value={c.pct} max={40} height={5} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3 — Flow table */}
        <div
          className="card"
          style={{ padding: 0, marginBottom: 20, overflow: 'hidden' }}
        >
          <div
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600 }}>Flow-level detail</span>
            <span
              style={{
                marginLeft: 8,
                fontSize: 12,
                color: 'var(--text-tertiary)',
              }}
            >
              <span className="mono">{flowRows.length}</span> flows
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 10,
                  color: 'var(--text-tertiary)',
                }}
              >
                (sample)
              </span>
            </span>
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 6 }}>
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'in', label: 'Inputs' },
                  { id: 'out', label: 'Outputs' },
                ] as Array<{ id: FilterDir; label: string }>
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFlowFilter(f.id)}
                  className={
                    'chip ' + (flowFilter === f.id ? 'chip-active' : '')
                  }
                  style={{
                    fontSize: 11,
                    cursor: 'pointer',
                    border: 'none',
                  }}
                >
                  {f.id === 'all' && <Icon name="filter" size={10} />} {f.label}
                </button>
              ))}
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 2fr 80px 100px 80px 100px 100px',
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
            <div>Substance</div>
            <div>Dir</div>
            <div style={{ textAlign: 'right' }}>Amount</div>
            <div>Unit</div>
            <div style={{ textAlign: 'right' }}>Factor</div>
            <div style={{ textAlign: 'right' }}>Impact</div>
          </div>
          {flowRows.map((f) => (
            <div
              key={f.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 2fr 80px 100px 80px 100px 100px',
                padding: '10px 20px',
                borderTop: '1px solid var(--border-subtle)',
                fontSize: 12,
                alignItems: 'center',
              }}
            >
              <div style={{ color: 'var(--text-secondary)' }}>{f.component}</div>
              <div style={{ color: 'var(--text-primary)' }}>{f.substance}</div>
              <div>
                <span
                  style={{
                    fontSize: 9,
                    padding: '2px 6px',
                    borderRadius: 3,
                    background:
                      f.dir === 'IN'
                        ? 'oklch(from var(--signal-info) l c h / 0.18)'
                        : 'oklch(from var(--signal-warn) l c h / 0.18)',
                    color:
                      f.dir === 'IN' ? 'var(--signal-info)' : 'var(--signal-warn)',
                    fontWeight: 600,
                  }}
                >
                  {f.dir}
                </span>
              </div>
              <div className="mono" style={{ textAlign: 'right' }}>
                {fmtNum(f.amount, 2)}
              </div>
              <div style={{ color: 'var(--text-tertiary)' }}>{f.unit}</div>
              <div
                className="mono"
                style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}
              >
                {fmtNum(f.factor, 3)}
              </div>
              <div
                className="mono"
                style={{
                  textAlign: 'right',
                  color: 'var(--brand-primary)',
                  fontWeight: 500,
                }}
              >
                {fmtNum(f.impact, 2)}
              </div>
            </div>
          ))}
        </div>

        {/* Historical runs */}
        <div className="card" style={{ padding: 20 }}>
          <div
            style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}
          >
            <span style={{ fontSize: 14, fontWeight: 600 }}>Historical runs</span>
            <span
              style={{
                marginLeft: 8,
                fontSize: 12,
                color: 'var(--text-tertiary)',
              }}
            >
              {historyRuns.length} runs
              {usingDemoRuns && (
                <span style={{ marginLeft: 6, fontSize: 10 }}>(sample)</span>
              )}
            </span>
            <div style={{ flex: 1 }} />
            <button
              className="chip"
              style={{ fontSize: 11, cursor: 'pointer', border: 'none' }}
              onClick={handleRunAssessment}
            >
              Run new
            </button>
          </div>
          <RunTimeline runs={historyRuns} />
        </div>
      </div>

      <RunAssessmentModal
        open={assessOpen}
        onClose={() => setAssessOpen(false)}
        caseId={Number(caseId)}
        onCompleted={handleAssessmentCompleted}
      />

      <MagicInsightsModal
        open={magicOpen}
        onClose={() => setMagicOpen(false)}
        caseName={currentCase?.name ?? 'this case'}
        method={mostRecentAssessment?.calculation_method ?? 'CML 2001'}
        totalImpact={mostRecentAssessment?.impacts?.['Global warming']?.value}
        totalCost={mostRecentAssessment?.costs?.total}
        topContributors={contributors.slice(0, 5).map((c) => ({
          id: c.id,
          name: c.name,
          pct: c.pct,
          value: c.value,
        }))}
        projectId={projectId}
        caseId={caseId}
      />
    </div>
  )
}
