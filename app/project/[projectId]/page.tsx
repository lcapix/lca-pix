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
    product: { bg: '#f0a68a', border: '#d98568', text: '#3a1a0f' },
    machine_line: { bg: '#f0a68a', border: '#d98568', text: '#3a1a0f' },
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

      return (
        <div key={node.component_id} className="flex flex-col items-center relative">
          <div
            className={`
              group relative
              rounded-lg shadow-botanical hover:shadow-botanical-hover
              px-6 py-4 min-w-[180px] max-w-[240px]
              cursor-pointer transition-all duration-200
              scale-[0.8] origin-top
              hover:scale-[0.82]
              font-['Inter_Tight',Inter,sans-serif]
              ${isSearchMatch ? 'ring-2 ring-primary/60 animate-pulse' : ''}
            `}
            style={{
              backgroundColor: colors.bg,
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: `${colors.border}4D`,
              color: colors.text,
            }}
          >
            <div className="text-center">
              <p className="font-semibold text-base leading-snug tracking-tight">
                {node.component_name}
              </p>
            </div>
            {children.length > 0 && (
              <button
                className="absolute -bottom-3 left-1/2 -translate-x-1/2 h-6 w-6 bg-surface-container-lowest border border-outline-variant/40 rounded-full shadow-botanical flex items-center justify-center hover:bg-surface-container-high z-20"
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
              >
                <ChevronDown
                  className={`h-4 w-4 text-on-surface-variant transition-transform ${
                    !isExpanded ? '-rotate-90' : ''
                  }`}
                />
              </button>
            )}
          </div>

          {children.length > 0 && isExpanded && (
            <>
              <div
                className="w-0.5 h-6 mt-3"
                style={{ backgroundColor: colors.connectionLine }}
              />
              <div className="flex gap-6 justify-center items-start relative">
                {children.length > 1 && (
                  <div
                    className="absolute top-0 h-0.5"
                    style={{
                      backgroundColor: colors.connectionLine,
                      left: `calc(100% / ${children.length} / 2)`,
                      right: `calc(100% / ${children.length} / 2)`,
                    }}
                  />
                )}
                {children.map((child) => (
                  <div
                    key={child.component_id}
                    className="flex flex-col items-center"
                  >
                    <div
                      className="w-0.5 h-6"
                      style={{ backgroundColor: colors.connectionLine }}
                    />
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
  const contributors = DEMO_CONTRIBUTORS // fallback; real contributors would come from assessment results
  const assessed = Boolean(activeCase?.assessmentRunAt || activeCase?.assessed)
  const totalImpact =
    activeCase?.totalImpact ?? activeCase?.impactResults?.global_warming ?? 126.82
  const impactUnit = activeCase?.impactUnit ?? 'kg CO₂-eq'
  const componentCount =
    activeCase?.componentCount ?? activeCase?.components?.length ?? 0
  const driverCount = activeCase?.driverCount ?? 0
  const totalCost = activeCase?.totalCost ?? 8420

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
            onClick={() => router.push(`/project/${projectId}/comparisons`)}
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
            <div style={{ flex: 1 }} />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => router.push(`/project/${projectId}/comparisons`)}
            >
              Open Full Comparison <Icon name="arrow-right" size={12} />
            </button>
          </div>
        )}

        {/* Case tabs */}
        <div
          style={{
            marginTop: 24,
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            paddingBottom: 8,
          }}
        >
          {cases.map((c) => {
            const active = activeCaseId === c.id
            const kind = c.type === 'base' ? 'BASE' : 'COMP'
            const compCount = c.componentCount ?? c.components?.length ?? 0
            const drvCount = c.driverCount ?? 0
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCaseId(c.id)}
                style={{
                  padding: '14px 20px',
                  borderRadius: 10,
                  border: 'none',
                  background: active ? 'var(--surface-raised)' : 'transparent',
                  boxShadow: active
                    ? 'inset 0 0 0 1.5px var(--primary), 0 4px 16px -8px var(--brand-glow)'
                    : 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-ui)',
                  minWidth: 240,
                  flex: '0 0 auto',
                }}
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
                    {c.name}
                  </span>
                  <span
                    className="label-sm"
                    style={{
                      fontSize: 9,
                      color: active ? 'var(--primary)' : 'var(--text-tertiary)',
                    }}
                  >
                    {kind}
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
                    <span className="mono">{compCount}</span> comps
                  </span>
                  <span>·</span>
                  <span>
                    <span className="mono">{drvCount}</span> drivers
                  </span>
                </div>
              </button>
            )
          })}
          <button
            type="button"
            onClick={handleAddCase}
            style={{
              padding: '12px 18px',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 8,
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
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600 }}>Case Tree</span>
              {activeCase && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 12,
                    color: 'var(--text-tertiary)',
                  }}
                >
                  · {activeCase.name}
                </span>
              )}
              <div style={{ flex: 1 }} />
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                  marginRight: 12,
                }}
              >
                drag · scroll to zoom
              </span>
              {activeCase && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginRight: 8 }}
                  onClick={() => openTreeModal(activeCase.id)}
                >
                  <Icon name="layers" size={14} /> View Full Hierarchy
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  activeCase
                    ? router.push(`/project/${projectId}/case/${activeCase.id}`)
                    : router.push(`/project/${projectId}/case/base/new`)
                }
              >
                <Icon name="external" size={14} /> Open editor
              </button>
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
                <MiniCanvas
                  tree={DEMO_TREE}
                  selectedId={selectedTreeNode?.id ?? null}
                  onSelect={setSelectedTreeNode}
                />
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
              const t = HIERARCHY_TYPES.find((h) => h.id === selectedTreeNode.type)
              const cost = (selectedTreeNode as any).cost ?? 0
              const flows = (selectedTreeNode as any).flows ?? 0
              return (
                <div
                  className="card"
                  style={{
                    marginTop: 16,
                    padding: 20,
                    borderLeft: `3px solid ${t?.color ?? 'var(--brand-primary)'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        className="eyebrow"
                        style={{ color: t?.color ?? 'var(--text-tertiary)', marginBottom: 6 }}
                      >
                        {t?.label ?? selectedTreeNode.type}
                      </div>
                      <div
                        className="title"
                        style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}
                      >
                        {selectedTreeNode.label}
                      </div>
                      <div className="body-sm mono" style={{ color: 'var(--text-tertiary)' }}>
                        ID: {selectedTreeNode.id}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedTreeNode(null)}
                      aria-label="Dismiss details"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-tertiary)',
                        padding: 4,
                        borderRadius: 4,
                      }}
                    >
                      <Icon name="x" size={16} />
                    </button>
                  </div>

                  <div
                    style={{
                      marginTop: 16,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        background: 'var(--surface-overlay)',
                        borderRadius: 8,
                        padding: '10px 12px',
                      }}
                    >
                      <div
                        className="label-sm"
                        style={{ marginBottom: 4 }}
                      >
                        Flows
                      </div>
                      <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {flows}
                      </div>
                    </div>
                    <div
                      style={{
                        background: 'var(--surface-overlay)',
                        borderRadius: 8,
                        padding: '10px 12px',
                      }}
                    >
                      <div
                        className="label-sm"
                        style={{ marginBottom: 4 }}
                      >
                        Cost
                      </div>
                      <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--brand-primary)' }}>
                        ${cost}
                      </div>
                    </div>
                    <div
                      style={{
                        background: 'var(--surface-overlay)',
                        borderRadius: 8,
                        padding: '10px 12px',
                      }}
                    >
                      <div
                        className="label-sm"
                        style={{ marginBottom: 4 }}
                      >
                        Children
                      </div>
                      <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {selectedTreeNode.children?.length ?? 0}
                      </div>
                    </div>
                  </div>

                  {activeCase && (
                    <div
                      style={{
                        marginTop: 14,
                        paddingTop: 14,
                        borderTop: '1px solid var(--border-subtle)',
                        display: 'flex',
                        gap: 8,
                      }}
                    >
                      <Link href={`/project/${projectId}/case/${activeCase.id}`}>
                        <button type="button" className="btn btn-secondary btn-sm">
                          <Icon name="external" size={12} /> Open in editor
                        </button>
                      </Link>
                    </div>
                  )}
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
                <div
                  className="mono"
                  style={{
                    fontSize: 36,
                    fontWeight: 600,
                    color: 'var(--brand-primary)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {fmtNum(totalImpact, 2)}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                  {impactUnit}
                </div>
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
                {contributors.slice(0, 5).map((c, i) => (
                  <div key={c.id}>
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
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  rowGap: 8,
                  fontSize: 13,
                }}
              >
                <div style={{ color: 'var(--text-secondary)' }}>Labor</div>
                <div className="mono">$2,240</div>
                <div style={{ color: 'var(--text-secondary)' }}>Energy</div>
                <div className="mono">$1,680</div>
                <div style={{ color: 'var(--text-secondary)' }}>Material</div>
                <div className="mono">$3,920</div>
                <div style={{ color: 'var(--text-secondary)' }}>Overhead</div>
                <div className="mono">$580</div>
                <div
                  style={{
                    gridColumn: '1/3',
                    height: 1,
                    background: 'var(--border-subtle)',
                    margin: '4px 0',
                  }}
                />
                <div
                  style={{ color: 'var(--text-primary)', fontWeight: 600 }}
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
                  ${fmtInt(totalCost)}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() =>
                  activeCase
                    ? router.push(
                        `/project/${projectId}/analytics?caseId=${activeCase.id}`,
                      )
                    : router.push(`/project/${projectId}/analytics`)
                }
              >
                <Icon name="run" size={14} /> Run Assessment
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  activeCase
                    ? router.push(
                        `/project/${projectId}/analytics?caseId=${activeCase.id}`,
                      )
                    : router.push(`/project/${projectId}/analytics`)
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
          className="!max-w-[98vw] !h-[95vh] flex flex-col p-0 gap-0 my-[2.5vh]"
          showCloseButton={false}
        >
          <DialogHeader className="px-6 py-3 glass-panel shadow-botanical border-b border-outline-variant/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Network className="h-5 w-5 text-primary" />
                <DialogTitle className="text-lg font-medium text-on-surface font-['Inter_Tight',Inter,sans-serif] tracking-tight">
                  Process Hierarchy - {modalCase?.case_name || 'Loading...'}
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
                    className="pl-9 h-9 w-56 text-sm bg-surface-container-low border-0 border-b border-outline-variant/40 rounded-none focus-visible:ring-0 focus-visible:border-primary font-mono text-xs placeholder:opacity-50 placeholder:uppercase placeholder:tracking-[0.12em]"
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
                  className="h-9 border-outline-variant/40 bg-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
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
                    className="h-9 px-2 text-on-surface-variant hover:bg-surface-container-high"
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
                    className="h-9 px-2 text-on-surface-variant hover:bg-surface-container-high"
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
                  className="h-9 border-outline-variant/40 bg-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                >
                  <Focus className="h-4 w-4 mr-1" />
                  Reset
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsTreeModalOpen(false)}
                  className="h-9 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
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
                  className="inline-block p-4 pt-6"
                  style={{ marginLeft: modalPan.x, marginTop: modalPan.y }}
                >
                  <div
                    className="transform-gpu transition-transform duration-100 origin-top"
                    style={{ transform: `scale(${modalZoom / 100})` }}
                  >
                    {renderFlowChart()}
                  </div>
                </div>
                <div className="absolute bottom-3 left-3 text-[10px] font-mono uppercase tracking-[0.12em] text-on-surface-variant/60 glass-panel px-2 py-1 rounded-md border border-outline-variant/10">
                  Scroll to pan · Ctrl+Scroll to zoom · Drag to move
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-3 border-t bg-slate-50 flex items-center justify-between text-xs text-gray-600">
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
