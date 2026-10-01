'use client'

// Data loading for the project workspace (/project/[projectId]): the project
// and its cases, the active case's tree for the MiniCanvas, and the active
// case's latest run + cost columns for the right rail.

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { apiRequest } from '@/lib/api-client'
import { transformProjectFromDB, transformCaseFromDB } from '@/lib/data-transformers'
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

          setProject({ ...transformedProject, cases: transformedCases })

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
      return
    }
    let cancelled = false
    setIsLoadingCaseTree(true)
    setIsSyncedFromBase(false)

    const activeCaseObj = project?.cases?.find((c: any) => c.id === activeCaseId)
    const isComp = activeCaseObj?.type === 'comparative'
    const baseCase = project?.cases?.find((c: any) => c.type === 'base')

    apiRequest(`/api/cases/${activeCaseId}/components`)
      .then(async (r) => {
        const data = await r.json()
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
      .catch(() => {
        if (!cancelled) setCaseTree(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCaseTree(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeCaseId, project])

  return { caseTree, selectedTreeNode, setSelectedTreeNode, isLoadingCaseTree, baseTree, isSyncedFromBase }
}

/**
 * The active case's latest completed run (focal category, top contributors)
 * and its cost columns, for the right rail. Cleared on every case switch, so
 * the previous case's numbers never show under the new one (PROJ-5).
 */
export function useCaseImpact(activeCaseId: string | null) {
  const [caseImpact, setCaseImpact] = useState<CaseImpact | null>(null)

  // Fetch real assessment results for the active case so the right rail
  // (Impact Overview / Top contributors / Cost summary) shows actual numbers
  // per-case instead of the hardcoded 126.82 demo value.
  useEffect(() => {
    // The previous case's numbers must never show under the new one (PROJ-5).
    setCaseImpact(null)
    if (!activeCaseId) return
    let cancelled = false
    // Cost summary from REAL component cost columns, never synthesized (the old
    // fallback fabricated a $192/kg-CO2 breakdown; removed). Per unit of
    // product: capex is a one-time investment, so it is not added in. No cost
    // data → null, and the panel shows an honest empty state.
    const loadCosts = async (): Promise<CaseCosts | null> => {
      try {
        const cr = await apiRequest(`/api/cases/${activeCaseId}/components`)
        const cd = await cr.json()
        const comps: any[] = cd?.components || cd?.data || []
        // DECIMAL strings summed as numbers; opex only where nothing is
        // itemized (PROJ-4).
        return summarizeCaseCosts(comps)
      } catch {
        return null
      }
    }
    ;(async () => {
      try {
        const ar = await apiRequest(`/api/cases/${activeCaseId}/assessments`)
        const ad = await ar.json()
        const runs = completedAssessments<any>(ad?.assessments || [])
        if (!runs.length) {
          // No run yet, but the case's cost columns are real data: show them.
          const costs = await loadCosts()
          if (!cancelled)
            setCaseImpact({
              totalImpact: null,
              unit: DEFAULT_IMPACT_UNIT,
              contributors: [],
              impactByComponent: {},
              costs,
            })
          return
        }
        const latest = runs[0]
        const dr = await apiRequest(`/api/assessments/${latest.run_id}`)
        const dd = await dr.json()
        if (cancelled || !dd?.success) return
        const summary = summarizeRunResults(dd.results || [])
        const costs = await loadCosts()
        if (!cancelled) {
          setCaseImpact({
            totalImpact: summary.total,
            unit: summary.unit,
            contributors: summary.contributors,
            impactByComponent: summary.impactByComponent,
            costs,
            method: latest.calculation_method ?? null,
            categoryCount: summary.categoryCount,
          })
        }
      } catch {
        if (!cancelled) setCaseImpact(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeCaseId])

  return caseImpact
}

/** Everything the project workspace loads, in the order the page always loaded it. */
export function useProject(projectId: string, router: Router) {
  const data = useProjectData(projectId, router)
  const tree = useCaseTree(data.activeCaseId, data.project)
  const caseImpact = useCaseImpact(data.activeCaseId)
  return { ...data, ...tree, caseImpact }
}
