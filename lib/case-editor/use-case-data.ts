'use client'

// Everything the case editor reads from the server, and when it re-reads it.
//
// - The case and its components: a full-page loader on the first load only.
//   Later refetches (lcapix:components-changed, delete, goal & scope) run in
//   the background with the editor mounted, so calculator and form state
//   survive them (EDIT-6). Every components response carries a sequence
//   number and only the newest one is applied, and the effect aborts its
//   requests when it re-runs, so an older response can never overwrite a
//   newer one.
// - The project's name and LCIA method (breadcrumb, hand-added factors).
// - Advisory reads that follow edits (refreshKey): completeness (the "what to
//   add next" strip and the run gate), past runs (journey phase, top step) and
//   whether a sibling case has been run (lesson 5).
//
// The effects run in this order: listener, sibling runs, project,
// completeness, runs, case + components.

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { apiRequest } from '@/lib/api-client'
import { transformCaseFromDB, transformComponentFromDB } from '@/lib/data-transformers'
import type { Case, ComponentNode } from '@/lib/store'
import { completedRuns, hasRunSibling, topClimateStep } from './run-assessment'
import type { CompletenessReport } from './types'

type Router = { push: (href: string) => void }

/**
 * A counter bumped whenever the component-create/edit modal (or anything
 * else) announces lcapix:components-changed; effects keyed on it re-run so
 * new nodes appear without a full reload.
 */
export function useComponentsChangedKey() {
  const [refreshKey, setRefreshKey] = useState(0)
  useEffect(() => {
    const handler = () => setRefreshKey((k) => k + 1)
    window.addEventListener('lcapix:components-changed', handler)
    return () => window.removeEventListener('lcapix:components-changed', handler)
  }, [])
  const refresh = () => setRefreshKey((k) => k + 1)
  return { refreshKey, refresh }
}

/** A sibling case that has been run is what makes lesson 5 (compare) possible. */
export function useHasComparableCase(projectId: string, caseId: string, refreshKey: number) {
  const [hasComparableCase, setHasComparableCase] = useState(false)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await apiRequest(`/api/projects/${projectId}/cases`)
        const d = await r.json().catch(() => ({}))
        const comparable = hasRunSibling(d?.cases, caseId)
        if (!cancelled) setHasComparableCase(comparable)
      } catch {
        /* advisory only */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId, caseId, refreshKey])
  return hasComparableCase
}

/** The project's name (for the breadcrumb) and LCIA method, fetched once. */
export function useProjectSummary(projectId: string) {
  const [projectName, setProjectName] = useState<string>('')
  const [studyMethod, setStudyMethod] = useState<string | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await apiRequest(`/api/projects/${projectId}`)
        const d = await r.json()
        if (!cancelled && d?.success) {
          setProjectName(d.project?.project_name ?? '')
          setStudyMethod(d.project?.lcia_method ?? undefined)
        }
      } catch {
        // breadcrumb falls back to 'Project'
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])
  return { projectName, studyMethod }
}

/**
 * Which data layers the case has. Drives the "what to add next" strip and
 * gates Run Assessment; re-read on refreshKey so it tracks live edits.
 */
export function useCaseCompleteness(caseId: string, refreshKey: number) {
  const [completeness, setCompleteness] = useState<CompletenessReport | null>(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await apiRequest(`/api/cases/${caseId}/completeness`)
        const d = await r.json()
        if (!cancelled && d?.success) setCompleteness(d.report ?? null)
      } catch {
        // completeness is advisory; a failure just hides the strip
      }
    })()
    return () => {
      cancelled = true
    }
  }, [caseId, refreshKey])
  return completeness
}

/**
 * Has this case been assessed yet (moves the journey from Inventory to
 * Interpretation), and which step carried the most climate impact in the
 * newest run. Re-checked on refreshKey.
 */
export function useAssessmentSummary(caseId: string, refreshKey: number) {
  const [hasAssessment, setHasAssessment] = useState(false)
  const [topStep, setTopStep] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await apiRequest(`/api/cases/${caseId}/assessments`)
        const d = await r.json()
        // A run that produced no results (nothing to characterize) does not
        // count as assessed.
        const runs = completedRuns(d?.assessments)
        if (!cancelled) setHasAssessment(runs.length > 0)

        // Which step actually carried the most climate impact, for the reveal
        // after a prediction. Newest run, headline category.
        const top = topClimateStep(runs[0])
        if (top !== undefined && !cancelled) setTopStep(top)
      } catch {
        /* advisory — panel falls back to the Inventory phase */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [caseId, refreshKey])
  return { hasAssessment, topStep }
}

/** The case and its components (see the file comment for the refetch rules). */
export function useCaseAndComponents({
  projectId,
  caseId,
  router,
  refreshKey,
}: {
  projectId: string
  caseId: string
  router: Router
  refreshKey: number
}) {
  const [currentCase, setCurrentCase] = useState<Case | null>(null)
  const [components, setComponents] = useState<ComponentNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  // Lessons: progress lives on the case, so an instructor sees it next to the
  // model the student built.
  const [learningState, setLearningState] = useState<unknown>(null)
  const [hasWriteUp, setHasWriteUp] = useState(false)

  const loadedCaseId = useRef<string | null>(null)
  const componentsSeq = useRef(0)

  /** Fetch the case's components; returns them, or null if a newer fetch won. */
  const reloadComponents = async (signal?: AbortSignal): Promise<ComponentNode[] | null> => {
    const seq = ++componentsSeq.current
    const r = await apiRequest(`/api/cases/${caseId}/components`, signal ? { signal } : undefined)
    const data = await r.json()
    if (seq !== componentsSeq.current || signal?.aborted) return null
    const list: ComponentNode[] =
      data?.success && Array.isArray(data.components)
        ? data.components.map((dbComp: any) => transformComponentFromDB(dbComp))
        : []
    setComponents(list)
    return list
  }

  useEffect(() => {
    const controller = new AbortController()
    const firstLoad = loadedCaseId.current !== caseId
    const fetchCaseData = async () => {
      if (firstLoad) setIsLoading(true)
      try {
        const [caseResponse, list] = await Promise.all([
          apiRequest(`/api/cases/${caseId}`, { signal: controller.signal }),
          reloadComponents(controller.signal),
        ])
        const caseData = await caseResponse.json()
        if (controller.signal.aborted) return

        if (caseData.success && caseData.case) {
          const transformedCase = transformCaseFromDB(caseData.case)
          setCurrentCase((prev) => ({
            ...transformedCase,
            components: list ?? prev?.components ?? [],
          }))
          setLearningState(caseData.case.learning_state ?? null)
          setHasWriteUp(!!String(caseData.case.interpretation ?? '').trim())
          loadedCaseId.current = caseId
        } else {
          toast.error('Case not found')
          router.push(`/project/${projectId}`)
        }
      } catch (error: any) {
        if (controller.signal.aborted || error?.name === 'AbortError') return
        console.error('Failed to fetch case:', error)
        if (firstLoad) {
          toast.error('Failed to load case details')
          router.push(`/project/${projectId}`)
        } else {
          // A failed background refresh keeps what is on screen.
          toast.error('Could not refresh the case. What you see may be out of date.')
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    fetchCaseData()
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, projectId, router, refreshKey])

  return { currentCase, components, isLoading, learningState, hasWriteUp, reloadComponents }
}

/** All of the above, wired to one refresh key. */
export function useCaseData({
  projectId,
  caseId,
  router,
}: {
  projectId: string
  caseId: string
  router: Router
}) {
  const { refreshKey, refresh } = useComponentsChangedKey()
  const hasComparableCase = useHasComparableCase(projectId, caseId, refreshKey)
  const { projectName, studyMethod } = useProjectSummary(projectId)
  const completeness = useCaseCompleteness(caseId, refreshKey)
  const { hasAssessment, topStep } = useAssessmentSummary(caseId, refreshKey)
  const caseState = useCaseAndComponents({ projectId, caseId, router, refreshKey })
  return {
    ...caseState,
    refreshKey,
    /** Background refetch of the tree, completeness and journey. */
    refresh,
    projectName,
    studyMethod,
    completeness,
    hasAssessment,
    topStep,
    hasComparableCase,
  }
}
