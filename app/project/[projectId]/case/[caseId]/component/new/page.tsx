"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ChevronRight, AlertCircle, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useProjectStore } from "@/lib/store"
import { useToast } from "@/hooks/use-toast"
import type { ProcessNode } from "@/types/component"
import type { ComponentNode } from "@/lib/store"
import type { NodeType } from "@/lib/hierarchy"
import { 
  getTypeLabel, 
  getRequiredParentType, 
  validateParentChild, 
  buildBreadcrumbPath 
} from "@/lib/hierarchy"

export default function NewComponentPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  
  const projectId = params.projectId as string
  const caseId = params.caseId as string
  const suggestedParentId = searchParams.get("parent")
  const suggestedType = searchParams.get("type") as NodeType | null
  const editingId = searchParams.get("edit")
  const editingName = searchParams.get("name")
  const editingDescription = searchParams.get("description")
  const editingDriverCategory = searchParams.get("driverCategory")
  const editingDrivers = searchParams.get("drivers")
  const editingOperationalCost = searchParams.get("operationalCostUSD")
  const editingCapitalCost = searchParams.get("capitalCostUSD")

  const { projects, addComponentNode, updateComponentNode } = useProjectStore()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEditMode = Boolean(editingId)
  
  const [formData, setFormData] = useState({
    processType: suggestedType || "",
    processName: editingName || "",
    processDescription: editingDescription || "",
    parentId: suggestedParentId || "",
    driverCategory: editingDriverCategory || "",
    drivers: editingDrivers ? JSON.parse(editingDrivers) : [] as string[],
    operationalCostUSD: editingOperationalCost ? parseFloat(editingOperationalCost) : 0,
    capitalCostUSD: editingCapitalCost ? parseFloat(editingCapitalCost) : 0,
  })

  const [errors, setErrors] = useState<{
    processType: string
    processName: string
    parentId: string
    driverCategory: string
    operationalCostUSD: string
    capitalCostUSD: string
  }>({
    processType: "",
    processName: "",
    parentId: "",
    driverCategory: "",
    operationalCostUSD: "",
    capitalCostUSD: "",
  })

  // Get current project and case
  const project = projects.find((p) => p.id === projectId)
  const currentCase = project?.cases.find((c) => c.id === caseId)

  // Convert components to ProcessNode format
  const processNodes: ProcessNode[] = useMemo(() => {
    const currentComponents = currentCase?.components || []
    return currentComponents.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      description: c.description,
      parentId: c.parentId || undefined
    }))
  }, [currentCase?.components])

  // Get eligible parents based on selected process type
  const eligibleParents = useMemo(() => {
    if (!formData.processType) return []
    
    const requiredParentType = getRequiredParentType(formData.processType as NodeType)
    if (!requiredParentType) return [] // Product has no parent
    
    return processNodes.filter(node => node.type === requiredParentType)
  }, [formData.processType, processNodes])

  // Check if we're in "add child" mode
  const isAddChildMode = Boolean(suggestedParentId && suggestedType && !isEditMode)
  const suggestedParent = suggestedParentId ? processNodes.find(n => n.id === suggestedParentId) : null
  
  // In edit mode, check if the component has children (affects type change ability)
  const editingComponent: ComponentNode | undefined = isEditMode ? 
    currentCase?.components.find(c => c.id === editingId) : undefined
  const hasChildren = editingComponent ? processNodes.some(n => n.parentId === editingComponent.id) : false
  
  // Editing rules based on parent existence
  const hasParent = editingComponent?.parentId ? true : false
  const isProcessTypeLocked = isEditMode && hasParent // Lock process type if has parent
  const isProcessTypeEditable = !isAddChildMode && (!isEditMode || !hasParent) // Editable if new or floating

  useEffect(() => {
    if (isAddChildMode && suggestedParent) {
      setFormData(prev => ({
        ...prev,
        processType: suggestedType || "",
        parentId: suggestedParentId || ""
      }))
    }
  }, [isAddChildMode, suggestedParent, suggestedType, suggestedParentId])

  const validateForm = () => {
    const newErrors = {
      processType: "",
      processName: "",
      parentId: "",
      driverCategory: "",
      operationalCostUSD: "",
      capitalCostUSD: "",
    }

    if (!formData.processType) {
      newErrors.processType = "Select a process type"
    }
    
    if (!formData.processName.trim()) {
      newErrors.processName = "Enter a process name"
    }

    const processType = formData.processType as NodeType
    if (processType !== "product") {
      // Allow creating components without parents (floating components)
      if (formData.parentId) {
        const parent = processNodes.find(n => n.id === formData.parentId)
        if (parent && !validateParentChild(parent.type, processType)) {
          const requiredParentType = getRequiredParentType(processType)
          newErrors.parentId = `Select a ${getTypeLabel(requiredParentType!)} as the parent.`
        }
        
        // Check for duplicate names at the same level (exclude current component in edit mode)
        const siblings = processNodes.filter(n => n.parentId === formData.parentId && n.id !== editingId)
        if (siblings.some(s => s.name.toLowerCase() === formData.processName.toLowerCase().trim())) {
          newErrors.processName = "A component with this name already exists at this level."
        }
      } else {
        // Check for duplicate names at root level (exclude current component in edit mode)
        const rootComponents = processNodes.filter(n => !n.parentId && n.id !== editingId)
        if (rootComponents.some(s => s.name.toLowerCase() === formData.processName.toLowerCase().trim())) {
          newErrors.processName = "A component with this name already exists at the root level."
        }
      }
    } else {
      // For product type, check for existing root products (exclude current component in edit mode)
      const existingProducts = processNodes.filter(n => n.type === "product" && !n.parentId && n.id !== editingId)
      if (existingProducts.length > 0) {
        newErrors.processType = "A Product already exists. Each case can only have one root Product."
      }
      
      // Check for duplicate product names (exclude current component in edit mode)
      if (processNodes.some(n => n.type === "product" && n.name.toLowerCase() === formData.processName.toLowerCase().trim() && n.id !== editingId)) {
        newErrors.processName = "A Product with this name already exists."
      }
    }

    setErrors(newErrors)
    return !newErrors.processType && !newErrors.processName && !newErrors.parentId
  }

  const isFormValid = formData.processType && formData.processName.trim()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      if (isEditMode && editingId) {
        // Update existing component
        updateComponentNode(editingId, {
          type: formData.processType as NodeType,
          name: formData.processName.trim(),
          description: formData.processDescription,
          parentId: formData.processType === "product" ? null : (formData.parentId || null),
          driverCategory: formData.driverCategory || undefined,
          drivers: formData.drivers.length > 0 ? formData.drivers : undefined,
          operationalCostUSD: formData.operationalCostUSD || undefined,
          capitalCostUSD: formData.capitalCostUSD || undefined,
        })

        toast({
          title: "Component Updated",
          description: `${formData.processName} has been updated successfully`,
        })
      } else {
        // Create new component
        const componentData = {
          caseId,
          type: formData.processType as NodeType,
          name: formData.processName.trim(),
          description: formData.processDescription,
          parentId: formData.processType === "product" ? null : (formData.parentId || null),
          driverCategory: formData.driverCategory || undefined,
          drivers: formData.drivers.length > 0 ? formData.drivers : undefined,
          operationalCostUSD: formData.operationalCostUSD || undefined,
          capitalCostUSD: formData.capitalCostUSD || undefined,
        }

        addComponentNode(caseId, componentData)

        toast({
          title: "Component Created",
          description: `${formData.processName} has been added to your case`,
        })
      }

      // Navigate back to case view
      router.push(`/project/${projectId}/case/${caseId}`)
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} component:`, error)
      toast({
        title: "Error",
        description: `Failed to ${isEditMode ? 'update' : 'create'} component. Please try again.`,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const processTypes: NodeType[] = ["product", "machine", "subprocess", "operation", "elemental"]

  // Driver categories and their associated drivers
  const driverCategories = [
    "Energy Consumption",
    "Material Usage",
    "Transportation",
    "Water Usage",
    "Waste Generation",
    "Chemical Process",
    "Manufacturing Process"
  ]

  const driversByCategory: Record<string, string[]> = {
    "Energy Consumption": ["Electricity (kWh)", "Natural Gas (m³)", "Diesel (L)", "Coal (kg)", "Steam (kg)"],
    "Material Usage": ["Steel (kg)", "Aluminum (kg)", "Plastic (kg)", "Concrete (m³)", "Wood (m³)"],
    "Transportation": ["Truck Transport (tkm)", "Rail Transport (tkm)", "Sea Transport (tkm)", "Air Transport (tkm)"],
    "Water Usage": ["Process Water (L)", "Cooling Water (L)", "Steam Generation (L)"],
    "Waste Generation": ["Solid Waste (kg)", "Liquid Waste (L)", "Hazardous Waste (kg)"],
    "Chemical Process": ["Solvent Usage (L)", "Catalyst Usage (kg)", "Chemical Reaction (mol)"],
    "Manufacturing Process": ["Machine Hours (h)", "Labor Hours (h)", "Production Rate (units/h)"]
  }

  const availableDrivers = formData.driverCategory ? driversByCategory[formData.driverCategory] || [] : []

  // Build hierarchy tree for visualization
  const buildHierarchyTree = (nodeId: string | null): any => {
    if (!nodeId) return null
    
    const node = processNodes.find(n => n.id === nodeId)
    if (!node) return null
    
    // Get ancestors
    const ancestors: ProcessNode[] = []
    let currentNode = node
    while (currentNode.parentId) {
      const parent = processNodes.find(n => n.id === currentNode.parentId)
      if (parent) {
        ancestors.unshift(parent)
        currentNode = parent
      } else {
        break
      }
    }
    
    // Get children
    const children = processNodes.filter(n => n.parentId === nodeId)
    
    return {
      node,
      ancestors,
      children
    }
  }

  const selectedParentTree = formData.parentId ? buildHierarchyTree(formData.parentId) : null

  // Check if current selection would violate hierarchy rules
  const getHierarchyValidation = () => {
    if (!formData.processType) return { valid: true, message: "" }
    
    const processType = formData.processType as NodeType
    
    if (processType === "product") {
      // Check if a product already exists
      const existingProducts = processNodes.filter(n => n.type === "product" && !n.parentId)
      if (existingProducts.length > 0 && !isEditMode) {
        return {
          valid: false,
          message: "A Product already exists. Each case can only have one root Product."
        }
      }
      if (formData.parentId) {
        return {
          valid: false,
          message: "Products must be root level components (no parent)."
        }
      }
    } else if (formData.parentId) {
      // Check if parent can accept this child type
      const parent = processNodes.find(n => n.id === formData.parentId)
      if (parent) {
        const requiredParentType = getRequiredParentType(processType)
        if (parent.type !== requiredParentType) {
          return {
            valid: false,
            message: `${getTypeLabel(processType)} must be added under ${getTypeLabel(requiredParentType!)} (currently under ${getTypeLabel(parent.type)})`
          }
        }
      }
    }
    
    return { valid: true, message: "" }
  }

  const hierarchyValidation = getHierarchyValidation()

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto py-8">
        <div className="mb-8">
          <div className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
            <Link href="/home" className="hover:text-gray-900">Home</Link>
            <span>→</span>
            <Link href={`/project/${projectId}`} className="hover:text-gray-900">
              {project?.name || "Project"}
            </Link>
            <span>→</span>
            <Link href={`/project/${projectId}/case/${caseId}`} className="hover:text-gray-900">
              {currentCase?.name || "Case"}
            </Link>
            <span>→</span>
            <span className="text-gray-900 font-medium">{isEditMode ? 'Edit Component' : 'Create Component'}</span>
          </div>
          <h1 className="text-4xl font-bold mb-2">{isEditMode ? 'Edit Component' : 'Add a Component'}</h1>
          <p className="text-gray-600">{isEditMode ? 'Update the component details below' : 'Define a process, material, or activity in your LCA model'}</p>
          {isAddChildMode && suggestedParent && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Adding child to:</strong> {buildBreadcrumbPath(suggestedParent, processNodes)} / {suggestedParent.name}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="bg-card shadow-sm rounded-xl border-0">
              <CardHeader className="p-6">
                <CardTitle className="text-xl">Component Details</CardTitle>
                <CardDescription className="text-gray-600">
                  Components represent individual processes, materials, or activities in your system
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                {/* Editing Rules Info Box */}
                {isEditMode && (
                  <div className={`mb-6 p-4 rounded-lg border ${hasParent ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {hasParent ? (
                          <AlertCircle className="h-5 w-5 text-amber-600" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className={`font-semibold mb-2 ${hasParent ? 'text-amber-900' : 'text-green-900'}`}>
                          Editing Rules {hasParent ? '(Component with Parent)' : '(Floating Component)'}
                        </h4>
                        <div className="space-y-1 text-sm">
                          {hasParent ? (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="text-amber-700">🔒 <strong>Process Type:</strong></span>
                                <span className="text-amber-600">Locked (has parent)</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-green-700">✏️ <strong>Parent:</strong></span>
                                <span className="text-green-600">Editable (can reassign or remove)</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-green-700">✏️ <strong>Other Fields:</strong></span>
                                <span className="text-green-600">All editable</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="text-green-700">✏️ <strong>Process Type:</strong></span>
                                <span className="text-green-600">Editable (no parent)</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-green-700">✏️ <strong>Parent:</strong></span>
                                <span className="text-green-600">Can assign parent</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-green-700">✏️ <strong>All Fields:</strong></span>
                                <span className="text-green-600">Fully editable</span>
                              </div>
                            </>
                          )}
                        </div>
                        {hasParent && (
                          <p className="text-xs text-amber-600 mt-2 italic">
                            Tip: To change process type, first remove the parent (make it floating).
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="processType" className="text-sm font-medium">
                      Process Type <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.processType}
                      onValueChange={(value) => {
                        setFormData((prev) => ({ ...prev, processType: value, parentId: "" }))
                        if (errors.processType) {
                          setErrors((prev) => ({ ...prev, processType: "" }))
                        }
                      }}
                      disabled={isAddChildMode || isProcessTypeLocked}
                    >
                      <SelectTrigger className={errors.processType ? "border-red-500" : ""}>
                        <SelectValue placeholder="Select process type" />
                      </SelectTrigger>
                      <SelectContent>
                        {processTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            <div className="flex items-center gap-2">
                              {getTypeLabel(type)}
                              {type === "elemental" && (
                                <Badge variant="outline" className="border-2 border-[#16A34A] bg-card text-card-foreground text-xs">
                                  Baseline
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.processType && <p className="text-sm text-red-500">{errors.processType}</p>}
                    {isAddChildMode && (
                      <p className="text-xs text-blue-600">
                        Process type is locked for child components
                      </p>
                    )}
                    {isEditMode && hasParent && (
                      <p className="text-xs text-amber-600">
                        🔒 Process type is locked when component has a parent. To change type, first make it floating (remove parent).
                      </p>
                    )}
                    {isEditMode && !hasParent && (
                      <p className="text-xs text-green-600">
                        ✅ Process type is editable for floating components (no parent)
                      </p>
                    )}
                  </div>

                  {formData.processType && formData.processType !== "product" && (
                    <div className="space-y-2">
                      <Label htmlFor="parentComponent" className="text-sm font-medium">
                        Parent Component {isEditMode && hasParent && (
                          <span className="text-xs font-normal text-green-600 ml-2">
                            ✓ Can reassign to another valid parent
                          </span>
                        )}
                      </Label>
                      <Select
                        value={formData.parentId || "none"}
                        onValueChange={(value) => {
                          setFormData((prev) => ({ ...prev, parentId: value === "none" ? "" : value }))
                          if (errors.parentId) {
                            setErrors((prev) => ({ ...prev, parentId: "" }))
                          }
                        }}
                        disabled={isAddChildMode}
                      >
                        <SelectTrigger className={errors.parentId ? "border-red-500" : ""}>
                          <SelectValue placeholder="Select parent or create as floating component">
                            {formData.parentId ? 
                              eligibleParents.find(p => p.id === formData.parentId)?.name || "Unknown Parent" 
                              : "📍 No Parent (Floating Component)"
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">📍</span>
                              <span>No Parent (Floating Component)</span>
                            </div>
                          </SelectItem>
                          {processNodes.length > 0 && (
                            <>
                              {eligibleParents.length > 0 && (
                                <>
                                  <div className="px-2 py-1 text-xs text-muted-foreground bg-muted">Available Parents</div>
                                  {eligibleParents.map((parent) => (
                                    <SelectItem key={parent.id} value={parent.id}>
                                      <div className="flex items-center justify-between w-full">
                                        <div>
                                          <div className="font-medium">{parent.name}</div>
                                          {buildBreadcrumbPath(parent, processNodes) && (
                                            <div className="text-xs text-gray-500">
                                              {buildBreadcrumbPath(parent, processNodes)}
                                            </div>
                                          )}
                                        </div>
                                        <Badge variant="outline" className="ml-2 text-xs">
                                          {getTypeLabel(parent.type)}
                                        </Badge>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </>
                              )}
                              
                              {/* Show disabled invalid parents */}
                              {(() => {
                                const invalidParents = processNodes.filter(node => {
                                  // Don't show eligible parents again
                                  if (eligibleParents.some(p => p.id === node.id)) return false
                                  
                                  // Don't show if it's the current component (in edit mode)
                                  if (isEditMode && node.id === editingId) return false
                                  
                                  // Show other nodes that can't be parents
                                  return true
                                })
                                
                                if (invalidParents.length === 0) return null
                                
                                return (
                                  <>
                                    <div className="px-2 py-1 text-xs text-red-500 bg-red-50">Invalid Parents (hierarchy rules)</div>
                                    {invalidParents.map((parent) => {
                                      const requiredParentType = getRequiredParentType(formData.processType as NodeType)
                                      const reason = requiredParentType && parent.type !== requiredParentType
                                        ? `${getTypeLabel(formData.processType as NodeType)} requires ${getTypeLabel(requiredParentType)} parent`
                                        : "Invalid parent type"
                                      
                                      return (
                                        <div key={parent.id} className="px-2 py-2 opacity-50 cursor-not-allowed">
                                          <div className="flex items-center justify-between w-full">
                                            <div>
                                              <div className="font-medium text-gray-500 line-through">{parent.name}</div>
                                              <div className="text-xs text-red-500">
                                                {reason}
                                              </div>
                                            </div>
                                            <Badge variant="outline" className="ml-2 text-xs opacity-50">
                                              {getTypeLabel(parent.type)}
                                            </Badge>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </>
                                )
                              })()}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      {errors.parentId && <p className="text-sm text-red-500">{errors.parentId}</p>}
                      {!formData.parentId && formData.processType && (
                        <p className="text-xs text-amber-600">
                          💡 This will create a floating component that can be organized later
                        </p>
                      )}
                      {isEditMode && hasParent && formData.parentId && (
                        <Alert className="mt-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-sm">
                            <strong>Parent Reassignment:</strong> You can move this component to another {getTypeLabel(getRequiredParentType(formData.processType as NodeType)!)} or make it floating.
                          </AlertDescription>
                        </Alert>
                      )}
                      {isEditMode && !hasParent && (
                        <Alert className="mt-2 border-green-200 bg-green-50">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <AlertDescription className="text-sm text-green-800">
                            <strong>Floating Component:</strong> You can assign a parent now or keep it floating. Process type can also be changed.
                          </AlertDescription>
                        </Alert>
                      )}
                      {isAddChildMode && suggestedParent && (
                        <p className="text-xs text-blue-600">
                          From: {buildBreadcrumbPath(suggestedParent, processNodes)} / {suggestedParent.name}
                        </p>
                      )}
                      
                      {/* Hierarchy Validation Alert */}
                      {!hierarchyValidation.valid && (
                        <Alert variant="destructive" className="mt-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-sm">
                            {hierarchyValidation.message}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="processName" className="text-sm font-medium">
                      Process Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="processName"
                      placeholder="e.g., Battery Cell Assembly"
                      value={formData.processName}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, processName: e.target.value }))
                        if (errors.processName) {
                          setErrors((prev) => ({ ...prev, processName: "" }))
                        }
                      }}
                      maxLength={100}
                      className={errors.processName ? "border-red-500" : ""}
                    />
                    <div className="flex justify-between">
                      {errors.processName && <p className="text-sm text-red-500">{errors.processName}</p>}
                      <p className="text-xs text-gray-500 ml-auto">{formData.processName.length}/100 characters</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="processDescription" className="text-sm font-medium">
                      Process Description
                    </Label>
                    <Textarea
                      id="processDescription"
                      placeholder="Describe the process, including key steps, materials, and assumptions…"
                      value={formData.processDescription}
                      onChange={(e) => setFormData((prev) => ({ ...prev, processDescription: e.target.value }))}
                      rows={4}
                      className="resize-none"
                    />
                    <p className="text-xs text-gray-500">Optional: Provide additional context about this component</p>
                  </div>

                  {/* Driver Category Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="driverCategory" className="text-sm font-medium">
                      Select Driver Category
                    </Label>
                    <Select
                      value={formData.driverCategory}
                      onValueChange={(value) => {
                        setFormData((prev) => ({ ...prev, driverCategory: value, drivers: [] }))
                        if (errors.driverCategory) {
                          setErrors((prev) => ({ ...prev, driverCategory: "" }))
                        }
                      }}
                    >
                      <SelectTrigger className={errors.driverCategory ? "border-red-500" : ""}>
                        <SelectValue placeholder="Select a driver category" />
                      </SelectTrigger>
                      <SelectContent>
                        {driverCategories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.driverCategory && <p className="text-sm text-red-500">{errors.driverCategory}</p>}
                  </div>

                  {/* Drivers Multi-Selection */}
                  {formData.driverCategory && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Select Drivers
                      </Label>
                      <div className="min-h-[80px] p-3 border rounded-md bg-muted">
                        {availableDrivers.length > 0 ? (
                          <div className="space-y-2">
                            {availableDrivers.map((driver) => (
                              <div key={driver} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id={`driver-${driver}`}
                                  checked={formData.drivers.includes(driver)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFormData((prev) => ({
                                        ...prev,
                                        drivers: [...prev.drivers, driver]
                                      }))
                                    } else {
                                      setFormData((prev) => ({
                                        ...prev,
                                        drivers: prev.drivers.filter((d) => d !== driver)
                                      }))
                                    }
                                  }}
                                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                />
                                <label htmlFor={`driver-${driver}`} className="text-sm text-gray-700">
                                  {driver}
                                </label>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No drivers available for this category</p>
                        )}
                      </div>
                      {formData.drivers.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {formData.drivers.map((driver) => (
                            <Badge key={driver} variant="secondary" className="text-xs">
                              {driver}
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData((prev) => ({
                                    ...prev,
                                    drivers: prev.drivers.filter((d) => d !== driver)
                                  }))
                                }}
                                className="ml-1 text-gray-500 hover:text-red-500"
                              >
                                ×
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Cost Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="operationalCostUSD" className="text-sm font-medium">
                        Operational costs in USD
                      </Label>
                      <Input
                        id="operationalCostUSD"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.operationalCostUSD || ""}
                        onChange={(e) => {
                          const value = e.target.value === "" ? 0 : parseFloat(e.target.value)
                          setFormData((prev) => ({ ...prev, operationalCostUSD: value }))
                          if (errors.operationalCostUSD) {
                            setErrors((prev) => ({ ...prev, operationalCostUSD: "" }))
                          }
                        }}
                        className={errors.operationalCostUSD ? "border-red-500" : ""}
                      />
                      {errors.operationalCostUSD && <p className="text-sm text-red-500">{errors.operationalCostUSD}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="capitalCostUSD" className="text-sm font-medium">
                        Capital costs in USD
                      </Label>
                      <Input
                        id="capitalCostUSD"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.capitalCostUSD || ""}
                        onChange={(e) => {
                          const value = e.target.value === "" ? 0 : parseFloat(e.target.value)
                          setFormData((prev) => ({ ...prev, capitalCostUSD: value }))
                          if (errors.capitalCostUSD) {
                            setErrors((prev) => ({ ...prev, capitalCostUSD: "" }))
                          }
                        }}
                        className={errors.capitalCostUSD ? "border-red-500" : ""}
                      />
                      {errors.capitalCostUSD && <p className="text-sm text-red-500">{errors.capitalCostUSD}</p>}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push(`/project/${projectId}/case/${caseId}`)}
                      className="px-6"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={!isFormValid || isSubmitting}
                      className="px-6 bg-green-600 hover:bg-green-700"
                    >
                      {isSubmitting ? (isEditMode ? "Updating..." : "Creating...") : 
                       isEditMode ? `Update ${formData.processType ? getTypeLabel(formData.processType as NodeType) : "Component"}` :
                       `Create ${formData.processType ? getTypeLabel(formData.processType as NodeType) : "Component"}`}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {/* Selected Parent Hierarchy Visualization */}
            {selectedParentTree && formData.parentId && (
              <Card className="bg-green-50 border-green-200 shadow-sm rounded-xl">
                <CardHeader className="p-6 pb-4">
                  <CardTitle className="text-lg text-green-900 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    Selected Parent Hierarchy
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                  <div className="space-y-3">
                    {/* Ancestors */}
                    {selectedParentTree.ancestors.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-green-700">Ancestors:</p>
                        <div className="pl-2 space-y-1">
                          {selectedParentTree.ancestors.map((ancestor: ProcessNode, index: number) => (
                            <div key={ancestor.id} className="flex items-center gap-2 text-sm text-green-800">
                              <span className="text-green-600">{"  ".repeat(index)}↳</span>
                              <span className="font-medium">{ancestor.name}</span>
                              <Badge variant="outline" className="text-xs border-green-300 text-green-700">
                                {getTypeLabel(ancestor.type)}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Selected Parent */}
                    <div className="p-3 bg-green-100 rounded-lg border border-green-300">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-green-900">
                            {selectedParentTree.node.name}
                          </span>
                          <Badge className="bg-green-600 text-white text-xs">
                            {getTypeLabel(selectedParentTree.node.type)}
                          </Badge>
                        </div>
                        <span className="text-xs text-green-700">Selected Parent</span>
                      </div>
                    </div>
                    
                    {/* New Component Position */}
                    <div className="pl-4">
                      <div className="flex items-center gap-2 text-sm">
                        <ChevronRight className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-blue-900">Your new {formData.processType ? getTypeLabel(formData.processType as NodeType) : 'component'}</span>
                        <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
                          Will be added here
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Existing Siblings */}
                    {selectedParentTree.children.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-green-200">
                        <p className="text-xs font-medium text-green-700 mb-2">Existing siblings under this parent:</p>
                        <div className="space-y-1">
                          {selectedParentTree.children.map((child: ProcessNode) => (
                            <div key={child.id} className="flex items-center gap-2 text-xs text-green-600 pl-4">
                              <span>•</span>
                              <span>{child.name}</span>
                              <span className="text-green-500">({getTypeLabel(child.type)})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            
            <Card className="bg-card shadow-sm rounded-xl border-0">
              <CardHeader className="p-6">
                <CardTitle className="text-lg">Examples</CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-4 text-sm">
                <div>
                  <p className="font-medium text-gray-900">Manufacturing:</p>
                  <p className="text-gray-600">Battery cell assembly, injection molding</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Transportation:</p>
                  <p className="text-gray-600">Raw material logistics, product distribution</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 border-blue-200 shadow-sm rounded-xl">
              <CardHeader className="p-6">
                <CardTitle className="text-lg text-blue-900">Hierarchy Rules</CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="text-sm text-blue-800 space-y-2">
                  <p className="font-medium">Follow this order:</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span>•</span>
                      <span>Product</span>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <span>↳</span>
                      <span>Machine Line Process</span>
                    </div>
                    <div className="flex items-center gap-2 ml-8">
                      <span>↳</span>
                      <span>Subprocess</span>
                    </div>
                    <div className="flex items-center gap-2 ml-12">
                      <span>↳</span>
                      <span>Operation</span>
                    </div>
                    <div className="flex items-center gap-2 ml-16">
                      <span>↳</span>
                      <span className="flex items-center gap-1">
                        Elemental Task
                        <Badge variant="outline" className="border-[#16A34A] text-[#16A34A] text-xs">
                          Baseline
                        </Badge>
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-blue-100 rounded border border-blue-300">
                    <p className="text-xs font-medium text-blue-900 mb-1">Rules:</p>
                    <ul className="text-xs text-blue-800 space-y-1">
                      <li>• Each type can only add its immediate child</li>
                      <li>• Elemental Tasks are leaf nodes (no children)</li>
                      <li>• Multiple children allowed per parent</li>
                      <li>• One Product per case maximum</li>
                      <li>• Components can be created as floating (no parent)</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}