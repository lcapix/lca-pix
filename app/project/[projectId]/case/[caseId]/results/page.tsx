'use client'

// Phase LG.2 — Results page ported from LCAPIX/pages-misc.jsx (ResultsPage).
// Business logic (case fetch, assessments fetch, Run Assessment modal,
// category selection, assessment-result building) is PRESERVED from the
// prior Phase 6 implementation. The visual layer mirrors the LCAPIX
// prototype: KPI strip, impact-overview card with chips + big number,
// CategoryBarChart + top-contributors, flow table with direction filter,
// and historical-runs timeline.

import Link from 'next/link'
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
  CategoryBarChart,
  RunTimeline,
  type CategoryBarChartItem,
  type RunTimelineRun,
  type RunTimelineStatus,
} from '@/components/lcapix'
import { useNotificationsStore } from '@/lib/notifications-store'
import { AnimatedNumber } from '@/components/lcapix/animated-number'
import { WriteUpCard } from '@/components/lcapix/case/write-up-card'
import { MagicInsightsModal } from '@/components/lcapix/magic-insights-modal'
import { HelpTip } from '@/components/lcapix/help-tip'
import { ISO_HELP, impactCategoryHelp } from '@/components/lcapix/iso-help'
import { IsoRunSummary } from '@/components/lcapix/results/iso-run-summary'
import type { GoalScope } from '@/lib/run-snapshot'
import type { DataQualitySummary } from '@/lib/lca-engine'
import { StagePanel } from '@/components/lcapix/results/stage-panel'
import { fmtSig } from '@/components/lcapix/formatters'
import {
  deltaVsPreviousRun,
  initialRunScope,
  latestCompletedRun,
  rankContributors,
} from '@/components/lcapix/results/run-math'

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
  /** Life-cycle stage of the step (migrate-022); null reads as production. */
  life_cycle_stage?: string | null
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
  /** Provenance tier of the factor (authoritative / industry_average / unverified / unknown). */
  source_tier?: string | null
  /** The factor's cited source. */
  source?: string | null
  /** Allocation share applied to this row, when < 1. */
  allocation?: number | null
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
  /** Region the run was computed with (canonical code, e.g. 'US'). */
  regionCode?: string
  /** Goal & scope frozen with the run (ISO 14044 4.2); null for older runs. */
  goalScope?: GoalScope | null
  /** Data-quality statement frozen with the run (ISO 14044 4.2.3.6). */
  dataQuality?: DataQualitySummary | null
}

type FilterDir = 'all' | 'in' | 'out'

// Provenance tier of a factor, as shown on hover in the flow table.
const TIER_LABEL: Record<string, string> = {
  authoritative: 'authoritative published source',
  industry_average: 'industry average',
  unverified: 'unverified legacy value',
  unknown: 'no source recorded',
}

export default function ResultsPage() {
  const params = useParams()
  const router = useRouter()

  const projectId = params.projectId as string
  const caseId = params.caseId as string

  // Case data
  const [currentCase, setCurrentCase] = useState<Case | null>(null)
  const [projectName, setProjectName] = useState<string>('Project')
  const [isLoadingCase, setIsLoadingCase] = useState(true)
  // RES-5: a failed fetch is an error, not an empty state. 'notfound' only for
  // a 404 (or a body without the case); 'error' for anything else.
  const [caseLoadError, setCaseLoadError] = useState<null | 'notfound' | 'error'>(null)
  const [assessmentsError, setAssessmentsError] = useState<string | null>(null)
  // The case's own region (where the product is made), for a first run.
  const [caseRegion, setCaseRegion] = useState<string | null>(null)

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
  // The pickers only hold what the user chose here; until then they show the
  // scope a re-run starts from (see initialRunScope below, RUN-5). Keeping the
  // choice separate also stops every refetch from resetting it.
  const [pickedMethod, setPickedMethod] = useState<string | null>(null)
  const [pickedRegion, setPickedRegion] = useState<string | null>(null)
  const [flowFilter, setFlowFilter] = useState<FilterDir>('all')
  // The author's own interpretation and assumptions, kept on the case and
  // printed in the exported report (ISO 14044 5.1).
  const [writeUp, setWriteUp] = useState<{
    interpretation: string
    assumptions: string
    isFinal: boolean
  }>({ interpretation: '', assumptions: '', isFinal: false })
  // The study's own method and region (goal & scope), used until this case has
  // a run of its own.
  const [studyMethod, setStudyMethod] = useState<string | null>(null)
  const [studyRegion, setStudyRegion] = useState<string | null>(null)

  // Fetch case + components (PRESERVED)
  useEffect(() => {
    const fetchCaseData = async () => {
      setIsLoadingCase(true)
      try {
        const [caseResponse, componentsResponse] = await Promise.all([
          apiRequest(`/api/cases/${caseId}`),
          apiRequest(`/api/cases/${caseId}/components`),
        ])

        if (!caseResponse.ok) {
          setCaseLoadError(caseResponse.status === 404 ? 'notfound' : 'error')
        } else {
          const caseData = await caseResponse.json()
          const componentsData = await componentsResponse.json().catch(() => ({}))

          if (!(caseData.success && caseData.case)) setCaseLoadError('notfound')
          if (caseData.success && caseData.case) {
            setCaseRegion(caseData.case.region_code ?? null)
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
            setWriteUp({
              interpretation: caseData.case.interpretation ?? '',
              assumptions: caseData.case.assumptions ?? '',
              isFinal: !!caseData.case.is_final,
            })
          }
        }
        // Also fetch the parent project to populate the breadcrumb correctly
        try {
          const projRes = await apiRequest(`/api/projects/${projectId}`)
          const projData = await projRes.json()
          if (projData?.success && projData?.project) {
            if (projData.project.project_name) setProjectName(projData.project.project_name)
            if (projData.project.lcia_method) setStudyMethod(projData.project.lcia_method)
            if (projData.project.region_code) setStudyRegion(projData.project.region_code)
          }
        } catch {}
      } catch (error) {
        console.error('Failed to fetch case:', error)
        setCaseLoadError('error')
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
        if (!response.ok) {
          setAssessmentsError(`the server answered ${response.status}`)
        } else {
          setAssessmentsError(null)
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
                regionCode: assessment.region_code ?? undefined,
                goalScope: assessment.goal_scope ?? null,
                dataQuality: assessment.data_quality ?? null,
              }),
            )
            setAssessmentResults(transformedAssessments)
            // The newest run that completed: a failed run has no results.
            setCurrentAssessment(latestCompletedRun(transformedAssessments))
          }
        }
      } catch (error: any) {
        console.error('Failed to fetch assessments:', error)
        setAssessmentsError(error?.message ?? 'the request failed')
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
      regionCode: data.assessment?.region_code ?? undefined,
      goalScope: data.goal_scope ?? null,
      dataQuality: data.data_quality ?? null,
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
  const [exporting, setExporting] = useState<null | 'pdf' | 'pptx' | 'csv'>(null)
  const handleExport = async (format: 'pdf' | 'pptx' | 'csv') => {
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
      const stem = format === 'csv' ? 'LCAPIX_inventory' : 'LCAPIX_Report'
      a.download = `${stem}_${currentCase?.name?.replace(/[^a-zA-Z0-9]/g, '_') ?? runId}.${format}`
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

  // Magic Insights keys its narration request on these props, so they are
  // built once per run / case instead of inline on every render: new arrays
  // on each parent render aborted and re-sent the request (INS-2). Hooks, so
  // they sit above the early returns.
  const numCost = (v: any) => Number(v ?? 0) || 0
  const insightsRun = currentAssessment || latestCompletedRun(assessmentResults)
  const caseComponents = currentCase?.components
  const insightsBreakdown = useMemo(
    () =>
      insightsRun?.componentBreakdown?.map((c) => ({
        component_id: c.component_id,
        component_name: c.component_name,
        impacts: c.impacts.map((i) => ({
          category_name: i.category_name,
          impact_value: i.impact_value,
          unit: i.unit,
        })),
      })),
    [insightsRun],
  )
  // Per-flow impacts, so the insight can name the lever by material
  // (aluminum across six steps), not only by the step that books it.
  const insightsMaterials = useMemo(
    () =>
      (insightsRun?.flowDetail || []).map((f) => ({
        category_name: f.category_name,
        name: f.substance,
        value: Number(f.impact) || 0,
        step: f.component,
        tier: f.source_tier ?? null,
      })),
    [insightsRun],
  )
  // Each step's own cost columns, so the trade-off view sets cost against
  // impact step by step instead of guessing.
  const insightsStepCosts = useMemo(
    () =>
      (caseComponents || []).map((c: any) => ({
        id: String(c.id),
        name: c.name,
        labor: numCost(c.laborCost),
        material: numCost(c.materialCost),
        energy: numCost(c.energyCost),
        other:
          numCost(c.overheadCost) +
          numCost(c.equipmentCost) +
          numCost(c.transportationCost) +
          numCost(c.operationalCostUSD) +
          numCost(c.capitalCostUSD),
      })),
    [caseComponents],
  )

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
            {caseLoadError === 'error' ? 'Could not load this case' : 'Case not found'}
          </h2>
          {caseLoadError === 'error' && (
            <p style={{ color: 'var(--text-tertiary)', fontSize: 13, margin: 0 }}>
              The server did not answer as expected. Try again in a moment.
            </p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => router.back()} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
            </Button>
            {caseLoadError === 'error' && (
              <Button onClick={() => window.location.reload()} variant="outline">
                Try again
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const mostRecentAssessment = insightsRun

  // What a re-run starts from (RUN-5): the displayed run, else the study's
  // method and the case's (then the project's) region. Unknown stays unset so
  // the run modal applies its own lookup instead of a hard-coded US grid.
  const runScope = initialRunScope({
    latestRun: mostRecentAssessment,
    caseRegion,
    projectRegion: studyRegion,
    studyMethod,
  })
  const method = pickedMethod ?? runScope.method ?? 'CML 2001'
  const region = pickedRegion ?? runScope.region ?? 'Global'

  // Real impact entries from the most-recent assessment (preserved).
  const impactEntries: Array<[string, { value: number; unit: string }]> =
    mostRecentAssessment ? Object.entries(mostRecentAssessment.impacts) : []

  // Category items for the chip row + CategoryBarChart. Prefer real data,
  // fall back to the canonical IMPACT_CATEGORIES ordering.
  const coverageByCategory = new Map(
    (mostRecentAssessment?.dataQuality?.category_coverage ?? []).map((c) => [c.category, c]),
  )
  const categoryItems: CategoryBarChartItem[] = impactEntries.length
    ? impactEntries.map(([name, imp]) => {
        const cov = coverageByCategory.get(name)
        return {
          key: name,
          label: name,
          value: imp.value,
          unit: imp.unit,
          coverage:
            cov && cov.covered < cov.total
              ? { covered: cov.covered, total: cov.total, missing: cov.missing_examples }
              : undefined,
        }
      })
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

  // Contributors to the active category (RES-4): credits stay in, ranked by
  // size, each share of the sum of absolute step values.
  const contributors =
    mostRecentAssessment && activeCat
      ? rankContributors(mostRecentAssessment.componentBreakdown || [], activeCat.key)
      : []
  // "No contributors yet" is for a case with no run at all; a run whose steps
  // carry nothing in this category says so differently.
  const usingDemoContributors = !mostRecentAssessment

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
      sourceTier: f.source_tier ?? null,
      source: f.source ?? null,
      allocation: f.allocation ?? null,
    }))
  // The region the displayed run was computed with (not the selector, which
  // only sets the next run), so "Global (fallback)" describes that run.
  const runRegion = mostRecentAssessment?.regionCode ?? region

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
  // Real case cost = the component cost columns (what the case-page Cost summary
  // shows). The assessment RUN has no cost fields, so mostRecentAssessment.costs
  // is always zero — feeding THAT to Magic Insights made it report "no costs"
  // even when the case clearly has them. Sum the real component columns instead.
  const realCaseCost = allComponents.reduce(
    (s: number, c: any) =>
      s +
      numCost(c.laborCost) +
      numCost(c.energyCost) +
      numCost(c.materialCost) +
      numCost(c.overheadCost) +
      numCost(c.equipmentCost) +
      numCost(c.transportationCost) +
      numCost(c.operationalCostUSD) +
      numCost(c.capitalCostUSD),
    0,
  )
  const runDuration = mostRecentAssessment
    ? '—'
    : '—'
  const activeCategoriesCount = impactEntries.length || Object.keys(IMPACT_CATEGORIES).length
  const lastRunLabel = mostRecentAssessment
    ? (isNaN(new Date(mostRecentAssessment.run_date).getTime()) ? 'Recent' : new Date(mostRecentAssessment.run_date).toLocaleString())
    : 'Never'

  const totalImpactDisplay = activeCat ? fmtSig(activeCat.value) : '—'

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
              ) : assessmentsError ? (
                <span style={{ color: 'var(--signal-warn, #b45309)' }}>
                  Could not load this case&apos;s assessments ({assessmentsError}). Reload the page to try
                  again.
                </span>
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
              onChange={(e) => setPickedMethod(e.target.value)}
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
            <HelpTip label="What is an impact-assessment method?">
              The method is the set of characterization factors that turns each input and
              output into impact scores. CML 2001 (Leiden University) is common in Europe;
              TRACI 2.1 is the US EPA method; ReCiPe Midpoint (H) uses the default
              &quot;hierarchist&quot; perspective. Results from different methods cannot be
              added or compared, so keep one method for every case you compare.
            </HelpTip>
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
              onChange={(e) => setPickedRegion(e.target.value)}
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
            <HelpTip label="What does the region change?">{ISO_HELP.region}</HelpTip>
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
            className="btn btn-secondary btn-sm"
            onClick={() => handleExport('csv')}
            disabled={exporting !== null}
            title="Every flow of this run as a spreadsheet row: amount, factor, its source and the impact"
          >
            {exporting === 'csv' ? 'Exporting…' : 'Export rows (CSV)'}
          </button>
          <button
            type="button"
            className={`btn btn-secondary btn-sm ${magicPulse ? 'bell-pulse' : ''}`}
            onClick={() => {
              setMagicPulse(false)
              setMagicOpen(true)
            }}
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
          // Δ vs the previous run with the same method and region (RES-2).
          deltaPct={activeCat ? deltaVsPreviousRun(assessmentResults, activeCat.key) : null}
          methodLabel={mostRecentAssessment?.calculation_method || 'CML 2001'}
          activeCategoriesCount={activeCategoriesCount}
          componentsAssessed={allComponents.length}
          lastRunLabel={lastRunLabel}
        />

        {/* Where a first-time user goes next, in one line. */}
        {mostRecentAssessment && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              padding: '10px 14px',
              marginBottom: 20,
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-raised)',
              fontSize: 12.5,
              color: 'var(--text-secondary)',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Next</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setMagicOpen(true)}
              title="A plain-language read of what drives this result"
            >
              See what drives it
            </button>
            <Link href={`/project/${projectId}/case/${caseId}`} className="btn btn-ghost btn-sm">
              Duplicate and change one thing
            </Link>
            <Link href={`/project/${projectId}/comparison`} className="btn btn-ghost btn-sm">
              Compare cases
            </Link>
            <span style={{ color: 'var(--text-tertiary)' }}>or export the report above.</span>
          </div>
        )}

        {/* ISO 14044: goal & scope, per-functional-unit results, data quality */}
        {mostRecentAssessment && (
          <IsoRunSummary
            goalScope={mostRecentAssessment.goalScope}
            dataQuality={mostRecentAssessment.dataQuality}
            impacts={mostRecentAssessment.impacts}
            editHref={`/project/${projectId}/case/${caseId}`}
          />
        )}

        {/* Where the impact falls across the product's life, and whether the
            study covers the boundary it declares. */}
        {mostRecentAssessment && (() => {
          const headline =
            Object.entries(mostRecentAssessment.impacts).find(([k]) =>
              /global warming|climate/i.test(k),
            ) ?? Object.entries(mostRecentAssessment.impacts)[0]
          if (!headline) return null
          const [categoryName, headlineValue] = headline
          const rows = (mostRecentAssessment.componentBreakdown ?? []).map((c) => ({
            component_name: c.component_name,
            life_cycle_stage: c.life_cycle_stage ?? null,
            value:
              Number(
                (c.impacts ?? []).find((i) => i.category_name === categoryName)?.impact_value ?? 0,
              ) || 0,
            flows: Number(c.flows_processed ?? 0),
          }))
          return (
            <StagePanel
              categoryName={categoryName}
              unit={headlineValue?.unit ?? ''}
              rows={rows}
              boundary={mostRecentAssessment.goalScope?.system_boundary ?? null}
              editHref={`/project/${projectId}/case/${caseId}`}
            />
          )
        })()}

        {/* The part only the author can write; both print in the report. */}
        {mostRecentAssessment && (
          <WriteUpCard
            caseId={caseId}
            initialInterpretation={writeUp.interpretation}
            initialAssumptions={writeUp.assumptions}
            initialFinal={writeUp.isFinal}
          />
        )}

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
            <HelpTip label="How do I read this table?" width={320}>
              {ISO_HELP.flowTable}
            </HelpTip>
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
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/project/${projectId}/case/${caseId}?component=${encodeURIComponent(f.component)}`,
                  )
                }
                title="Edit this component's flows (e.g. remove the CO₂ output to clear the double-count)"
                style={{
                  color: 'var(--brand-primary)',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  font: 'inherit',
                  textDecoration: 'underline',
                  textDecorationStyle: 'dotted',
                  textUnderlineOffset: 2,
                }}
              >
                {f.component}
              </button>
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
                {fmtSig(f.amount)}
              </div>
              <div style={{ color: 'var(--text-tertiary)' }} title={f.conversion || undefined}>
                {f.unit}
                {f.conversion ? ' *' : ''}
              </div>
              <div
                className="mono"
                style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}
                title={
                  f.source
                    ? `Source: ${f.source}${f.sourceTier ? ` (${TIER_LABEL[f.sourceTier] ?? f.sourceTier})` : ''}`
                    : f.sourceTier
                      ? TIER_LABEL[f.sourceTier]
                      : undefined
                }
              >
                {fmtSig(f.factor)}
                {(f.sourceTier === 'unverified' || f.sourceTier === 'unknown') && (
                  <span style={{ color: 'var(--signal-warn)' }}> !</span>
                )}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                {f.scope ? (
                  f.scope === 'Global' && runRegion !== 'Global' ? (
                    <span title="No region-specific factor on file for this substance — the engine fell back to the Global factor. Your region choice was applied where a regional factor exists (e.g. electricity).">
                      Global{' '}
                      <span style={{ color: 'var(--signal-warn)' }}>(fallback)</span>
                    </span>
                  ) : (
                    f.scope
                  )
                ) : (
                  '—'
                )}
              </div>
              <div
                className="mono"
                style={{
                  textAlign: 'right',
                  color: 'var(--brand-primary)',
                  fontWeight: 500,
                }}
              >
                {fmtSig(f.impact)}
                {f.allocation != null && f.allocation < 1 && (
                  <span
                    title={`Allocated: ${Math.round(f.allocation * 100)}% of this process's burden is assigned to the product (ISO 14044 4.3.4)`}
                    style={{ color: 'var(--text-tertiary)', fontSize: 10 }}
                  >
                    {' '}
                    ×{Math.round(f.allocation * 100)}%
                  </span>
                )}
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
                ? `No driver flows contribute to ${activeCat?.label ?? 'this category'}. Add input/output flows on an operation and re-run.`
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
        initialMethod={pickedMethod ?? runScope.method}
        initialRegion={pickedRegion ?? runScope.region}
      />

      <MagicInsightsModal
        open={magicOpen}
        onClose={() => setMagicOpen(false)}
        caseName={currentCase?.name ?? 'this case'}
        method={mostRecentAssessment?.calculation_method ?? 'CML 2001'}
        impacts={mostRecentAssessment?.impacts}
        componentBreakdown={insightsBreakdown}
        materialBreakdown={insightsMaterials}
        totalCost={realCaseCost > 0 ? realCaseCost : undefined}
        stepCosts={insightsStepCosts}
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
  activeCat: CategoryBarChartItem | null
  totalImpactDisplay: string
  flagshipGlow?: boolean
  contributors: Array<{ id: string; name: string; value: number; pct: number }>
  usingDemoContributors?: boolean
  categoryItems: CategoryBarChartItem[]
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
  // Significant figures everywhere (RES-1/RES-6): credits keep their sign and
  // a small non-zero value never prints as 0.00.
  const formatVal = (v: number) => fmtSig(v)
  const formatCatVal = (v?: number) => fmtSig(v)
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
            <HelpTip label="How do I read this number?" width={320}>
              {ISO_HELP.readTotal}
            </HelpTip>
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
            {/* The per-category coverage chips were removed from this screen on
                2026-09-29 at Shreya's call: too much warning for the demo. The
                engine still computes coverage and the data-quality statement
                below still states it in words, which is what the report prints. */}
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
            {contributors.length === 0 && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-tertiary)',
                  marginTop: 4,
                  fontStyle: 'italic',
                }}
              >
                {usingDemoContributors
                  ? 'No contributors yet — run an assessment to see what is driving impact.'
                  : `No step carries ${activeCat?.label ?? 'this category'} in this run.`}
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
            <HelpTip label="What are impact categories?">{ISO_HELP.categoriesOverview}</HelpTip>
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
                  title={impactCategoryHelp(c.label)}
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
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
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
