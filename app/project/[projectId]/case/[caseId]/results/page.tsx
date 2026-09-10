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

interface FlowDetailRow {
  flow_id: number
  component: string
  substance: string
  category_name: string
  dir: 'IN' | 'OUT'
  amount: number
  unit: string
  factor: number
  impact: number
  /** Factor scope the engine selected ('US', 'Global', ...) — snapshot runs only. */
  scope?: string
  /** Unit conversion the engine applied (e.g. "1 g = 0.001 kg") — snapshot runs only. */
  conversion?: string | null
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
  flowDetail: FlowDetailRow[]
  algorithmSteps?: string[]
  /** Engine data-quality warnings frozen in the run snapshot. */
  warnings?: string[]
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

  // Load historical assessments (PRESERVED). Extracted so it can be re-run
  // after a fresh assessment completes (to pull in server-computed flowDetail).
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
                flowDetail: assessment.flowDetail || [],
                warnings: assessment.warnings || [],
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

  useEffect(() => {
    if (caseId) {
      fetchAssessments()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      flowDetail: data.flowDetail || [],
      warnings: data.warnings || [],
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
      // The POST response doesn't include server-computed flowDetail; refetch
      // the list so the Flow-level detail table populates for the new run.
      fetchAssessments()
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

  // Export the most-recent assessment as a server-generated PDF or PowerPoint
  // deck. The server route (/api/assessments/{runId}/export) builds the full
  // report; we fetch it with auth and trigger a download. Falls back to
  // window.print() only when there's no completed run to export yet.
  const [exporting, setExporting] = useState<null | 'pdf' | 'pptx'>(null)
  const handleExport = async (format: 'pdf' | 'pptx') => {
    const runId = mostRecentAssessment?.run_id
    if (!runId) {
      if (typeof window !== 'undefined') window.print()
      return
    }
    setExporting(format)
    try {
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
      const res = await fetch(
        `/api/assessments/${runId}/export?format=${format}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      )
      if (!res.ok) {
        toast.error(`Export failed (${res.status})`)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `LCAPIX_Report_${currentCase?.name?.replace(/[^a-zA-Z0-9]/g, '_') ?? runId}.${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(`${format.toUpperCase()} exported`)
    } catch (e: any) {
      toast.error(`Export error: ${e?.message ?? 'unknown'}`)
    } finally {
      setExporting(null)
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
    : []
  // ^^ Bug fix: do NOT fall back to DEMO_CONTRIBUTORS. Empty contributors
  // now drive a real empty state in the render below — previously a brand-
  // new case looked like it had run an assessment when it hadn't.

  const usingDemoContributors = !realContributors.length

  // Flow table — real per-flow rows for the active category, computed
  // server-side (Amount × Factor = Impact, matching the engine). Filtered by
  // the input/output toggle. Empty when the active category has no driver
  // flows (handled by an empty-state in the render below).
  const flowRows = (mostRecentAssessment?.flowDetail || [])
    .filter((f) => !activeCat || f.category_name === activeCat.key)
    .filter((f) =>
      flowFilter === 'all'
        ? true
        : flowFilter === 'in'
          ? f.dir === 'IN'
          : f.dir === 'OUT',
    )
    .map((f) => ({
      id: String(f.flow_id),
      component: f.component,
      substance: f.substance,
      dir: f.dir,
      amount: f.amount,
      unit: f.unit,
      factor: f.factor,
      impact: f.impact,
      scope: f.scope,
      conversion: f.conversion,
    }))

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

  // Show whatever real runs we have. Previously, fewer than 2 real runs
  // triggered a DEMO_RUNS fallback that made the history timeline look
  // populated. Now: 0 real runs → empty timeline + empty-state. 1+ real
  // runs → render them honestly.
  const historyRuns: RunTimelineRun[] = realRuns

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

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null}
            title="Download a PDF report of the latest run"
          >
            <Icon name="download" size={14} />{' '}
            {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => handleExport('pptx')}
            disabled={exporting !== null}
            title="Download a PowerPoint deck of the latest run"
          >
            <Icon name="download" size={14} />{' '}
            {exporting === 'pptx' ? 'Exporting…' : 'Export PPT'}
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

        {/* Hero dashboard — total impact · contributors · all categories */}
        <DashboardHero
          activeCat={activeCat}
          totalImpactDisplay={totalImpactDisplay}
          flagshipGlow={flagshipGlow}
          contributors={contributors}
          usingDemoContributors={usingDemoContributors}
          categoryItems={categoryItems}
          activeKey={activeKey}
          onSelectCategory={setActiveCategoryKey}
          deltaPct={(() => {
            // Δ vs previous run on the active category
            if (!activeCat || realRuns.length < 2) return null
            const sorted = [...realRuns].sort((a, b) =>
              new Date(b.runAt).getTime() - new Date(a.runAt).getTime(),
            )
            const cur = Number(sorted[0]?.value ?? 0)
            const prev = Number(sorted[1]?.value ?? 0)
            if (!prev) return null
            return ((cur - prev) / prev) * 100
          })()}
          methodLabel={mostRecentAssessment?.calculation_method || 'CML 2001'}
          activeCategoriesCount={activeCategoriesCount}
          componentsAssessed={allComponents.length}
          lastRunLabel={lastRunLabel}
        />


        {/* Data-quality warnings frozen in the run snapshot */}
        {(mostRecentAssessment?.warnings?.length ?? 0) > 0 && (
          <div
            className="card"
            style={{
              marginBottom: 20,
              padding: '14px 18px',
              borderLeft: '4px solid var(--warning, #b8860b)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 6 }}>
              DATA-QUALITY WARNINGS · {mostRecentAssessment!.warnings!.length}
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)' }}>
              {mostRecentAssessment!.warnings!.map((w, i) => (
                <li key={i} style={{ marginBottom: 4 }}>{w}</li>
              ))}
            </ul>
          </div>
        )}

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
              gridTemplateColumns: '1.5fr 2fr 70px 100px 90px 90px 70px 100px',
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
            <div>Scope</div>
            <div style={{ textAlign: 'right' }}>Impact</div>
          </div>
          {flowRows.map((f) => (
            <div
              key={f.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 2fr 70px 100px 90px 90px 70px 100px',
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
              <div style={{ color: 'var(--text-tertiary)' }} title={f.conversion || undefined}>
                {f.unit}
                {f.conversion ? ' *' : ''}
              </div>
              <div
                className="mono"
                style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}
              >
                {fmtNum(f.factor, 3)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{f.scope || '—'}</div>
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
          {flowRows.length === 0 && (
            <div
              style={{
                padding: '28px 20px',
                textAlign: 'center',
                fontSize: 12,
                color: 'var(--text-tertiary)',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              {mostRecentAssessment
                ? `No driver flows contribute to ${activeCat?.label ?? 'this category'}. Add input/output flows on a leaf component and re-run.`
                : 'Run an assessment to see flow-level detail.'}
            </div>
          )}
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
        initialMethod={method}
        initialRegion={region}
      />

      <MagicInsightsModal
        open={magicOpen}
        onClose={() => setMagicOpen(false)}
        caseName={currentCase?.name ?? 'this case'}
        method={mostRecentAssessment?.calculation_method ?? 'CML 2001'}
        impacts={mostRecentAssessment?.impacts}
        componentBreakdown={mostRecentAssessment?.componentBreakdown?.map((c) => ({
          component_id: c.component_id,
          component_name: c.component_name,
          impacts: c.impacts.map((i) => ({
            category_name: i.category_name,
            impact_value: i.impact_value,
            unit: i.unit,
          })),
        }))}
        totalCost={mostRecentAssessment?.costs?.total}
        initialCategory={activeKey}
        projectId={projectId}
        caseId={caseId}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DashboardHero — single tight section that replaced the old KPI strip +
// impact overview row + top contributors. Mirrors the lcapix.io mockup:
// total impact at top-left with Δ-vs-last-run pill, horizontal contribution
// bars beneath, and a stacked categories panel on the right.
// ─────────────────────────────────────────────────────────────────────────────

interface DashboardHeroProps {
  activeCat: { key: string; label: string; value?: number; unit?: string } | null
  totalImpactDisplay: string
  flagshipGlow?: boolean
  contributors: Array<{ id: string; name: string; value: number; pct: number }>
  usingDemoContributors?: boolean
  categoryItems: Array<{ key: string; label: string; value?: number; unit?: string }>
  activeKey: string
  onSelectCategory: (k: string) => void
  deltaPct: number | null
  methodLabel: string
  activeCategoriesCount: number
  componentsAssessed: number
  lastRunLabel: string
}

function DashboardHero({
  activeCat,
  totalImpactDisplay,
  flagshipGlow,
  contributors,
  usingDemoContributors,
  categoryItems,
  activeKey,
  onSelectCategory,
  deltaPct,
  methodLabel,
  activeCategoriesCount,
  componentsAssessed,
  lastRunLabel,
}: DashboardHeroProps) {
  const maxContribValue = Math.max(
    1e-9,
    ...contributors.map((c) => Math.abs(c.value)),
  )
  const formatVal = (v: number) =>
    v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)
  const formatCatVal = (v?: number) => {
    if (v == null || !isFinite(v)) return '—'
    if (v < 0.001 && v > 0) return v.toExponential(2)
    if (v < 1) return v.toFixed(4)
    if (v < 100) return v.toFixed(2)
    return v.toFixed(0)
  }
  return (
    <div
      className="card"
      style={{
        padding: 0,
        marginBottom: 20,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.7fr) minmax(0, 1fr)',
          gap: 0,
        }}
      >
        {/* LEFT — total impact + delta + contribution bars */}
        <div style={{ padding: '28px 28px 24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
              marginBottom: 8,
            }}
          >
            <span
              className="eyebrow"
              style={{
                fontSize: 11,
                letterSpacing: '0.14em',
                color: 'var(--brand-primary)',
              }}
            >
              TOTAL IMPACT · {activeCat?.label.toUpperCase() || '—'}
            </span>
            <span
              style={{ flex: 1 }}
            />
            <span
              className="mono"
              style={{
                fontSize: 10,
                padding: '3px 8px',
                borderRadius: 999,
                background: 'var(--surface-overlay)',
                color: 'var(--text-tertiary)',
                letterSpacing: '0.04em',
              }}
            >
              {methodLabel}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            <div
              className={`mono success-glow-host ${flagshipGlow ? 'is-glowing' : ''}`}
              style={{
                fontSize: 56,
                fontWeight: 600,
                color: 'var(--brand-primary)',
                lineHeight: 1,
                letterSpacing: '-0.02em',
              }}
            >
              {totalImpactDisplay}
            </div>
            <div
              style={{
                fontSize: 14,
                color: 'var(--text-tertiary)',
              }}
            >
              {activeCat?.unit ?? ''}
            </div>
            {deltaPct != null && (
              <span
                className="mono"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: 999,
                  color:
                    deltaPct <= 0
                      ? 'var(--signal-success, #16a34a)'
                      : '#b45309',
                  background:
                    deltaPct <= 0
                      ? 'color-mix(in oklab, var(--signal-success, #16a34a) 14%, transparent)'
                      : 'color-mix(in oklab, #d98568 18%, transparent)',
                }}
              >
                {deltaPct <= 0 ? '↓' : '↑'} {Math.abs(deltaPct).toFixed(1)}% vs last run
              </span>
            )}
          </div>

          {/* Small KPI row */}
          <div
            style={{
              marginTop: 14,
              display: 'flex',
              gap: 18,
              fontSize: 11.5,
              color: 'var(--text-tertiary)',
            }}
          >
            <span>
              <span
                className="mono"
                style={{ color: 'var(--text-primary)', fontWeight: 600 }}
              >
                {activeCategoriesCount}
              </span>{' '}
              categories
            </span>
            <span>·</span>
            <span>
              <span
                className="mono"
                style={{ color: 'var(--text-primary)', fontWeight: 600 }}
              >
                {componentsAssessed}
              </span>{' '}
              components
            </span>
            <span>·</span>
            <span>
              last run <span className="mono">{lastRunLabel}</span>
            </span>
          </div>

          {/* Contribution bars */}
          <div
            style={{
              marginTop: 26,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {contributors.slice(0, 5).map((c, i) => {
              const widthPct =
                maxContribValue > 0
                  ? Math.max(2, (Math.abs(c.value) / maxContribValue) * 100)
                  : 0
              return (
                <div
                  key={c.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(140px, 180px) 1fr 60px',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={c.name}
                  >
                    {c.name}
                  </div>
                  <div
                    style={{
                      height: 22,
                      borderRadius: 6,
                      background: 'var(--surface-overlay)',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        width: `${widthPct}%`,
                        height: '100%',
                        background: `color-mix(in oklab, var(--brand-primary) ${
                          100 - i * 14
                        }%, var(--surface-raised))`,
                        transition: 'width 600ms cubic-bezier(.2,.7,.2,1)',
                      }}
                    />
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 13,
                      textAlign: 'right',
                      color: 'var(--text-primary)',
                      fontWeight: 500,
                    }}
                  >
                    {formatVal(c.value)}
                  </div>
                </div>
              )
            })}
            {usingDemoContributors && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-tertiary)',
                  marginTop: 4,
                  fontStyle: 'italic',
                }}
              >
                No contributors yet — run an assessment to see what is driving impact.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — categories list */}
        <div
          style={{
            padding: '28px 28px 24px',
            borderLeft: '1px solid var(--border-subtle)',
            background:
              'color-mix(in oklab, var(--brand-primary) 2%, var(--surface-raised))',
          }}
        >
          <div
            className="eyebrow"
            style={{
              fontSize: 11,
              letterSpacing: '0.14em',
              color: 'var(--brand-primary)',
              marginBottom: 14,
            }}
          >
            IMPACT CATEGORIES
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              maxHeight: 360,
              overflowY: 'auto',
            }}
          >
            {categoryItems.map((c) => {
              const isActive = c.key === activeKey
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => onSelectCategory(c.key)}
                  style={{
                    textAlign: 'left',
                    padding: '12px 14px',
                    borderRadius: 8,
                    border:
                      '1px solid ' +
                      (isActive
                        ? 'color-mix(in oklab, var(--brand-primary) 45%, transparent)'
                        : 'var(--border-subtle)'),
                    background: isActive
                      ? 'color-mix(in oklab, var(--brand-primary) 10%, var(--surface-raised))'
                      : 'var(--surface-raised)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-ui)',
                    transition: 'background 160ms ease, border-color 160ms ease',
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 500,
                      color: 'var(--text-primary)',
                      marginBottom: 4,
                    }}
                  >
                    {c.label}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 6,
                    }}
                  >
                    <span
                      className="mono"
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: isActive
                          ? 'var(--brand-primary)'
                          : 'var(--text-primary)',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {formatCatVal(c.value)}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      {c.unit || ''}
                    </span>
                  </div>
                </button>
              )
            })}
            {categoryItems.length === 0 && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-tertiary)',
                  fontStyle: 'italic',
                  padding: '6px 0',
                }}
              >
                No categories available — run an assessment.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
