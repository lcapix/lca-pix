'use client'

// Data loading for the project workspace (/project/[projectId]): the project
// and its cases, the active case's tree for the MiniCanvas, and the active
// case's latest run + cost columns for the right rail.

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { apiRequest } from '@/lib/api-client'
import { transformProjectFromDB, transformCaseFromDB } from '@/lib/data-transformers'
import { isProjectRole } from '@/lib/project-role'
import { summarizeCaseCosts } from '@/lib/case-tree-adapter'
import type { DemoTreeNode } from '@/lib/lcapix-demo'
import { buildCaseTree, initialTreeSelection } from './case-tree'
import {
  DEFAULT_IMPACT_UNIT,
  completedAssessments,
  summarizeRunResults,
  type CaseCosts,
  type CaseImpact,
} from './case-impact'
import { defaultActiveCaseId } from './workspace'

type Router = { push: (href: string) => void }

/**
 * A GET whose failure is an error, never an empty answer: a non-2xx answer or
 * a body without `success` throws with the route's own message.
 */
async function getOk(path: string): Promise<any> {
  const r = await apiRequest(path)
  const body = await r.json().catch(() => null)
  if (!r.ok || !body?.success) throw new Error(body?.error || `the server answered ${r.status}`)
  return body
}

const reasonOf = (err: unknown) => ((err instanceof Error && err.message) || 'the request failed').replace(/\.\s*$/, '')

/**
 * Loads the project and its cases, and keeps the active case selected (the
 * base case, else the first, until the user picks another). An unknown
 * project or a failed load goes back to /home with a toast.
 */
export function useProjectData(projectId: string, router: Router) {
  const [project, setProject] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null)

  // Preserved fetch — unchanged logic
  useEffect(() => {
    const fetchProjectAndCases = async () => {
      setIsLoading(true)
      try {
        const [projectResponse, casesResponse] = await Promise.all([
          apiRequest(`/api/projects/${projectId}`),
          apiRequest(`/api/projects/${projectId}/cases`),
        ])

        const projectData = await projectResponse.json()
        const casesData = await casesResponse.json()

        if (projectData.success && projectData.project) {
          const transformedProject = transformProjectFromDB(projectData.project)
          const transformedCases =
            casesData.success && casesData.cases
              ? casesData.cases.map(transformCaseFromDB)
              : []

          // myRole: the caller's role, so the page can hide what they cannot do.
          const myRole = isProjectRole(projectData.project.my_role) ? projectData.project.my_role : null
          setProject({ ...transformedProject, cases: transformedCases, myRole })

          if (transformedCases.length > 0) {
            setActiveCaseId((prev) => {
              if (prev) return prev
              return defaultActiveCaseId(transformedCases)
            })
          }
        } else {
          toast.error('Project not found', { description: 'The requested project could not be found.' })
          router.push('/home')
        }
      } catch (error) {
        console.error('Failed to fetch project:', error)
        toast.error('Error loading project', { description: 'Failed to load project details' })
        router.push('/home')
      } finally {
        setIsLoading(false)
      }
    }

    fetchProjectAndCases()
  }, [projectId, router])

  return { project, setProject, isLoading, activeCaseId, setActiveCaseId }
}

/**
 * The active case's component tree for the MiniCanvas, and the selected node.
 * An empty comparative case keeps the base tree only as a reference ghost.
 */
export function useCaseTree(activeCaseId: string | null, project: any) {
  const [selectedTreeNode, setSelectedTreeNode] = useState<DemoTreeNode | null>(null)
  const [caseTree, setCaseTree] = useState<DemoTreeNode | null>(null)
  const [isLoadingCaseTree, setIsLoadingCaseTree] = useState(false)
  const [baseTree, setBaseTree] = useState<DemoTreeNode | null>(null)
  const [isSyncedFromBase, setIsSyncedFromBase] = useState(false)
  // Why the tree could not be read: the panel says so instead of offering to
  // build a case that already has steps.
  const [caseTreeError, setCaseTreeError] = useState<string | null>(null)

  useEffect(() => {
    if (!activeCaseId) {
      setCaseTree(null)
      setIsSyncedFromBase(false)
      // Bug fix: do NOT seed the canvas with the demo "Painted Metal Box"
      // tree. A brand-new project with zero cases used to render a fake
      // Product node with $4,200 cost / 39 flows / 2 sub-components — that
      // came from DEMO_TREE leaking through. Now we show a true empty
      // state until the user creates a case.
      setSelectedTreeNode(null)
      setCaseTreeError(null)
      return
    }
    let cancelled = false
    setIsLoadingCaseTree(true)
    setIsSyncedFromBase(false)
    setCaseTreeError(null)

    const activeCaseObj = project?.cases?.find((c: any) => c.id === activeCaseId)
    const isComp = activeCaseObj?.type === 'comparative'
    const baseCase = project?.cases?.find((c: any) => c.type === 'base')

    getOk(`/api/cases/${activeCaseId}/components`)
      .then(async (data) => {
        if (cancelled) return
        const tree = buildCaseTree(data)
        if (tree) {
          setCaseTree(tree)
          // Never default-select the synthetic multi-root container — pick the
          // first real root so the inspector shows an actual component, not
          // "Case Root".
          setSelectedTreeNode(initialTreeSelection(tree))
          return
        }
        // Empty case: keep base tree available as a *reference ghost* but DO NOT
        // populate the active tree with it — that made comp cases look identical
        // to base. Instead the empty-state UI prompts the user to clone or build.
        if (isComp && baseCase) {
          try {
            const br = await apiRequest(`/api/cases/${baseCase.id}/components`)
            const baseData = await br.json()
            const baseTreeBuilt = buildCaseTree(baseData)
            if (!cancelled && baseTreeBuilt) setBaseTree(baseTreeBuilt)
          } catch {}
        }
        if (!cancelled) {
          setCaseTree(null)
          setSelectedTreeNode(null)
        }
      })
      .catch((err) => {
        if (cancelled) return
        setCaseTree(null)
        setSelectedTreeNode(null)
        setCaseTreeError(reasonOf(err))
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCaseTree(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeCaseId, project])

  return { caseTree, selectedTreeNode, setSelectedTreeNode, isLoadingCaseTree, caseTreeError, baseTree, isSyncedFromBase }
}

/**
 * The active case's latest completed run (focal category, top contributors)
 * and its cost columns, for the right rail. Cleared on every case switch, so
 * the previous case's numbers never show under the new one (PROJ-5). A read
 * that fails is reported (impactError, costsError), never shown as "not yet
 * assessed" or "no cost data".
 */
export function useCaseImpact(activeCaseId: string | null) {
  const [caseImpact, setCaseImpact] = useState<CaseImpact | null>(null)
  const [impactError, setImpactError] = useState<string | null>(null)
  const [costsError, setCostsError] = useState<string | null>(null)

  useEffect(() => {
    // The previous case's numbers must never show under the new one (PROJ-5).
    setCaseImpact(null)
    setImpactError(null)
    setCostsError(null)
    if (!activeCaseId) return
    let cancelled = false
    // Cost summary from REAL component cost columns, never synthesized (the old
    // fallback fabricated a $192/kg-CO2 breakdown; removed). Per unit of
    // product: capex is a one-time investment, so it is not added in. No cost
    // data → null, and the panel shows an honest empty state.
    const loadCosts = async (): Promise<CaseCosts | null> => {
      const cd = await getOk(`/api/cases/${activeCaseId}/components`)
      // DECIMAL strings summed as numbers; opex only where nothing is
      // itemized (PROJ-4).
      return summarizeCaseCosts(cd.components || cd.data || [])
    }
    // The latest completed run, or null when the case has none yet.
    const loadRun = async () => {
      const ad = await getOk(`/api/cases/${activeCaseId}/assessments`)
      const runs = completedAssessments<any>(ad.assessments || [])
      if (!runs.length) return null
      const latest = runs[0]
      const dd = await getOk(`/api/assessments/${latest.run_id}`)
      return { summary: summarizeRunResults(dd.results || []), method: latest.calculation_method ?? null }
    }
    ;(async () => {
      const [run, costs] = await Promise.allSettled([loadRun(), loadCosts()])
      if (cancelled) return
      if (run.status === 'rejected') setImpactError(reasonOf(run.reason))
      if (costs.status === 'rejected') setCostsError(reasonOf(costs.reason))
      const r = run.status === 'fulfilled' ? run.value : null
      setCaseImpact({
        totalImpact: r ? r.summary.total : null,
        unit: r ? r.summary.unit : DEFAULT_IMPACT_UNIT,
        contributors: r ? r.summary.contributors : [],
        impactByComponent: r ? r.summary.impactByComponent : {},
        costs: costs.status === 'fulfilled' ? costs.value : null,
        ...(r ? { method: r.method, categoryCount: r.summary.categoryCount } : {}),
      })
    })()
    return () => {
      cancelled = true
    }
  }, [activeCaseId])

  return { caseImpact, impactError, costsError }
}

/** Everything the project workspace loads, in the order the page always loaded it. */
export function useProject(projectId: string, router: Router) {
  const data = useProjectData(projectId, router)
  const tree = useCaseTree(data.activeCaseId, data.project)
  const impact = useCaseImpact(data.activeCaseId)
  return { ...data, ...tree, ...impact }
}
