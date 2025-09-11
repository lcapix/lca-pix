"use client"
import React, { useState } from "react"
import type { ProcessNode, TreeNode } from "@/types/component"
import { getTypeLabel, getAllowedChildType } from "@/lib/hierarchy"
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
} from "lucide-react"
import { useProjectStore, type ComponentNode, type NodeType } from "@/lib/store"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
// Removed ComponentModal import - now using inline editing

export default function CaseViewPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string
  const caseId = params.caseId as string

  const { projects, updateComponentNode, deleteComponentNode, addComponentNode } = useProjectStore()
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("overview")
  const [isTreeExpanded, setIsTreeExpanded] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(380)
  const [isEditing, setIsEditing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [showTreeVisualization, setShowTreeVisualization] = useState(false)
  const [treeEditingComponent, setTreeEditingComponent] = useState<string | null>(null)
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

  const project = projects.find((p) => p.id === projectId)
  const currentCase = project?.cases.find((c) => c.id === caseId)

  if (!project || !currentCase) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Case not found</h1>
          <Button onClick={() => router.push("/home")}>Return to Home</Button>
        </div>
      </div>
    )
  }

  const componentCount = currentCase.components?.length || 0

  // Convert components to ProcessNode format for tree building
  const processNodes: ProcessNode[] = (currentCase?.components || []).map(c => ({
    id: c.id,
    name: c.name,
    type: c.type,
    description: c.description,
    parentId: c.parentId || undefined
  }))
  
  // Get selected component details
  const selectedComponent = selectedNode ? currentCase.components?.find(c => c.id === selectedNode) : null
  
  // Debug logging
  // Debug logs
  console.log("Debug - selectedNode:", selectedNode)
  console.log("Debug - selectedComponent:", selectedComponent)
  console.log("Debug - currentCase components:", currentCase?.components?.length)

  // Color scheme for tree visualization (matching LCA v2)
  const getFlowChartColors = (type: NodeType) => {
    const colorSchemes = {
      product: {
        bg: "bg-red-100",
        border: "border-red-300",
        text: "text-red-900",
        badge: "bg-red-100 text-red-900 border-red-300"
      },
      machine: {
        bg: "bg-orange-100", 
        border: "border-orange-300",
        text: "text-orange-900",
        badge: "bg-orange-100 text-orange-900 border-orange-300"
      },
      subprocess: {
        bg: "bg-yellow-100",
        border: "border-yellow-300", 
        text: "text-yellow-900",
        badge: "bg-yellow-100 text-yellow-900 border-yellow-300"
      },
      operation: {
        bg: "bg-blue-100",
        border: "border-blue-300",
        text: "text-blue-900",
        badge: "bg-blue-100 text-blue-900 border-blue-300"
      },
      elemental: {
        bg: "bg-purple-100",
        border: "border-purple-300",
        text: "text-purple-900",
        badge: "bg-purple-100 text-purple-900 border-purple-300"
      }
    }
    return colorSchemes[type] || colorSchemes.product
  }
  
  // Shared utility function to check if a node is descendant of another
  const isDescendant = (ancestorId: string, nodeId: string): boolean => {
    const children = (currentCase?.components || []).filter(n => n.parentId === ancestorId)
    for (const child of children) {
      if (child.id === nodeId || isDescendant(child.id, nodeId)) {
        return true
      }
    }
    return false
  }

  const hierarchyRules: Record<string, string[]> = {
    product: ["machine"],
    machine: ["subprocess"],
    subprocess: ["operation"],
    operation: ["elemental"],
    elemental: [],
  }

  // Color schemes for different node types
  const getNodeColors = (type: string, isSelected = false, isHovered = false) => {
    const colorSchemes = {
      product: {
        bg: isSelected ? "bg-blue-100" : isHovered ? "bg-blue-25" : "bg-blue-50",
        border: isSelected ? "border-blue-400" : "border-blue-200",
        text: isSelected ? "text-blue-950" : "text-blue-900",
        badge: isSelected ? "bg-blue-200 text-blue-900 border-blue-400" : "bg-blue-100 text-blue-800 border-blue-300",
        icon: isSelected ? "text-blue-700" : "text-blue-600",
        shadow: isSelected ? "shadow-blue-200/50" : "",
        borderWidth: isSelected ? "border-2" : "border"
      },
      machine: {
        bg: isSelected ? "bg-orange-100" : isHovered ? "bg-orange-25" : "bg-orange-50",
        border: isSelected ? "border-orange-400" : "border-orange-200",
        text: isSelected ? "text-orange-950" : "text-orange-900",
        badge: isSelected ? "bg-orange-200 text-orange-900 border-orange-400" : "bg-orange-100 text-orange-800 border-orange-300",
        icon: isSelected ? "text-orange-700" : "text-orange-600",
        shadow: isSelected ? "shadow-orange-200/50" : "",
        borderWidth: isSelected ? "border-2" : "border"
      },
      subprocess: {
        bg: isSelected ? "bg-purple-100" : isHovered ? "bg-purple-25" : "bg-purple-50",
        border: isSelected ? "border-purple-400" : "border-purple-200",
        text: isSelected ? "text-purple-950" : "text-purple-900",
        badge: isSelected ? "bg-purple-200 text-purple-900 border-purple-400" : "bg-purple-100 text-purple-800 border-purple-300",
        icon: isSelected ? "text-purple-700" : "text-purple-600",
        shadow: isSelected ? "shadow-purple-200/50" : "",
        borderWidth: isSelected ? "border-2" : "border"
      },
      operation: {
        bg: isSelected ? "bg-cyan-100" : isHovered ? "bg-cyan-25" : "bg-cyan-50",
        border: isSelected ? "border-cyan-400" : "border-cyan-200",
        text: isSelected ? "text-cyan-950" : "text-cyan-900",
        badge: isSelected ? "bg-cyan-200 text-cyan-900 border-cyan-400" : "bg-cyan-100 text-cyan-800 border-cyan-300",
        icon: isSelected ? "text-cyan-700" : "text-cyan-600",
        shadow: isSelected ? "shadow-cyan-200/50" : "",
        borderWidth: isSelected ? "border-2" : "border"
      },
      elemental: {
        bg: isSelected ? "bg-green-100" : isHovered ? "bg-green-25" : "bg-green-50",
        border: isSelected ? "border-green-400" : "border-green-200",
        text: isSelected ? "text-green-950" : "text-green-900",
        badge: isSelected ? "bg-green-200 text-green-900 border-green-400" : "bg-green-100 text-green-800 border-green-300",
        icon: isSelected ? "text-green-700" : "text-green-600",
        shadow: isSelected ? "shadow-green-200/50" : "",
        borderWidth: isSelected ? "border-2" : "border"
      }
    }
    return colorSchemes[type as keyof typeof colorSchemes] || colorSchemes.product
  }

  const handleEditNode = (node: ProcessNode) => {
    // Get the full component data
    const fullComponent = currentCase?.components.find(c => c.id === node.id)
    if (!fullComponent) return
    
    // Select the node and switch to edit mode
    setSelectedNode(node.id)
    setIsEditing(true)
    setEditFormData({
      processType: fullComponent.type,
      processName: fullComponent.name,
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

  const handleDeleteNode = (node: ProcessNode) => {
    setDeletingNode(node)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (!deletingNode || !currentCase) return

    const allComponents = currentCase.components || []
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
    const fullComponent = currentCase?.components.find(c => c.id === node.id)
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
    // Switch to create mode in the right panel
    setSelectedNode(null)
    setIsCreating(true)
    setIsEditing(false)
    setEditFormData({
      processType: "",
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
  const handleSaveComponent = () => {
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
        // Update existing component
        updateComponentNode(selectedNode, {
          name: editFormData.processName.trim(),
          type: editFormData.processType as NodeType,
          description: editFormData.processDescription || undefined,
          parentId: editFormData.parentId || null,
          driverCategory: editFormData.driverCategory || undefined,
          selectedDriver: editFormData.selectedDriver || undefined,
          drivers: (editFormData.drivers && editFormData.drivers.length > 0) ? editFormData.drivers : undefined,
          mass: editFormData.mass || undefined,
          massUnit: editFormData.massUnit || undefined,
          operationalCostUSD: editFormData.operationalCostUSD || undefined,
          capitalCostUSD: editFormData.capitalCostUSD || undefined,
        })
        toast.success("Component updated successfully")
      } else if (isCreating) {
        // Create new component
        const newComponent = addComponentNode(caseId, {
          caseId,
          type: editFormData.processType as NodeType,
          name: editFormData.processName.trim(),
          description: editFormData.processDescription || undefined,
          parentId: editFormData.parentId || null,
          driverCategory: editFormData.driverCategory || undefined,
          selectedDriver: editFormData.selectedDriver || undefined,
          drivers: (editFormData.drivers && editFormData.drivers.length > 0) ? editFormData.drivers : undefined,
          mass: editFormData.mass || undefined,
          massUnit: editFormData.massUnit || undefined,
          operationalCostUSD: editFormData.operationalCostUSD || undefined,
          capitalCostUSD: editFormData.capitalCostUSD || undefined,
        })
        
        // If parent was set, expand that parent node
        if (editFormData.parentId) {
          const newExpanded = new Set(expandedNodes)
          newExpanded.add(editFormData.parentId)
          setExpandedNodes(newExpanded)
        }
        
        // Select the newly created component
        if (newComponent) {
          setSelectedNode(newComponent.id)
        }
        
        toast.success("Component created successfully")
      }
      
      // Reset form and exit edit/create mode
      setIsEditing(false)
      setIsCreating(false)
      setEditFormData({})
    } catch (error) {
      console.error("Error saving component:", error)
      toast.error("Failed to save component")
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

    const draggedComponent = currentCase?.components.find(n => n.id === draggedNode)
    const targetComponent = currentCase?.components.find(n => n.id === nodeId)
    
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

    const draggedComponent = currentCase?.components.find(n => n.id === draggedNode)
    const targetComponent = currentCase?.components.find(n => n.id === targetNodeId)
    
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
        }
      } else {
        roots.push(nodeMap.get(comp.id))
      }
    })

    return roots
  }

  const renderTreeNode = (node: TreeNode, level = 0) => {
    const hasChildren = node.children && node.children.length > 0
    const isExpanded = expandedNodes.has(node.id)
    const isSelected = selectedNode === node.id
    const isHovered = hoveredNode === node.id
    const isInlineEditing = inlineEditingNode === node.id
    const showControls = isHovered || isSelected || contextMenuOpen === node.id
    const colors = getNodeColors(node.type, isSelected, isHovered)
    const component = currentCase?.components?.find(c => c.id === node.id)

    return (
      <div key={node.id} className="space-y-1">
        <div
          className={`flex items-center gap-2 py-3 px-3 pr-12 rounded-lg cursor-pointer group relative transition-all duration-200 ${
            isSelected ? `${colors.bg} ${colors.borderWidth} ${colors.border} shadow-lg ${colors.shadow} ring-1 ring-opacity-25` : 
            dragOverNode === node.id ? (
              isDragValid 
                ? "bg-green-50 dark:bg-green-900 border-2 border-green-400 dark:border-green-600 shadow-lg" 
                : "bg-red-50 dark:bg-red-900 border-2 border-red-400 dark:border-red-600 shadow-lg"
            ) : isHovered ? `${colors.bg} ${colors.borderWidth} ${colors.border}` : "hover:bg-gray-50 hover:border hover:border-gray-200"
          } ${draggedNode === node.id ? "opacity-50 scale-95" : ""} ${
            isTreeExpanded ? "min-h-[60px] mb-2" : ""
          }`}
          style={{ paddingLeft: `${level * (isTreeExpanded ? 24 : 20) + 8}px` }}
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
            
            // If node is not selected, just select it
            if (!isSelected) {
              setSelectedNode(node.id)
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
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setContextMenuPosition({ x: e.clientX, y: e.clientY })
            setContextMenuOpen(node.id)
          }}
          tabIndex={0}
        >
          {showControls && <GripVertical className="h-3 w-3 text-gray-400 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />}

          {hasChildren && (
            <ChevronRight className={`h-5 w-5 text-gray-500 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
          )}
          {!hasChildren && <div className="w-4" />}

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
                <Badge className={`text-xs font-medium ${colors.badge} border shadow-sm`}>
                  {getTypeLabel(node.type)}
                </Badge>
              </div>
              {component && (
                <div className="text-xs text-gray-500 space-y-1">
                  {component.driverCategory && (
                    <div className="flex items-center gap-1">
                      <Palette className={`h-3 w-3 ${colors.icon}`} />
                      <span className={colors.text}>{component.driverCategory}</span>
                    </div>
                  )}
                  {component.mass && (
                    <div className="flex items-center gap-1">
                      <span className={colors.icon}>⚖️</span>
                      <span className={colors.text}>
                        {component.mass} {component.massUnit || 'kg'}
                      </span>
                    </div>
                  )}
                  {(component.operationalCostUSD || component.capitalCostUSD) && (
                    <div className="flex items-center gap-1">
                      <span className={colors.icon}>💰</span>
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
            <>
              <span className={`text-base font-medium ${isSelected ? colors.text : isHovered ? colors.text : "text-gray-900"}`}>{node.name}</span>
              {node.type && (
                <Badge
                  className={`text-sm font-medium ${
                    isSelected ? colors.badge : isHovered ? colors.badge : "border-gray-200 bg-gray-50 text-gray-700"
                  } border ${isSelected ? 'shadow-sm' : ''}`}
                >
                  {getTypeLabel(node.type)}
                </Badge>
              )}
            </>
          )}

          {showControls && !isInlineEditing && (
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 w-6 p-0 absolute right-1 top-1/2 -translate-y-1/2 z-30 opacity-0 group-hover:opacity-100 transition-opacity`}
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
        {hasChildren && isExpanded && <div>{node.children.map((child) => renderTreeNode(child, level + 1))}</div>}
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
    const components = currentCase?.components || []
    
    // Build hierarchy tree
    const rootNodes = components.filter(c => !c.parentId)
    
    const renderFlowNode = (node: ComponentNode, level: number = 0) => {
      const children = components.filter(c => c.parentId === node.id)
      const colors = getFlowChartColors(node.type)
      
      return (
        <div key={node.id} className="flex flex-col items-center">
          {/* Node Box */}
          <div 
            className={`
              ${colors.bg} ${colors.border} ${colors.text}
              border-2 rounded-lg p-4 min-w-[160px] max-w-[200px] 
              text-center font-medium cursor-pointer hover:shadow-lg
              transition-all duration-200 mb-4
              ${selectedNode === node.id ? 'ring-2 ring-blue-500' : ''}
            `}
            onClick={() => setSelectedNode(node.id)}
          >
            <div className="font-semibold text-sm mb-1">{node.name}</div>
            <div className="text-xs opacity-75">{getTypeLabel(node.type)}</div>
          </div>
          
          {/* Connection Line */}
          {children.length > 0 && (
            <div className="flex flex-col items-center">
              <div className="w-px h-4 bg-gray-400"></div>
              <div className="w-4 h-px bg-gray-400"></div>
              <div className="w-px h-4 bg-gray-400"></div>
            </div>
          )}
          
          {/* Children */}
          {children.length > 0 && (
            <div className="flex gap-6 relative">
              {children.length > 1 && (
                <div className="absolute top-0 left-0 right-0 h-px bg-gray-400" style={{ top: '-16px' }}></div>
              )}
              {children.map((child) => (
                <div key={child.id} className="flex flex-col items-center">
                  {children.length > 1 && (
                    <div className="w-px h-4 bg-gray-400" style={{ marginTop: '-16px' }}></div>
                  )}
                  {renderFlowNode(child, level + 1)}
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }
    
    if (rootNodes.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">No components found</div>
          <Button onClick={() => setShowTreeVisualization(false)}>Close</Button>
        </div>
      )
    }
    
    return (
      <div className="flex flex-wrap gap-8 justify-center">
        {rootNodes.map(root => renderFlowNode(root))}
      </div>
    )
  }

  // Render main content area based on selection and mode
  const renderMainContent = () => {
    // Tree Visualization Mode
    if (showTreeVisualization) {
      const selectedComponent = selectedNode ? currentCase?.components.find(c => c.id === selectedNode) : null

      return (
        <div className="min-h-screen bg-gray-50/50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 bg-white border-b shadow-sm">
            <div className="flex items-center gap-3">
              <Network className="h-6 w-6 text-gray-700" />
              <h2 className="text-2xl font-bold text-gray-900">Process Hierarchy</h2>
              <Badge variant="outline" className="text-base px-3 py-1">{currentCase.name}</Badge>
            </div>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowTreeVisualization(false)
                setTreeEditingComponent(null)
                setEditFormData({})
              }}
              className="px-4 py-2"
            >
              Close Tree View
            </Button>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Side - Tree Visualization */}
            <div className="flex-1 p-6 overflow-auto">
              <div className="bg-green-50 p-8 rounded-xl border shadow-sm overflow-x-auto">
                <div className="min-w-max">
                  {renderFlowChart()}
                </div>
              </div>
              
              {/* Legend */}
              <div className="mt-6 bg-white p-4 rounded-xl border shadow-sm">
                <h3 className="font-semibold text-base mb-3 text-center">Component Types</h3>
                <div className="flex flex-wrap gap-4 justify-center">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-100 border-2 border-red-300 rounded"></div>
                    <span className="text-sm font-medium">Product</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-orange-100 border-2 border-orange-300 rounded"></div>
                    <span className="text-sm font-medium">Machine/Line</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-yellow-100 border-2 border-yellow-300 rounded"></div>
                    <span className="text-sm font-medium">Subprocess</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-100 border-2 border-blue-300 rounded"></div>
                    <span className="text-sm font-medium">Operation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-purple-100 border-2 border-purple-300 rounded"></div>
                    <span className="text-sm font-medium">Elemental Task</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Component Details Panel */}
            <div className="w-96 bg-white border-l shadow-lg p-6 overflow-y-auto">
              {selectedComponent ? (
                <div className="space-y-6">
                  {/* Component Header */}
                  <div className="border-b pb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge className={`text-xs font-medium ${getFlowChartColors(selectedComponent.type).badge} border shadow-sm`}>
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
                            className="bg-green-600 hover:bg-green-700"
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
                          <Label className="text-sm font-semibold text-gray-700">Component Name</Label>
                          <Input
                            value={editFormData.processName || ""}
                            onChange={(e) => setEditFormData({ ...editFormData, processName: e.target.value })}
                            className="mt-1"
                            placeholder="Component name"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-semibold text-gray-700">Description</Label>
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
                        <h3 className="text-xl font-bold text-gray-900">{selectedComponent.name}</h3>
                        {selectedComponent.description && (
                          <p className="text-sm text-gray-600 mt-1">{selectedComponent.description}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Component Details - Edit Mode or View Mode */}
                  {treeEditingComponent === selectedComponent.id ? (
                    <div className="space-y-4">
                      {/* Parent Component Selection */}
                      <div>
                        <Label className="text-sm font-semibold text-gray-700">Parent Component</Label>
                        <Select
                          value={editFormData.parentId || "none"}
                          onValueChange={(value) => setEditFormData({...editFormData, parentId: value === "none" ? "" : value})}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select parent component" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              <span className="text-gray-500">No parent (floating component)</span>
                            </SelectItem>
                            {(() => {
                              const hierarchyRules: Record<string, string[]> = {
                                product: ["machine"],
                                machine: ["subprocess"],
                                subprocess: ["operation"],
                                operation: ["elemental"],
                                elemental: [],
                              }
                              
                              const eligibleParents = (currentCase?.components || []).filter(comp => {
                                // Don't allow self-selection
                                if (comp.id === selectedComponent.id) return false
                                
                                // Don't allow selection of own children (prevents circular references)
                                const isChild = (parentId: string, childId: string): boolean => {
                                  const children = (currentCase?.components || []).filter(c => c.parentId === parentId)
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
                                    <Badge className={`text-xs ${getFlowChartColors(parent.type).badge}`}>
                                      {getTypeLabel(parent.type)}
                                    </Badge>
                                    <span>{parent.name}</span>
                                  </div>
                                </SelectItem>
                              ))
                            })()}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500 mt-1">
                          Choose a parent component or leave as floating component
                        </p>
                      </div>

                      {/* Driver Category */}
                      <div>
                        <Label className="text-sm font-semibold text-gray-700">Driver Category</Label>
                        <Select
                          value={editFormData.driverCategory || ""}
                          onValueChange={(value) => setEditFormData({...editFormData, driverCategory: value, selectedDriver: ""})}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select driver category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ELEMENTARYFLOW">Elementary Flow</SelectItem>
                            <SelectItem value="PRODUCTFLOW">Product Flow</SelectItem>
                            <SelectItem value="WASTEFLOW">Waste Flow</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Selected Driver */}
                      <div>
                        <Label className="text-sm font-semibold text-gray-700">Selected Driver</Label>
                        <Select
                          value={editFormData.selectedDriver || ""}
                          onValueChange={(value) => setEditFormData({...editFormData, selectedDriver: value})}
                          disabled={!editFormData.driverCategory}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select driver" />
                          </SelectTrigger>
                          <SelectContent>
                            {editFormData.driverCategory === "ELEMENTARYFLOW" && (
                              <>
                                <SelectItem value="Electricity (kWh)">Electricity (kWh)</SelectItem>
                                <SelectItem value="Natural Gas (MJ)">Natural Gas (MJ)</SelectItem>
                                <SelectItem value="Water (L)">Water (L)</SelectItem>
                              </>
                            )}
                            {editFormData.driverCategory === "PRODUCTFLOW" && (
                              <>
                                <SelectItem value="Steel (kg)">Steel (kg)</SelectItem>
                                <SelectItem value="Aluminum (kg)">Aluminum (kg)</SelectItem>
                                <SelectItem value="Plastic (kg)">Plastic (kg)</SelectItem>
                              </>
                            )}
                            {editFormData.driverCategory === "WASTEFLOW" && (
                              <>
                                <SelectItem value="Solid Waste (kg)">Solid Waste (kg)</SelectItem>
                                <SelectItem value="Liquid Waste (L)">Liquid Waste (L)</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Mass */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-sm font-semibold text-gray-700">Mass</Label>
                          <Input
                            type="number"
                            value={editFormData.mass || ""}
                            onChange={(e) => setEditFormData({...editFormData, mass: parseFloat(e.target.value) || 0})}
                            className="mt-1"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-semibold text-gray-700">Unit</Label>
                          <Select
                            value={editFormData.massUnit || "kg"}
                            onValueChange={(value) => setEditFormData({...editFormData, massUnit: value})}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="kg">kg</SelectItem>
                              <SelectItem value="g">g</SelectItem>
                              <SelectItem value="lb">lb</SelectItem>
                              <SelectItem value="oz">oz</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Costs */}
                      <div className="grid grid-cols-1 gap-2">
                        <div>
                          <Label className="text-sm font-semibold text-gray-700">Operational Cost (USD)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={editFormData.operationalCostUSD || ""}
                            onChange={(e) => setEditFormData({...editFormData, operationalCostUSD: parseFloat(e.target.value) || 0})}
                            className="mt-1"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-semibold text-gray-700">Capital Cost (USD)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={editFormData.capitalCostUSD || ""}
                            onChange={(e) => setEditFormData({...editFormData, capitalCostUSD: parseFloat(e.target.value) || 0})}
                            className="mt-1"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Parent Component Display */}
                      {(() => {
                        const parentComponent = selectedComponent.parentId 
                          ? (currentCase?.components || []).find(c => c.id === selectedComponent.parentId)
                          : null
                        
                        return (
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <Label className="text-sm font-semibold text-gray-700">Parent Component</Label>
                            {parentComponent ? (
                              <div className="flex items-center gap-2 mt-1">
                                <Badge className={`text-xs ${getFlowChartColors(parentComponent.type).badge}`}>
                                  {getTypeLabel(parentComponent.type)}
                                </Badge>
                                <span className="text-sm text-gray-600">{parentComponent.name}</span>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500 mt-1">Floating component (no parent)</p>
                            )}
                          </div>
                        )
                      })()}

                      {selectedComponent.driverCategory && (
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <Label className="text-sm font-semibold text-gray-700">Driver Category</Label>
                          <p className="text-sm text-gray-600 mt-1">{selectedComponent.driverCategory}</p>
                        </div>
                      )}

                      {selectedComponent.selectedDriver && (
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <Label className="text-sm font-semibold text-gray-700">Selected Driver</Label>
                          <p className="text-sm text-gray-600 mt-1">{selectedComponent.selectedDriver}</p>
                        </div>
                      )}

                      {selectedComponent.mass && (
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <Label className="text-sm font-semibold text-gray-700">Mass</Label>
                          <p className="text-sm text-gray-600 mt-1">
                            {selectedComponent.mass} {selectedComponent.massUnit || 'kg'}
                          </p>
                        </div>
                      )}

                      {(selectedComponent.operationalCostUSD || selectedComponent.capitalCostUSD) && (
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <Label className="text-sm font-semibold text-gray-700">Costs (USD)</Label>
                          <div className="space-y-1 mt-1">
                            {selectedComponent.operationalCostUSD && (
                              <p className="text-sm text-gray-600">
                                Operational: ${selectedComponent.operationalCostUSD.toLocaleString()}
                              </p>
                            )}
                            {selectedComponent.capitalCostUSD && (
                              <p className="text-sm text-gray-600">
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
                    const children = (currentCase?.components || []).filter(c => c.parentId === selectedComponent.id)
                    if (children.length > 0) {
                      return (
                        <div className="border-t pt-4">
                          <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                            Child Components ({children.length})
                          </Label>
                          <div className="space-y-2">
                            {children.map(child => (
                              <div 
                                key={child.id}
                                className="flex items-center gap-2 p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100 transition-colors"
                                onClick={() => setSelectedNode(child.id)}
                              >
                                <Badge className={`text-xs ${getFlowChartColors(child.type).badge}`}>
                                  {getTypeLabel(child.type)}
                                </Badge>
                                <span className="text-sm font-medium flex-1">{child.name}</span>
                                <ChevronRight className="h-4 w-4 text-gray-400" />
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
                <div className="text-center py-12">
                  <Network className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Component Selected</h3>
                  <p className="text-sm text-gray-500">
                    Click on a component in the flowchart to view its details and edit options.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )
    }
    
    // Create/Edit Form Mode
    if (isCreating || isEditing) {
      return (
        <div className="min-h-screen bg-gray-50/50">
          <div className="max-w-full mx-auto py-4 px-4">
            {/* Header */}
            <div className="text-center mb-2">
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                {isCreating ? "Create New Component" : `Edit Component`}
              </h2>
              <p className="text-xs text-gray-600">
                {isCreating ? "Add a new component to your LCA model" : `Modify settings for "${selectedComponent?.name}"`}
              </p>
            </div>

            {/* Horizontal Form Layout */}
            <Card className="shadow-lg border border-gray-200 bg-white overflow-hidden">
              <CardContent className="p-6">
                <div className="space-y-6">
                  {/* Row 1: Process Name and Type */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <Label htmlFor="processName" className="text-lg font-semibold text-gray-700">Process Name</Label>
                      <Input
                        id="processName"
                        value={editFormData.processName || ""}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, processName: e.target.value })
                        }
                        placeholder="e.g., Aluminium Production"
                        className="h-14 text-lg px-4"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="processType" className="text-lg font-semibold text-gray-700">Process Type</Label>
                      <Select
                        value={editFormData.processType || ""}
                        onValueChange={(value) =>
                          setEditFormData({ ...editFormData, processType: value })
                        }
                      >
                        <SelectTrigger className="h-14 text-lg px-4">
                          <SelectValue placeholder="e.g., Elemental Task" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="product">Product</SelectItem>
                          <SelectItem value="machine">Machine Line Process</SelectItem>
                          <SelectItem value="subprocess">Subprocess</SelectItem>
                          <SelectItem value="operation">Operation</SelectItem>
                          <SelectItem value="elemental">Elemental Task</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Row 2: Process Description (Full Width) */}
                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-lg font-semibold text-gray-700">Process Description</Label>
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
                      className="h-14 text-lg px-4"
                    />
                  </div>

                  {/* Parent Selection - Only show if creating and not product */}
                  {isCreating && editFormData.processType && editFormData.processType !== 'product' && (
                    <div className="space-y-2">
                      <Label htmlFor="parentId" className="text-lg font-semibold text-gray-700">Parent Component</Label>
                      <Select
                        value={editFormData.parentId || "none"}
                        onValueChange={(value) =>
                          setEditFormData({ ...editFormData, parentId: value === "none" ? "" : value })
                        }
                      >
                        <SelectTrigger className="h-14 text-lg px-4">
                          <SelectValue placeholder="Select parent component (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <span className="text-gray-500">No parent (floating component)</span>
                          </SelectItem>
                          {(() => {
                            const eligibleParents = (currentCase?.components || []).filter(comp => {
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
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <Label className="text-lg font-semibold text-gray-700">Driver Category</Label>
                      <Select
                        value={editFormData.driverCategory || ""}
                        onValueChange={(value) => setEditFormData({...editFormData, driverCategory: value, selectedDriver: ""})}
                      >
                        <SelectTrigger className="h-14 text-lg px-4">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ELEMENTARYFLOW">Elementary Drivers - Raw materials</SelectItem>
                          <SelectItem value="PRODUCTFLOW">Process Drivers</SelectItem>
                          <SelectItem value="WASTEFLOW">Waste Drivers</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-lg font-semibold text-gray-700">Selected Driver</Label>
                      <Select
                        value={editFormData.selectedDriver || ""}
                        onValueChange={(value) => {
                          setEditFormData({...editFormData, selectedDriver: value})
                        }}
                        disabled={!editFormData.driverCategory}
                      >
                        <SelectTrigger className="h-14 text-lg px-4">
                          <SelectValue placeholder={editFormData.driverCategory ? "Select driver" : "Select category first"} />
                        </SelectTrigger>
                        <SelectContent>
                          {editFormData.driverCategory === "ELEMENTARYFLOW" && (
                            <>
                              <SelectItem value="aluminum_ore">Aluminum ore</SelectItem>
                              <SelectItem value="steel_scrap">Steel scrap</SelectItem>
                              <SelectItem value="natural_gas">Natural gas</SelectItem>
                              <SelectItem value="electricity_mix">Electricity mix</SelectItem>
                              <SelectItem value="water_fresh">Fresh water</SelectItem>
                            </>
                          )}
                          {editFormData.driverCategory === "PRODUCTFLOW" && (
                            <>
                              <SelectItem value="transport_truck">Transport, truck</SelectItem>
                              <SelectItem value="manufacturing_steel">Manufacturing, steel</SelectItem>
                              <SelectItem value="heat_natural_gas">Heat, natural gas</SelectItem>
                              <SelectItem value="electricity_production">Electricity production</SelectItem>
                              <SelectItem value="machining_process">Machining process</SelectItem>
                            </>
                          )}
                          {editFormData.driverCategory === "WASTEFLOW" && (
                            <>
                              <SelectItem value="co2_emissions">CO2 emissions</SelectItem>
                              <SelectItem value="wastewater">Wastewater</SelectItem>
                              <SelectItem value="solid_waste">Solid waste</SelectItem>
                              <SelectItem value="hazardous_waste">Hazardous waste</SelectItem>
                              <SelectItem value="metal_scrap">Metal scrap</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mass" className="text-lg font-semibold text-gray-700">Mass</Label>
                      <Input
                        id="mass"
                        type="number"
                        min="0"
                        step="0.001"
                        value={editFormData.mass || ""}
                        onChange={(e) => setEditFormData({...editFormData, mass: parseFloat(e.target.value) || 0})}
                        placeholder="100"
                        className="h-14 text-lg px-4"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="massUnit" className="text-lg font-semibold text-gray-700">Unit</Label>
                      <Select
                        value={editFormData.massUnit || "kg"}
                        onValueChange={(value) => setEditFormData({...editFormData, massUnit: value})}
                      >
                        <SelectTrigger className="h-14 text-lg px-4">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="g">g</SelectItem>
                          <SelectItem value="lb">lb</SelectItem>
                          <SelectItem value="oz">oz</SelectItem>
                          <SelectItem value="t">t</SelectItem>
                          <SelectItem value="st">st</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Row 4: Costs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <Label htmlFor="operationalCost" className="text-lg font-semibold text-gray-700">Operational costs in USD</Label>
                      <Input
                        id="operationalCost"
                        type="number"
                        min="0"
                        step="0.01"
                        value={editFormData.operationalCostUSD || ""}
                        onChange={(e) => setEditFormData({...editFormData, operationalCostUSD: parseFloat(e.target.value) || 0})}
                        placeholder="$ 10000"
                        className="h-14 text-lg px-4"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="capitalCost" className="text-lg font-semibold text-gray-700">Capital costs in USD</Label>
                      <Input
                        id="capitalCost"
                        type="number"
                        min="0"
                        step="0.01"
                        value={editFormData.capitalCostUSD || ""}
                        onChange={(e) => setEditFormData({...editFormData, capitalCostUSD: parseFloat(e.target.value) || 0})}
                        placeholder="$ 20000"
                        className="h-14 text-lg px-4"
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-center gap-6 pt-4">
                    <Button 
                      onClick={handleSaveComponent}
                      className="bg-green-600 hover:bg-green-700 px-12 py-4 text-lg font-medium h-14"
                      disabled={!editFormData.processType || !editFormData.processName?.trim()}
                    >
                      {isCreating ? 
                        editFormData.processType === "product" ? "Create Product" :
                        editFormData.processType === "machine" ? "Create Machine Line Process" :
                        editFormData.processType === "subprocess" ? "Create Subprocess" :
                        editFormData.processType === "operation" ? "Create Operation" :
                        editFormData.processType === "elemental" ? "Create Elemental Task" :
                        "Create Component"
                        : "Save Changes"}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleCancelEdit}
                      className="px-12 py-4 text-lg font-medium border-gray-300 h-14"
                    >
                      Cancel
                    </Button>
                  </div>
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
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No component selected</h3>
            <p className="text-gray-600 mb-6">Select a component from the tree to view its details, or create a new one.</p>
            
            <Button onClick={handleCreateComponent} className="bg-green-600 hover:bg-green-700 text-base px-5 py-3 h-10">
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
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="data">Data & Drivers</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Component Name</Label>
                    <p className="text-sm font-medium mt-1">{selectedComponent.name}</p>
                  </div>
                  <div>
                    <Label>Type</Label>
                    <p className="text-sm font-medium mt-1">{getTypeLabel(selectedComponent.type)}</p>
                  </div>
                </div>
                {selectedComponent.description && (
                  <div>
                    <Label>Description</Label>
                    <p className="text-sm text-gray-600 mt-1">{selectedComponent.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Mass</Label>
                    <p className="text-sm font-medium mt-1">
                      {selectedComponent.mass ? `${selectedComponent.mass} ${selectedComponent.massUnit || 'kg'}` : "Not specified"}
                    </p>
                  </div>
                  <div>
                    <Label>Total Cost</Label>
                    <p className="text-sm font-medium mt-1">
                      ${((selectedComponent.operationalCostUSD || 0) + (selectedComponent.capitalCostUSD || 0)).toFixed(2)} USD
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Operational Cost</Label>
                    <p className="text-sm font-medium mt-1">
                      ${selectedComponent.operationalCostUSD?.toFixed(2) || "0.00"} USD
                    </p>
                  </div>
                  <div>
                    <Label>Capital Cost</Label>
                    <p className="text-sm font-medium mt-1">
                      ${selectedComponent.capitalCostUSD?.toFixed(2) || "0.00"} USD
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="data" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Environmental Drivers</CardTitle>
                <CardDescription>Data inputs and drivers for LCA calculations</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedComponent.driverCategory ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Driver Category</Label>
                      <p className="text-sm font-medium mt-1">{selectedComponent.driverCategory}</p>
                    </div>
                    {selectedComponent.selectedDriver && (
                      <div>
                        <Label>Selected Driver</Label>
                        <p className="text-sm font-medium mt-1">{selectedComponent.selectedDriver}</p>
                      </div>
                    )}
                    {selectedComponent.drivers && selectedComponent.drivers.length > 0 && (
                      <div>
                        <Label>Additional Drivers</Label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {selectedComponent.drivers.map((driver) => (
                            <Badge key={driver} variant="secondary">{driver}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-4">
                      <Settings className="h-8 w-8 text-orange-500 mx-auto mb-3" />
                      <h3 className="font-semibold text-orange-900 mb-2">Drivers Required for Assessment</h3>
                      <p className="text-sm text-orange-700 mb-4">
                        This component needs environmental drivers configured to be included in LCA assessments.
                      </p>
                      <Button 
                        onClick={() => {
                          const node: ProcessNode = {
                            id: selectedComponent.id,
                            name: selectedComponent.name,
                            type: selectedComponent.type,
                            description: selectedComponent.description,
                            parentId: selectedComponent.parentId || undefined
                          }
                          handleEditNode(node)
                        }}
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Configure Drivers Now
                      </Button>
                    </div>
                    <div className="text-xs text-gray-500">
                      Configure driver category, selected drivers, and quantities to enable LCA calculations
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="results" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Assessment Results</CardTitle>
                <CardDescription>Environmental impact calculations for this component</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <BarChart3 className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-4">No results available yet</p>
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

  return (
    <>
      <div className="min-h-screen bg-background flex">
        {/* Left Sidebar - Tree (Hidden in tree visualization mode) */}
        {!showTreeVisualization && (
        <div 
          className="border-r border-border bg-card flex flex-col transition-all duration-300"
          style={{ width: `${sidebarWidth}px` }}
        >
          {/* Header */}
          <div className="p-5 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsTreeExpanded(!isTreeExpanded)
                    setSidebarWidth(isTreeExpanded ? 380 : 520)
                  }}
                  className="h-6 w-6 p-0"
                  title={isTreeExpanded ? "Collapse view" : "Expand view"}
                >
                  {isTreeExpanded ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowTreeVisualization(true)
                    setSelectedNode(null)
                    setIsCreating(false)
                    setIsEditing(false)
                    setTreeEditingComponent(null)
                    setEditFormData({})
                  }}
                  className="h-6 w-6 p-0"
                  title="View Tree Hierarchy"
                >
                  <Network className="h-4 w-4" />
                </Button>
                <Badge className="bg-green-600 text-white text-xs">
                  {currentCase.type === 'base' ? 'Base' : 'Comparative'}
                </Badge>
              </div>
            </div>
            <h3 className="font-bold text-xl mb-1">{currentCase.name}</h3>
            <p className="text-base text-muted-foreground">{componentCount} components</p>
          </div>

          {/* Action Buttons */}
          <div className="p-4 border-b border-border space-y-2">
            {/* Run Assessment Button */}
            {(() => {
              const componentsWithDrivers = currentCase?.components?.filter(c => 
                c.driverCategory && c.drivers && c.drivers.length > 0
              ) || []
              const assessmentReady = componentsWithDrivers.length > 0
              
              return (
                <Button
                  onClick={() => {
                    if (assessmentReady) {
                      router.push(`/project/${projectId}/case/${caseId}/results`)
                    } else {
                      toast.error("Please configure drivers for your components first")
                    }
                  }}
                  className={`w-full ${
                    assessmentReady 
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : 'bg-gray-400 hover:bg-gray-500'
                  }`}
                  size="sm"
                  title={
                    assessmentReady 
                      ? `Ready! ${componentsWithDrivers.length} components configured with drivers` 
                      : `Setup needed: ${(currentCase?.components?.length || 0) - componentsWithDrivers.length} components need driver configuration in 'Data & Drivers' tab`
                  }
                >
                  {assessmentReady ? (
                    <>
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Run Assessment ({componentsWithDrivers.length})
                    </>
                  ) : (
                    <>
                      <Settings className="h-4 w-4 mr-2" />
                      Setup Required
                    </>
                  )}
                </Button>
              )
            })()}
            
            {/* Create Component Button */}
            <Button 
              onClick={handleCreateComponent}
              className="w-full bg-green-600 hover:bg-green-700"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Component
            </Button>
          </div>

          {/* Tree Content */}
          <div className="flex-1 overflow-y-auto p-3">
            {componentCount === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-3">
                  <FileText className="h-8 w-8 mx-auto" />
                </div>
                <p className="text-sm text-gray-600 mb-4">No components yet</p>
                <Button 
                  onClick={handleCreateComponent}
                  variant="outline" 
                  size="sm"
                >
                  Create First Component
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {treeData.map((node) => renderTreeNode(node))}
              </div>
            )}
          </div>

          {/* Run Assessment */}
          <div className="p-4 border-t border-border">
            {(() => {
              const componentsWithDrivers = currentCase?.components?.filter(c => 
                c.driverCategory && c.drivers && c.drivers.length > 0
              ) || []
              const assessmentReady = componentsWithDrivers.length > 0
              
              return (
                <div className="space-y-3">
                  {/* Assessment Status */}
                  <div className={`p-3 rounded-lg text-sm ${
                    assessmentReady 
                      ? 'bg-green-50 text-green-800 border border-green-200' 
                      : 'bg-orange-50 text-orange-800 border border-orange-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      {assessmentReady ? (
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      ) : (
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      )}
                      <span className="font-medium">
                        {assessmentReady ? 'Ready for Assessment' : 'Setup Required'}
                      </span>
                    </div>
                    <div className="text-xs">
                      {assessmentReady 
                        ? `${componentsWithDrivers.length} components configured`
                        : `${(currentCase?.components?.length || 0) - componentsWithDrivers.length} components need drivers`
                      }
                    </div>
                  </div>
                  
                  {/* Run Assessment Button */}
                  <Button 
                    className={`w-full ${
                      assessmentReady 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : 'bg-gray-400 hover:bg-gray-500'
                    }`}
                    onClick={() => {
                      if (assessmentReady) {
                        router.push(`/project/${projectId}/case/${caseId}/results`)
                      } else {
                        toast.error("Please configure drivers for your components first")
                      }
                    }}
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    {assessmentReady ? 'Run Assessment' : 'Configure Components First'}
                  </Button>
                </div>
              )
            })()}
          </div>
        </div>
        )}

        {/* Resize Handle (Hidden in tree visualization mode) */}
        {!showTreeVisualization && (
        <div 
          className="w-1 bg-border hover:bg-gray-300 cursor-col-resize transition-colors"
          onMouseDown={(e) => {
            e.preventDefault()
            const startX = e.clientX
            const startWidth = sidebarWidth
            
            const handleMouseMove = (e: MouseEvent) => {
              const newWidth = Math.max(340, Math.min(680, startWidth + (e.clientX - startX)))
              setSidebarWidth(newWidth)
            }
            
            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove)
              document.removeEventListener('mouseup', handleMouseUp)
            }
            
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
          }}
        />
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          {renderMainContent()}
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
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
              role="menuitem"
              onClick={() => {
                const node = currentCase?.components?.find((c) => c.id === contextMenuOpen)
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
              const node = currentCase?.components?.find((c) => c.id === contextMenuOpen)
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
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
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
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
              role="menuitem"
              onClick={() => {
                const node = currentCase?.components?.find((c) => c.id === contextMenuOpen)
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
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
              role="menuitem"
              onClick={() => {
                const node = currentCase?.components?.find((c) => c.id === contextMenuOpen)
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
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-red-600"
              role="menuitem"
              onClick={() => {
                const node = currentCase?.components?.find((c) => c.id === contextMenuOpen)
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
                const allComponents = currentCase?.components || []
                const nodeChildren = allComponents.filter(n => n.parentId === deletingNode?.id)
                return nodeChildren.length > 0
                  ? `This component has ${nodeChildren.length} child component(s). What would you like to do with them?`
                  : "This action cannot be undone."
              })()}
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const allComponents = currentCase?.components || []
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
                        <span className="text-gray-500">📍</span>
                        <span>No Parent (Make Floating)</span>
                      </div>
                    </SelectItem>
                    {(() => {
                      // Get eligible parents for the moving node
                      const allComponents = currentCase?.components || []
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
                          <div className="p-3 text-sm text-gray-600">
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
              className="bg-green-600 hover:bg-green-700"
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