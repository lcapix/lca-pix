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
//   add next" strip and the run gate) and past runs (journey phase).
//
// The effects run in this order: listener, project, completeness, runs,
// case + components.

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { apiRequest } from '@/lib/api-client'
import { transformCaseFromDB, transformComponentFromDB } from '@/lib/data-transformers'
import type { Case, ComponentNode } from '@/lib/store'
import { isProjectRole, type ProjectRole } from '@/lib/project-role'
import { completedRuns } from './run-assessment'
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
 * Interpretation). Re-checked on refreshKey.
 */
export function useAssessmentSummary(caseId: string, refreshKey: number) {
  const [hasAssessment, setHasAssessment] = useState(false)
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
      } catch {
        /* advisory — panel falls back to the Inventory phase */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [caseId, refreshKey])
  return { hasAssessment }
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
  const [hasWriteUp, setHasWriteUp] = useState(false)
  // The caller's role in the project, sent with the case (null until known).
  const [myRole, setMyRole] = useState<ProjectRole | null>(null)

  const loadedCaseId = useRef<string | null>(null)
  const componentsSeq = useRef(0)

  /**
   * Fetch the case's components; returns them, or null if a newer fetch won.
   * A failed read throws and leaves the steps on screen as they were: an empty
   * list would blank the canvas as if the case had no steps.
   */
  const reloadComponents = async (signal?: AbortSignal): Promise<ComponentNode[] | null> => {
    const seq = ++componentsSeq.current
    const r = await apiRequest(`/api/cases/${caseId}/components`, signal ? { signal } : undefined)
    const data = await r.json().catch(() => null)
    if (seq !== componentsSeq.current || signal?.aborted) return null
    if (!r.ok || !data?.success || !Array.isArray(data.components)) {
      throw new Error(data?.error || `The steps could not be reloaded (${r.status}).`)
    }
    const list: ComponentNode[] = data.components.map((dbComp: any) => transformComponentFromDB(dbComp))
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
          setHasWriteUp(!!String(caseData.case.interpretation ?? '').trim())
          setMyRole(isProjectRole(caseData.case.my_role) ? caseData.case.my_role : null)
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

  return { currentCase, components, isLoading, hasWriteUp, myRole, reloadComponents }
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
  const { projectName, studyMethod } = useProjectSummary(projectId)
  const completeness = useCaseCompleteness(caseId, refreshKey)
  const { hasAssessment } = useAssessmentSummary(caseId, refreshKey)
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
  }
}
