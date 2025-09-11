"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { useProjectStore, type ComponentNode, type NodeType } from "@/lib/store"
import { 
  getTypeLabel, 
  getRequiredParentType, 
  getAllowedChildType,
  validateParentChild 
} from "@/lib/hierarchy"
import { toast } from "sonner"

interface ComponentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit' | 'duplicate'
  caseId: string
  projectId: string
  editingNode?: ComponentNode | null
  suggestedParentId?: string | null
  suggestedType?: NodeType | null
}

export function ComponentModal({
  open,
  onOpenChange,
  mode,
  caseId,
  projectId,
  editingNode,
  suggestedParentId,
  suggestedType,
}: ComponentModalProps) {
  const { projects, addComponentNode, updateComponentNode } = useProjectStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Get current project and case
  const project = projects.find((p) => p.id === projectId)
  const currentCase = project?.cases.find((c) => c.id === caseId)
  
  // Form state
  const [formData, setFormData] = useState({
    processType: "",
    processName: "",
    processDescription: "",
    parentId: "",
    driverCategory: "",
    drivers: [] as string[],
    mass: 0,
    massUnit: "kg",
    operationalCostUSD: 0,
    capitalCostUSD: 0,
  })
  
  const [errors, setErrors] = useState({
    processType: "",
    processName: "",
    parentId: "",
    driverCategory: "",
    mass: "",
    massUnit: "",
    operationalCostUSD: "",
    capitalCostUSD: "",
  })

  // Initialize form data based on mode
  useEffect(() => {
    if (open) {
      if (mode === 'edit' && editingNode) {
        setFormData({
          processType: editingNode.type,
          processName: editingNode.name,
          processDescription: editingNode.description || "",
          parentId: editingNode.parentId || "",
          driverCategory: editingNode.driverCategory || "",
          drivers: editingNode.drivers || [],
          mass: editingNode.mass || 0,
          massUnit: editingNode.massUnit || "kg",
          operationalCostUSD: editingNode.operationalCostUSD || 0,
          capitalCostUSD: editingNode.capitalCostUSD || 0,
        })
      } else if (mode === 'duplicate' && editingNode) {
        setFormData({
          processType: editingNode.type,
          processName: `${editingNode.name} (Copy)`,
          processDescription: editingNode.description || "",
          parentId: editingNode.parentId || "",
          driverCategory: editingNode.driverCategory || "",
          drivers: editingNode.drivers || [],
          mass: editingNode.mass || 0,
          massUnit: editingNode.massUnit || "kg",
          operationalCostUSD: editingNode.operationalCostUSD || 0,
          capitalCostUSD: editingNode.capitalCostUSD || 0,
        })
      } else if (mode === 'create') {
        setFormData({
          processType: suggestedType || "",
          processName: "",
          processDescription: "",
          parentId: suggestedParentId || "",
          driverCategory: "",
          drivers: [],
          mass: 0,
          massUnit: "kg",
          operationalCostUSD: 0,
          capitalCostUSD: 0,
        })
      }
      
      // Clear errors
      setErrors({
        processType: "",
        processName: "",
        parentId: "",
        driverCategory: "",
        operationalCostUSD: "",
        capitalCostUSD: "",
      })
    }
  }, [open, mode, editingNode, suggestedParentId, suggestedType])

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

  // Get eligible parents based on selected process type
  const eligibleParents = () => {
    if (!formData.processType) return []
    
    const requiredParentType = getRequiredParentType(formData.processType as NodeType)
    if (!requiredParentType) return [] // Product has no parent
    
    return (currentCase?.components || []).filter(comp => {
      // Can't be its own parent
      if (mode === 'edit' && comp.id === editingNode?.id) return false
      
      // Must be the correct parent type
      return comp.type === requiredParentType
    })
  }

  // Check if this is a floating component
  const isFloatingComponent = !formData.parentId && formData.processType

  // Check if we can change process type (only for floating components or new components)
  const canChangeProcessType = mode === 'create' || !formData.parentId

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
      newErrors.processType = "Please select a process type"
    }

    if (!formData.processName.trim()) {
      newErrors.processName = "Please enter a component name"
    }

    // Validate parent selection based on process type
    const requiredParentType = getRequiredParentType(formData.processType as NodeType)
    if (requiredParentType && !formData.parentId) {
      // Parent is required for this type but not selected
      const availableParents = eligibleParents()
      if (availableParents.length > 0) {
        // Don't require parent if we're allowing floating components
        // newErrors.parentId = `Please select a ${getTypeLabel(requiredParentType)} parent`
      }
    }

    if (formData.mass < 0) {
      newErrors.mass = "Mass must be non-negative"
    }

    if (formData.operationalCostUSD < 0) {
      newErrors.operationalCostUSD = "Cost must be non-negative"
    }

    if (formData.capitalCostUSD < 0) {
      newErrors.capitalCostUSD = "Cost must be non-negative"
    }

    setErrors(newErrors)
    return !Object.values(newErrors).some(error => error !== "")
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setIsSubmitting(true)

    try {
      if (mode === 'edit' && editingNode) {
        // Update existing component
        updateComponentNode(editingNode.id, {
          name: formData.processName.trim(),
          type: formData.processType as NodeType,
          description: formData.processDescription || undefined,
          parentId: formData.parentId || null,
          driverCategory: formData.driverCategory || undefined,
          drivers: formData.drivers.length > 0 ? formData.drivers : undefined,
          mass: formData.mass || undefined,
          massUnit: formData.massUnit || undefined,
          operationalCostUSD: formData.operationalCostUSD || undefined,
          capitalCostUSD: formData.capitalCostUSD || undefined,
        })
        toast.success("Component updated successfully")
      } else {
        // Create new component (for both create and duplicate modes)
        addComponentNode(caseId, {
          caseId,
          type: formData.processType as NodeType,
          name: formData.processName.trim(),
          description: formData.processDescription || undefined,
          parentId: formData.parentId || null,
          driverCategory: formData.driverCategory || undefined,
          drivers: formData.drivers.length > 0 ? formData.drivers : undefined,
          mass: formData.mass || undefined,
          massUnit: formData.massUnit || undefined,
          operationalCostUSD: formData.operationalCostUSD || undefined,
          capitalCostUSD: formData.capitalCostUSD || undefined,
        })
        toast.success(mode === 'duplicate' ? "Component duplicated successfully" : "Component created successfully")
      }
      
      onOpenChange(false)
    } catch (error) {
      toast.error("An error occurred. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Get process type label for dynamic text
  const getProcessTypeLabel = () => {
    switch (formData.processType) {
      case 'product':
        return 'Product'
      case 'machine':
        return 'Machine Line Process'
      case 'subprocess':
        return 'Subprocess'
      case 'operation':
        return 'Operation'
      case 'elemental':
        return 'Elemental Task'
      default:
        return 'Component'
    }
  }

  // Get dialog title based on mode
  const getDialogTitle = () => {
    const typeLabel = getProcessTypeLabel()
    switch (mode) {
      case 'edit':
        return `Edit ${typeLabel}`
      case 'duplicate':
        return `Duplicate ${typeLabel}`
      case 'create':
      default:
        return `Create ${typeLabel}`
    }
  }

  // Get dialog description based on mode
  const getDialogDescription = () => {
    const typeLabel = getProcessTypeLabel().toLowerCase()
    switch (mode) {
      case 'edit':
        return `Edit the details for "${editingNode?.name}"`
      case 'duplicate':
        return `Create a copy of "${editingNode?.name}" with the details below`
      case 'create':
      default:
        return `Add a new ${typeLabel} to your LCA model`
    }
  }

  // Get selected parent component
  const selectedParent = formData.parentId 
    ? currentCase?.components.find(c => c.id === formData.parentId)
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          <DialogDescription>{getDialogDescription()}</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Process Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="processType">Process Type *</Label>
            <Select
              value={formData.processType}
              onValueChange={(value) => {
                setFormData({ 
                  ...formData, 
                  processType: value,
                  parentId: "" // Reset parent when type changes
                })
                setErrors({ ...errors, processType: "" })
              }}
              disabled={!canChangeProcessType}
            >
              <SelectTrigger id="processType" className={errors.processType ? "border-red-500" : ""}>
                <SelectValue placeholder="Select a process type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="product">Product</SelectItem>
                <SelectItem value="machine">Machine Line Process</SelectItem>
                <SelectItem value="subprocess">Subprocess</SelectItem>
                <SelectItem value="operation">Operation</SelectItem>
                <SelectItem value="elemental">Elemental Task</SelectItem>
              </SelectContent>
            </Select>
            {errors.processType && (
              <p className="text-sm text-red-500">{errors.processType}</p>
            )}
            {mode === 'edit' && !canChangeProcessType && (
              <Alert className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Process type is locked when component has a parent. Remove parent first to change type.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Parent Selection */}
          {formData.processType && getRequiredParentType(formData.processType as NodeType) && (
            <div className="space-y-2">
              <Label htmlFor="parent">
                Parent {getTypeLabel(getRequiredParentType(formData.processType as NodeType) || '')}
                {isFloatingComponent && <Badge variant="outline" className="ml-2">Optional - Floating Component</Badge>}
              </Label>
              <Select
                value={formData.parentId || "__no_parent__"}
                onValueChange={(value) => {
                  const parentId = value === "__no_parent__" ? "" : value
                  setFormData({ ...formData, parentId })
                  setErrors({ ...errors, parentId: "" })
                }}
              >
                <SelectTrigger id="parent" className={errors.parentId ? "border-red-500" : ""}>
                  <SelectValue placeholder={isFloatingComponent ? "No parent (Floating Component)" : "Select a parent"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__no_parent__">
                    <span className="text-muted-foreground">No parent (Floating Component)</span>
                  </SelectItem>
                  {eligibleParents().map((parent) => (
                    <SelectItem key={parent.id} value={parent.id}>
                      {parent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.parentId && (
                <p className="text-sm text-red-500">{errors.parentId}</p>
              )}
            </div>
          )}

          {/* Show floating component indicator */}
          {isFloatingComponent && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                This will be created as a <strong>Floating Component (Unassigned)</strong>. You can assign it to a parent later.
              </AlertDescription>
            </Alert>
          )}

          {/* Component Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Component Name *</Label>
            <Input
              id="name"
              value={formData.processName}
              onChange={(e) => {
                setFormData({ ...formData, processName: e.target.value })
                setErrors({ ...errors, processName: "" })
              }}
              placeholder="Enter component name"
              className={errors.processName ? "border-red-500" : ""}
            />
            {errors.processName && (
              <p className="text-sm text-red-500">{errors.processName}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.processDescription}
              onChange={(e) => setFormData({ ...formData, processDescription: e.target.value })}
              placeholder="Describe this component (optional)"
              rows={3}
            />
          </div>

          {/* Driver Category */}
          <div className="space-y-2">
            <Label htmlFor="driverCategory">Driver Category</Label>
            <Select
              value={formData.driverCategory}
              onValueChange={(value) => {
                setFormData({ ...formData, driverCategory: value, drivers: [] })
              }}
            >
              <SelectTrigger id="driverCategory">
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
          </div>

          {/* Drivers */}
          {formData.driverCategory && (
            <div className="space-y-2">
              <Label>Select Drivers</Label>
              <div className="border rounded-md p-3 bg-muted max-h-32 overflow-y-auto">
                {driversByCategory[formData.driverCategory]?.map((driver) => (
                  <div key={driver} className="flex items-center space-x-2 mb-2">
                    <input
                      type="checkbox"
                      id={`driver-${driver}`}
                      checked={formData.drivers.includes(driver)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            drivers: [...formData.drivers, driver]
                          })
                        } else {
                          setFormData({
                            ...formData,
                            drivers: formData.drivers.filter((d) => d !== driver)
                          })
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
            </div>
          )}

          {/* Mass + Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mass">Mass</Label>
              <Input
                id="mass"
                type="number"
                min="0"
                step="0.001"
                value={formData.mass || ""}
                onChange={(e) => {
                  const value = e.target.value === "" ? 0 : parseFloat(e.target.value)
                  setFormData({ ...formData, mass: value })
                  setErrors({ ...errors, mass: "" })
                }}
                placeholder="0.000"
                className={errors.mass ? "border-red-500" : ""}
              />
              {errors.mass && (
                <p className="text-sm text-red-500">{errors.mass}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="massUnit">Unit</Label>
              <Select
                value={formData.massUnit}
                onValueChange={(value) => {
                  setFormData({ ...formData, massUnit: value })
                  setErrors({ ...errors, massUnit: "" })
                }}
              >
                <SelectTrigger className={errors.massUnit ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg (kilograms)</SelectItem>
                  <SelectItem value="g">g (grams)</SelectItem>
                  <SelectItem value="lb">lb (pounds)</SelectItem>
                  <SelectItem value="oz">oz (ounces)</SelectItem>
                  <SelectItem value="t">t (metric tons)</SelectItem>
                  <SelectItem value="st">st (short tons)</SelectItem>
                </SelectContent>
              </Select>
              {errors.massUnit && (
                <p className="text-sm text-red-500">{errors.massUnit}</p>
              )}
            </div>
          </div>

          {/* Costs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="operationalCost">Operational Cost (USD)</Label>
              <Input
                id="operationalCost"
                type="number"
                min="0"
                step="0.01"
                value={formData.operationalCostUSD || ""}
                onChange={(e) => {
                  const value = e.target.value === "" ? 0 : parseFloat(e.target.value)
                  setFormData({ ...formData, operationalCostUSD: value })
                  setErrors({ ...errors, operationalCostUSD: "" })
                }}
                placeholder="0.00"
                className={errors.operationalCostUSD ? "border-red-500" : ""}
              />
              {errors.operationalCostUSD && (
                <p className="text-sm text-red-500">{errors.operationalCostUSD}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="capitalCost">Capital Cost (USD)</Label>
              <Input
                id="capitalCost"
                type="number"
                min="0"
                step="0.01"
                value={formData.capitalCostUSD || ""}
                onChange={(e) => {
                  const value = e.target.value === "" ? 0 : parseFloat(e.target.value)
                  setFormData({ ...formData, capitalCostUSD: value })
                  setErrors({ ...errors, capitalCostUSD: "" })
                }}
                placeholder="0.00"
                className={errors.capitalCostUSD ? "border-red-500" : ""}
              />
              {errors.capitalCostUSD && (
                <p className="text-sm text-red-500">{errors.capitalCostUSD}</p>
              )}
            </div>
          </div>

          {/* Hierarchy Preview */}
          {selectedParent && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-900 mb-2">Hierarchy Preview:</p>
              <div className="text-sm text-blue-800">
                {selectedParent.name} <Badge variant="outline" className="text-xs">{getTypeLabel(selectedParent.type)}</Badge>
                <div className="ml-4 mt-1">
                  ↳ {formData.processName || "(New Component)"} <Badge variant="outline" className="text-xs">{getTypeLabel(formData.processType as NodeType)}</Badge>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.processName.trim() || !formData.processType}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? "Saving..." : mode === 'edit' ? "Save Changes" : mode === 'duplicate' ? "Create Duplicate" : `Create ${getProcessTypeLabel()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}