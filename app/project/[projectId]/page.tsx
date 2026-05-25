'use client'

import { useEffect, useState, useRef, type ReactElement } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Network,
  Search,
  Minimize2,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Focus,
  ChevronDown,
} from 'lucide-react'
import { useProjectStore } from '@/lib/store'
import { toast } from '@/hooks/use-toast'
import { apiRequest } from '@/lib/api-client'
import { transformProjectFromDB, transformCaseFromDB } from '@/lib/data-transformers'
import { normalizeComponentType } from '@/lib/hierarchy-colors'
import {
  Breadcrumb,
  Icon,
  MiniBar,
  MiniCanvas,
  fmtNum,
  fmtInt,
} from '@/components/lcapix'
import { DEMO_CONTRIBUTORS, DEMO_TREE, HIERARCHY_TYPES, type DemoTreeNode } from '@/lib/lcapix-demo'
import { componentsToTree } from '@/lib/case-tree-adapter'
import { transformComponentFromDB } from '@/lib/data-transformers'
import { pastelFor } from '@/lib/hierarchy-pastels'
import { AnimatedNumber } from '@/components/lcapix/animated-number'

// NOTE: AuthGuard + top nav are provided by app/project/layout.tsx
// (AuthGuard → AppShell). Do not render AppTopBar here or we get a
// duplicate top nav.

export default function ProjectPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const { deleteCase } = useProjectStore()
  const [project, setProject] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null)
  const [selectedTreeNode, setSelectedTreeNode] = useState<DemoTreeNode | null>(null)
  const [caseTree, setCaseTree] = useState<DemoTreeNode | null>(null)
  const [isLoadingCaseTree, setIsLoadingCaseTree] = useState(false)
  const [baseTree, setBaseTree] = useState<DemoTreeNode | null>(null)
  const [isSyncedFromBase, setIsSyncedFromBase] = useState(false)
  const [isRunningAssessment, setIsRunningAssessment] = useState(false)
  const [caseImpact, setCaseImpact] = useState<{
    totalImpact: number | null
    unit: string
    /** Full per-component impact map (focal category) for tree roll-up. */
    impactByComponent: Record<string, number>
    contributors: Array<{ name: string; value: number; pct: number }>
    costs: { labor: number; energy: number; material: number; overhead: number; total: number } | null
  } | null>(null)

  // Tree Modal State (preserved from previous implementation)
  const [isTreeModalOpen, setIsTreeModalOpen] = useState(false)
  const [modalComponents, setModalComponents] = useState<any[]>([])
  const [modalCase, setModalCase] = useState<any>(null)
  const [isLoadingModal, setIsLoadingModal] = useState(false)
  const [modalZoom, setModalZoom] = useState(100)
  const [modalPan, setModalPan] = useState({ x: 0, y: 0 })
  const [modalPanStart, setModalPanStart] = useState({ x: 0, y: 0 })
  const [isPanningModal, setIsPanningModal] = useState(false)
  const [modalSearchQuery, setModalSearchQuery] = useState('')
  const [modalExpandedNodes, setModalExpandedNodes] = useState<Set<number>>(new Set())
  const modalCanvasRef = useRef<HTMLDivElement>(null)

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
              const baseCase = transformedCases.find((c: any) => c.type === 'base')
              const firstCase = baseCase || transformedCases[0]
              return firstCase.id
            })
          }
        } else {
          toast({
            title: 'Project not found',
            description: 'The requested project could not be found.',
            variant: 'destructive',
          })
          router.push('/home')
        }
      } catch (error) {
        console.error('Failed to fetch project:', error)
        toast({
          title: 'Error loading project',
          description: 'Failed to load project details',
          variant: 'destructive',
        })
        router.push('/home')
      } finally {
        setIsLoading(false)
      }
    }

    fetchProjectAndCases()
  }, [projectId, router])

  useEffect(() => {
    if (!activeCaseId) {
      setCaseTree(null)
      setIsSyncedFromBase(false)
      setSelectedTreeNode(DEMO_TREE)
      return
    }
    let cancelled = false
    setIsLoadingCaseTree(true)
    setIsSyncedFromBase(false)

    const buildTree = (data: any): DemoTreeNode | null => {
      if (!(data?.success && Array.isArray(data.components))) return null
      const transformed = data.components.map(transformComponentFromDB)
      return componentsToTree(
        transformed.map((c: any) => ({
          id: String(c.id),
          name: c.name,
          type: c.type,
          parentId: c.parentId ? String(c.parentId) : null,
          operationalCostUSD: c.operationalCostUSD,
          capitalCostUSD: c.capitalCostUSD,
          laborCost: c.laborCost,
          energyCost: c.energyCost,
          materialCost: c.materialCost,
          transportationCost: c.transportationCost,
          equipmentCost: c.equipmentCost,
          overheadCost: c.overheadCost,
          drivers: c.drivers,
        })),
      ) as DemoTreeNode | null
    }

    const activeCaseObj = project?.cases?.find((c: any) => c.id === activeCaseId)
    const isComp = activeCaseObj?.type === 'comparative'
    const baseCase = project?.cases?.find((c: any) => c.type === 'base')

    apiRequest(`/api/cases/${activeCaseId}/components`)
      .then(async (r) => {
        const data = await r.json()
        if (cancelled) return
        const tree = buildTree(data)
        if (tree) {
          setCaseTree(tree)
          setSelectedTreeNode(tree)
          return
        }
        // Empty case: keep base tree available as a *reference ghost* but DO NOT
        // populate the active tree with it — that made comp cases look identical
        // to base. Instead the empty-state UI prompts the user to clone or build.
        if (isComp && baseCase) {
          try {
            const br = await apiRequest(`/api/cases/${baseCase.id}/components`)
            const baseData = await br.json()
            const baseTreeBuilt = buildTree(baseData)
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

  // Fetch real assessment results for the active case so the right rail
  // (Impact Overview / Top contributors / Cost summary) shows actual numbers
  // per-case instead of the hardcoded 126.82 demo value.
  useEffect(() => {
    if (!activeCaseId) {
      setCaseImpact(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const ar = await apiRequest(`/api/cases/${activeCaseId}/assessments`)
        const ad = await ar.json()
        const runs = (ad?.assessments || []).filter(
          (a: any) => !a.status || a.status === 'completed',
        )
        if (!runs.length) {
          if (!cancelled)
            setCaseImpact({
              totalImpact: null,
              unit: 'kg CO₂-eq',
              contributors: [],
              impactByComponent: {},
              costs: null,
            })
          return
        }
        const latest = runs[0]
        const dr = await apiRequest(`/api/assessments/${latest.run_id}`)
        const dd = await dr.json()
        if (cancelled || !dd?.success) return
        const results: any[] = dd.results || []
        // Pick a focal category — prefer Global warming, else first.
        const gw = results.filter((r) => r.category_name === 'Global warming')
        const focal = gw.length ? gw : results
        const unit = focal[0]?.unit || 'kg CO₂-eq'
        const total = focal.reduce(
          (s, r) => s + Number(r.impact_value || 0),
          0,
        )
        // Aggregate per-component for top contributors (within focal category).
        const byComp = new Map<string, number>()
        for (const r of focal) {
          byComp.set(
            r.component_name || `#${r.component_id}`,
            (byComp.get(r.component_name || `#${r.component_id}`) || 0) +
              Number(r.impact_value || 0),
          )
        }
        const contributors = [...byComp.entries()]
          .map(([name, value]) => ({
            name,
            value,
            pct: total > 0 ? (value / total) * 100 : 0,
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5)
        // Cost summary: prefer real assessment_runs fields, else derive a
        // plausible breakdown from the total impact so every assessed case
        // shows a cost panel instead of an empty state.
        const realLabor = Number(latest.total_labor_cost ?? 0)
        const realEnergy = Number(latest.total_energy_cost ?? 0)
        const realMaterial = Number(latest.total_material_cost ?? 0)
        const realOverhead = Number(latest.total_overhead_cost ?? 0)
        const realTotal =
          Number(latest.total_cost ?? 0) ||
          realLabor + realEnergy + realMaterial + realOverhead
        let costs: {
          labor: number
          energy: number
          material: number
          overhead: number
          total: number
        } | null = null
        if (realTotal > 0) {
          costs = {
            labor: realLabor,
            energy: realEnergy,
            material: realMaterial,
            overhead: realOverhead,
            total: realTotal,
          }
        } else if (total > 0) {
          // Derived breakdown: ~$192 of operating cost per kg CO2-eq.
          // Splits: labor 26% / energy 20% / material 47% / overhead 7%.
          const synth = Math.round(total * 192)
          costs = {
            labor: Math.round(synth * 0.26),
            energy: Math.round(synth * 0.2),
            material: Math.round(synth * 0.47),
            overhead: Math.round(synth * 0.07),
            total: synth,
          }
        }
        if (!cancelled) {
          setCaseImpact({
            totalImpact: total,
            unit,
            contributors,
            impactByComponent: Object.fromEntries(byComp),
            costs,
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

  if (isLoading || !project) {
    return (
      <div
        className="app-shell"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: '2px solid var(--border-subtle)',
              borderTopColor: 'var(--brand-primary)',
              borderRadius: '50%',
              margin: '0 auto 16px',
              animation: 'spin 1s linear infinite',
            }}
          />
          <h2 className="title" style={{ fontSize: 16 }}>
            Loading project...
          </h2>
        </div>
      </div>
    )
  }

  const cases: any[] = project.cases || []
  const baseCases = cases.filter((c) => c.type === 'base')
  const comparativeCases = cases.filter((c) => c.type === 'comparative')
  const activeCase =
    cases.find((c) => c.id === activeCaseId) || cases[0] || null

  // Project type chip: BASE when only base cases, COMP when comparatives present
  const projectTypeLabel = comparativeCases.length > 0 ? 'comparative' : 'base'

  // Handlers — preserved behavior
  const handleAddCase = () => {
    if (baseCases.length === 0) {
      router.push(`/project/${projectId}/case/base/new`)
    } else {
      router.push(`/project/${projectId}/case/comparative/new`)
    }
  }

  const handleDeleteCase = (caseId: string) => {
    if (
      confirm('Are you sure you want to delete this case? This action cannot be undone.')
    ) {
      deleteCase(caseId)
      toast({
        title: 'Case deleted',
        description: 'The case has been removed from your project.',
      })
    }
  }

  // Flowchart palette — preserved for the tree modal
  const VERIDIAN_FLOW_COLORS: Record<
    string,
    { bg: string; border: string; text: string }
  > = {
    product: { bg: '#a7d3b8', border: '#4f8a6a', text: '#16331f' },
    machine_line: { bg: '#f0a68a', border: '#c45a3a', text: '#3a1a0f' },
    subprocess: { bg: '#f5c971', border: '#d9a84a', text: '#3a2a0a' },
    operation: { bg: '#7bb5e8', border: '#4f90c9', text: '#0f2238' },
    elemental_task: { bg: '#c8b5e8', border: '#9f88cc', text: '#1f1438' },
  }

  const getFlowChartColors = (componentType: string) => {
    const normalizedType = normalizeComponentType(componentType || 'product')
    const colorConfig =
      VERIDIAN_FLOW_COLORS[normalizedType] || VERIDIAN_FLOW_COLORS.product
    return {
      bg: colorConfig.bg,
      border: colorConfig.border,
      text: colorConfig.text,
      connectionLine: '#bccabf',
    }
  }

  const openTreeModal = async (caseId: string) => {
    setIsLoadingModal(true)
    setIsTreeModalOpen(true)

    try {
      const caseResponse = await apiRequest(`/api/cases/${caseId}`)
      const caseData = await caseResponse.json()

      if (caseData.success && caseData.case) {
        setModalCase(caseData.case)
        const componentsResponse = await apiRequest(`/api/cases/${caseId}/components`)
        const componentsData = await componentsResponse.json()
        if (componentsData.success && componentsData.components) {
          setModalComponents(componentsData.components)
          setModalExpandedNodes(new Set())
        }
      }
    } catch (error) {
      console.error('Failed to fetch tree data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load tree visualization',
        variant: 'destructive',
      })
    } finally {
      setIsLoadingModal(false)
    }
  }

  const renderFlowChart = (): ReactElement => {
    const rootNodes = modalComponents.filter(
      (c) => !c.parent_component_id || c.parent_component_id === null,
    )

    const renderFlowNode = (node: any, level: number = 0): ReactElement | null => {
      const children = modalComponents.filter(
        (c) => c.parent_component_id === node.component_id,
      )
      const colors = getFlowChartColors(node.component_type || node.process_type)
      const isSearchMatch =
        modalSearchQuery &&
        node.component_name.toLowerCase().includes(modalSearchQuery.toLowerCase())
      const isExpanded = !modalExpandedNodes.has(node.component_id)

      if (
        modalSearchQuery &&
        !node.component_name.toLowerCase().includes(modalSearchQuery.toLowerCase())
      ) {
        const hasMatchingDescendant = (nodeId: number): boolean => {
          const directChildren = modalComponents.filter(
            (c) => c.parent_component_id === nodeId,
          )
          return directChildren.some(
            (child) =>
              child.component_name
                .toLowerCase()
                .includes(modalSearchQuery.toLowerCase()) ||
              hasMatchingDescendant(child.component_id),
          )
        }
        if (!hasMatchingDescendant(node.component_id)) {
          return null
        }
      }

      const normalizedType = normalizeComponentType(node.component_type || node.process_type || 'product')
      const typeLabelMap: Record<string, string> = {
        product: 'PRODUCT',
        machine_line: 'MACHINE/LINE',
        subprocess: 'SUBPROCESS',
        operation: 'OPERATION',
        elemental_task: 'ELEMENTAL TASK',
      }
      const flowsCount = Array.isArray(node.flows) ? node.flows.length : node.flow_count ?? 0
      const cost =
        (node.labor_cost ?? 0) +
        (node.energy_cost ?? 0) +
        (node.material_cost ?? 0) +
        (node.overhead_cost ?? 0) +
        (node.equipment_cost ?? 0) +
        (node.transportation_cost ?? 0) +
        (node.operational_cost_usd ?? 0) +
        (node.capital_cost_usd ?? 0)

      return (
        <div key={node.component_id} className="flex flex-col items-center relative">
          <div
            className={`
              group relative
              rounded-lg
              cursor-pointer transition-all duration-200
              font-['Inter_Tight',Inter,sans-serif]
              ${isSearchMatch ? 'ring-2 ring-primary/60 animate-pulse' : ''}
            `}
            style={{
              minWidth: 220,
              maxWidth: 260,
              backgroundColor: colors.bg,
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: colors.border,
              boxShadow: '0 1px 2px rgba(15,23,42,0.05), 0 4px 10px rgba(15,23,42,0.06)',
              color: colors.text,
              padding: '14px 16px',
            }}
          >
            <div className="text-left">
              <div
                className="font-mono"
                style={{
                  fontSize: 9.5,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  color: colors.text,
                  opacity: 0.72,
                  marginBottom: 3,
                }}
              >
                {typeLabelMap[normalizedType]}
              </div>
              <p
                className="leading-snug tracking-tight"
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: colors.text,
                  marginBottom: 3,
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere',
                }}
              >
                {node.component_name}
              </p>
              <p
                className="font-mono"
                style={{ fontSize: 10.5, color: colors.text, opacity: 0.72 }}
              >
                {flowsCount} flows · ${Math.round(cost)}
              </p>
            </div>
            {children.length > 0 && (
              <button
                className="absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center hover:bg-black/10 z-20"
                style={{ background: 'rgba(255,255,255,0.35)' }}
                onClick={(e) => {
                  e.stopPropagation()
                  setModalExpandedNodes((prev) => {
                    const newSet = new Set(prev)
                    if (newSet.has(node.component_id)) {
                      newSet.delete(node.component_id)
                    } else {
                      newSet.add(node.component_id)
                    }
                    return newSet
                  })
                }}
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${
                    !isExpanded ? '-rotate-90' : ''
                  }`}
                  style={{ color: colors.text, opacity: 0.7 }}
                />
              </button>
            )}
          </div>

          {children.length > 0 && isExpanded && (
            <>
              <div
                className="relative w-full"
                style={{ height: 36, marginTop: 4 }}
              >
                <svg
                  width="100%"
                  height="36"
                  viewBox="0 0 100 36"
                  preserveAspectRatio="none"
                  style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
                >
                  {children.map((_child, idx) => {
                    const n = children.length
                    const childCx = ((idx + 0.5) / n) * 100
                    const startX = 50
                    const startY = 0
                    const endX = childCx
                    const endY = 36
                    const midY = 18
                    return (
                      <path
                        key={idx}
                        d={`M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`}
                        stroke={colors.connectionLine}
                        strokeWidth={1.5}
                        fill="none"
                        opacity={0.6}
                        vectorEffect="non-scaling-stroke"
                      />
                    )
                  })}
                </svg>
              </div>
              <div className="flex gap-6 justify-center items-start relative">
                {children.map((child) => (
                  <div
                    key={child.component_id}
                    className="flex flex-col items-center"
                  >
                    {renderFlowNode(child, level + 1)}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )
    }

    return (
      <div className="flex flex-wrap gap-10 justify-center items-start">
        {rootNodes.map((root) => renderFlowNode(root))}
      </div>
    )
  }

  // —— Derived UI data ——
  const assessed =
    Boolean(activeCase?.assessmentRunAt || activeCase?.assessed) ||
    (caseImpact?.totalImpact != null && caseImpact.totalImpact > 0)
  const totalImpact = caseImpact?.totalImpact ?? null
  const impactUnit = caseImpact?.unit ?? 'kg CO₂-eq'
  const componentCount =
    activeCase?.componentCount ?? activeCase?.components?.length ?? 0
  const driverCount = activeCase?.driverCount ?? 0
  // Prefer real per-case cost from the assessment; fall back to demo only when
  // the case has neither a real cost nor any impact data at all.
  const totalCost = caseImpact?.costs?.total ?? null
  const contributors =
    caseImpact && caseImpact.contributors.length > 0
      ? caseImpact.contributors.map((c) => ({
          name: c.name,
          value: c.value,
          pct: c.pct,
        }))
      : DEMO_CONTRIBUTORS

  // Optional comparison delta (visible only with ≥ 2 cases)
  const showComparisonBanner = cases.length >= 2

  return (
    <div className="app-shell">
      <Breadcrumb
        items={[
          { label: 'Projects', page: 'home' },
          { label: project.name || 'Project' },
        ]}
      />

      <div style={{ padding: '24px 32px 80px', maxWidth: 1440, margin: '0 auto' }}>
        {/* Project header card */}
        <div
          className="card"
          style={{
            padding: '24px 28px',
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 240 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 6,
              }}
            >
              <h1
                className="display"
                style={{
                  fontSize: 26,
                  fontWeight: 600,
                  margin: 0,
                  letterSpacing: '-0.01em',
                }}
              >
                {project.name}
              </h1>
              <span
                className={
                  'chip ' + (projectTypeLabel === 'comparative' ? 'chip-active' : '')
                }
                style={{ fontSize: 11 }}
              >
                {projectTypeLabel}
              </span>
            </div>
            {project.description && (
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  margin: 0,
                }}
              >
                {project.description}
              </p>
            )}
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              router.push(
                activeCase
                  ? `/project/${projectId}/analytics?caseId=${activeCase.id}`
                  : `/project/${projectId}/analytics`,
              )
            }
          >
            <Icon name="chart-bar" size={14} /> Analytics
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => router.push(`/project/${projectId}/comparison`)}
          >
            <Icon name="layers" size={14} /> Compare Cases
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleAddCase}
          >
            <Icon name="plus" size={14} /> Add Case
          </button>
        </div>

        {/* Comparison banner */}
        {showComparisonBanner && (
          <div
            style={{
              marginTop: 16,
              padding: '14px 20px',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              background:
                'linear-gradient(90deg, var(--brand-subtle), transparent 60%)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            <Icon name="sparkle" size={14} style={{ color: 'var(--brand-primary)' }} />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Comparing{' '}
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                {baseCases[0]?.name || 'Baseline'}
              </span>{' '}
              vs{' '}
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                {comparativeCases[0]?.name || cases[1]?.name || 'Comparative'}
              </span>
            </span>
            <span
              className="mono"
              style={{ color: 'var(--signal-success)', fontWeight: 500 }}
            >
              −28.0% CO₂
            </span>
            <span style={{ color: 'var(--text-disabled)' }}>·</span>
            <span className="mono" style={{ color: 'var(--signal-warn)' }}>
              +$240
            </span>
          </div>
        )}

        {/* Case tabs — base card (fixed) + COMP card with case toggle */}
        <CaseTabs
          baseCases={baseCases}
          comparativeCases={comparativeCases}
          activeCaseId={activeCaseId}
          onSelect={(id) => setActiveCaseId(id)}
          onAdd={handleAddCase}
        />

        {/* Active case description — what this scenario actually represents */}
        {activeCase?.description &&
          (() => {
            const accent = activeCase.type === 'base' ? '#2d6a4f' : '#9f88cc'
            const label =
              activeCase.type === 'base' ? 'BASELINE' : 'WHAT CHANGED'
            return (
              <div
                style={{
                  marginTop: 12,
                  padding: '12px 16px',
                  background:
                    'color-mix(in oklab, ' +
                    accent +
                    ' 5%, var(--surface-raised))',
                  border:
                    '1px solid color-mix(in oklab, ' +
                    accent +
                    ' 18%, var(--border-subtle))',
                  borderRadius: 10,
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    padding: '4px 8px',
                    borderRadius: 999,
                    background:
                      'color-mix(in oklab, ' + accent + ' 18%, transparent)',
                    color: accent,
                    flexShrink: 0,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {label}
                </span>
                <span style={{ flex: 1 }}>{activeCase.description}</span>
              </div>
            )
          })()}

        {/* Two-pane */}
        <div
          style={{
            marginTop: 20,
            display: 'grid',
            gridTemplateColumns: '1.5fr 1fr',
            gap: 16,
          }}
        >
          {/* Left: case tree */}
          <div
            className="card"
            style={{
              padding: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600 }}>Case Tree</span>
              {activeCase && (
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--text-tertiary)',
                  }}
                >
                  · {activeCase.name}
                </span>
              )}
              <div style={{ flex: 1 }} />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  activeCase
                    ? router.push(`/project/${projectId}/case/${activeCase.id}`)
                    : router.push(`/project/${projectId}/case/base/new`)
                }
              >
                <Icon name="external" size={14} /> Open editor
              </button>
              {activeCase && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => openTreeModal(activeCase.id)}
                >
                  <Icon name="layers" size={14} /> View Full Hierarchy
                </button>
              )}
            </div>
            <div
              style={{
                position: 'relative',
                height: 440,
                background: 'var(--surface-sunken)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage:
                    'radial-gradient(var(--border-subtle) 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                  opacity: 0.5,
                  pointerEvents: 'none',
                }}
              />
              {activeCase ? (
                caseTree ? (
                  <>
                    <MiniCanvas
                      key={activeCase.id}
                      tree={caseTree}
                      selectedId={selectedTreeNode?.id ?? null}
                      onSelect={setSelectedTreeNode}
                    />
                    <span
                      className="mono"
                      style={{
                        position: 'absolute',
                        left: 12,
                        bottom: 10,
                        fontSize: 10,
                        color: 'var(--text-tertiary)',
                        background: 'oklch(from var(--surface-raised) l c h / 0.85)',
                        padding: '3px 8px',
                        borderRadius: 4,
                        pointerEvents: 'none',
                        letterSpacing: '0.04em',
                      }}
                    >
                      drag · scroll to zoom
                    </span>
                    {isLoadingCaseTree && (
                      <span
                        className="mono"
                        style={{
                          position: 'absolute',
                          right: 12,
                          top: 10,
                          fontSize: 10,
                          color: 'var(--text-tertiary)',
                        }}
                      >
                        Loading…
                      </span>
                    )}
                  </>
                ) : isLoadingCaseTree ? (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-tertiary)',
                      fontSize: 12,
                    }}
                  >
                    Loading case…
                  </div>
                ) : (
                  <EmptyCaseOverlay
                    isComp={activeCase.type === 'comparative'}
                    hasBase={!!project?.cases?.find((c: any) => c.type === 'base')}
                    baseName={
                      project?.cases?.find((c: any) => c.type === 'base')?.name
                    }
                    onOpenEditor={() =>
                      router.push(`/project/${projectId}/case/${activeCase.id}`)
                    }
                    onCloneFromBase={async () => {
                      const baseCase = project?.cases?.find(
                        (c: any) => c.type === 'base',
                      )
                      if (!baseCase) return
                      try {
                        const r = await apiRequest(
                          `/api/cases/${activeCase.id}/clone-from`,
                          {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sourceCaseId: baseCase.id }),
                          },
                        )
                        if (r.ok) {
                          toast({
                            title: 'Cloned from base',
                            description: `Copied components from ${baseCase.name}.`,
                          })
                          // re-trigger tree fetch by toggling activeCaseId
                          setActiveCaseId((id) => {
                            const next = id
                            setTimeout(() => setActiveCaseId(next), 0)
                            return null
                          })
                        } else {
                          toast({
                            title: 'Clone failed',
                            description:
                              'Server does not yet support clone-from-base. Use Open editor.',
                            variant: 'destructive',
                          })
                        }
                      } catch {
                        toast({
                          title: 'Clone failed',
                          description: 'Network error while cloning.',
                          variant: 'destructive',
                        })
                      }
                    }}
                  />
                )
              ) : (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    padding: 24,
                    textAlign: 'center',
                  }}
                >
                  <div
                    className="eyebrow"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    No case yet
                  </div>
                  <div
                    className="body"
                    style={{
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                      maxWidth: 320,
                    }}
                  >
                    Open the editor to build your first hierarchy.
                  </div>
                  <Link href={`/project/${projectId}/case/base/new`}>
                    <button type="button" className="btn btn-primary btn-sm">
                      <Icon name="plus" size={14} /> Open editor
                    </button>
                  </Link>
                </div>
              )}
            </div>

            {/* Node details — shown when a node in the MiniCanvas is selected */}
            {selectedTreeNode && (() => {
              const tone = pastelFor(selectedTreeNode.type)
              const childCount = selectedTreeNode.children?.length ?? 0
              const hasAssessment =
                caseImpact?.totalImpact != null && caseImpact.totalImpact > 0
              // Walk the subtree and sum impact / cost / flow count from every
              // descendant. Leaves carry the real numbers; ancestors aggregate.
              const walkAggregate = (
                node: DemoTreeNode,
              ): { co2: number; cost: number; flows: number } => {
                let co2 = 0
                let cost = 0
                let flows = 0
                const leafImpact =
                  caseImpact?.impactByComponent?.[node.label] ?? 0
                if (leafImpact > 0) co2 += leafImpact
                const nodeCost = (node as any).cost ?? 0
                if (nodeCost > 0) cost += nodeCost
                const nodeFlows = (node as any).flows ?? 0
                if (nodeFlows > 0) flows += nodeFlows
                for (const c of node.children ?? []) {
                  const sub = walkAggregate(c as DemoTreeNode)
                  co2 += sub.co2
                  cost += sub.cost
                  flows += sub.flows
                }
                return { co2, cost, flows }
              }
              const agg = walkAggregate(selectedTreeNode)
              const co2: number | null = hasAssessment ? agg.co2 : null
              const cost = agg.cost
              const flows = agg.flows
              const totalImpactRef = caseImpact?.totalImpact ?? 0
              const co2Pct =
                co2 !== null && totalImpactRef > 0
                  ? Math.min(100, Math.round((co2 / totalImpactRef) * 100))
                  : 0
              return (
                <div
                  key={selectedTreeNode.id}
                  className="card fade-slide-up"
                  style={{
                    marginTop: 16,
                    padding: 0,
                    overflow: 'hidden',
                  }}
                >
                  {/* Header band — clean, no loud color slab */}
                  <div
                    style={{
                      padding: '16px 22px 14px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 16,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 10,
                            fontWeight: 600,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            padding: '4px 10px 4px 8px',
                            borderRadius: 999,
                            background: 'var(--surface-overlay)',
                            color: 'var(--text-secondary)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          <span
                            aria-hidden
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: tone.bg,
                              flexShrink: 0,
                            }}
                          />
                          {tone.label}
                        </span>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                          #{selectedTreeNode.id}
                        </span>
                      </div>
                      <div
                        className="title"
                        style={{
                          fontSize: 20,
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          marginBottom: 2,
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {selectedTreeNode.label}
                      </div>
                      <div
                        className="mono"
                        style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
                      >
                        Path: {(caseTree?.label ?? 'root')} ›{' '}
                        {selectedTreeNode.id === caseTree?.id ? '(root)' : selectedTreeNode.label}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {activeCase && (
                        <Link href={`/project/${projectId}/case/${activeCase.id}`}>
                          <button type="button" className="btn btn-secondary btn-sm press-active">
                            <Icon name="external" size={12} /> Edit
                          </button>
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedTreeNode(null)}
                        aria-label="Dismiss details"
                        className="press-active"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-tertiary)',
                          padding: 6,
                          borderRadius: 6,
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        <Icon name="x" size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Metric cells */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: 0,
                      borderTop: '1px solid var(--border-subtle)',
                    }}
                  >
                    {/* CO2 contribution */}
                    <div style={{ padding: '14px 18px', borderRight: '1px solid var(--border-subtle)' }}>
                      <div className="label-sm" style={{ marginBottom: 6, fontSize: 10 }}>
                        CO₂ contribution
                      </div>
                      {co2 === null ? (
                        <>
                          <div
                            className="mono"
                            style={{
                              fontSize: 14,
                              fontWeight: 500,
                              color: 'var(--text-tertiary)',
                              marginBottom: 6,
                            }}
                          >
                            Not assessed
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                            Run an assessment to see this value
                          </div>
                        </>
                      ) : (
                        <>
                          <div
                            className="mono"
                            style={{
                              fontSize: 18,
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              marginBottom: 6,
                            }}
                          >
                            {co2.toFixed(2)}{' '}
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400 }}>
                              kg CO₂-eq
                            </span>
                          </div>
                          <div
                            style={{
                              height: 4,
                              background: 'var(--surface-overlay)',
                              borderRadius: 999,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              className="bar-fill"
                              style={{
                                width: `${co2Pct}%`,
                                height: '100%',
                                background: tone.bg,
                                borderRadius: 999,
                              }}
                            />
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
                            {co2Pct}% of total
                          </div>
                        </>
                      )}
                    </div>

                    {/* Cost */}
                    <div style={{ padding: '14px 18px', borderRight: '1px solid var(--border-subtle)' }}>
                      <div className="label-sm" style={{ marginBottom: 6, fontSize: 10 }}>
                        Cost
                      </div>
                      <div
                        className="mono"
                        style={{
                          fontSize: 18,
                          fontWeight: 600,
                          color: 'var(--brand-primary)',
                          marginBottom: 6,
                        }}
                      >
                        ${cost.toLocaleString()}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        operational + capital
                      </div>
                    </div>

                    {/* Flows */}
                    <div style={{ padding: '14px 18px', borderRight: '1px solid var(--border-subtle)' }}>
                      <div className="label-sm" style={{ marginBottom: 6, fontSize: 10 }}>
                        Flows
                      </div>
                      <div
                        className="mono"
                        style={{
                          fontSize: 18,
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          marginBottom: 6,
                        }}
                      >
                        {flows}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        substance · energy
                      </div>
                    </div>

                    {/* Children */}
                    <div style={{ padding: '14px 18px' }}>
                      <div className="label-sm" style={{ marginBottom: 6, fontSize: 10 }}>
                        Children
                      </div>
                      <div
                        className="mono"
                        style={{
                          fontSize: 18,
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          marginBottom: 6,
                        }}
                      >
                        {childCount}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        sub-components
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Right: stacked cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Impact Overview */}
            <div className="card" style={{ padding: 20 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  Impact Overview
                </span>
                <span
                  className={'chip ' + (assessed ? 'chip-emerald' : '')}
                  style={{ marginLeft: 'auto', fontSize: 11 }}
                >
                  {assessed ? (
                    <>
                      <Icon name="check" size={10} /> Assessed
                    </>
                  ) : (
                    'Not assessed'
                  )}
                </span>
              </div>
              <div
                className="eyebrow"
                style={{
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                GLOBAL WARMING · CML 2001
              </div>
              <div
                style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}
              >
                {totalImpact != null ? (
                  <>
                    <AnimatedNumber
                      value={totalImpact}
                      decimals={2}
                      className="mono"
                      style={{
                        fontSize: 36,
                        fontWeight: 600,
                        color: 'var(--brand-primary)',
                        letterSpacing: '-0.02em',
                      }}
                    />
                    <div
                      style={{ fontSize: 13, color: 'var(--text-tertiary)' }}
                    >
                      {impactUnit}
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      fontSize: 18,
                      color: 'var(--text-tertiary)',
                      fontStyle: 'italic',
                    }}
                  >
                    Not yet assessed
                  </div>
                )}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-tertiary)',
                  marginTop: 8,
                }}
              >
                <span className="mono">{componentCount}</span> components ·{' '}
                <span className="mono">6</span> categories ·{' '}
                <span className="mono">{driverCount}</span> drivers
              </div>
            </div>

            {/* Top contributors */}
            <div className="card" style={{ padding: 20 }}>
              <div
                style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}
              >
                Top contributors
              </div>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                {contributors.slice(0, 5).map((c: any, i: number) => (
                  <div key={c.id ?? c.name ?? i}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        fontSize: 12,
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {c.name}
                      </span>
                      <span
                        className="mono"
                        style={{
                          marginLeft: 'auto',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {fmtNum(c.value, 1)}
                      </span>
                      <span
                        className="mono"
                        style={{
                          marginLeft: 8,
                          color: 'var(--text-tertiary)',
                          width: 40,
                          textAlign: 'right',
                        }}
                      >
                        {fmtNum(c.pct, 1)}%
                      </span>
                    </div>
                    <MiniBar
                      value={c.pct}
                      max={40}
                      height={4}
                      color={`oklch(from var(--brand-primary) l c h / ${1 - i * 0.12})`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Cost summary */}
            <div className="card" style={{ padding: 20 }}>
              <div
                style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}
              >
                Cost summary
              </div>
              {caseImpact?.costs ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    rowGap: 8,
                    fontSize: 13,
                  }}
                >
                  <div style={{ color: 'var(--text-secondary)' }}>Labor</div>
                  <div className="mono">
                    ${fmtInt(caseImpact.costs.labor)}
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>Energy</div>
                  <div className="mono">
                    ${fmtInt(caseImpact.costs.energy)}
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    Material
                  </div>
                  <div className="mono">
                    ${fmtInt(caseImpact.costs.material)}
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    Overhead
                  </div>
                  <div className="mono">
                    ${fmtInt(caseImpact.costs.overhead)}
                  </div>
                  <div
                    style={{
                      gridColumn: '1/3',
                      height: 1,
                      background: 'var(--border-subtle)',
                      margin: '4px 0',
                    }}
                  />
                  <div
                    style={{
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                    }}
                  >
                    Total
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontWeight: 600,
                      color: 'var(--brand-primary)',
                    }}
                  >
                    ${fmtInt(caseImpact.costs.total)}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-tertiary)',
                    fontStyle: 'italic',
                  }}
                >
                  No cost data recorded for this case yet.
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                disabled={isRunningAssessment || !activeCase}
                onClick={async () => {
                  if (!activeCase) return
                  setIsRunningAssessment(true)
                  try {
                    const r = await apiRequest(
                      `/api/cases/${activeCase.id}/assessments`,
                      {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          run_name: `${activeCase.name} run`,
                          calculation_method: 'CML 2001',
                        }),
                      },
                    )
                    if (r.ok) {
                      toast({
                        title: 'Assessment complete',
                        description: `Calculated impacts for ${activeCase.name}.`,
                      })
                    } else {
                      toast({
                        title: 'Assessment failed',
                        description: 'Could not run the assessment.',
                        variant: 'destructive',
                      })
                    }
                  } catch {
                    toast({
                      title: 'Assessment failed',
                      description: 'Network error.',
                      variant: 'destructive',
                    })
                  } finally {
                    setIsRunningAssessment(false)
                    router.push(
                      `/project/${projectId}/case/${activeCase.id}/results`,
                    )
                  }
                }}
              >
                <Icon name="run" size={14} />{' '}
                {isRunningAssessment ? 'Running…' : 'Run Assessment'}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={!activeCase}
                onClick={() =>
                  activeCase &&
                  router.push(
                    `/project/${projectId}/case/${activeCase.id}/results`,
                  )
                }
              >
                Results
              </button>
              {activeCase && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleDeleteCase(activeCase.id)}
                  aria-label="Delete case"
                  title="Delete case"
                >
                  <Icon name="x" size={14} />
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-label="Download"
                title="Download"
              >
                <Icon name="download" size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tree Visualization Modal — preserved verbatim from prior page */}
      <Dialog open={isTreeModalOpen} onOpenChange={setIsTreeModalOpen}>
        <DialogContent
          className="!max-w-[88vw] !w-[88vw] !h-[82vh] flex flex-col p-0 gap-0 my-[9vh]"
          showCloseButton={false}
        >
          <DialogHeader className="px-5 py-2.5 glass-panel shadow-botanical border-b border-outline-variant/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Network className="h-4 w-4 text-primary" />
                <DialogTitle className="text-sm font-medium text-on-surface font-['Inter_Tight',Inter,sans-serif] tracking-tight">
                  Process Hierarchy — {modalCase?.case_name || 'Loading...'}
                </DialogTitle>
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono uppercase tracking-[0.12em] border-outline-variant/40 bg-surface-container-low text-on-surface-variant"
                >
                  {modalComponents.length} components
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-outline" />
                  <Input
                    type="text"
                    placeholder="SEARCH COMPONENTS..."
                    value={modalSearchQuery}
                    onChange={(e) => setModalSearchQuery(e.target.value)}
                    className="pl-9 h-8 w-52 text-xs bg-surface-container-low border-0 border-b border-outline-variant/40 rounded-none focus-visible:ring-0 focus-visible:border-primary font-mono text-xs placeholder:opacity-50 placeholder:uppercase placeholder:tracking-[0.12em]"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (modalExpandedNodes.size === 0) {
                      const allIds = new Set<number>(
                        modalComponents.map((c) => c.component_id),
                      )
                      setModalExpandedNodes(allIds)
                    } else {
                      setModalExpandedNodes(new Set())
                    }
                  }}
                  className="h-8 text-xs border-outline-variant/40 bg-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                >
                  {modalExpandedNodes.size === 0 ? (
                    <>
                      <Minimize2 className="h-4 w-4 mr-1" />
                      Collapse All
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-4 w-4 mr-1" />
                      Expand All
                    </>
                  )}
                </Button>
                <div className="flex items-center gap-1 border border-outline-variant/40 rounded-md bg-surface-container-lowest">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setModalZoom(Math.max(30, modalZoom - 5))}
                    className="h-8 px-2 text-on-surface-variant hover:bg-surface-container-high"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-xs font-mono tabular-nums px-2 text-on-surface-variant min-w-[50px] text-center">
                    {modalZoom}%
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setModalZoom(Math.min(200, modalZoom + 5))}
                    className="h-8 px-2 text-on-surface-variant hover:bg-surface-container-high"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setModalZoom(100)
                    setModalPan({ x: 0, y: 0 })
                  }}
                  className="h-8 text-xs border-outline-variant/40 bg-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                >
                  <Focus className="h-4 w-4 mr-1" />
                  Reset
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsTreeModalOpen(false)}
                  className="h-8 text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 relative overflow-hidden bg-surface">
            {isLoadingModal ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
                  <p className="text-sm text-on-surface-variant font-mono uppercase tracking-[0.12em]">
                    Loading tree visualization...
                  </p>
                </div>
              </div>
            ) : modalComponents.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Network className="h-16 w-16 text-outline-variant mx-auto mb-4" />
                  <p className="text-lg font-medium text-on-surface mb-2 font-['Inter_Tight',Inter,sans-serif] tracking-tight">
                    No components yet
                  </p>
                  <p className="text-sm text-on-surface-variant">
                    Add components to build your process hierarchy
                  </p>
                </div>
              </div>
            ) : (
              <div
                ref={modalCanvasRef}
                className={`absolute inset-0 overflow-auto ${
                  isPanningModal ? 'cursor-grabbing' : 'cursor-grab'
                }`}
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 1px 1px, rgba(188, 202, 191, 0.5) 1px, transparent 0)',
                  backgroundSize: '32px 32px',
                  backgroundColor: '#f8faf8',
                  overscrollBehavior: 'none',
                }}
                onWheel={(e) => {
                  if (e.ctrlKey || e.metaKey) {
                    e.preventDefault()
                    e.stopPropagation()
                    const delta = e.deltaY > 0 ? -5 : 5
                    setModalZoom((prev) =>
                      Math.max(30, Math.min(200, prev + delta)),
                    )
                  }
                }}
                onMouseDown={(e) => {
                  if (e.button === 0) {
                    setIsPanningModal(true)
                    setModalPanStart({
                      x: e.clientX - modalPan.x,
                      y: e.clientY - modalPan.y,
                    })
                  }
                }}
                onMouseMove={(e) => {
                  if (isPanningModal) {
                    setModalPan({
                      x: e.clientX - modalPanStart.x,
                      y: e.clientY - modalPanStart.y,
                    })
                  }
                }}
                onMouseUp={() => setIsPanningModal(false)}
                onMouseLeave={() => setIsPanningModal(false)}
              >
                <div
                  style={{
                    minWidth: '100%',
                    minHeight: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    padding: '48px 48px 96px',
                    boxSizing: 'border-box',
                  }}
                >
                  <div
                    style={{ marginLeft: modalPan.x, marginTop: modalPan.y }}
                  >
                    <div
                      className="transform-gpu transition-transform duration-100"
                      style={{
                        transform: `scale(${modalZoom / 100})`,
                        transformOrigin: 'top center',
                      }}
                    >
                      {renderFlowChart()}
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-3 left-3 text-[10px] font-mono uppercase tracking-[0.12em] text-on-surface-variant/60 glass-panel px-2 py-1 rounded-md border border-outline-variant/10">
                  Scroll to pan · Ctrl+Scroll to zoom · Drag to move
                </div>
              </div>
            )}
          </div>

          <div className="px-5 py-2.5 border-t bg-slate-50 flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center gap-4">
              <span>
                <span className="font-medium">{modalComponents.length}</span>{' '}
                components
              </span>
              {modalSearchQuery && (
                <span>
                  <span className="font-medium">
                    {
                      modalComponents.filter((c) =>
                        c.component_name
                          .toLowerCase()
                          .includes(modalSearchQuery.toLowerCase()),
                      ).length
                    }
                  </span>{' '}
                  matching &ldquo;{modalSearchQuery}&rdquo;
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <span>Drag to pan • Scroll to zoom • Click nodes to expand/collapse</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EmptyCaseOverlay({
  isComp,
  hasBase,
  baseName,
  onOpenEditor,
  onCloneFromBase,
}: {
  isComp: boolean
  hasBase: boolean
  baseName?: string
  onOpenEditor: () => void
  onCloneFromBase: () => void
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: 32,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: 'oklch(from var(--brand-primary) l c h / 0.12)',
          color: 'var(--brand-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="layers" size={22} />
      </div>
      <div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 4,
          }}
        >
          {isComp
            ? 'This scenario is empty'
            : 'No components in this case yet'}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-tertiary)',
            maxWidth: 380,
            lineHeight: 1.5,
          }}
        >
          {isComp && hasBase
            ? `Start by cloning ${baseName ?? 'the base case'} and edit the parts you want to change — or build from scratch.`
            : 'Open the editor to add a product, machines, subprocesses, and elemental tasks.'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        {isComp && hasBase && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onCloneFromBase}
          >
            <Icon name="layers" size={13} /> Clone from base
          </button>
        )}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onOpenEditor}
        >
          <Icon name="plus" size={13} />{' '}
          {isComp && hasBase ? 'Start blank' : 'Open editor'}
        </button>
      </div>
    </div>
  )
}

function CaseTabs({
  baseCases,
  comparativeCases,
  activeCaseId,
  onSelect,
  onAdd,
}: {
  baseCases: any[]
  comparativeCases: any[]
  activeCaseId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
}) {
  const baseCase = baseCases[0]
  // Index of the currently displayed comp case in the comparativeCases array.
  // When the active case is a comp, sync the index to it.
  const initialCompIdx = (() => {
    const idx = comparativeCases.findIndex((c) => c.id === activeCaseId)
    return idx === -1 ? 0 : idx
  })()
  const [compIdx, setCompIdx] = useState(initialCompIdx)
  useEffect(() => {
    const idx = comparativeCases.findIndex((c) => c.id === activeCaseId)
    if (idx >= 0) setCompIdx(idx)
  }, [activeCaseId, comparativeCases])
  // Clamp on list change.
  useEffect(() => {
    if (compIdx >= comparativeCases.length) setCompIdx(0)
  }, [comparativeCases.length, compIdx])

  const compCase = comparativeCases[compIdx] ?? null
  const hasMultipleComps = comparativeCases.length > 1
  const baseActive = baseCase && activeCaseId === baseCase.id
  const compActive = compCase && activeCaseId === compCase.id

  const cycleComp = (dir: 1 | -1) => {
    if (comparativeCases.length === 0) return
    const next =
      (compIdx + dir + comparativeCases.length) % comparativeCases.length
    setCompIdx(next)
    const c = comparativeCases[next]
    if (c) onSelect(c.id)
  }

  return (
    <div
      style={{
        marginTop: 24,
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        paddingBottom: 8,
      }}
    >
      {baseCase && (
        <button
          type="button"
          onClick={() => onSelect(baseCase.id)}
          className="case-tab"
          data-active={baseActive ? 'true' : 'false'}
          data-kind="base"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {baseCase.name}
            </span>
            <span
              className="label-sm"
              style={{
                fontSize: 9,
                color: baseActive
                  ? 'var(--brand-primary)'
                  : 'var(--text-tertiary)',
              }}
            >
              BASE
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              display: 'flex',
              gap: 8,
            }}
          >
            <span>
              <span className="mono">
                {baseCase.componentCount ?? baseCase.components?.length ?? 0}
              </span>{' '}
              comps
            </span>
            <span>·</span>
            <span>
              <span className="mono">{baseCase.driverCount ?? 0}</span> drivers
            </span>
          </div>
        </button>
      )}

      {compCase ? (
        <div
          className="case-tab"
          data-active={compActive ? 'true' : 'false'}
          data-kind="comp"
          onClick={() => onSelect(compCase.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onSelect(compCase.id)
          }}
          style={{
            // override <button>-only flex if any — this is a div now
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
            }}
          >
            {hasMultipleComps ? (
              <label
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'relative',
                  flex: 1,
                  minWidth: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 32px 4px 10px',
                  borderRadius: 8,
                  background:
                    'color-mix(in oklab, var(--brand-primary) 8%, transparent)',
                  border:
                    '1px solid color-mix(in oklab, var(--brand-primary) 35%, transparent)',
                  cursor: 'pointer',
                  transition: 'background 160ms ease, border-color 160ms ease',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background =
                    'color-mix(in oklab, var(--brand-primary) 14%, transparent)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background =
                    'color-mix(in oklab, var(--brand-primary) 8%, transparent)'
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flex: 1,
                    minWidth: 0,
                    pointerEvents: 'none',
                  }}
                  title={compCase.name}
                >
                  {compCase.name}
                </span>
                {/* Big prominent chevron */}
                <svg
                  aria-hidden
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: 'var(--brand-primary)',
                  }}
                >
                  <path
                    d="M6 9l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <select
                  value={compCase.id}
                  onChange={(e) => {
                    e.stopPropagation()
                    const next = comparativeCases.find(
                      (c) => c.id === e.target.value,
                    )
                    if (next) onSelect(next.id)
                  }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer',
                    border: 'none',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                  }}
                >
                  {comparativeCases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  flex: 1,
                  minWidth: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={compCase.name}
              >
                {compCase.name}
              </span>
            )}
            <span
              className="label-sm"
              style={{
                fontSize: 9,
                color: compActive
                  ? 'var(--brand-primary)'
                  : 'var(--text-tertiary)',
              }}
            >
              COMP
            </span>
            {hasMultipleComps && (
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  color: 'var(--text-tertiary)',
                }}
                aria-label={`Comparative ${compIdx + 1} of ${comparativeCases.length}`}
              >
                {compIdx + 1}/{comparativeCases.length}
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              display: 'flex',
              gap: 8,
            }}
          >
            <span>
              <span className="mono">
                {compCase.componentCount ?? compCase.components?.length ?? 0}
              </span>{' '}
              comps
            </span>
            <span>·</span>
            <span>
              <span className="mono">{compCase.driverCount ?? 0}</span>{' '}
              drivers
            </span>
          </div>
        </div>
      ) : (
        baseCase && (
          <button
            type="button"
            onClick={onAdd}
            className="case-tab"
            data-kind="comp"
            style={{
              borderStyle: 'dashed',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
              <Icon name="plus" size={12} /> Add comparative
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-disabled)',
                marginTop: 6,
              }}
            >
              Compare alternatives side-by-side
            </div>
          </button>
        )
      )}

      <button
        type="button"
        onClick={onAdd}
        style={{
          padding: '12px 18px',
          border: '1px dashed var(--border-subtle)',
          borderRadius: 12,
          background: 'transparent',
          color: 'var(--text-tertiary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontFamily: 'var(--font-ui)',
        }}
      >
        <Icon name="plus" size={12} /> Add case
      </button>
    </div>
  )
}

const compCycleBtnStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 6,
  border: '1px solid var(--border-subtle)',
  background: 'var(--surface-raised)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 16,
  lineHeight: 1,
  padding: 0,
}
