'use client'

// Data loading and actions for the results screen: the case (with its
// components, write-up and region) and its project, the case's runs, the run
// modal's completion, exports, and the Magic Insights inputs.

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { apiRequest } from '@/lib/api-client'
import { isProjectRole, type ProjectRole } from '@/lib/project-role'
import { transformCaseFromDB } from '@/lib/data-transformers'
import type { Case } from '@/lib/store'
import { useNotificationsStore } from '@/lib/notifications-store'
import { isOlderRun, latestCompletedRun, runToShow } from '@/lib/results/run-math'
import { buildAssessmentResult, toAssessmentResult, type AssessmentResult, type FilterDir } from './assessment'
import { insightsBreakdownOf, insightsMaterialsOf, insightsStepCostsOf } from './insights-inputs'
import { exportFileName } from './results-view'

/**
 * @param requestedRunId the run to show (?run=<id>); the newest completed run
 * when absent, failed or unknown. An older run is shown read-only, exactly as
 * it was frozen when it ran.
 */
export function useResults(projectId: string, caseId: string, requestedRunId?: string | null) {
  // The run the page was asked for; kept in a ref so a refetch honours it.
  const requestedRun = useRef<string | null>(requestedRunId ?? null)
  // Case data
  const [currentCase, setCurrentCase] = useState<Case | null>(null)
  const [projectName, setProjectName] = useState<string>('Project')
  const [isLoadingCase, setIsLoadingCase] = useState(true)
  // RES-5: a failed fetch is an error, not an empty state. 'notfound' only for
  // a 404 (or a body without the case); 'error' for anything else.
  const [caseLoadError, setCaseLoadError] = useState<null | 'notfound' | 'error'>(null)
  const [assessmentsError, setAssessmentsError] = useState<string | null>(null)
  // The project could not be read: a first run would start from defaults
  // instead of the study's method and region, so the header says so.
  const [studyError, setStudyError] = useState<string | null>(null)
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
  // scope a re-run starts from (initialRunScope, RUN-5). Keeping the choice
  // separate also stops every refetch from resetting it.
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
  // The caller's role, sent with the case: a "Can read" member gets no Run or write-up editing.
  const [myRole, setMyRole] = useState<ProjectRole | null>(null)

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
          // The steps give the step count, the case cost and Magic Insights'
          // costs: a failed read is a failed page, not a case with no steps.
          const componentsData = componentsResponse.ok
            ? await componentsResponse.json().catch(() => null)
            : null
          const componentsRead = !!componentsData?.success && Array.isArray(componentsData.components)

          if (!(caseData.success && caseData.case)) setCaseLoadError('notfound')
          else if (!componentsRead) setCaseLoadError('error')
          if (caseData.success && caseData.case && componentsRead) {
            setCaseRegion(caseData.case.region_code ?? null)
            setMyRole(isProjectRole(caseData.case.my_role) ? caseData.case.my_role : null)
            const transformedCase = transformCaseFromDB(caseData.case)

            const { transformComponentFromDB } = await import('@/lib/data-transformers')
            transformedCase.components = componentsData.components.map((c: any) =>
              transformComponentFromDB(c),
            )

            setCurrentCase(transformedCase)
            setWriteUp({
              interpretation: caseData.case.interpretation ?? '',
              assumptions: caseData.case.assumptions ?? '',
              isFinal: !!caseData.case.is_final,
            })
          }
        }
        // The parent project: the breadcrumb, and the study's method and region
        // a first run starts from.
        try {
          const projRes = await apiRequest(`/api/projects/${projectId}`)
          const projData = await projRes.json().catch(() => null)
          if (!projRes.ok || !projData?.success || !projData.project) {
            throw new Error(projData?.error || `the server answered ${projRes.status}`)
          }
          if (projData.project.project_name) setProjectName(projData.project.project_name)
          if (projData.project.lcia_method) setStudyMethod(projData.project.lcia_method)
          if (projData.project.region_code) setStudyRegion(projData.project.region_code)
          setStudyError(null)
        } catch (error: any) {
          setStudyError(String(error?.message || 'the request failed').replace(/\.\s*$/, ''))
        }
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
          const transformedAssessments: AssessmentResult[] = data.assessments.map(toAssessmentResult)
          setAssessmentResults(transformedAssessments)
          // The newest run that completed: a failed run has no results.
          setCurrentAssessment(runToShow(transformedAssessments, requestedRun.current))
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

  // PRESERVED handler — open modal
  const handleRunAssessment = () => setAssessOpen(true)

  // PRESERVED handler — assessment completed
  const handleAssessmentCompleted = (data: any) => {
    try {
      // A new run is the one to read, whatever older run was open.
      requestedRun.current = null
      const result = buildAssessmentResult(data, currentCase?.components)
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

  /** Show an older completed run read-only, or the newest again with null. */
  const viewRun = (runId: number | null) => {
    requestedRun.current = runId == null ? null : String(runId)
    setCurrentAssessment(runToShow(assessmentResults, requestedRun.current))
  }
  const latestRun = latestCompletedRun(assessmentResults)
  const viewingOlderRun = isOlderRun(currentAssessment, assessmentResults)

  // Magic Insights keys its narration request on these props, so they are
  // built once per run / case instead of inline on every render: new arrays
  // on each parent render aborted and re-sent the request (INS-2). Hooks, so
  // they sit above the page's early returns.
  const insightsRun = currentAssessment || latestCompletedRun(assessmentResults)
  const caseComponents = currentCase?.components
  const insightsBreakdown = useMemo(() => insightsBreakdownOf(insightsRun), [insightsRun])
  const insightsMaterials = useMemo(() => insightsMaterialsOf(insightsRun), [insightsRun])
  const insightsStepCosts = useMemo(() => insightsStepCostsOf(caseComponents), [caseComponents])

  // Export the most-recent assessment as a server-generated PDF, PowerPoint
  // deck or CSV. The server route (/api/assessments/{runId}/export) builds the
  // full report; we fetch it with auth and trigger a download. Falls back to
  // window.print() only when there's no completed run to export yet.
  const [exporting, setExporting] = useState<null | 'pdf' | 'pptx' | 'csv'>(null)
  const handleExport = async (format: 'pdf' | 'pptx' | 'csv') => {
    const runId = insightsRun?.run_id
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
      a.download = exportFileName(format, currentCase?.name, runId)
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

  return {
    myRole,
    viewRun,
    latestRun,
    viewingOlderRun,
    currentCase,
    projectName,
    isLoadingCase,
    caseLoadError,
    assessmentsError,
    studyError,
    caseRegion,
    isRunningAssessment,
    assessmentResults,
    assessOpen,
    setAssessOpen,
    magicOpen,
    setMagicOpen,
    flagshipGlow,
    magicPulse,
    setMagicPulse,
    activeCategoryKey,
    setActiveCategoryKey,
    pickedMethod,
    setPickedMethod,
    pickedRegion,
    setPickedRegion,
    flowFilter,
    setFlowFilter,
    writeUp,
    studyMethod,
    studyRegion,
    /** The displayed run: the one just completed, else the newest completed run. */
    mostRecentAssessment: insightsRun,
    insightsBreakdown,
    insightsMaterials,
    insightsStepCosts,
    exporting,
    handleExport,
    handleRunAssessment,
    handleAssessmentCompleted,
  }
}
