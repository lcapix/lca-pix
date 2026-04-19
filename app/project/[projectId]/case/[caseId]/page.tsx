"use client"
import React, { useState, useEffect, useRef, useMemo } from "react"
import type { ProcessNode, TreeNode } from "@/types/component"
import { getTypeLabel, getAllowedChildType } from "@/lib/hierarchy"
import { getColorsByComponentType, normalizeComponentType, type ComponentType } from "@/lib/hierarchy-colors"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Plus,
  ChevronRight,
  GripVertical,
  MoreHorizontal,
  Edit,
  UserPlus,
  Copy,
  Move,
  Trash2,
  Settings,
  BarChart3,
  FileText,
  Maximize2,
  Minimize2,
  Palette,
  Info,
  Network,
  GitCompare,
  LineChart,
  Users,
  Zap,
  Truck,
  Package,
  Building,
  Building2,
  DollarSign,
  AlertCircle,
  Search,
  ZoomIn,
  ZoomOut,
  Filter,
  LayoutGrid,
  ArrowLeft,
  Boxes,
  Factory,
  GitBranch,
  Cog,
  Atom,
  MoreVertical,
  Download,
  Eye,
  MousePointer,
  Focus,
  Hand,
  Play,
  ChevronDown,
} from "lucide-react"
import { useProjectStore, type ComponentNode, type NodeType, type Case } from "@/lib/store"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { apiRequest } from "@/lib/api-client"
import { transformCaseFromDB, transformComponentFromDB } from "@/lib/data-transformers"
import { EnvironmentalFlows } from "@/components/environmental-flows"
import { AbcCosting } from "@/components/abc-costing"
// Removed ComponentModal import - now using inline editing

// Component type constants - matches database enum exactly
const COMPONENT_TYPES = {
  PRODUCT: 'product',
  MACHINE_LINE: 'machine_line',
  SUBPROCESS: 'subprocess',
  OPERATION: 'operation',
  ELEMENTAL_TASK: 'elemental_task'
} as const;

const COMPONENT_TYPE_LABELS: Record<string, string> = {
  product: 'Product',
  machine_line: 'Machine Line Process',
  subprocess: 'Subprocess',
  operation: 'Operation',
  elemental_task: 'Elemental Task'
};

export default function CaseViewPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string
  const caseId = params.caseId as string

  const { updateComponentNode, deleteComponentNode, addComponentNode} = useProjectStore()
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollPositionRef = useRef(0)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("data")
  const [editFormTab, setEditFormTab] = useState("details")
  const [isTreeExpanded, setIsTreeExpanded] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(25) // percentage - 25% default for sidebar
  const [isSidebarResizing, setIsSidebarResizing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [showTreeVisualization, setShowTreeVisualization] = useState(false)
  const [treeEditingComponent, setTreeEditingComponent] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [zoomLevel, setZoomLevel] = useState(80)
  const [allExpanded, setAllExpanded] = useState(false)
  const [treePanelWidth, setTreePanelWidth] = useState(60) // percentage - 60% default for tree
  const [isResizing, setIsResizing] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  // Pan state for drag-to-pan
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const treeContainerRef = React.useRef<HTMLDivElement>(null)
  const [editFormData, setEditFormData] = useState<{
    processType?: string
    processName?: string
    processDescription?: string
    parentId?: string
    driverCategory?: string
    selectedDriver?: string
    drivers?: string[]
    mass?: number
    massUnit?: string
    operationalCostUSD?: number
    capitalCostUSD?: number
    // ABC Costing - Detailed cost breakdown
    laborCost?: number
    energyCost?: number
    transportationCost?: number
    materialCost?: number
    equipmentCost?: number
    overheadCost?: number
    currency?: string
    costAllocationType?: 'manual' | 'calculated' | 'allocated'
  }>({})

  // Removed modal states - now using inline editing

  // Other states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingNode, setDeletingNode] = useState<ProcessNode | null>(null)
  const [deleteOption, setDeleteOption] = useState<'cascade' | 'float'>('cascade')
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [movingNode, setMovingNode] = useState<ProcessNode | null>(null)
  const [selectedMoveTarget, setSelectedMoveTarget] = useState<string | null>(null)
  const [inlineEditingNode, setInlineEditingNode] = useState<string | null>(null)
  const [inlineEditValue, setInlineEditValue] = useState("")
  const [contextMenuOpen, setContextMenuOpen] = useState<string | null>(null)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const [draggedNode, setDraggedNode] = useState<string | null>(null)
  const [dragOverNode, setDragOverNode] = useState<string | null>(null)
  const [isDragValid, setIsDragValid] = useState<boolean>(false)

  // Fetch case and components from database
  const [currentCase, setCurrentCase] = useState<Case | null>(null)
  const [components, setComponents] = useState<ComponentNode[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch case and components on mount
  useEffect(() => {
    const fetchCaseData = async () => {
      setIsLoading(true)
      try {
        // Fetch case details and components in parallel
        const [caseResponse, componentsResponse] = await Promise.all([
          apiRequest(`/api/cases/${caseId}`),
          apiRequest(`/api/cases/${caseId}/components`)
        ])

        const caseData = await caseResponse.json()
        const componentsData = await componentsResponse.json()

        // 🔍 DEBUG STEP 1: Check raw API response
        const firstComponent = componentsData.components?.[0]
        console.log('🔍 DEBUG STEP 1 - Raw API Response:', {
          componentsCount: componentsData.components?.length,
          firstComponent: {
            id: firstComponent?.component_id,
            name: firstComponent?.component_name,
            // ABC Cost Data from DB
            labor_cost: firstComponent?.labor_cost,
            energy_cost: firstComponent?.energy_cost,
            transportation_cost: firstComponent?.transportation_cost,
            material_cost: firstComponent?.material_cost,
            currency: firstComponent?.currency
          }
        })

        if (caseData.success && caseData.case) {
          const transformedCase = transformCaseFromDB(caseData.case)
          const transformedComponents = componentsData.success && componentsData.components
            ? componentsData.components.map((dbComp: any) => {
                const transformed = transformComponentFromDB(dbComp)
                // 🔍 DEBUG STEP 2: Check transformation for Oven Heating Task
                if (dbComp.component_name === 'Oven Heating Task') {
                  console.log('🔍 DEBUG STEP 2 - Transformation for Oven Heating Task:', {
                    rawDB: {
                      driver_category: dbComp.driver_category,
                      driver_type: dbComp.driver_type,
                      drivers: dbComp.drivers,
                      process_type: dbComp.process_type
                    },
                    transformed: {
                      driverCategory: transformed.driverCategory,
                      selectedDriver: transformed.selectedDriver,
                      drivers: transformed.drivers,
                      processType: transformed.processType
                    }
                  })
                }
                return transformed
              })
            : []

          setCurrentCase({ ...transformedCase, components: transformedComponents })
          setComponents(transformedComponents)

          // 🔍 DEBUG: Make components available globally for inspection
          if (typeof window !== 'undefined') {
            (window as any).__debugComponents = transformedComponents;
          }

          // 🔍 DEBUG STEP 3: Check final state
          const firstTransformed = transformedComponents[0]
          console.log('🔍 DEBUG STEP 3 - Final Components State:', {
            totalCount: transformedComponents.length,
            firstTransformedComponent: {
              id: firstTransformed?.id,
              name: firstTransformed?.name,
              // ABC Cost Data (transformed)
              laborCost: firstTransformed?.laborCost,
              energyCost: firstTransformed?.energyCost,
              transportationCost: firstTransformed?.transportationCost,
              materialCost: firstTransformed?.materialCost,
              equipmentCost: firstTransformed?.equipmentCost,
              overheadCost: firstTransformed?.overheadCost,
              currency: firstTransformed?.currency
            }
          })
        } else {
          toast.error("Case not found")
          router.push(`/project/${projectId}`)
        }
      } catch (error) {
        console.error("Failed to fetch case:", error)
        toast.error("Failed to load case details")
        router.push(`/project/${projectId}`)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCaseData()
  }, [caseId, projectId, router])

  // Auto-expand all nodes when components load - ALWAYS expand tree on page load
  React.useEffect(() => {
    if (components && components.length > 0) {
      // Create a set of all component IDs that have children to auto-expand the hierarchy
      const allComponentsWithChildren = new Set<string>()

      components.forEach(component => {
        const hasChildren = components.some(c => c.parentId === component.id)
        if (hasChildren) {
          allComponentsWithChildren.add(component.id)
        }
      })

      // Always expand all nodes, regardless of current state
      setExpandedNodes(allComponentsWithChildren)
    }
  }, [components.length])

  // Auto-select the first root component on initial load
  React.useEffect(() => {
    if (components && components.length > 0 && !selectedNode) {
      const rootComponents = components.filter(c => !c.parentId)
      if (rootComponents.length > 0) {
        const firstRoot = rootComponents[0]
        setSelectedNode(firstRoot.id)
        // Set the edit form data for the selected component
        setEditFormData({
          processName: firstRoot.name,
          processType: firstRoot.type,
          processDescription: firstRoot.description || "",
          driverCategory: firstRoot.driverCategory || "",
          selectedDriver: firstRoot.selectedDriver || "",
          mass: firstRoot.mass ?? undefined,
          massUnit: firstRoot.massUnit || "",
          operationalCostUSD: firstRoot.operationalCostUSD ?? undefined,
          capitalCostUSD: firstRoot.capitalCostUSD ?? undefined,
          parentId: firstRoot.parentId || undefined,
          // ABC Costing - Detailed cost breakdown
          laborCost: firstRoot.laborCost ?? undefined,
          energyCost: firstRoot.energyCost ?? undefined,
          transportationCost: firstRoot.transportationCost ?? undefined,
          materialCost: firstRoot.materialCost ?? undefined,
          equipmentCost: firstRoot.equipmentCost ?? undefined,
          overheadCost: firstRoot.overheadCost ?? undefined,
          currency: firstRoot.currency || 'USD',
          costAllocationType: firstRoot.costAllocationType ?? undefined,
        })
        setIsEditing(true)
        setActiveTab("data")
      }
    }
  }, [components.length])

  // Lock body scroll when tree visualization is shown
  useEffect(() => {
    if (showTreeVisualization) {
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [showTreeVisualization])

  // Preserve scroll position when expandedNodes changes
  useEffect(() => {
    const container = scrollContainerRef.current
    if (container && scrollPositionRef.current > 0) {
      requestAnimationFrame(() => {
        container.scrollTop = Math.min(scrollPositionRef.current, container.scrollHeight - container.clientHeight)
      })
    }
  }, [expandedNodes])

  // Resize panel handler for tree visualization
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = (e.clientX / window.innerWidth) * 100
      setTreePanelWidth(Math.min(Math.max(newWidth, 30), 70)) // Constrain between 30-70%
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  // Resize panel handler for sidebar
  useEffect(() => {
    if (!isSidebarResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = (e.clientX / window.innerWidth) * 100
      setSidebarWidth(Math.min(Math.max(newWidth, 15), 40)) // Constrain between 15-40%
    }

    const handleMouseUp = () => {
      setIsSidebarResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isSidebarResizing])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading case...</p>
      </div>
    )
  }

  if (!currentCase) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Case not found</h1>
          <Button onClick={() => router.push("/home")}>Return to Home</Button>
        </div>
      </div>
    )
  }

  const componentCount = components.length || 0

  // Convert components to ProcessNode format for tree building
  const processNodes: ProcessNode[] = components.map(c => ({
    id: c.id,
    name: c.name,
    type: c.type,
    description: c.description,
    parentId: c.parentId || undefined
  }))
  
  // Get selected component details
  const selectedComponent = selectedNode ? components.find(c => c.id === selectedNode) : null
  
  // Debug logging
  // Debug logs
  console.log("Debug - selectedNode:", selectedNode)
  console.log("Debug - selectedComponent:", selectedComponent)
  console.log("Debug - currentCase components:", components?.length)

  // Color scheme for tree visualization (matching LCA v2)
  // Get icon for node type
  const getNodeIcon = (type: NodeType) => {
    const iconMap = {
      product: <Boxes className="h-4 w-4" />,
      machine: <Factory className="h-4 w-4" />,
      machine_line: <Factory className="h-4 w-4" />,
      subprocess: <GitBranch className="h-4 w-4" />,
      operation: <Cog className="h-4 w-4" />,
      elemental: <Atom className="h-4 w-4" />,
      elemental_task: <Atom className="h-4 w-4" />
    }
    return iconMap[type] || <Package className="h-4 w-4" />
  }

  // Enhanced color scheme with full backgrounds
  const getFlowChartColors = (type: NodeType) => {
    const colorSchemes = {
      product: {
        bg: "bg-red-50",
        border: "border-red-200",
        text: "text-red-700",
        iconBg: "bg-red-100",
        badge: "bg-red-100 text-red-700 border-red-200",
        connectionLine: "bg-red-300"
      },
      machine: {
        bg: "bg-orange-50",
        border: "border-orange-200",
        text: "text-orange-700",
        iconBg: "bg-orange-100",
        badge: "bg-orange-100 text-orange-700 border-orange-200",
        connectionLine: "bg-orange-300"
      },
      machine_line: {
        bg: "bg-orange-50",
        border: "border-orange-200",
        text: "text-orange-700",
        iconBg: "bg-orange-100",
        badge: "bg-orange-100 text-orange-700 border-orange-200",
        connectionLine: "bg-orange-300"
      },
      subprocess: {
        bg: "bg-amber-50",
        border: "border-amber-200",
        text: "text-amber-700",
        iconBg: "bg-amber-100",
        badge: "bg-amber-100 text-amber-700 border-amber-200",
        connectionLine: "bg-amber-300"
      },
      operation: {
        bg: "bg-secondary-container",
        border: "border-outline-variant/40",
        text: "text-primary",
        iconBg: "bg-secondary-container",
        badge: "bg-secondary-container text-primary border-outline-variant/40",
        connectionLine: "bg-primary/40"
      },
      elemental: {
        bg: "bg-purple-50",
        border: "border-purple-200",
        text: "text-purple-700",
        iconBg: "bg-purple-100",
        badge: "bg-purple-100 text-purple-700 border-purple-200",
        connectionLine: "bg-purple-300"
      },
      elemental_task: {
        bg: "bg-purple-50",
        border: "border-purple-200",
        text: "text-purple-700",
        iconBg: "bg-purple-100",
        badge: "bg-purple-100 text-purple-700 border-purple-200",
        connectionLine: "bg-purple-300"
      }
    }
    return colorSchemes[type] || colorSchemes.product
  }

  // Level-based color scheme for tree visualization - More Prominent & Vibrant
  // Type-based color scheme for tree visualization - uses central config
  const getFlowChartColorsByType = (type: string, isSelected: boolean = false) => {
    const normalizedType = normalizeComponentType(type) as ComponentType
    const state = isSelected ? 'selected' : 'standby'
    const colors = getColorsByComponentType(normalizedType, state)

    return {
      bg: colors.bg,
      border: colors.border,
      text: colors.text,
      connectionLine: "#9CA3AF" // Gray connection lines
    }
  }

  // Shared utility function to check if a node is descendant of another
  const isDescendant = (ancestorId: string, nodeId: string): boolean => {
    const children = (components || []).filter(n => n.parentId === ancestorId)
    for (const child of children) {
      if (child.id === nodeId || isDescendant(child.id, nodeId)) {
        return true
      }
    }
    return false
  }

  const hierarchyRules: Record<string, string[]> = {
    // Display format (UI labels)
    "Product": ["Machine/Line"],
    "Machine/Line": ["Subprocess"],
    "Subprocess": ["Operation"],
    "Operation": ["Elemental Task"],
    "Elemental Task": [],
    // Database format (snake_case) - needed for dropdown filters
    "product": ["machine_line"],
    "machine_line": ["subprocess"],
    "subprocess": ["operation"],
    "operation": ["elemental_task"],
    "elemental_task": [],
  }

  // Color schemes for different node types - uses central config
  const getNodeColors = (type: string, isSelected = false, isHovered = false) => {
    // Get colors from central config
    const normalizedType = normalizeComponentType(type) as ComponentType
    const state = isSelected ? 'selected' : 'standby'
    const centralColors = getColorsByComponentType(normalizedType, state)

    // Helper to create very subtle tint for selected state
    const getSubtleTint = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      // Mix 95% white + 5% color for very subtle background
      const tintR = Math.round(255 * 0.95 + r * 0.05)
      const tintG = Math.round(255 * 0.95 + g * 0.05)
      const tintB = Math.round(255 * 0.95 + b * 0.05)
      return `rgb(${tintR}, ${tintG}, ${tintB})`
    }

    const baseColor = centralColors.bg

    return {
      // Tree list uses clean white backgrounds
      bg: "bg-white",
      border: isSelected ? `border-[${baseColor}]` : "border-outline-variant/30",
      text: "text-on-surface",
      badge: isSelected ? `text-[${baseColor}] border-[${baseColor}]` : `bg-transparent text-[${baseColor}] border-[${baseColor}]`,
      icon: `text-[${baseColor}]`,
      shadow: isSelected ? "shadow-md" : "shadow-sm",
      borderWidth: "border-l-4 border-t border-r border-b",
      leftBorder: `bg-[${baseColor}]`,
      ring: isSelected ? `ring-1 ring-[${baseColor}] ring-opacity-30` : "",
      // Inline style properties
      bgStyle: isSelected ? { backgroundColor: getSubtleTint(baseColor) } : { backgroundColor: 'white' },
      borderStyle: { borderLeftColor: baseColor },
      iconStyle: { backgroundColor: baseColor, color: 'white' }
    }
  }

  const handleEditNode = (node: ProcessNode) => {
    // Get the full component data
    const fullComponent = components.find(c => c.id === node.id)
    if (!fullComponent) return

    // 🔍 DEBUG STEP 4: Check component data when editing
    console.log('🔍 DEBUG STEP 4 - handleEditNode called for:', fullComponent.name)
    console.log('🔍 Full component data:', {
      id: fullComponent.id,
      name: fullComponent.name,
      type: fullComponent.type,
      driverCategory: fullComponent.driverCategory,
      selectedDriver: fullComponent.selectedDriver,
      drivers: fullComponent.drivers,
      processType: fullComponent.processType,
      mass: fullComponent.mass,
      massUnit: fullComponent.massUnit,
      opex: fullComponent.operationalCostUSD,
      capex: fullComponent.capitalCostUSD,
      // ABC Cost Data
      laborCost: fullComponent.laborCost,
      energyCost: fullComponent.energyCost,
      transportationCost: fullComponent.transportationCost,
      materialCost: fullComponent.materialCost,
      equipmentCost: fullComponent.equipmentCost,
      overheadCost: fullComponent.overheadCost,
      currency: fullComponent.currency
    })

    const formData = {
      processType: fullComponent.type,
      processName: fullComponent.name,
      processDescription: fullComponent.description || "",
      parentId: fullComponent.parentId || "",
      driverCategory: fullComponent.driverCategory || "",
      selectedDriver: fullComponent.selectedDriver || "",
      drivers: fullComponent.drivers || [] as string[],
      mass: fullComponent.mass ?? undefined,
      massUnit: fullComponent.massUnit || "",
      operationalCostUSD: fullComponent.operationalCostUSD ?? undefined,
      capitalCostUSD: fullComponent.capitalCostUSD ?? undefined,
      // ABC Costing - Detailed cost breakdown
      laborCost: fullComponent.laborCost ?? undefined,
      energyCost: fullComponent.energyCost ?? undefined,
      transportationCost: fullComponent.transportationCost ?? undefined,
      materialCost: fullComponent.materialCost ?? undefined,
      equipmentCost: fullComponent.equipmentCost ?? undefined,
      overheadCost: fullComponent.overheadCost ?? undefined,
      currency: fullComponent.currency || 'USD',
      costAllocationType: fullComponent.costAllocationType ?? undefined,
    }

    // 🔍 DEBUG STEP 5: Check form data being set
    console.log('🔍 DEBUG STEP 5 - Form data being set:', formData)
    console.log('🔍 ABC Cost Breakdown:', {
      laborCost: formData.laborCost,
      energyCost: formData.energyCost,
      transportationCost: formData.transportationCost,
      materialCost: formData.materialCost,
      equipmentCost: formData.equipmentCost,
      overheadCost: formData.overheadCost,
      total: (formData.laborCost || 0) + (formData.energyCost || 0) +
             (formData.transportationCost || 0) + (formData.materialCost || 0) +
             (formData.equipmentCost || 0) + (formData.overheadCost || 0),
      currency: formData.currency
    })

    // Select the node and switch to edit mode
    setSelectedNode(node.id)
    setActiveTab("data") // Switch to data tab immediately
    setIsEditing(true)
    setEditFormData(formData)
  }

  const handleDeleteNode = (node: ProcessNode) => {
    setDeletingNode(node)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (!deletingNode || !currentCase) return

    const allComponents = components || []
    const nodeChildren = allComponents.filter(n => n.parentId === deletingNode.id)
    
    if (nodeChildren.length > 0) {
      if (deleteOption === 'cascade') {
        // Delete children recursively
        const deleteRecursively = (nodeId: string) => {
          const children = allComponents.filter(n => n.parentId === nodeId)
          children.forEach(child => deleteRecursively(child.id))
          deleteComponentNode(nodeId)
        }
        deleteRecursively(deletingNode.id)
        toast.success(`Component and ${nodeChildren.length} child component(s) deleted`)
      } else if (deleteOption === 'float') {
        // Make children floating (remove their parentId)
        nodeChildren.forEach(child => {
          updateComponentNode(child.id, { parentId: null })
        })
        deleteComponentNode(deletingNode.id)
        toast.success(`Component deleted. ${nodeChildren.length} child(ren) converted to floating components`)
      }
    } else {
      deleteComponentNode(deletingNode.id)
      toast.success("Component deleted")
    }
    
    // Clear selection if deleted node was selected
    if (selectedNode === deletingNode.id) {
      setSelectedNode(null)
    }
    
    setDeleteDialogOpen(false)
    setDeletingNode(null)
    setDeleteOption('cascade')
  }

  const handleDuplicateNode = (node: ProcessNode) => {
    // Get the full component data
    const fullComponent = components.find(c => c.id === node.id)
    if (!fullComponent) return
    
    // Switch to create mode with duplicated data
    setSelectedNode(null)
    setIsCreating(true)
    setIsEditing(false)
    setEditFormData({
      processType: fullComponent.type,
      processName: `${fullComponent.name} (Copy)`,
      processDescription: fullComponent.description || "",
      parentId: fullComponent.parentId || "",
      driverCategory: fullComponent.driverCategory || "",
      selectedDriver: fullComponent.selectedDriver || "",
      drivers: fullComponent.drivers || [] as string[],
      mass: fullComponent.mass || 0,
      massUnit: fullComponent.massUnit || "kg",
      operationalCostUSD: fullComponent.operationalCostUSD || 0,
      capitalCostUSD: fullComponent.capitalCostUSD || 0,
    })
  }

  const handleAddChild = (parentNode: ProcessNode) => {
    const childType = getAllowedChildType(parentNode.type)
    if (!childType) {
      toast.error("Cannot add children to this node type.")
      return
    }
    
    // Switch to create mode with suggested parent and type
    setSelectedNode(null)
    setIsCreating(true)
    setIsEditing(false)
    setEditFormData({
      processType: childType,
      processName: "",
      processDescription: "",
      parentId: parentNode.id,
      driverCategory: "",
      selectedDriver: "",
      drivers: [] as string[],
      mass: 0,
      massUnit: "kg",
      operationalCostUSD: 0,
      capitalCostUSD: 0,
    })
  }
  
  const handleCreateComponent = () => {
    // Check if a Product already exists
    const hasProduct = components?.some(c => c.type === "Product")

    // Switch to create mode in the right panel
    setSelectedNode(null)
    setIsCreating(true)
    setIsEditing(false)
    setEditFormData({
      processType: hasProduct ? "" : "Product", // Default to Product only if none exists
      processName: "",
      processDescription: "",
      parentId: "",
      driverCategory: "",
      selectedDriver: "",
      drivers: [] as string[],
      mass: 0,
      massUnit: "kg",
      operationalCostUSD: 0,
      capitalCostUSD: 0,
    })
  }

  const handleInlineEdit = (node: ProcessNode) => {
    setInlineEditingNode(node.id)
    setInlineEditValue(node.name || "")
  }

  const saveInlineEdit = () => {
    if (!inlineEditingNode) return
    
    if (!inlineEditValue || !inlineEditValue.trim()) {
      toast.error("Enter a name.")
      return
    }
    
    // Update the component name in store
    updateComponentNode(inlineEditingNode, {
      name: inlineEditValue.trim()
    })
    
    setInlineEditingNode(null)
    toast.success("Name updated")
  }

  const cancelInlineEdit = () => {
    setInlineEditingNode(null)
    setInlineEditValue("")
  }

  // Inline form handlers
  const handleSaveComponent = async () => {
    // Validation
    if (!editFormData.processType) {
      toast.error("Please select a process type")
      return
    }

    if (!editFormData.processName || !editFormData.processName.trim()) {
      toast.error("Component name is required")
      return
    }

    try {
      if (isEditing && selectedNode) {
        // Update existing component via API
        const updatePayload = {
          component_name: editFormData.processName.trim(),
          component_type: editFormData.processType,
          component_description: editFormData.processDescription || null,
          parent_component_id: editFormData.parentId ? parseInt(editFormData.parentId) : null,
          process_type: editFormData.processType,
          driver_category: editFormData.driverCategory || null,
          driver_type: editFormData.selectedDriver || null,
          drivers: (editFormData.drivers && editFormData.drivers.length > 0) ? JSON.stringify(editFormData.drivers) : null,
          quantity: editFormData.mass || null,
          unit: editFormData.massUnit || null,
          opex: editFormData.operationalCostUSD || null,
          capex: editFormData.capitalCostUSD || null,
          // ABC Costing - Detailed cost breakdown
          labor_cost: editFormData.laborCost || null,
          energy_cost: editFormData.energyCost || null,
          transportation_cost: editFormData.transportationCost || null,
          material_cost: editFormData.materialCost || null,
          currency: editFormData.currency || 'USD',
          cost_allocation_type: editFormData.costAllocationType || 'manual',
        }

        const response = await apiRequest(`/api/components/${selectedNode}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload),
        })

        const result = await response.json()

        if (!result.success) {
          throw new Error(result.error || 'Failed to update component')
        }

        // Refetch components to get latest data from database
        const componentsResponse = await apiRequest(`/api/cases/${caseId}/components`)
        const componentsData = await componentsResponse.json()

        if (componentsData.success && componentsData.components) {
          const transformedComponents = componentsData.components.map(transformComponentFromDB)
          setComponents(transformedComponents)
        }

        toast.success("Component updated successfully")
      } else if (isCreating) {
        // Validate: prevent multiple Products
        if (editFormData.processType === COMPONENT_TYPES.PRODUCT) {
          const hasProduct = components?.some(c => c.type === COMPONENT_TYPES.PRODUCT)
          if (hasProduct) {
            toast.error("Only one Product component is allowed per case")
            return
          }
        }

        // Create new component via API
        const createPayload = {
          component_name: editFormData.processName.trim(),
          component_type: editFormData.processType,
          component_description: editFormData.processDescription || null,
          parent_component_id: editFormData.parentId ? parseInt(editFormData.parentId) : null,
          process_type: editFormData.processType,
          driver_category: editFormData.driverCategory || null,
          driver_type: editFormData.selectedDriver || null,
          drivers: (editFormData.drivers && editFormData.drivers.length > 0) ? JSON.stringify(editFormData.drivers) : null,
          quantity: editFormData.mass || null,
          unit: editFormData.massUnit || null,
          opex: editFormData.operationalCostUSD || null,
          capex: editFormData.capitalCostUSD || null,
          // ABC Costing - Detailed cost breakdown
          labor_cost: editFormData.laborCost || null,
          energy_cost: editFormData.energyCost || null,
          transportation_cost: editFormData.transportationCost || null,
          material_cost: editFormData.materialCost || null,
          currency: editFormData.currency || 'USD',
          cost_allocation_type: editFormData.costAllocationType || 'manual',
        }

        const response = await apiRequest(`/api/cases/${caseId}/components`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createPayload),
        })

        const result = await response.json()

        if (!result.success) {
          throw new Error(result.error || 'Failed to create component')
        }

        // Refetch components to get latest data from database
        const componentsResponse = await apiRequest(`/api/cases/${caseId}/components`)
        const componentsData = await componentsResponse.json()

        if (componentsData.success && componentsData.components) {
          const transformedComponents = componentsData.components.map(transformComponentFromDB)
          setComponents(transformedComponents)

          // If parent was set, expand that parent node
          if (editFormData.parentId) {
            const newExpanded = new Set(expandedNodes)
            newExpanded.add(editFormData.parentId)
            setExpandedNodes(newExpanded)
          }

          // Select the newly created component
          if (result.component && result.component.component_id) {
            setSelectedNode(String(result.component.component_id))
          }
        }

        toast.success("Component created successfully")
      }

      // Reset form and exit edit/create mode
      setIsEditing(false)
      setIsCreating(false)
      setEditFormData({})
    } catch (error: any) {
      console.error("Error saving component:", error)
      toast.error(error.message || "Failed to save component")
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setIsCreating(false)
    setEditFormData({})
  }

  const handleDragStart = (e: React.DragEvent, nodeId: string) => {
    setDraggedNode(nodeId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, nodeId: string) => {
    e.preventDefault()
    
    if (!draggedNode || draggedNode === nodeId) {
      setDragOverNode(null)
      setIsDragValid(false)
      return
    }

    const draggedComponent = components.find(n => n.id === draggedNode)
    const targetComponent = components.find(n => n.id === nodeId)
    
    if (!draggedComponent || !targetComponent) {
      setDragOverNode(null)
      setIsDragValid(false)
      return
    }

    // Check if target can accept this child type
    const allowedChildren = hierarchyRules[targetComponent.type] || []
    const isValidDrop = allowedChildren.includes(draggedComponent.type)
    
    const isValidHierarchy = !isDescendant(draggedNode, nodeId)
    const finalValid = isValidDrop && isValidHierarchy
    
    e.dataTransfer.dropEffect = finalValid ? 'move' : 'none'
    setDragOverNode(nodeId)
    setIsDragValid(finalValid)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    // Only clear drag over if we're actually leaving the element
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverNode(null)
      setIsDragValid(false)
    }
  }

  const handleDrop = (e: React.DragEvent, targetNodeId: string) => {
    e.preventDefault()
    
    if (!draggedNode || draggedNode === targetNodeId) {
      setDraggedNode(null)
      setDragOverNode(null)
      return
    }

    const draggedComponent = components.find(n => n.id === draggedNode)
    const targetComponent = components.find(n => n.id === targetNodeId)
    
    if (!draggedComponent || !targetComponent) {
      setDraggedNode(null)
      setDragOverNode(null)
      return
    }

    // Check if target can accept this child type
    const allowedChildren = hierarchyRules[targetComponent.type] || []
    if (!allowedChildren.includes(draggedComponent.type)) {
      toast.error(`${getTypeLabel(targetComponent.type)} cannot contain ${getTypeLabel(draggedComponent.type)}`)
      setDraggedNode(null)
      setDragOverNode(null)
      return
    }

    if (isDescendant(draggedNode, targetNodeId)) {
      toast.error("Cannot move a component into its own child")
      setDraggedNode(null)
      setDragOverNode(null)
      return
    }

    // Update the dragged component's parent
    updateComponentNode(draggedNode, { parentId: targetNodeId })
    toast.success(`Moved ${draggedComponent.name} under ${targetComponent.name}`)
    
    setDraggedNode(null)
    setDragOverNode(null)
  }

  const handleDragEnd = () => {
    setDraggedNode(null)
    setDragOverNode(null)
    setIsDragValid(false)
  }

  const buildTree = (components: ProcessNode[]): TreeNode[] => {
    const nodeMap = new Map()
    const roots: TreeNode[] = []
    const orphans: TreeNode[] = [] // Track components with invalid parent references

    // Create node map
    components.forEach((comp) => {
      nodeMap.set(comp.id, { ...comp, children: [] })
    })

    // Build parent-child relationships
    components.forEach((comp) => {
      if (comp.parentId) {
        const parent = nodeMap.get(comp.parentId)
        if (parent) {
          parent.children.push(nodeMap.get(comp.id))
        } else {
          // Parent doesn't exist - treat as orphan/root node
          orphans.push(nodeMap.get(comp.id))
        }
      } else {
        roots.push(nodeMap.get(comp.id))
      }
    })

    // Return both proper roots and orphaned components
    return [...roots, ...orphans]
  }

  const renderTreeNode = (node: TreeNode, level = 0, isLast = false, parentPrefix = "") => {
    const hasChildren = node.children && node.children.length > 0
    const isExpanded = expandedNodes.has(node.id)
    const isSelected = selectedNode === node.id
    const isHovered = hoveredNode === node.id
    const isInlineEditing = inlineEditingNode === node.id
    const showControls = isHovered || isSelected || contextMenuOpen === node.id
    const colors = getNodeColors(node.type, isSelected, isHovered)
    const component = components?.find(c => c.id === node.id)

    const connector = isLast ? "└─" : "├─"
    const childPrefix = parentPrefix + (isLast ? "   " : "│  ")

    return (
      <div key={node.id} className="space-y-4">
        <div className="flex items-start gap-4 group" style={{ marginLeft: `${level * 20}px` }}>
          {/* Tree Connectors */}
          {level > 0 && (
            <span className="text-on-surface-variant/70 font-mono text-sm select-none shrink-0 mt-4">
              {connector}
            </span>
          )}

          <div
            style={dragOverNode !== node.id ? { ...colors.bgStyle, ...colors.borderStyle } : undefined}
            className={`flex-1 flex items-center gap-4 py-3 px-4 pr-16 rounded-lg cursor-pointer relative transition-all duration-200 ${
              isSelected ? `${colors.borderWidth} ${colors.shadow} ${colors.ring}` :
              dragOverNode === node.id ? (
                isDragValid
                  ? "bg-primary-fixed/15 dark:bg-green-900 border-2 border-primary/50 dark:border-green-600 shadow-lg"
                  : "bg-red-50 dark:bg-red-900 border-2 border-red-400 dark:border-red-600 shadow-lg"
              ) : `${colors.borderWidth} hover:bg-surface-container-low`
            } ${draggedNode === node.id ? "opacity-50 scale-95" : ""} ${
              isTreeExpanded ? "min-h-[60px]" : ""
            }`}
          draggable={!isInlineEditing}
          onDragStart={(e) => handleDragStart(e, node.id)}
          onDragOver={(e) => handleDragOver(e, node.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, node.id)}
          onDragEnd={handleDragEnd}
          onMouseEnter={() => setHoveredNode(node.id)}
          onMouseLeave={() => setHoveredNode(null)}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("[data-menu-trigger]")) {
              return
            }

            // If node is not selected, select it and open edit form
            if (!isSelected) {
              setSelectedNode(node.id)
              // Get the full component data and trigger edit
              const fullComponent = components.find(c => c.id === node.id)
              if (fullComponent) {
                setEditFormData({
                  processName: fullComponent.name,
                  processType: fullComponent.type,
                  processDescription: fullComponent.description || "",
                  driverCategory: fullComponent.driverCategory || "",
                  selectedDriver: fullComponent.selectedDriver || "",
                  mass: fullComponent.mass ?? undefined,
                  massUnit: fullComponent.massUnit || "",
                  operationalCostUSD: fullComponent.operationalCostUSD ?? undefined,
                  capitalCostUSD: fullComponent.capitalCostUSD ?? undefined,
                  parentId: fullComponent.parentId || undefined,
                  // ABC Costing - Detailed cost breakdown
                  laborCost: fullComponent.laborCost ?? undefined,
                  energyCost: fullComponent.energyCost ?? undefined,
                  transportationCost: fullComponent.transportationCost ?? undefined,
                  materialCost: fullComponent.materialCost ?? undefined,
                  equipmentCost: fullComponent.equipmentCost ?? undefined,
                  overheadCost: fullComponent.overheadCost ?? undefined,
                  currency: fullComponent.currency || 'USD',
                  costAllocationType: fullComponent.costAllocationType ?? undefined,
                })
                setIsEditing(true)
              }
              setActiveTab("data") // Switch to data tab immediately
              return
            }

            // If node is already selected and has children, toggle expansion
            if (isSelected && hasChildren) {
              const newExpanded = new Set(expandedNodes)
              if (newExpanded.has(node.id)) {
                newExpanded.delete(node.id)
              } else {
                newExpanded.add(node.id)
              }
              setExpandedNodes(newExpanded)
            }
          }}
          onDoubleClick={(e) => {
            if ((e.target as HTMLElement).closest("[data-menu-trigger]")) {
              return
            }

            // Double-click collapses all children recursively
            if (hasChildren) {
              const collapseAllChildren = (nodeId: string) => {
                const allNodes = processNodes
                const children = allNodes.filter(n => n.parentId === nodeId)
                const childIds = new Set(children.map(c => c.id))

                // Recursively collect all descendants
                const collectDescendants = (parentId: string): string[] => {
                  const directChildren = allNodes.filter(n => n.parentId === parentId)
                  let allDescendants = directChildren.map(c => c.id)

                  directChildren.forEach(child => {
                    allDescendants = allDescendants.concat(collectDescendants(child.id))
                  })

                  return allDescendants
                }

                return collectDescendants(nodeId)
              }

              const newExpanded = new Set(expandedNodes)
              const allDescendants = collapseAllChildren(node.id)

              // Remove this node and all its descendants from expanded set
              newExpanded.delete(node.id)
              allDescendants.forEach(id => newExpanded.delete(id))

              setExpandedNodes(newExpanded)
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setContextMenuPosition({ x: e.clientX, y: e.clientY })
            setContextMenuOpen(node.id)
          }}
          tabIndex={0}
        >
          {/* Process type indicator badge with label - Full colored circle */}
          <div
            style={colors.iconStyle}
            className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 shadow-md"
          >
            <span className="text-white text-xs font-bold">
              {node.type === 'product' ? 'P' :
               node.type === 'machine_line' ? 'M' :
               node.type === 'subprocess' ? 'S' :
               node.type === 'operation' ? 'O' : 'E'}
            </span>
          </div>

          {showControls && <GripVertical className="h-3 w-3 text-on-surface-variant/70 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />}

          {hasChildren && (
            <ChevronRight className={`h-5 w-5 text-on-surface-variant transition-transform ${isExpanded ? "rotate-90" : ""}`} />
          )}
          {!hasChildren && <div className="w-5" />}

          {isInlineEditing ? (
            <Input
              value={inlineEditValue}
              onChange={(e) => setInlineEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  saveInlineEdit()
                } else if (e.key === "Escape") {
                  e.preventDefault()
                  cancelInlineEdit()
                }
              }}
              onBlur={saveInlineEdit}
              className={`text-sm font-medium ${isTreeExpanded ? 'h-8' : 'h-6'} py-0 px-1 border-0 bg-card shadow-sm`}
              autoFocus
            />
          ) : (
            null
          )}

          {isTreeExpanded ? (
            <div className="flex flex-col flex-1 gap-1">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${colors.text}`}>{node.name}</span>
              </div>
              {component && (
                <div className="text-xs text-on-surface-variant space-y-1">
                  {component.driverCategory && (
                    <div className="flex items-center gap-1">
                      <Palette className={`h-3 w-3 ${colors.icon}`} />
                      <span className={colors.text}>{component.driverCategory}</span>
                    </div>
                  )}
                  {component.mass && (
                    <div className="flex items-center gap-1">
                      <span className={colors.text}>
                        {component.mass} {component.massUnit || 'kg'}
                      </span>
                    </div>
                  )}
                  {(component.operationalCostUSD || component.capitalCostUSD) && (
                    <div className="flex items-center gap-1">
                      <span className={`font-medium ${colors.text}`}>
                        ${((component.operationalCostUSD || 0) + (component.capitalCostUSD || 0)).toFixed(0)} USD
                      </span>
                    </div>
                  )}
                  {component.drivers && component.drivers.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Info className={`h-3 w-3 ${colors.icon}`} />
                      <span className={colors.text}>{component.drivers.length} drivers</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <span className={`text-base font-medium ${isSelected ? colors.text : isHovered ? colors.text : "text-on-surface"}`}>{node.name}</span>
          )}

          {showControls && !isInlineEditing && (
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 w-6 p-0 absolute right-2 top-1/2 -translate-y-1/2 z-30 opacity-0 group-hover:opacity-100 transition-opacity`}
              data-menu-trigger
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const rect = e.currentTarget.getBoundingClientRect()
                setContextMenuPosition({ x: rect.left, y: rect.bottom })
                setContextMenuOpen(node.id)
              }}
              aria-haspopup="menu"
              aria-expanded={contextMenuOpen === node.id}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          )}
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div className="space-y-4">
            {node.children.map((child, index) =>
              renderTreeNode(child, level + 1, index === node.children.length - 1, childPrefix)
            )}
          </div>
        )}
      </div>
    )
  }

  const treeData = buildTree(processNodes)

  const getMenuLabels = (node: ProcessNode) => {
    const childType = getAllowedChildType(node.type)

    // Only show child creation if this node type can have children
    if (childType) {
      return {
        showChild: true,
        showSibling: false, // Never show sibling options
        addChild: `Add ${getTypeLabel(childType)}`,
      }
    }

    // Elemental nodes have no children
    return {
      showChild: false,
      showSibling: false,
    }
  }

  // Render hierarchical flow chart
  const renderFlowChart = () => {
    // Build hierarchy tree
    const rootNodes = components.filter(c => !c.parentId)
    
    const renderFlowNode = (node: ComponentNode, level: number = 0) => {
      // Use string comparison for consistent type handling
      const children = components.filter(c => String(c.parentId) === String(node.id))
      const isSelected = selectedNode === node.id
      const colors = getFlowChartColorsByType(node.type, isSelected)
      const isSearchMatch = searchQuery && node.name.toLowerCase().includes(searchQuery.toLowerCase())
      const isExpanded = !expandedNodes.has(node.id) // Note: we store collapsed nodes, not expanded

      return (
        <div key={node.id} className="flex flex-col items-center relative">
          {/* Simplified Node Card - Figma Design - Scaled to 0.8 */}
          <div
            className={`
              group relative
              rounded-xl shadow-lg
              px-6 py-4 min-w-[180px] max-w-[240px]
              cursor-pointer transition-all duration-200
              scale-[0.8] origin-top
              ${isSelected
                ? 'ring-2 ring-blue-500 shadow-2xl !scale-[0.84]'
                : 'hover:shadow-xl hover:scale-[0.82]'
              }
              ${isSearchMatch ? 'ring-2 ring-yellow-400 animate-pulse' : ''}
            `}
            style={{
              backgroundColor: colors.bg,
              borderColor: colors.border,
              borderWidth: '3px',
              borderStyle: 'solid',
              color: colors.text
            }}
            onClick={() => {
              setSelectedNode(node.id)
              setActiveTab("data")
            }}
          >
            {/* Expand/Collapse Toggle - only show if has children */}
            {children.length > 0 && (
              <button
                className="absolute -bottom-3 left-1/2 -translate-x-1/2 h-6 w-6 bg-white border border-outline-variant/40 rounded-full shadow-sm flex items-center justify-center hover:bg-surface-container z-20"
                onClick={(e) => {
                  e.stopPropagation()
                  setExpandedNodes(prev => {
                    const newSet = new Set(prev)
                    if (newSet.has(node.id)) {
                      newSet.delete(node.id)
                    } else {
                      newSet.add(node.id)
                    }
                    return newSet
                  })
                }}
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                <ChevronDown className={`h-4 w-4 text-on-surface-variant transition-transform ${!isExpanded ? '-rotate-90' : ''}`} />
              </button>
            )}
            {/* Context Menu (visible on hover) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-black/10 flex items-center justify-center z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation()
                  setSelectedNode(node.id)
                  setEditFormData({
                    processType: node.type,
                    processName: node.name,
                    processDescription: node.description,
                    parentId: node.parentId || "",
                    driverCategory: node.driverCategory,
                    selectedDriver: node.selectedDriver,
                    mass: node.mass,
                    massUnit: node.massUnit,
                    operationalCostUSD: node.operationalCostUSD,
                    capitalCostUSD: node.capitalCostUSD,
                  })
                  setTreeEditingComponent(node.id)
                }}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation()
                  toast.info("Add child functionality coming soon")
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Child
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation()
                  toast.info("Duplicate functionality coming soon")
                }}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(`Delete "${node.name}"?`)) {
                      deleteComponentNode(node.id)
                      toast.success("Component deleted")
                    }
                  }}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Centered Node Name */}
            <div className="text-center">
              <p className="font-semibold text-base leading-snug">
                {node.name}
              </p>
            </div>
          </div>

          {/* T-Junction Connector - only show if expanded */}
          {children.length > 0 && isExpanded && (
            <>
              {/* Vertical stem from parent */}
              <div className="w-0.5 h-8 -mt-[4px]" style={{ backgroundColor: '#9CA3AF' }}></div>

              {/* Children Container with horizontal connector */}
              <div className="flex gap-3 justify-center items-start relative">
                {/* Horizontal line spanning children */}
                {children.length > 1 && (
                  <div
                    className="absolute top-0 h-0.5"
                    style={{
                      backgroundColor: '#9CA3AF',
                      left: `calc(100% / ${children.length} / 2)`,
                      right: `calc(100% / ${children.length} / 2)`
                    }}
                  />
                )}

                {children.map((child) => (
                  <div key={child.id} className="flex flex-col items-center">
                    {/* Vertical line down to child */}
                    <div className="w-0.5 h-8 -mt-[2px] -mb-[4px]" style={{ backgroundColor: '#9CA3AF' }}></div>
                    {renderFlowNode(child, level + 1)}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )
    }
    
    if (rootNodes.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="text-on-surface-variant mb-4">No components found</div>
          <Button onClick={() => {
            setShowTreeVisualization(false)
          }}>Close</Button>
        </div>
      )
    }
    
    return (
      <div className="flex flex-wrap gap-10 justify-center items-start">
        {rootNodes.map(root => renderFlowNode(root))}
      </div>
    )
  }

  // Render main content area based on selection and mode
  const renderMainContent = () => {
    // Tree Visualization Mode
    if (showTreeVisualization) {
      const selectedComponent = selectedNode ? components.find(c => c.id === selectedNode) : null

      return (
        <div className="fixed inset-0 top-16 z-30 bg-cyan-50/80 flex flex-col overflow-hidden" style={{ overscrollBehavior: 'none' }}>
          {/* Enhanced Modern Header */}
          <div className="sticky top-0 z-50 bg-white border-b shadow-sm">
            {/* Row 1: Breadcrumb & Main Actions */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-outline-variant/30">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowTreeVisualization(false)
                    setTreeEditingComponent(null)
                    setEditFormData({})
                    setSearchQuery("")
                  }}
                  className="h-8"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <div className="flex items-center gap-2">
                  <Network className="h-5 w-5 text-on-surface-variant" />
                  <h2 className="text-lg font-semibold text-on-surface">Process Hierarchy</h2>
                </div>
                <Badge variant="outline" className="ml-2">{currentCase.name}</Badge>
                <span className="text-sm text-on-surface-variant ml-2">
                  {components.length} component{components.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Row 2: Search & Controls */}
            <div className="flex items-center gap-3 px-6 py-2 bg-surface-container-low">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant/70" />
                <Input
                  placeholder="Search components..."
                  className="pl-10 h-9 bg-white"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1 bg-white border rounded-lg px-2 py-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setZoomLevel(prev => Math.max(prev - 10, 30))}
                  disabled={zoomLevel <= 30}
                  title="Zoom out (Ctrl -)"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs text-on-surface-variant min-w-[3rem] text-center font-medium">
                  {zoomLevel}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setZoomLevel(prev => Math.min(prev + 10, 200))}
                  disabled={zoomLevel >= 200}
                  title="Zoom in (Ctrl +)"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <div className="w-px h-4 bg-surface-container-high mx-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    setZoomLevel(80)
                    setPanOffset({ x: 0, y: 0 })
                  }}
                  title="Fit to view"
                >
                  <Focus className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Expand/Collapse All */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (allExpanded) {
                    setExpandedNodes(new Set())
                    setAllExpanded(false)
                  } else {
                    const allWithChildren = new Set<string>()
                    components.forEach(c => {
                      if (components.some(child => child.parentId === c.id)) {
                        allWithChildren.add(c.id)
                      }
                    })
                    setExpandedNodes(allWithChildren)
                    setAllExpanded(true)
                  }
                }}
                className="h-8"
              >
                <ChevronDown className={`h-4 w-4 mr-1 transition-transform ${allExpanded ? '' : '-rotate-90'}`} />
                {allExpanded ? 'Collapse All' : 'Expand All'}
              </Button>

              {/* Fullscreen Toggle */}
              <Button
                variant={isFullscreen ? "default" : "outline"}
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="h-8"
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen view"}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>

              {/* Pan indicator */}
              {isPanning && (
                <Badge variant="secondary" className="h-8 gap-1">
                  <Hand className="h-3 w-3" />
                  Panning
                </Badge>
              )}
            </div>
          </div>

          {/* Main Content Area with Flexible Layout */}
          <div className="flex-1 min-h-0 relative overflow-hidden" style={{ height: '100%' }}>
            {/* Left Side - Tree Visualization with Zoom (Resizable) */}
            <div
              ref={treeContainerRef}
              className={`absolute top-0 left-0 bottom-0 overflow-auto transition-all duration-150 ${
                isPanning ? 'cursor-grabbing' : 'cursor-grab'
              }`}
              style={{
                width: isFullscreen ? '100%' : `${treePanelWidth}%`,
                background: 'radial-gradient(circle at 1px 1px, rgb(209 213 219 / 0.3) 1px, transparent 0)',
                backgroundSize: '40px 40px',
                backgroundColor: '#fafafa',
                overscrollBehavior: 'contain',
              }}
              onWheel={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  e.preventDefault()
                  e.stopPropagation()
                  const delta = e.deltaY > 0 ? -5 : 5
                  setZoomLevel(prev => Math.max(30, Math.min(200, prev + delta)))
                }
              }}
              onMouseDown={(e) => {
                if (e.button === 0) {
                  setIsPanning(true)
                  setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
                }
              }}
              onMouseMove={(e) => {
                if (isPanning) {
                  setPanOffset({
                    x: e.clientX - panStart.x,
                    y: e.clientY - panStart.y
                  })
                }
              }}
              onMouseUp={() => setIsPanning(false)}
              onMouseLeave={() => setIsPanning(false)}
            >
              {/* Canvas Container */}
              <div
                className="inline-block p-8 pt-12"
                style={{
                  marginLeft: panOffset.x,
                  marginTop: panOffset.y,
                }}
              >
                <div
                  className="transform-gpu transition-transform duration-100 origin-top"
                  style={{ transform: `scale(${zoomLevel / 100})` }}
                >
                  {renderFlowChart()}
                </div>
              </div>

              {/* Mini controls hint */}
              <div className="absolute bottom-3 left-3 text-xs text-on-surface-variant/70 bg-white/80 px-2 py-1 rounded">
                Scroll to pan • Ctrl+Scroll to zoom • Drag to move
              </div>
            </div>

            {/* Resize Handle - Hidden in fullscreen */}
            {!isFullscreen && (
              <div
                className="absolute top-0 bottom-0 w-2 bg-surface-container-high hover:bg-primary/60 cursor-col-resize hover:w-3 transition-all flex items-center justify-center group select-none z-10"
                style={{ left: `calc(${treePanelWidth}% - 4px)` }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  setIsResizing(true)
                }}
                title="Drag to resize panels"
              >
                <div className="flex flex-col gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                  <div className="w-1 h-1 bg-surface-container-low0 rounded-full" />
                  <div className="w-1 h-1 bg-surface-container-low0 rounded-full" />
                  <div className="w-1 h-1 bg-surface-container-low0 rounded-full" />
                </div>
              </div>
            )}

            {/* Right Side - Component Details Panel (Flexible) - Hidden in fullscreen */}
            {!isFullscreen && (
            <div
              className="absolute top-0 right-0 bottom-0 bg-white border-l border-outline-variant/30 p-4 overflow-auto"
              style={{ left: `${treePanelWidth}%`, overscrollBehavior: 'contain' }}
            >
              {selectedComponent ? (
                <div className="space-y-2">
                  {/* Component Header */}
                  <div className="border-b pb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="outline" className="text-xs font-medium border shadow-sm">
                        {getTypeLabel(selectedComponent.type)}
                      </Badge>
                      {treeEditingComponent === selectedComponent.id ? (
                        <div className="flex gap-2 ml-auto">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setTreeEditingComponent(null)
                              setEditFormData({})
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="bg-primary hover:bg-primary-container"
                            onClick={() => {
                              updateComponentNode(selectedComponent.id, {
                                name: editFormData.processName || selectedComponent.name,
                                description: editFormData.processDescription,
                                parentId: editFormData.parentId === "" ? null : editFormData.parentId,
                                driverCategory: editFormData.driverCategory,
                                selectedDriver: editFormData.selectedDriver,
                                mass: editFormData.mass,
                                massUnit: editFormData.massUnit,
                                operationalCostUSD: editFormData.operationalCostUSD,
                                capitalCostUSD: editFormData.capitalCostUSD,
                              })
                              setTreeEditingComponent(null)
                              setEditFormData({})
                              toast.success("Component updated successfully")
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditFormData({
                              processType: selectedComponent.type,
                              processName: selectedComponent.name,
                              processDescription: selectedComponent.description,
                              parentId: selectedComponent.parentId || "",
                              driverCategory: selectedComponent.driverCategory,
                              selectedDriver: selectedComponent.selectedDriver,
                              mass: selectedComponent.mass,
                              massUnit: selectedComponent.massUnit,
                              operationalCostUSD: selectedComponent.operationalCostUSD,
                              capitalCostUSD: selectedComponent.capitalCostUSD,
                            })
                            setTreeEditingComponent(selectedComponent.id)
                          }}
                          className="ml-auto"
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      )}
                    </div>
                    {treeEditingComponent === selectedComponent.id ? (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm font-semibold text-on-surface">Component Name</Label>
                          <Input
                            value={editFormData.processName || ""}
                            onChange={(e) => setEditFormData({ ...editFormData, processName: e.target.value })}
                            className="mt-1"
                            placeholder="Component name"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-semibold text-on-surface">Description</Label>
                          <Input
                            value={editFormData.processDescription || ""}
                            onChange={(e) => setEditFormData({ ...editFormData, processDescription: e.target.value })}
                            className="mt-1"
                            placeholder="Component description"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <h3 className="text-xl font-bold text-on-surface">{selectedComponent.name}</h3>
                        {selectedComponent.description && (
                          <p className="text-sm text-on-surface-variant mt-1">{selectedComponent.description}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Section */}
                  {!treeEditingComponent && (
                    <div className="bg-secondary-container border border-outline-variant/40 rounded-lg p-4">
                      <h4 className="text-sm font-bold text-on-surface uppercase tracking-wide mb-3">Actions</h4>
                      <Button
                        onClick={() => {
                          // Navigate to results page with component context
                          router.push(`/project/${projectId}/case/${caseId}/results?component=${selectedComponent.id}`)
                        }}
                        className="w-full veridian-gradient text-white font-semibold px-4 py-2 rounded-md shadow-sm hover:opacity-95 transition-opacity"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Run Assessment (from this component)
                      </Button>
                      <p className="text-xs text-primary mt-2">
                        Runs assessment for this component and all its descendants
                      </p>
                    </div>
                  )}

                  {/* Component Details - Edit Mode or View Mode */}
                  {treeEditingComponent === selectedComponent.id ? (
                    <div className="space-y-2">
                      {/* Hierarchy Section */}
                      <div className="bg-surface-container-low p-4 rounded-lg space-y-4">
                        <h4 className="text-sm font-bold text-on-surface uppercase tracking-wide">Hierarchy</h4>

                        {/* Parent Component Selection */}
                        <div>
                          <Label className="text-sm font-semibold text-on-surface">Parent Component</Label>
                          <Select
                            value={editFormData.parentId || "none"}
                            onValueChange={(value) => setEditFormData({...editFormData, parentId: value === "none" ? "" : value})}
                          >
                            <SelectTrigger className="mt-1.5">
                              <SelectValue placeholder="Select parent component" />
                            </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              <span className="text-on-surface-variant">No parent (floating component)</span>
                            </SelectItem>
                            {(() => {
                              // Map database types to UI types for hierarchy lookup
                              const typeMapping: Record<string, string> = {
                                'product': 'Product',
                                'machine_line': 'Machine/Line',
                                'subprocess': 'Subprocess',
                                'operation': 'Operation',
                                'elemental_task': 'Elemental Task'
                              }

                              const hierarchyRules: Record<string, string[]> = {
                                "Product": ["Machine/Line"],
                                "Machine/Line": ["Subprocess"],
                                "Subprocess": ["Operation"],
                                "Operation": ["Elemental Task"],
                                "Elemental Task": [],
                                "product": ["machine_line"],
                                "machine_line": ["subprocess"],
                                "subprocess": ["operation"],
                                "operation": ["elemental_task"],
                                "elemental_task": [],
                              }

                              const eligibleParents = (components || []).filter(comp => {
                                // Don't allow self-selection
                                if (comp.id === selectedComponent.id) return false

                                // Don't allow selection of own children (prevents circular references)
                                const isChild = (parentId: string, childId: string): boolean => {
                                  const children = (components || []).filter(c => c.parentId === parentId)
                                  return children.some(child => child.id === childId || isChild(child.id, childId))
                                }
                                if (isChild(selectedComponent.id, comp.id)) return false

                                // Check hierarchy rules - parent must be able to contain current component type
                                const allowedChildren = hierarchyRules[comp.type] || []
                                return allowedChildren.includes(selectedComponent.type)
                              })

                              return eligibleParents.map((parent) => (
                                <SelectItem key={parent.id} value={parent.id}>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">
                                      {getTypeLabel(parent.type)}
                                    </Badge>
                                    <span>{parent.name}</span>
                                  </div>
                                </SelectItem>
                              ))
                            })()}
                          </SelectContent>
                        </Select>
                          <p className="text-xs text-on-surface-variant mt-1.5">
                            Choose a parent component or leave as floating component
                          </p>
                        </div>
                      </div>

                      {/* Environmental Drivers Section */}
                      <div className="bg-secondary-container p-4 rounded-lg space-y-4">
                        <h4 className="text-sm font-bold text-on-surface uppercase tracking-wide">Environmental Drivers</h4>

                        {/* Driver Category */}
                        <div>
                          <Label className="text-sm font-semibold text-on-surface">Driver Category</Label>
                          <Select
                            value={editFormData.driverCategory || ""}
                            onValueChange={(value) => setEditFormData({...editFormData, driverCategory: value, selectedDriver: ""})}
                          >
                            <SelectTrigger className="mt-1.5">
                              <SelectValue placeholder="Select driver category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Energy">Energy</SelectItem>
                              <SelectItem value="Materials">Materials</SelectItem>
                              <SelectItem value="Transport">Transport</SelectItem>
                              <SelectItem value="Waste">Waste</SelectItem>
                              <SelectItem value="Water">Water</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Selected Driver */}
                        <div>
                          <Label className="text-sm font-semibold text-on-surface">Selected Driver</Label>
                        <Select
                          value={editFormData.selectedDriver || ""}
                          onValueChange={(value) => setEditFormData({...editFormData, selectedDriver: value})}
                          disabled={!editFormData.driverCategory}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder={editFormData.driverCategory ? "Select driver" : "Select category first"} />
                          </SelectTrigger>
                          <SelectContent>
                            {editFormData.driverCategory === "Energy" && (
                              <>
                                <SelectItem value="Electricity (kWh)">Electricity (kWh)</SelectItem>
                                <SelectItem value="Natural Gas (MJ)">Natural Gas (MJ)</SelectItem>
                                <SelectItem value="Diesel (L)">Diesel (L)</SelectItem>
                                <SelectItem value="Coal (kg)">Coal (kg)</SelectItem>
                                <SelectItem value="Renewable Energy (kWh)">Renewable Energy (kWh)</SelectItem>
                              </>
                            )}
                            {editFormData.driverCategory === "Materials" && (
                              <>
                                <SelectItem value="Steel (kg)">Steel (kg)</SelectItem>
                                <SelectItem value="Aluminum (kg)">Aluminum (kg)</SelectItem>
                                <SelectItem value="Plastic (kg)">Plastic (kg)</SelectItem>
                                <SelectItem value="Concrete (kg)">Concrete (kg)</SelectItem>
                                <SelectItem value="Glass (kg)">Glass (kg)</SelectItem>
                                <SelectItem value="Copper (kg)">Copper (kg)</SelectItem>
                              </>
                            )}
                            {editFormData.driverCategory === "Transport" && (
                              <>
                                <SelectItem value="Truck Transport (tkm)">Truck Transport (tkm)</SelectItem>
                                <SelectItem value="Rail Transport (tkm)">Rail Transport (tkm)</SelectItem>
                                <SelectItem value="Ship Transport (tkm)">Ship Transport (tkm)</SelectItem>
                                <SelectItem value="Air Transport (tkm)">Air Transport (tkm)</SelectItem>
                              </>
                            )}
                            {editFormData.driverCategory === "Waste" && (
                              <>
                                <SelectItem value="Solid Waste (kg)">Solid Waste (kg)</SelectItem>
                                <SelectItem value="Liquid Waste (L)">Liquid Waste (L)</SelectItem>
                                <SelectItem value="Hazardous Waste (kg)">Hazardous Waste (kg)</SelectItem>
                              </>
                            )}
                            {editFormData.driverCategory === "Water" && (
                              <>
                                <SelectItem value="Freshwater (L)">Freshwater (L)</SelectItem>
                                <SelectItem value="Wastewater (L)">Wastewater (L)</SelectItem>
                                <SelectItem value="Process Water (L)">Process Water (L)</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        </div>
                      </div>

                      {/* Physical Attributes Section */}
                      <div className="bg-primary-fixed/15 p-4 rounded-lg space-y-4">
                        <h4 className="text-sm font-bold text-on-surface uppercase tracking-wide">Physical Attributes</h4>

                        {/* Mass */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-sm font-semibold text-on-surface">Mass</Label>
                            <Input
                              type="number"
                              value={editFormData.mass || ""}
                              onChange={(e) => setEditFormData({...editFormData, mass: parseFloat(e.target.value) || 0})}
                              className="mt-1.5"
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-semibold text-on-surface">Unit</Label>
                            <Select
                              value={editFormData.massUnit || "kg"}
                              onValueChange={(value) => setEditFormData({...editFormData, massUnit: value})}
                            >
                              <SelectTrigger className="mt-1.5">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="kg">kg (kilogram)</SelectItem>
                                <SelectItem value="g">g (gram)</SelectItem>
                                <SelectItem value="t">t (metric ton)</SelectItem>
                                <SelectItem value="lb">lb (pound)</SelectItem>
                                <SelectItem value="oz">oz (ounce)</SelectItem>
                                <SelectItem value="unit">unit (piece)</SelectItem>
                                <SelectItem value="line">line (production line)</SelectItem>
                                <SelectItem value="kWh">kWh (kilowatt-hour)</SelectItem>
                                <SelectItem value="MJ">MJ (megajoule)</SelectItem>
                                <SelectItem value="L">L (liter)</SelectItem>
                                <SelectItem value="m3">m³ (cubic meter)</SelectItem>
                                <SelectItem value="m2">m² (square meter)</SelectItem>
                                <SelectItem value="m">m (meter)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Financial Section */}
                      <div className="bg-amber-50 p-4 rounded-lg space-y-4">
                        <h4 className="text-sm font-bold text-on-surface uppercase tracking-wide">Financial</h4>

                        {/* Costs */}
                        <div className="space-y-3">
                          <div>
                            <Label className="text-sm font-semibold text-on-surface">Operational Cost (USD)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editFormData.operationalCostUSD || ""}
                              onChange={(e) => setEditFormData({...editFormData, operationalCostUSD: Math.max(0, parseFloat(e.target.value) || 0)})}
                              className="mt-1.5"
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-semibold text-on-surface">Capital Cost (USD)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editFormData.capitalCostUSD || ""}
                              onChange={(e) => setEditFormData({...editFormData, capitalCostUSD: Math.max(0, parseFloat(e.target.value) || 0)})}
                              className="mt-1.5"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Parent Component Display */}
                      {(() => {
                        const parentComponent = selectedComponent.parentId 
                          ? (components || []).find(c => c.id === selectedComponent.parentId)
                          : null
                        
                        return (
                          <div className="bg-surface-container-low p-3 rounded-lg">
                            <Label className="text-sm font-semibold text-on-surface">Parent Component</Label>
                            {parentComponent ? (
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {getTypeLabel(parentComponent.type)}
                                </Badge>
                                <span className="text-sm text-on-surface-variant">{parentComponent.name}</span>
                              </div>
                            ) : (
                              <div>
                                <p className="text-sm text-on-surface-variant mt-1">Floating component (no parent)</p>
                                {(() => {
                                  // Show available parents that could be assigned
                                  const hierarchyRules: Record<string, string[]> = {
                                    "Product": ["Machine/Line"],
                                    "Machine/Line": ["Subprocess"],
                                    "Subprocess": ["Operation"],
                                    "Operation": ["Elemental Task"],
                                    "Elemental Task": [],
                                  }

                                  const eligibleParents = (components || []).filter(comp => {
                                    if (comp.id === selectedComponent.id) return false

                                    // Check hierarchy rules - parent must be able to contain current component type
                                    const allowedChildren = hierarchyRules[comp.type] || []
                                    return allowedChildren.includes(selectedComponent.type)
                                  })

                                  if (eligibleParents.length > 0) {
                                    return (
                                      <div className="mt-2 p-2 bg-secondary-container rounded border border-outline-variant/40">
                                        <p className="text-xs text-primary font-medium mb-1">Available Parents:</p>
                                        <div className="flex flex-wrap gap-1">
                                          {eligibleParents.map((parent) => (
                                            <Badge key={parent.id} variant="outline" className="text-xs bg-white border-outline-variant/40">
                                              {parent.name}
                                            </Badge>
                                          ))}
                                        </div>
                                        <p className="text-xs text-primary mt-1">Click Edit to assign a parent</p>
                                      </div>
                                    )
                                  }
                                  return null
                                })()}
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {selectedComponent.driverCategory && (
                        <div className="bg-surface-container-low p-3 rounded-lg">
                          <Label className="text-sm font-semibold text-on-surface">Driver Category</Label>
                          <p className="text-sm text-on-surface-variant mt-1">{selectedComponent.driverCategory}</p>
                        </div>
                      )}

                      {selectedComponent.selectedDriver && (
                        <div className="bg-surface-container-low p-3 rounded-lg">
                          <Label className="text-sm font-semibold text-on-surface">Selected Driver</Label>
                          <p className="text-sm text-on-surface-variant mt-1">{selectedComponent.selectedDriver}</p>
                        </div>
                      )}

                      {selectedComponent.mass && (
                        <div className="bg-surface-container-low p-3 rounded-lg">
                          <Label className="text-sm font-semibold text-on-surface">Mass</Label>
                          <p className="text-sm text-on-surface-variant mt-1">
                            {selectedComponent.mass} {selectedComponent.massUnit || 'kg'}
                          </p>
                        </div>
                      )}

                      {(selectedComponent.operationalCostUSD || selectedComponent.capitalCostUSD) && (
                        <div className="bg-surface-container-low p-3 rounded-lg">
                          <Label className="text-sm font-semibold text-on-surface">Costs (USD)</Label>
                          <div className="space-y-1 mt-1">
                            {selectedComponent.operationalCostUSD && (
                              <p className="text-sm text-on-surface-variant">
                                Operational: ${selectedComponent.operationalCostUSD.toLocaleString()}
                              </p>
                            )}
                            {selectedComponent.capitalCostUSD && (
                              <p className="text-sm text-on-surface-variant">
                                Capital: ${selectedComponent.capitalCostUSD.toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Children Components */}
                  {(() => {
                    // Use string comparison to handle potential type mismatches
                    const children = (components || []).filter(c =>
                      String(c.parentId) === String(selectedComponent.id)
                    )
                    if (children.length > 0) {
                      return (
                        <div className="border-t pt-4">
                          <Label className="text-sm font-semibold text-on-surface mb-2 block">
                            Child Components ({children.length})
                          </Label>
                          <div className="space-y-2">
                            {children.map(child => (
                              <div 
                                key={child.id}
                                className="flex items-center gap-2 p-2 bg-surface-container-low rounded cursor-pointer hover:bg-surface-container transition-colors"
                                onClick={() => {
                                  setSelectedNode(child.id)
                                  setActiveTab("data") // Switch to data tab immediately
                                }}
                              >
                                <Badge variant="outline" className="text-xs">
                                  {getTypeLabel(child.type)}
                                </Badge>
                                <span className="text-sm font-medium flex-1">{child.name}</span>
                                <ChevronRight className="h-4 w-4 text-on-surface-variant/70" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center p-8">
                  <div className="text-center max-w-sm">
                    <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mx-auto mb-4">
                      <MousePointer className="h-8 w-8 text-on-surface-variant/70" />
                    </div>
                    <h3 className="text-lg font-semibold text-on-surface mb-2">
                      No Component Selected
                    </h3>
                    <p className="text-sm text-on-surface-variant mb-6">
                      Click on any component in the flowchart to view its details, edit properties, and manage relationships.
                    </p>

                    {/* Quick tips */}
                    <div className="bg-secondary-container rounded-lg p-4 text-left">
                      <h4 className="text-xs font-semibold text-on-surface mb-2">Quick Tips:</h4>
                      <ul className="text-xs text-primary space-y-1">
                        <li className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          <span>Click nodes to view and edit details</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          <span>Use search to quickly find components</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          <span>Hover over nodes for quick actions menu</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          <span>Zoom in/out using the controls above</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      )
    }

    // Create/Edit Form Mode
    if (isCreating || isEditing) {
      return (
        <div className="h-full overflow-hidden">
          <div className="max-w-7xl mx-auto py-6 px-10">
            {/* Title on green background */}
            <div className="text-center mb-8">
              <h2 className="font-display text-3xl font-semibold tracking-tight text-on-surface mb-2">
                {isCreating ? "Create New Component" : `Edit Component`}
              </h2>
              <p className="text-sm text-on-surface-variant">
                {isCreating ? "Add a new component to your LCA model" : `Modify settings for "${selectedComponent?.name}"`}
              </p>
            </div>

            {/* Horizontal Form Layout */}
            <Card className="bg-surface-container-lowest shadow-botanical rounded-xl border-0 overflow-hidden">
              <CardContent className="p-8 md:p-10">
                {/* Tabs for Details and Costs */}
                <Tabs value={editFormTab} onValueChange={setEditFormTab} className="w-full">
                  <TabsList className="flex w-full mb-8 p-1 bg-surface-container-low rounded-full h-auto gap-1">
                    <TabsTrigger value="details" className="flex-1 font-mono text-xs uppercase tracking-wider py-2.5 rounded-full data-[state=active]:veridian-gradient data-[state=active]:text-on-primary data-[state=active]:shadow-botanical text-on-surface-variant">Details</TabsTrigger>
                    <TabsTrigger value="costs" className="flex-1 font-mono text-xs uppercase tracking-wider py-2.5 rounded-full data-[state=active]:veridian-gradient data-[state=active]:text-on-primary data-[state=active]:shadow-botanical text-on-surface-variant">Costs</TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="space-y-6">
                  {/* Row 1: Process Name and Type */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="processName" className="font-mono text-xs uppercase tracking-wider text-on-surface-variant">Process Name</Label>
                      <Input
                        id="processName"
                        value={editFormData.processName || ""}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, processName: e.target.value })
                        }
                        placeholder="e.g., Aluminium Production"
                        className="h-11 text-base px-3 bg-surface-container-low border-0 border-b border-outline-variant/40 rounded-none focus-visible:border-primary focus-visible:border-b-2 focus-visible:ring-0 focus-visible:ring-offset-0 font-sans"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="processType" className="font-mono text-xs uppercase tracking-wider text-on-surface-variant">Process Type</Label>
                      <Select
                        value={editFormData.processType || ""}
                        onValueChange={(value) =>
                          setEditFormData({ ...editFormData, processType: value })
                        }
                      >
                        <SelectTrigger className="h-11 text-base px-3 bg-surface-container-low border-0 border-b border-outline-variant/40 rounded-none focus:border-primary focus:border-b-2 focus:ring-0 focus:ring-offset-0 [&>svg]:text-primary font-sans">
                          <SelectValue placeholder="e.g., Elemental Task" />
                        </SelectTrigger>
                        <SelectContent>
                          {(() => {
                            const hasProduct = components?.some(c => c.type === COMPONENT_TYPES.PRODUCT)
                            return (
                              <>
                                <SelectItem value={COMPONENT_TYPES.PRODUCT} disabled={hasProduct}>
                                  {COMPONENT_TYPE_LABELS.product} {hasProduct && "(Already exists)"}
                                </SelectItem>
                                <SelectItem value={COMPONENT_TYPES.MACHINE_LINE}>{COMPONENT_TYPE_LABELS.machine_line}</SelectItem>
                                <SelectItem value={COMPONENT_TYPES.SUBPROCESS}>{COMPONENT_TYPE_LABELS.subprocess}</SelectItem>
                                <SelectItem value={COMPONENT_TYPES.OPERATION}>{COMPONENT_TYPE_LABELS.operation}</SelectItem>
                                <SelectItem value={COMPONENT_TYPES.ELEMENTAL_TASK}>{COMPONENT_TYPE_LABELS.elemental_task}</SelectItem>
                              </>
                            )
                          })()}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Row 2: Process Description (Full Width) */}
                  <div className="space-y-2">
                    <Label htmlFor="description" className="font-mono text-xs uppercase tracking-wider text-on-surface-variant">Process Description</Label>
                    <Input
                      id="description"
                      value={editFormData.processDescription || ""}
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          processDescription: e.target.value,
                        })
                      }
                      placeholder="Description of the product"
                      className="h-10 text-sm px-3 bg-surface-container-low border-0 border-b border-outline-variant/40 rounded-none focus-visible:border-primary focus-visible:border-b-2 focus-visible:ring-0 focus-visible:ring-offset-0 font-sans"
                    />
                  </div>

                  {/* Parent Selection - Show if not product type */}
                  {editFormData.processType && editFormData.processType !== COMPONENT_TYPES.PRODUCT && (
                    <div className="space-y-2">
                      <Label htmlFor="parentId" className="font-mono text-xs uppercase tracking-wider text-on-surface-variant">Parent Component</Label>
                      <Select
                        value={editFormData.parentId || "none"}
                        onValueChange={(value) =>
                          setEditFormData({ ...editFormData, parentId: value === "none" ? "" : value })
                        }
                      >
                        <SelectTrigger className="h-10 text-sm px-3 bg-surface-container-low border-0 border-b border-outline-variant/40 rounded-none focus:border-primary focus:border-b-2 focus:ring-0 focus:ring-offset-0 [&>svg]:text-primary font-sans">
                          <SelectValue placeholder="Select parent component (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <span className="text-on-surface-variant">No parent (floating component)</span>
                          </SelectItem>
                          {(() => {
                            const eligibleParents = (components || []).filter(comp => {
                              const allowedChildren = hierarchyRules[comp.type] || []
                              return editFormData.processType && allowedChildren.includes(editFormData.processType)
                            })
                            
                            return eligibleParents.map((parent) => (
                              <SelectItem key={parent.id} value={parent.id}>
                                <div className="flex items-center justify-between w-full">
                                  <span>{parent.name}</span>
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {getTypeLabel(parent.type)}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))
                          })()}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Row 3: Driver Category, Selected Driver, Mass, Unit */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase tracking-wider text-on-surface-variant">Driver Category</Label>
                      <Select
                        value={editFormData.driverCategory || ""}
                        onValueChange={(value) => setEditFormData({...editFormData, driverCategory: value, selectedDriver: ""})}
                      >
                        <SelectTrigger className="h-10 text-sm px-3 bg-surface-container-low border-0 border-b border-outline-variant/40 rounded-none focus:border-primary focus:border-b-2 focus:ring-0 focus:ring-offset-0 [&>svg]:text-primary font-sans">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Energy">Energy</SelectItem>
                          <SelectItem value="Materials">Materials</SelectItem>
                          <SelectItem value="Transport">Transport</SelectItem>
                          <SelectItem value="Waste">Waste</SelectItem>
                          <SelectItem value="Water">Water</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase tracking-wider text-on-surface-variant">Selected Driver</Label>
                      <Select
                        value={editFormData.selectedDriver || ""}
                        onValueChange={(value) => {
                          setEditFormData({...editFormData, selectedDriver: value})
                        }}
                        disabled={!editFormData.driverCategory}
                      >
                        <SelectTrigger className="h-10 text-sm px-3 bg-surface-container-low border-0 border-b border-outline-variant/40 rounded-none focus:border-primary focus:border-b-2 focus:ring-0 focus:ring-offset-0 [&>svg]:text-primary font-sans">
                          <SelectValue placeholder={editFormData.driverCategory ? "Select driver" : "Select category first"} />
                        </SelectTrigger>
                        <SelectContent>
                          {editFormData.driverCategory === "Energy" && (
                            <>
                              <SelectItem value="Electricity (kWh)">Electricity (kWh)</SelectItem>
                              <SelectItem value="Natural Gas (MJ)">Natural Gas (MJ)</SelectItem>
                              <SelectItem value="Diesel (L)">Diesel (L)</SelectItem>
                              <SelectItem value="Coal (kg)">Coal (kg)</SelectItem>
                              <SelectItem value="Renewable Energy (kWh)">Renewable Energy (kWh)</SelectItem>
                            </>
                          )}
                          {editFormData.driverCategory === "Materials" && (
                            <>
                              <SelectItem value="Steel (kg)">Steel (kg)</SelectItem>
                              <SelectItem value="Aluminum (kg)">Aluminum (kg)</SelectItem>
                              <SelectItem value="Plastic (kg)">Plastic (kg)</SelectItem>
                              <SelectItem value="Concrete (kg)">Concrete (kg)</SelectItem>
                              <SelectItem value="Glass (kg)">Glass (kg)</SelectItem>
                              <SelectItem value="Copper (kg)">Copper (kg)</SelectItem>
                            </>
                          )}
                          {editFormData.driverCategory === "Transport" && (
                            <>
                              <SelectItem value="Truck Transport (km)">Truck Transport (km)</SelectItem>
                              <SelectItem value="Rail Transport (km)">Rail Transport (km)</SelectItem>
                              <SelectItem value="Ship Transport (km)">Ship Transport (km)</SelectItem>
                              <SelectItem value="Air Transport (km)">Air Transport (km)</SelectItem>
                            </>
                          )}
                          {editFormData.driverCategory === "Waste" && (
                            <>
                              <SelectItem value="Solid Waste (kg)">Solid Waste (kg)</SelectItem>
                              <SelectItem value="Liquid Waste (L)">Liquid Waste (L)</SelectItem>
                              <SelectItem value="Hazardous Waste (kg)">Hazardous Waste (kg)</SelectItem>
                            </>
                          )}
                          {editFormData.driverCategory === "Water" && (
                            <>
                              <SelectItem value="Freshwater (L)">Freshwater (L)</SelectItem>
                              <SelectItem value="Wastewater (L)">Wastewater (L)</SelectItem>
                              <SelectItem value="Process Water (L)">Process Water (L)</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mass" className="font-mono text-xs uppercase tracking-wider text-on-surface-variant">Mass</Label>
                      <Input
                        id="mass"
                        type="number"
                        min="0"
                        step="0.001"
                        value={editFormData.mass || ""}
                        onChange={(e) => setEditFormData({...editFormData, mass: parseFloat(e.target.value) || 0})}
                        placeholder="100"
                        className="h-10 text-sm px-3 bg-surface-container-low border-0 border-b border-outline-variant/40 rounded-none focus-visible:border-primary focus-visible:border-b-2 focus-visible:ring-0 focus-visible:ring-offset-0 font-sans"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="massUnit" className="font-mono text-xs uppercase tracking-wider text-on-surface-variant">Unit</Label>
                      <Select
                        value={editFormData.massUnit || "kg"}
                        onValueChange={(value) => setEditFormData({...editFormData, massUnit: value})}
                      >
                        <SelectTrigger className="h-10 text-sm px-3 bg-surface-container-low border-0 border-b border-outline-variant/40 rounded-none focus:border-primary focus:border-b-2 focus:ring-0 focus:ring-offset-0 [&>svg]:text-primary font-sans">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kg">kg (kilogram)</SelectItem>
                          <SelectItem value="g">g (gram)</SelectItem>
                          <SelectItem value="t">t (metric ton)</SelectItem>
                          <SelectItem value="lb">lb (pound)</SelectItem>
                          <SelectItem value="oz">oz (ounce)</SelectItem>
                          <SelectItem value="unit">unit (piece)</SelectItem>
                          <SelectItem value="line">line (production line)</SelectItem>
                          <SelectItem value="kWh">kWh (kilowatt-hour)</SelectItem>
                          <SelectItem value="MJ">MJ (megajoule)</SelectItem>
                          <SelectItem value="L">L (liter)</SelectItem>
                          <SelectItem value="m3">m³ (cubic meter)</SelectItem>
                          <SelectItem value="m2">m² (square meter)</SelectItem>
                          <SelectItem value="m">m (meter)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  </TabsContent>

                  <TabsContent value="costs" className="space-y-6">
                  {/* Currency Selector */}
                  <div className="space-y-2">
                    <Label htmlFor="currency" className="text-sm font-semibold text-on-surface">
                      Currency
                    </Label>
                    <select
                      id="currency"
                      value={editFormData.currency || 'USD'}
                      onChange={(e) => setEditFormData({...editFormData, currency: e.target.value})}
                      className="w-full px-4 py-2.5 text-sm border border-outline-variant/40 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-primary"
                    >
                      <option value="USD">USD - US Dollar</option>
                    </select>
                    <p className="text-xs text-on-surface-variant">Select the currency for all cost fields below</p>
                  </div>

                  {/* Detailed Cost Breakdown */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-on-surface">
                      Detailed Cost Breakdown
                    </h3>
                    <p className="text-sm text-on-surface-variant">
                      Break down costs by category for activity-based costing analysis.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Labor Costs */}
                      <div className="space-y-2">
                        <Label htmlFor="laborCost" className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                          <Users className="h-4 w-4" />
                          Labor Costs
                        </Label>
                        <Input
                          id="laborCost"
                          type="number"
                          min="0"
                          step="0.01"
                          value={editFormData.laborCost ?? ""}
                          onChange={(e) => setEditFormData({...editFormData, laborCost: parseFloat(e.target.value) || 0})}
                          placeholder="0.00"
                          className="h-11"
                        />
                        <p className="text-xs text-on-surface-variant">Personnel, wages, benefits</p>
                      </div>

                      {/* Energy Costs */}
                      <div className="space-y-2">
                        <Label htmlFor="energyCost" className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                          <Zap className="h-4 w-4" />
                          Energy Costs
                        </Label>
                        <Input
                          id="energyCost"
                          type="number"
                          min="0"
                          step="0.01"
                          value={editFormData.energyCost ?? ""}
                          onChange={(e) => setEditFormData({...editFormData, energyCost: parseFloat(e.target.value) || 0})}
                          placeholder="0.00"
                          className="h-11"
                        />
                        <p className="text-xs text-on-surface-variant">Electricity, fuel, utilities</p>
                      </div>

                      {/* Transportation Costs */}
                      <div className="space-y-2">
                        <Label htmlFor="transportationCost" className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                          <Truck className="h-4 w-4" />
                          Transportation Costs
                        </Label>
                        <Input
                          id="transportationCost"
                          type="number"
                          min="0"
                          step="0.01"
                          value={editFormData.transportationCost ?? ""}
                          onChange={(e) => setEditFormData({...editFormData, transportationCost: parseFloat(e.target.value) || 0})}
                          placeholder="0.00"
                          className="h-11"
                        />
                        <p className="text-xs text-on-surface-variant">Shipping, logistics, freight</p>
                      </div>

                      {/* Material Costs */}
                      <div className="space-y-2">
                        <Label htmlFor="materialCost" className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                          <Package className="h-4 w-4" />
                          Material Costs
                        </Label>
                        <Input
                          id="materialCost"
                          type="number"
                          min="0"
                          step="0.01"
                          value={editFormData.materialCost ?? ""}
                          onChange={(e) => setEditFormData({...editFormData, materialCost: parseFloat(e.target.value) || 0})}
                          placeholder="0.00"
                          className="h-11"
                        />
                        <p className="text-xs text-on-surface-variant">Raw materials, supplies</p>
                      </div>

                      {/* Operational Costs (OPEX) */}
                      <div className="space-y-2">
                        <Label htmlFor="operationalCost" className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                          <DollarSign className="h-4 w-4" />
                          Operational Cost (OPEX)
                        </Label>
                        <Input
                          id="operationalCost"
                          type="number"
                          min="0"
                          step="0.01"
                          value={editFormData.operationalCostUSD ?? ""}
                          onChange={(e) => setEditFormData({...editFormData, operationalCostUSD: parseFloat(e.target.value) || 0})}
                          placeholder="0.00"
                          className="h-11"
                        />
                        <p className="text-xs text-on-surface-variant">Operating expenses</p>
                      </div>

                      {/* Capital Costs (CAPEX) */}
                      <div className="space-y-2">
                        <Label htmlFor="capitalCost" className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                          <Building2 className="h-4 w-4" />
                          Capital Cost (CAPEX)
                        </Label>
                        <Input
                          id="capitalCost"
                          type="number"
                          min="0"
                          step="0.01"
                          value={editFormData.capitalCostUSD ?? ""}
                          onChange={(e) => setEditFormData({...editFormData, capitalCostUSD: parseFloat(e.target.value) || 0})}
                          placeholder="0.00"
                          className="h-11"
                        />
                        <p className="text-xs text-on-surface-variant">Capital expenditures</p>
                      </div>

                    </div>
                  </div>

                  {/* Total Breakdown Summary */}
                  <div className="mt-6 p-4 bg-slate-100 rounded-lg border border-slate-300">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-on-surface">Total Breakdown:</span>
                      <span className="text-2xl font-bold text-slate-900">
                        {editFormData.currency || 'USD'} {((editFormData.laborCost || 0) +
                           (editFormData.energyCost || 0) +
                           (editFormData.transportationCost || 0) +
                           (editFormData.materialCost || 0) +
                           (editFormData.capitalCostUSD || 0) +
                           (editFormData.operationalCostUSD || 0)).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </span>
                    </div>
                  </div>
                  </TabsContent>
                </Tabs>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-3 pt-8 mt-2 border-t border-outline-variant/30">
                    <Button
                      variant="ghost"
                      onClick={handleCancelEdit}
                      className="text-primary font-mono text-sm uppercase tracking-wider hover:bg-primary/5 px-6 py-2.5 h-auto"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveComponent}
                      className="veridian-gradient text-on-primary font-medium px-6 py-2.5 h-auto rounded-md shadow-botanical hover:opacity-95 transition-opacity"
                      disabled={!editFormData.processType || !editFormData.processName?.trim()}
                    >
                      {isCreating ?
                        editFormData.processType === COMPONENT_TYPES.PRODUCT ? "Create Product" :
                        editFormData.processType === COMPONENT_TYPES.MACHINE_LINE ? "Create Machine Line Process" :
                        editFormData.processType === COMPONENT_TYPES.SUBPROCESS ? "Create Subprocess" :
                        editFormData.processType === COMPONENT_TYPES.OPERATION ? "Create Operation" :
                        editFormData.processType === COMPONENT_TYPES.ELEMENTAL_TASK ? "Create Elemental Task" :
                        "Create Component"
                        : "Save Changes"}
                    </Button>
                  </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    }

    // Empty State
    if (!selectedComponent) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center max-w-2xl mx-auto p-8">
            <FileText className="h-12 w-12 text-on-surface-variant/70 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-on-surface mb-2">No component selected</h3>
            <p className="text-on-surface-variant mb-6">Select a component from the tree to view its details, or create a new one.</p>
            
            <Button onClick={handleCreateComponent} className="veridian-gradient text-white font-semibold text-base px-5 py-3 h-10 rounded-md shadow-sm hover:opacity-95 transition-opacity">
              <Plus className="h-5 w-5 mr-2" />
              Create Component
            </Button>
          </div>
        </div>
      )
    }

    // Component View Mode
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold">{selectedComponent.name}</h2>
            <Badge variant="outline" className="text-base px-3 py-1">{getTypeLabel(selectedComponent.type)}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              const node: ProcessNode = {
                id: selectedComponent.id,
                name: selectedComponent.name,
                type: selectedComponent.type,
                description: selectedComponent.description,
                parentId: selectedComponent.parentId || undefined
              }
              handleEditNode(node)
            }}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              const node: ProcessNode = {
                id: selectedComponent.id,
                name: selectedComponent.name,
                type: selectedComponent.type,
                description: selectedComponent.description,
                parentId: selectedComponent.parentId || undefined
              }
              handleDeleteNode(node)
            }}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="data">Data & Drivers</TabsTrigger>
            <TabsTrigger value="abc">ABC Costing</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>

          <TabsContent value="data" className="space-y-2">
            <EnvironmentalFlows
              componentId={parseInt(selectedComponent.id)}
              componentName={selectedComponent.name}
            />
          </TabsContent>

          <TabsContent value="abc" className="space-y-2">
            <AbcCosting
              componentId={parseInt(selectedComponent.id)}
              componentName={selectedComponent.name}
              opex={selectedComponent.operationalCostUSD || 0}
              capex={selectedComponent.capitalCostUSD || 0}
              quantity={selectedComponent.mass || 1}
              unit={selectedComponent.massUnit || "unit"}
              driverType={selectedComponent.selectedDriver}
              driverQuantity={selectedComponent.mass}
              childComponents={
                (components || [])
                  .filter(c => c.parentId === selectedComponent.id)
                  .map(child => ({
                    id: child.id,
                    name: child.name,
                    type: child.type,
                    opex: child.operationalCostUSD || 0,
                    capex: child.capitalCostUSD || 0
                  }))
              }
            />
          </TabsContent>

          <TabsContent value="results" className="space-y-2">
            <Card>
              <CardHeader>
                <CardTitle>Assessment Results</CardTitle>
                <CardDescription>Environmental impact calculations for this component</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <BarChart3 className="h-8 w-8 text-on-surface-variant/70 mx-auto mb-2" />
                  <p className="text-sm text-on-surface-variant mb-4">No results available yet</p>
                  <Button onClick={() => router.push(`/project/${projectId}/case/${caseId}/results`)}>
                    Run Assessment
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  // Render mini tree visualization function
  const renderMiniTree = (node: TreeNode, level = 0): React.ReactNode => {
    const isSelected = selectedNode === node.id
    const hasChildren = node.children && node.children.length > 0
    const colors = getNodeColors(node.type, isSelected, false)

    return (
      <div key={node.id} className="ml-4">
        <div
          className={`flex items-center gap-1 py-1 px-2 rounded cursor-pointer transition-all duration-200 ${
            isSelected
              ? `bg-secondary-container border-2 border-primary shadow-lg`
              : 'hover:bg-surface-container'
          }`}
          onClick={() => {
            setSelectedNode(node.id)
            if (!showTreeVisualization) {
              setIsEditing(true)
              const fullComponent = components.find(c => c.id === node.id)
              if (fullComponent) {
                setEditFormData({
                  processName: fullComponent.name,
                  processType: fullComponent.type,
                  processDescription: fullComponent.description || "",
                  driverCategory: fullComponent.driverCategory || "",
                  selectedDriver: fullComponent.selectedDriver || "",
                  mass: fullComponent.mass ?? undefined,
                  massUnit: fullComponent.massUnit || "",
                  operationalCostUSD: fullComponent.operationalCostUSD ?? undefined,
                  capitalCostUSD: fullComponent.capitalCostUSD ?? undefined,
                  parentId: fullComponent.parentId || undefined,
                  // ABC Costing - Detailed cost breakdown
                  laborCost: fullComponent.laborCost ?? undefined,
                  energyCost: fullComponent.energyCost ?? undefined,
                  transportationCost: fullComponent.transportationCost ?? undefined,
                  materialCost: fullComponent.materialCost ?? undefined,
                  equipmentCost: fullComponent.equipmentCost ?? undefined,
                  overheadCost: fullComponent.overheadCost ?? undefined,
                  currency: fullComponent.currency || 'USD',
                  costAllocationType: fullComponent.costAllocationType ?? undefined,
                })
              }
            }
          }}
        >
          <div className={`w-2 h-2 rounded-full ${colors.bg}`}></div>
          <span className={`text-xs ${isSelected ? 'font-bold text-black' : 'text-on-surface-variant'}`}>
            {node.name}
          </span>
        </div>
        {hasChildren && (
          <div className="ml-3 border-l border-outline-variant/40 pl-1">
            {node.children.map((child) => renderMiniTree(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="h-screen flex overflow-hidden">
        {/* Left Sidebar - Tree (Hidden in tree visualization mode) */}
        {!showTreeVisualization && (
        <div
          className="border-r border-outline-variant/30 bg-white flex flex-col shadow-sm relative"
          style={{ width: `${sidebarWidth}%` }}
        >
          {/* Header */}
          <div className="p-4 border-b border-outline-variant/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg text-on-surface">{currentCase.name}</h3>
              <Badge className="bg-primary text-white text-xs px-2 py-1">
                {currentCase.type === 'base' ? 'Base' : 'Comparative'}
              </Badge>
            </div>
            <p className="text-sm text-on-surface-variant mb-3">{componentCount} components</p>

            {/* Tree View Toggle - Elegant Card Design */}
            <button
              onClick={() => {
                // Auto-expand all nodes when opening tree visualization
                const allComponentsWithChildren = new Set<string>()
                components.forEach(component => {
                  const hasChildren = components.some(c => c.parentId === component.id)
                  if (hasChildren) {
                    allComponentsWithChildren.add(component.id)
                  }
                })
                setExpandedNodes(allComponentsWithChildren)
                setAllExpanded(true)

                setShowTreeVisualization(true)
                setSelectedNode(null)
                setIsCreating(false)
                setIsEditing(false)
                setTreeEditingComponent(null)
                setEditFormData({})
              }}
              className="w-full group relative overflow-hidden rounded-lg border-2 border-outline-variant/40 bg-white hover:border-primary hover:bg-secondary-container transition-all duration-300 p-3 flex items-center gap-3"
              title="View Full Tree Hierarchy"
            >
              {/* Icon Container */}
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow duration-300">
                <Network className="h-5 w-5 text-white" />
              </div>

              {/* Text Content */}
              <div className="flex-1 text-left">
                <div className="font-semibold text-on-surface text-sm group-hover:text-primary transition-colors duration-300">
                  Tree Hierarchy
                </div>
                <div className="text-xs text-on-surface-variant group-hover:text-primary transition-colors duration-300">
                  View full structure
                </div>
              </div>

              {/* Arrow Indicator */}
              <svg className="w-5 h-5 text-on-surface-variant/70 group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="p-3 border-b border-outline-variant/30 space-y-2">
            {/* Run Assessment Button */}
            <Button
              onClick={() => router.push(`/project/${projectId}/case/${caseId}/results`)}
              className="w-full h-9 text-sm veridian-gradient text-white font-semibold rounded-md shadow-sm hover:opacity-95 transition-opacity"
              size="sm"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Run Assessment
            </Button>

            {/* Create Component Button */}
            <Button
              onClick={handleCreateComponent}
              className="w-full h-9 text-sm veridian-gradient text-white font-semibold rounded-md shadow-sm hover:opacity-95 transition-opacity"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Component
            </Button>
          </div>

          {/* Tree Content */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-5 pb-32"
            onScroll={(e) => {
              scrollPositionRef.current = e.currentTarget.scrollTop
            }}
          >
            {componentCount === 0 ? (
              <div className="text-center py-8">
                <div className="text-on-surface-variant/70 mb-3">
                  <FileText className="h-8 w-8 mx-auto" />
                </div>
                <p className="text-sm text-on-surface-variant mb-4">No components yet</p>
                <Button 
                  onClick={handleCreateComponent}
                  variant="outline" 
                  size="sm"
                >
                  Create First Component
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {treeData.map((node) => renderTreeNode(node))}
              </div>
            )}
          </div>

          {/* Resize Handle */}
          <div
            className="absolute top-0 bottom-0 right-0 w-2 bg-surface-container-high hover:bg-primary/60 cursor-col-resize hover:w-3 transition-all flex items-center justify-center group select-none z-10"
            onMouseDown={(e) => {
              e.preventDefault()
              setIsSidebarResizing(true)
            }}
            title="Drag to resize sidebar"
          >
            <div className="w-1 h-8 bg-on-surface-variant/60 group-hover:bg-primary-container rounded-full transition-colors"></div>
          </div>
        </div>
        )}


        {/* Main Content Area */}
        <div className="flex-1 bg-white overflow-hidden">
          <div className={showTreeVisualization ? "" : "h-full max-w-7xl mx-auto p-8"}>
            {renderMainContent()}
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenuOpen && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setContextMenuOpen(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setContextMenuOpen(null)
            }
          }}
        >
          <div
            className="absolute bg-popover rounded-md shadow-lg border py-1 min-w-[160px]"
            style={{
              left: contextMenuPosition.x,
              top: contextMenuPosition.y,
            }}
            role="menu"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-surface-container flex items-center gap-2"
              role="menuitem"
              onClick={() => {
                const node = components?.find((c) => c.id === contextMenuOpen)
                if (node) {
                  const processNode: ProcessNode = {
                    id: node.id,
                    name: node.name,
                    type: node.type,
                    description: node.description,
                    parentId: node.parentId || undefined
                  }
                  handleEditNode(processNode)
                }
                setContextMenuOpen(null)
              }}
            >
              <Edit className="h-4 w-4" />
              Edit…
            </button>
            {(() => {
              const node = components?.find((c) => c.id === contextMenuOpen)
              const processNode: ProcessNode | undefined = node ? {
                id: node.id,
                name: node.name,
                type: node.type,
                description: node.description,
                parentId: node.parentId || undefined
              } : undefined
              const menuLabels = processNode ? getMenuLabels(processNode) : { showChild: false }
              if (!menuLabels.showChild) return null
              return (
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-surface-container flex items-center gap-2"
                  role="menuitem"
                  onClick={() => {
                    if (processNode) {
                      handleAddChild(processNode)
                      setContextMenuOpen(null)
                    }
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                  {menuLabels.showChild && 'addChild' in menuLabels ? menuLabels.addChild : ''}
                </button>
              )
            })()}
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-surface-container flex items-center gap-2"
              role="menuitem"
              onClick={() => {
                const node = components?.find((c) => c.id === contextMenuOpen)
                if (node) {
                  const processNode: ProcessNode = {
                    id: node.id,
                    name: node.name,
                    type: node.type,
                    description: node.description,
                    parentId: node.parentId || undefined
                  }
                  setMovingNode(processNode)
                  setSelectedMoveTarget(null)
                  setMoveDialogOpen(true)
                }
                setContextMenuOpen(null)
              }}
            >
              <Move className="h-4 w-4" />
              Move to…
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-surface-container flex items-center gap-2"
              role="menuitem"
              onClick={() => {
                const node = components?.find((c) => c.id === contextMenuOpen)
                if (node) {
                  const processNode: ProcessNode = {
                    id: node.id,
                    name: node.name,
                    type: node.type,
                    description: node.description,
                    parentId: node.parentId || undefined
                  }
                  handleDuplicateNode(processNode)
                }
                setContextMenuOpen(null)
              }}
            >
              <Copy className="h-4 w-4" />
              Duplicate
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-surface-container flex items-center gap-2 text-red-600"
              role="menuitem"
              onClick={() => {
                const node = components?.find((c) => c.id === contextMenuOpen)
                if (node) {
                  const processNode: ProcessNode = {
                    id: node.id,
                    name: node.name,
                    type: node.type,
                    description: node.description,
                    parentId: node.parentId || undefined
                  }
                  handleDeleteNode(processNode)
                }
                setContextMenuOpen(null)
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete…
            </button>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete component?</DialogTitle>
            <DialogDescription>
              {(() => {
                const allComponents = components || []
                const nodeChildren = allComponents.filter(n => n.parentId === deletingNode?.id)
                return nodeChildren.length > 0
                  ? `This component has ${nodeChildren.length} child component(s). What would you like to do with them?`
                  : "This action cannot be undone."
              })()}
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const allComponents = components || []
            const nodeChildren = allComponents.filter(n => n.parentId === deletingNode?.id)
            return nodeChildren.length > 0 && (
              <div className="py-4 space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="cascade"
                    name="deleteOption"
                    value="cascade"
                    checked={deleteOption === 'cascade'}
                    onChange={(e) => setDeleteOption(e.target.value as 'cascade' | 'float')}
                    className="w-4 h-4"
                  />
                  <label htmlFor="cascade" className="text-sm">
                    Delete all children too (cascade delete)
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="float"
                    name="deleteOption"
                    value="float"
                    checked={deleteOption === 'float'}
                    onChange={(e) => setDeleteOption(e.target.value as 'cascade' | 'float')}
                    className="w-4 h-4"
                  />
                  <label htmlFor="float" className="text-sm">
                    Convert children to floating components
                  </label>
                </div>
              </div>
            )
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move component</DialogTitle>
            <DialogDescription>
              {movingNode ? `Select a new parent for "${movingNode.name}"` : "Select a new parent for this component."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {movingNode && (
              <div className="space-y-2">
                <Label htmlFor="moveTarget">Select new parent</Label>
                <Select
                  value={selectedMoveTarget || "root"}
                  onValueChange={(value) => setSelectedMoveTarget(value === "root" ? null : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a parent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="root">
                      <div className="flex items-center gap-2">
                        <span>No Parent (Make Floating)</span>
                      </div>
                    </SelectItem>
                    {(() => {
                      // Get eligible parents for the moving node
                      const allComponents = components || []
                      const eligibleParents = allComponents.filter(comp => {
                        // Can't move to itself
                        if (comp.id === movingNode.id) return false
                        
                        // Check if this component can accept the moving node as a child
                        const allowedChildren = hierarchyRules[comp.type] || []
                        if (!allowedChildren.includes(movingNode!.type)) return false
                        
                        // Prevent moving to own descendants
                        if (isDescendant(movingNode!.id, comp.id)) return false
                        
                        return true
                      })
                      
                      if (eligibleParents.length === 0) {
                        return (
                          <div className="p-3 text-sm text-on-surface-variant">
                            No eligible parents available for {getTypeLabel(movingNode.type)}
                          </div>
                        )
                      }
                      
                      return eligibleParents.map((parent) => (
                        <SelectItem key={parent.id} value={parent.id}>
                          <div className="flex items-center justify-between w-full">
                            <div>
                              <div className="font-medium">{parent.name}</div>
                            </div>
                            <Badge variant="outline" className="ml-2 text-xs">
                              {getTypeLabel(parent.type)}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))
                    })()}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setMoveDialogOpen(false)
              setMovingNode(null)
              setSelectedMoveTarget(null)
            }}>
              Cancel
            </Button>
            <Button 
              className="bg-primary hover:bg-primary-container"
              onClick={() => {
                if (movingNode) {
                  updateComponentNode(movingNode.id, { 
                    parentId: selectedMoveTarget 
                  })
                  toast.success(`Moved "${movingNode.name}" successfully`)
                  setMoveDialogOpen(false)
                  setMovingNode(null)
                  setSelectedMoveTarget(null)
                }
              }}
            >
              Move here
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Removed ComponentModal - now using inline editing */}
    </>
  )
}