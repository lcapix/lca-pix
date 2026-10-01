'use client'

// Data loading and actions of the analytics page: cases → assessments → run
// details → categories/components, plus each case's component costs. The
// fetch sequence is preserved verbatim from the Phase 8 Veridian page.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api-client'
import { transformCaseFromDB } from '@/lib/data-transformers'
import { analyticsImpacts } from '@/components/lcapix/results/analytics-impacts'
import { EMPTY_COSTS } from './constants'
import { costRowsFromResponse, sumComponentCosts } from './costs'
import { analyticsCsvFilename, buildAnalyticsCsvRows, toCsvContent } from './csv'
import { gwpTotalScore } from './derive'
import {
  classifyLoadError,
  filterCompletedRuns,
  noCompletedAssessmentsMessage,
  pickCasesToFetch,
} from './load'
import type { AssessmentData, CostBreakdown } from './types'

/** Everything the analytics page reads from {@link useAnalytics}. */
export interface UseAnalyticsResult {
  /** One entry per loaded case with a completed run. */
  assessmentData: AssessmentData[]
  /** The cases picked for loading (transformed DB rows). */
  cases: any[]
  /** Project name for the breadcrumb and title; '' until loaded. */
  projectName: string
  isLoading: boolean
  /** True when there is no token or the session expired. */
  authError: boolean
  errorMessage: string
  /** Reloads cases and assessments (the "Try again" button). */
  refetch: () => Promise<void>
  /** Prints the page (PDF export). */
  handleExportPDF: () => void
  /** Downloads the category results as CSV. */
  handleExportCSV: () => void
  /** Navigates to the project page. */
  goToProject: () => void
  /** Navigates to the login page. */
  goToLogin: () => void
}

/**
 * Loads the analytics of one project: on mount (and when `projectId` changes)
 * the project name, then the case picked by `filterCaseId` (else the base or
 * first case) with its latest completed run and component costs.
 */
export function useAnalytics(
  projectId: string,
  filterCaseId: string | null,
): UseAnalyticsResult {
  const router = useRouter()

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
      const picked = pickCasesToFetch<any>(transformedCases, filterCaseId)
      if ('error' in picked) {
        setErrorMessage(picked.error)
        setIsLoading(false)
        return
      }
      const casesToFetch: any[] = picked.cases

      setCases(casesToFetch)

      const dataPromises = casesToFetch.map(async (caseItem: any) => {
        try {
          const assessmentsRes = await apiRequest(
            `/api/cases/${caseItem.id}/assessments`
          )
          const assessmentsData = await assessmentsRes.json()
          if (!assessmentsData.success || !assessmentsData.assessments?.length)
            return null

          const completedAssessments = filterCompletedRuns<any>(
            assessmentsData.assessments
          )
          if (!completedAssessments.length) return null

          const latestRun = completedAssessments[0]
          const detailRes = await apiRequest(`/api/assessments/${latestRun.run_id}`)
          const detailData = await detailRes.json()
          if (!detailData.success) return null

          // Impacts keep their sign (ANA-1): a net credit is part of the
          // result, not a burden.
          const { categories, components } = analyticsImpacts(detailData)
          // The headline is the climate-change result. Impacts in different
          // units (kg CO2e, kg SO2e, kg Sb eq) cannot be added into one score
          // (ISO 14044 4.4); each category is compared on its own below.
          const totalScore = gwpTotalScore(categories)

          // Cost analysis — aggregate per-component costs for this case. LCAPIX's
          // whole point is cost ↔ impact together, so analytics must show cost
          // too, not just impact-by-category. Best-effort: an empty/failed fetch
          // just yields zeroed costs rather than breaking the page.
          const costs: CostBreakdown = { ...EMPTY_COSTS }
          try {
            const compRes = await apiRequest(`/api/cases/${caseItem.id}/components`)
            const compData = await compRes.json()
            const rows: any[] = costRowsFromResponse(compData)
            sumComponentCosts(rows, costs)
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
        setErrorMessage(noCompletedAssessmentsMessage(transformedCases.length))
      }
      setAssessmentData(validResults)
    } catch (error) {
      const { authError: isAuthError, message } = classifyLoadError(error)
      if (isAuthError) setAuthError(true)
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportPDF = () => {
    window.print()
  }

  const handleExportCSV = () => {
    const csvRows = buildAnalyticsCsvRows(assessmentData)
    const csvContent = toCsvContent(csvRows)
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = analyticsCsvFilename(new Date())
    a.click()
  }

  const goToProject = () => router.push(`/project/${projectId}`)

  const goToLogin = () => router.push('/auth/login')

  return {
    assessmentData,
    cases,
    projectName,
    isLoading,
    authError,
    errorMessage,
    refetch: fetchCasesAndAssessments,
    handleExportPDF,
    handleExportCSV,
    goToProject,
    goToLogin,
  }
}
