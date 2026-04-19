"use client"
import { useEffect, useState, useRef, type ReactElement } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useProjectStore } from "@/lib/store"
import {
  Plus,
  Edit,
  Trash2,
  BarChart3,
  GitCompare,
  LineChart,
  Maximize2,
  Network,
  ZoomIn,
  ZoomOut,
  Focus,
  Minimize2,
  Search,
  ChevronDown,
  Info,
  Share2,
  Activity,
} from "lucide-react"
import Link from "next/link"
import { toast } from "@/hooks/use-toast"
import { apiRequest } from "@/lib/api-client"
import { transformProjectFromDB, transformCaseFromDB } from "@/lib/data-transformers"
import { CaseMiniVisualization } from "@/components/case-mini-visualization"
import { CaseTreeVisualization } from "@/components/case-tree-visualization"
import { getColorsByComponentType, normalizeComponentType } from "@/lib/hierarchy-colors"
// AuthGuard + AppShell are provided by app/project/layout.tsx
// (single-source-of-truth so sub-routes like /case/[id] inherit too)
import { ProjectShell } from "@/components/project/project-shell"
import { CaseTabPills } from "@/components/project/case-tab-pills"
import { HierarchyStepPills } from "@/components/project/hierarchy-step-pills"
import { ProjectKpiStrip, type ProjectKpi } from "@/components/project/project-kpi-strip"

type ViewMode = "hierarchy" | "analytics"

export default function ProjectPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const { deleteCase } = useProjectStore()
  const [project, setProject] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("hierarchy")

  // Tree Modal State (preserved)
  const [isTreeModalOpen, setIsTreeModalOpen] = useState(false)
  const [modalComponents, setModalComponents] = useState<any[]>([])
  const [modalCase, setModalCase] = useState<any>(null)
  const [isLoadingModal, setIsLoadingModal] = useState(false)
  const [modalZoom, setModalZoom] = useState(100)
  const [modalPan, setModalPan] = useState({ x: 0, y: 0 })
  const [modalPanStart, setModalPanStart] = useState({ x: 0, y: 0 })
  const [isPanningModal, setIsPanningModal] = useState(false)
  const [modalSearchQuery, setModalSearchQuery] = useState("")
  const [modalExpandedNodes, setModalExpandedNodes] = useState<Set<number>>(new Set())
  const modalCanvasRef = useRef<HTMLDivElement>(null)

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
            casesData.success && casesData.cases ? casesData.cases.map(transformCaseFromDB) : []

          setProject({ ...transformedProject, cases: transformedCases })

          if (transformedCases.length > 0 && !selectedCaseId) {
            const baseCase = transformedCases.find((c: any) => c.type === "base")
            const firstCase = baseCase || transformedCases[0]
            setSelectedCaseId(`${firstCase.type === "base" ? "base" : "comp"}-${firstCase.id}`)
          }
        } else {
          toast({
            title: "Project not found",
            description: "The requested project could not be found.",
            variant: "destructive",
          })
          router.push("/home")
        }
      } catch (error) {
        console.error("Failed to fetch project:", error)
        toast({
          title: "Error loading project",
          description: "Failed to load project details",
          variant: "destructive",
        })
        router.push("/home")
      } finally {
        setIsLoading(false)
      }
    }

    fetchProjectAndCases()
  }, [projectId, router])

  if (isLoading || !project) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-on-surface">Loading project...</h2>
        </div>
      </div>
    )
  }

  const baseCases = project.cases?.filter((c: any) => c.type === "base") || []
  const comparativeCases = project.cases?.filter((c: any) => c.type === "comparative") || []
  const allCases = [...baseCases, ...comparativeCases]

  const selectedCase = project.cases?.find((c: any) => {
    const cid = `${c.type === "base" ? "base" : "comp"}-${c.id}`
    return cid === selectedCaseId
  })

  // Build pill list with tab-id keys
  const pillCases = allCases.map((c: any) => ({
    id: `${c.type === "base" ? "base" : "comp"}-${c.id}`,
    name: c.name,
    type: c.type === "base" ? "BASE" : "COMP",
  }))

  const handleAddCase = () => {
    if (baseCases.length === 0) {
      router.push(`/project/${projectId}/case/base/new`)
    } else {
      router.push(`/project/${projectId}/case/comparative/new`)
    }
  }

  const handleDeleteCase = (caseId: string) => {
    if (confirm("Are you sure you want to delete this case? This action cannot be undone.")) {
      deleteCase(caseId)
      toast({
        title: "Case deleted",
        description: "The case has been removed from your project.",
      })
    }
  }

  // Flowchart helpers (preserved from original)
  const getFlowChartColors = (componentType: string) => {
    const normalizedType = normalizeComponentType(componentType || "product")
    const colorConfig = getColorsByComponentType(normalizedType, "standby")
    return {
      bg: colorConfig.bg,
      border: colorConfig.border,
      text: colorConfig.text,
      connectionLine: "#9CA3AF",
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
      console.error("Failed to fetch tree data:", error)
      toast({
        title: "Error",
        description: "Failed to load tree visualization",
        variant: "destructive",
      })
    } finally {
      setIsLoadingModal(false)
    }
  }

  const renderFlowChart = (): ReactElement => {
    const rootNodes = modalComponents.filter(
      (c) => !c.parent_component_id || c.parent_component_id === null
    )

    const renderFlowNode = (node: any, level: number = 0): ReactElement | null => {
      const children = modalComponents.filter((c) => c.parent_component_id === node.component_id)
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
          const directChildren = modalComponents.filter((c) => c.parent_component_id === nodeId)
          return directChildren.some(
            (child) =>
              child.component_name.toLowerCase().includes(modalSearchQuery.toLowerCase()) ||
              hasMatchingDescendant(child.component_id)
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
              rounded-xl shadow-lg
              px-6 py-4 min-w-[180px] max-w-[240px]
              cursor-pointer transition-all duration-200
              scale-[0.8] origin-top
              hover:shadow-xl hover:scale-[0.82]
              ${isSearchMatch ? "ring-2 ring-yellow-400 animate-pulse" : ""}
            `}
            style={{
              backgroundColor: colors.bg,
              borderWidth: "3px",
              borderStyle: "solid",
              borderColor: colors.border,
              color: colors.text,
            }}
          >
            <div className="text-center">
              <p className="font-semibold text-base leading-snug">{node.component_name}</p>
            </div>
            {children.length > 0 && (
              <button
                className="absolute -bottom-3 left-1/2 -translate-x-1/2 h-6 w-6 bg-white border border-gray-300 rounded-full shadow-sm flex items-center justify-center hover:bg-gray-100 z-20"
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
                  className={`h-4 w-4 text-gray-600 transition-transform ${
                    !isExpanded ? "-rotate-90" : ""
                  }`}
                />
              </button>
            )}
          </div>

          {children.length > 0 && isExpanded && (
            <>
              <div className="w-0.5 h-6 mt-3" style={{ backgroundColor: colors.connectionLine }} />
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
                  <div key={child.component_id} className="flex flex-col items-center">
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

  // KPI strip — derived from case data
  const kpis: ProjectKpi[] = [
    { label: "TOTAL CASES", value: allCases.length, status: "ok" },
    { label: "BASE CASES", value: baseCases.length, status: "stable" },
    { label: "COMPARATIVES", value: comparativeCases.length, status: "ok" },
    { label: "TEAM MEMBERS", value: project.members?.length || 1, status: "stable" },
  ]

  return (
    <ProjectShell
      projectName={project.name || "Project"}
      projectId={projectId}
      activeSection="editor"
    >
          <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-8">
            {/* Breadcrumb */}
            <nav className="font-mono text-[11px] uppercase tracking-[0.12em] text-on-surface-variant mb-4">
              <Link href="/home" className="hover:text-primary transition-colors">
                Projects
              </Link>
              <span className="mx-2 opacity-50">/</span>
              <span className="text-on-surface">{project.name}</span>
              <span className="mx-2 opacity-50">/</span>
              <span>Initial View</span>
            </nav>

            {/* Header row */}
            <div className="flex items-start justify-between gap-6 mb-8">
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl md:text-4xl font-bold text-on-surface leading-tight">
                  {project.name}
                </h1>
                {project.description && (
                  <div className="mt-3 flex items-start gap-2">
                    <p className="text-on-surface-variant line-clamp-3 flex-1 max-w-3xl">
                      {project.description}
                    </p>
                    {project.description.length > 150 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsDescriptionModalOpen(true)}
                        className="h-7 text-xs flex-shrink-0"
                      >
                        <Info className="h-3 w-3 mr-1" />
                        Read more
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" className="h-9">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
                <Button
                  onClick={() => router.push(`/project/${projectId}/comparisons`)}
                  size="sm"
                  variant="outline"
                  className="h-9"
                >
                  <GitCompare className="h-4 w-4 mr-2" />
                  Compare
                </Button>
                <Button
                  onClick={() => {
                    if (selectedCase) {
                      router.push(`/project/${projectId}/analytics?caseId=${selectedCase.id}`)
                    } else {
                      router.push(`/project/${projectId}/analytics`)
                    }
                  }}
                  size="sm"
                  className="h-9 veridian-gradient text-on-primary"
                >
                  <LineChart className="h-4 w-4 mr-2" />
                  Analytics
                </Button>
              </div>
            </div>

            {/* Case tab pills + add */}
            {pillCases.length > 0 ? (
              <div className="mb-6">
                <CaseTabPills
                  cases={pillCases}
                  activeCaseId={selectedCaseId}
                  onSelect={(id) => setSelectedCaseId(String(id))}
                  onAdd={handleAddCase}
                />
              </div>
            ) : (
              <div className="mb-6 rounded-lg border border-dashed border-outline-variant/40 bg-surface-container-lowest p-8 text-center">
                <p className="text-on-surface-variant mb-4">
                  No cases yet. Start by creating your base case.
                </p>
                <Link href={`/project/${projectId}/case/base/new`}>
                  <Button className="veridian-gradient text-on-primary">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Base Case
                  </Button>
                </Link>
              </div>
            )}

            {/* View toggle */}
            {selectedCase && (
              <div className="flex items-center justify-between mb-6">
                <div className="inline-flex rounded-md border border-outline-variant/30 bg-surface-container-lowest p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("hierarchy")}
                    className={
                      viewMode === "hierarchy"
                        ? "px-4 py-1.5 rounded bg-primary text-on-primary text-sm font-medium"
                        : "px-4 py-1.5 rounded text-on-surface-variant text-sm hover:text-on-surface transition-colors"
                    }
                  >
                    Hierarchy
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("analytics")}
                    className={
                      viewMode === "analytics"
                        ? "px-4 py-1.5 rounded bg-primary text-on-primary text-sm font-medium"
                        : "px-4 py-1.5 rounded text-on-surface-variant text-sm hover:text-on-surface transition-colors"
                    }
                  >
                    Analytics
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/project/${projectId}/case/${selectedCase.id}`}>
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Case
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteCase(selectedCase.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {selectedCase && (
              <>
                {viewMode === "hierarchy" ? (
                  <>
                    <div className="mb-5">
                      <HierarchyStepPills current={1} />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 mb-8">
                      {/* Main: tree visualization + mini */}
                      <div className="space-y-4">
                        <div className="rounded-lg border border-outline-variant/15 bg-surface-container-lowest">
                          <div className="flex items-center justify-between px-5 py-3 border-b border-outline-variant/15">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-on-surface-variant">
                                Case Tree
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {selectedCase.type === "base" ? "Base" : "Comparative"}
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openTreeModal(selectedCase.id)}
                              className="h-8 text-xs"
                            >
                              <Maximize2 className="h-3 w-3 mr-1" />
                              View Hierarchy
                            </Button>
                          </div>
                          <div className="p-4 h-[560px] overflow-y-auto">
                            <CaseTreeVisualization
                              caseId={selectedCase.id}
                              caseName={selectedCase.name}
                              projectId={projectId}
                              compact={false}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Right rail: live telemetry */}
                      <aside className="space-y-4">
                        <div className="rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-5">
                          <div className="flex items-center gap-2 mb-4">
                            <Activity className="h-4 w-4 text-primary" />
                            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-on-surface-variant">
                              Live Telemetry
                            </span>
                          </div>
                          <dl className="space-y-3 text-sm">
                            <div className="flex items-center justify-between">
                              <dt className="text-on-surface-variant">Case name</dt>
                              <dd className="text-on-surface font-medium truncate max-w-[140px]">
                                {selectedCase.name}
                              </dd>
                            </div>
                            <div className="flex items-center justify-between">
                              <dt className="text-on-surface-variant">Type</dt>
                              <dd className="text-on-surface font-medium capitalize">
                                {selectedCase.type}
                              </dd>
                            </div>
                            <div className="flex items-center justify-between">
                              <dt className="text-on-surface-variant">Status</dt>
                              <dd className="text-primary font-medium">Active</dd>
                            </div>
                          </dl>
                        </div>
                        <div className="rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-5">
                          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-on-surface-variant mb-3">
                            Mini Visualization
                          </div>
                          <CaseMiniVisualization
                            caseId={selectedCase.id}
                            caseName={selectedCase.name}
                          />
                        </div>
                      </aside>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-10 text-center mb-8">
                    <BarChart3 className="h-10 w-10 text-primary mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-on-surface mb-2">
                      Analytics Dashboard
                    </h3>
                    <p className="text-on-surface-variant mb-4">
                      Open the full analytics view for impact charts, contribution breakdowns, and
                      KPI trends.
                    </p>
                    <Button
                      onClick={() =>
                        router.push(`/project/${projectId}/analytics?caseId=${selectedCase.id}`)
                      }
                      className="veridian-gradient text-on-primary"
                    >
                      <LineChart className="h-4 w-4 mr-2" />
                      Open Analytics
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* KPI strip */}
            <ProjectKpiStrip kpis={kpis} />
          </div>

          {/* Tree Visualization Modal (preserved verbatim from original) */}
          <Dialog open={isTreeModalOpen} onOpenChange={setIsTreeModalOpen}>
            <DialogContent
              className="!max-w-[98vw] !h-[95vh] flex flex-col p-0 gap-0 my-[2.5vh]"
              showCloseButton={false}
            >
              <DialogHeader className="px-6 py-3 border-b bg-slate-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Network className="h-5 w-5 text-blue-600" />
                    <DialogTitle className="text-lg font-semibold">
                      Process Hierarchy - {modalCase?.case_name || "Loading..."}
                    </DialogTitle>
                    <Badge variant="outline" className="text-xs">
                      {modalComponents.length} components
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search components..."
                        value={modalSearchQuery}
                        onChange={(e) => setModalSearchQuery(e.target.value)}
                        className="pl-9 h-9 w-56 text-sm"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (modalExpandedNodes.size === 0) {
                          const allIds = new Set<number>(
                            modalComponents.map((c) => c.component_id)
                          )
                          setModalExpandedNodes(allIds)
                        } else {
                          setModalExpandedNodes(new Set())
                        }
                      }}
                      className="h-9"
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
                    <div className="flex items-center gap-1 border rounded-md bg-white">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setModalZoom(Math.max(30, modalZoom - 5))}
                        className="h-9 px-2"
                      >
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                      <span className="text-xs font-medium px-2 text-gray-600 min-w-[50px] text-center">
                        {modalZoom}%
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setModalZoom(Math.min(200, modalZoom + 5))}
                        className="h-9 px-2"
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
                      className="h-9"
                    >
                      <Focus className="h-4 w-4 mr-1" />
                      Reset
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsTreeModalOpen(false)}
                      className="h-9"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 relative overflow-hidden bg-slate-50">
                {isLoadingModal ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                      <p className="text-sm text-gray-600">Loading tree visualization...</p>
                    </div>
                  </div>
                ) : modalComponents.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Network className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-lg font-medium text-gray-600 mb-2">No components yet</p>
                      <p className="text-sm text-gray-500">
                        Add components to build your process hierarchy
                      </p>
                    </div>
                  </div>
                ) : (
                  <div
                    ref={modalCanvasRef}
                    className={`absolute inset-0 overflow-auto ${
                      isPanningModal ? "cursor-grabbing" : "cursor-grab"
                    }`}
                    style={{
                      background:
                        "radial-gradient(circle at 1px 1px, rgb(209 213 219 / 0.3) 1px, transparent 0)",
                      backgroundSize: "40px 40px",
                      backgroundColor: "#f0fdfa",
                      overscrollBehavior: "none",
                    }}
                    onWheel={(e) => {
                      if (e.ctrlKey || e.metaKey) {
                        e.preventDefault()
                        e.stopPropagation()
                        const delta = e.deltaY > 0 ? -5 : 5
                        setModalZoom((prev) => Math.max(30, Math.min(200, prev + delta)))
                      }
                    }}
                    onMouseDown={(e) => {
                      if (e.button === 0) {
                        setIsPanningModal(true)
                        setModalPanStart({ x: e.clientX - modalPan.x, y: e.clientY - modalPan.y })
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
                    <div className="absolute bottom-3 left-3 text-xs text-gray-400 bg-white/80 px-2 py-1 rounded">
                      Scroll to pan • Ctrl+Scroll to zoom • Drag to move
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-3 border-t bg-slate-50 flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center gap-4">
                  <span>
                    <span className="font-medium">{modalComponents.length}</span> components
                  </span>
                  {modalSearchQuery && (
                    <span>
                      <span className="font-medium">
                        {
                          modalComponents.filter((c) =>
                            c.component_name
                              .toLowerCase()
                              .includes(modalSearchQuery.toLowerCase())
                          ).length
                        }
                      </span>{" "}
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

          {/* Project Description Modal */}
          <Dialog open={isDescriptionModalOpen} onOpenChange={setIsDescriptionModalOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{project?.name}</DialogTitle>
              </DialogHeader>
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-on-surface mb-2">Project Description</h4>
                <p className="text-sm text-on-surface-variant whitespace-pre-wrap leading-relaxed">
                  {project?.description}
                </p>
                {project?.cases && (
                  <div className="mt-6 pt-4 border-t border-outline-variant/20">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-on-surface-variant">Total Cases:</span>{" "}
                        <span className="font-medium">{project.cases.length}</span>
                      </div>
                      <div>
                        <span className="text-on-surface-variant">Base Cases:</span>{" "}
                        <span className="font-medium">
                          {project.cases.filter((c: any) => c.type === "base").length}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
    </ProjectShell>
  )
}
