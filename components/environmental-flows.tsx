"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TableSkeleton } from "@/components/skeletons/table-skeleton"
import { Plus, Trash2, Edit, ArrowDown, ArrowUp, Zap, Info } from "lucide-react"
import { toast } from "sonner"
import { apiRequest } from "@/lib/api-client"

interface Flow {
  flow_id: number
  component_id: number
  substance_id: number
  substance_name: string
  substance_category?: string
  flow_type: 'input' | 'output'
  quantity: number
  unit: string
  is_driver: boolean
  driver_description?: string
  created_at?: string
}

interface Substance {
  substance_id: number
  substance_name: string
  category: string
  cas_number?: string
}

interface EnvironmentalFlowsProps {
  componentId: number
  componentName: string
  isReadOnly?: boolean
}

export function EnvironmentalFlows({ componentId, componentName, isReadOnly = false }: EnvironmentalFlowsProps) {
  const [flows, setFlows] = useState<Flow[]>([])
  const [substances, setSubstances] = useState<Substance[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingFlow, setEditingFlow] = useState<Flow | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    substance_id: '',
    flow_type: 'input' as 'input' | 'output',
    quantity: '',
    unit: 'kg',
    is_driver: true,
    driver_description: ''
  })

  // Fetch flows and substances on mount
  useEffect(() => {
    fetchFlows()
    fetchSubstances()
  }, [componentId])

  const fetchFlows = async () => {
    setIsLoading(true)
    try {
      const response = await apiRequest(`/api/components/${componentId}/flows`)
      const data = await response.json()

      if (data.success) {
        setFlows(data.flows || [])
      } else {
        toast.error('Failed to load flows')
      }
    } catch (error) {
      console.error('Error fetching flows:', error)
      toast.error('Failed to load environmental flows')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSubstances = async () => {
    try {
      const response = await apiRequest('/api/substances')
      const data = await response.json()

      if (data.success) {
        setSubstances(data.substances || [])
      }
    } catch (error) {
      console.error('Error fetching substances:', error)
    }
  }

  const handleOpenDialog = (flow?: Flow) => {
    if (flow) {
      setEditingFlow(flow)
      setFormData({
        substance_id: String(flow.substance_id),
        flow_type: flow.flow_type,
        quantity: String(flow.quantity),
        unit: flow.unit,
        is_driver: flow.is_driver,
        driver_description: flow.driver_description || ''
      })
    } else {
      setEditingFlow(null)
      setFormData({
        substance_id: '',
        flow_type: 'input',
        quantity: '',
        unit: 'kg',
        is_driver: true,
        driver_description: ''
      })
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingFlow(null)
  }

  const handleSaveFlow = async () => {
    // Validation
    if (!formData.substance_id) {
      toast.error('Please select a substance')
      return
    }

    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      toast.error('Please enter a valid quantity')
      return
    }

    try {
      const payload = {
        substance_id: parseInt(formData.substance_id),
        flow_type: formData.flow_type,
        quantity: parseFloat(formData.quantity),
        unit: formData.unit,
        is_driver: formData.is_driver,
        driver_description: formData.driver_description || null
      }

      let response
      if (editingFlow) {
        // Update existing flow
        response = await apiRequest(`/api/flows/${editingFlow.flow_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } else {
        // Create new flow
        response = await apiRequest(`/api/components/${componentId}/flows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }

      const result = await response.json()

      if (result.success) {
        toast.success(editingFlow ? 'Flow updated successfully' : 'Flow created successfully')
        await fetchFlows()
        handleCloseDialog()
      } else {
        toast.error(result.error || 'Failed to save flow')
      }
    } catch (error) {
      console.error('Error saving flow:', error)
      toast.error('Failed to save flow')
    }
  }

  const handleDeleteFlow = async (flowId: number) => {
    if (!confirm('Are you sure you want to delete this flow?')) return

    try {
      const response = await apiRequest(`/api/flows/${flowId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Flow deleted successfully')
        await fetchFlows()
      } else {
        toast.error(result.error || 'Failed to delete flow')
      }
    } catch (error) {
      console.error('Error deleting flow:', error)
      toast.error('Failed to delete flow')
    }
  }

  const inputFlows = flows.filter(f => f.flow_type === 'input')
  const outputFlows = flows.filter(f => f.flow_type === 'output')
  const driverFlows = flows.filter(f => f.is_driver)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-600" />
              Environmental Flows
            </CardTitle>
            <CardDescription>
              Inputs and outputs for {componentName} - used in LCA calculations
            </CardDescription>
          </div>
          {!isReadOnly && (
            <Button onClick={() => handleOpenDialog()} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Flow
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <TableSkeleton rows={5} columns={7} />
        ) : flows.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
            <Info className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-700 mb-2">No Environmental Flows</h3>
            <p className="text-sm text-gray-600 mb-4">
              Add inputs (electricity, materials) and outputs (emissions, waste) to enable LCA calculations
            </p>
            {!isReadOnly && (
              <Button onClick={() => handleOpenDialog()} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add First Flow
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowDown className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Inputs</span>
                </div>
                <div className="text-2xl font-bold text-green-700">{inputFlows.length}</div>
              </div>
              <div className="bg-orange-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowUp className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium text-orange-900">Outputs</span>
                </div>
                <div className="text-2xl font-bold text-orange-700">{outputFlows.length}</div>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Drivers</span>
                </div>
                <div className="text-2xl font-bold text-blue-700">{driverFlows.length}</div>
              </div>
            </div>

            {/* Flows Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Substance</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Driver</TableHead>
                  {!isReadOnly && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {flows.map((flow) => (
                  <TableRow key={flow.flow_id}>
                    <TableCell>
                      {flow.flow_type === 'input' ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                          <ArrowDown className="h-3 w-3 mr-1" />
                          Input
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                          <ArrowUp className="h-3 w-3 mr-1" />
                          Output
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{flow.substance_name}</TableCell>
                    <TableCell className="text-right font-mono">{flow.quantity.toLocaleString()}</TableCell>
                    <TableCell>{flow.unit}</TableCell>
                    <TableCell>
                      <span className="text-xs text-gray-600">{flow.substance_category || 'N/A'}</span>
                    </TableCell>
                    <TableCell>
                      {flow.is_driver ? (
                        <Badge variant="default" className="bg-blue-600">
                          <Zap className="h-3 w-3 mr-1" />
                          Driver
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Non-driver</Badge>
                      )}
                    </TableCell>
                    {!isReadOnly && (
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(flow)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteFlow(flow.flow_id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingFlow ? 'Edit Flow' : 'Add Environmental Flow'}</DialogTitle>
            <DialogDescription>
              Define an input or output flow for this component
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Flow Type</Label>
                <Select
                  value={formData.flow_type}
                  onValueChange={(value) => setFormData({ ...formData, flow_type: value as 'input' | 'output' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="input">
                      <div className="flex items-center gap-2">
                        <ArrowDown className="h-4 w-4 text-green-600" />
                        Input
                      </div>
                    </SelectItem>
                    <SelectItem value="output">
                      <div className="flex items-center gap-2">
                        <ArrowUp className="h-4 w-4 text-orange-600" />
                        Output
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Driver Status</Label>
                <Select
                  value={String(formData.is_driver)}
                  onValueChange={(value) => setFormData({ ...formData, is_driver: value === 'true' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-blue-600" />
                        Driver Flow
                      </div>
                    </SelectItem>
                    <SelectItem value="false">Non-driver</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Substance</Label>
              <Select
                value={formData.substance_id}
                onValueChange={(value) => setFormData({ ...formData, substance_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a substance..." />
                </SelectTrigger>
                <SelectContent>
                  {substances.map((substance) => (
                    <SelectItem key={substance.substance_id} value={String(substance.substance_id)}>
                      {substance.substance_name} {substance.category && `(${substance.category})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>Unit</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => setFormData({ ...formData, unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg (kilograms)</SelectItem>
                    <SelectItem value="kWh">kWh (kilowatt-hours)</SelectItem>
                    <SelectItem value="m3">m³ (cubic meters)</SelectItem>
                    <SelectItem value="MJ">MJ (megajoules)</SelectItem>
                    <SelectItem value="L">L (liters)</SelectItem>
                    <SelectItem value="ton">ton (metric tons)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.is_driver && (
              <div className="space-y-2">
                <Label>Driver Description (Optional)</Label>
                <Input
                  value={formData.driver_description}
                  onChange={(e) => setFormData({ ...formData, driver_description: e.target.value })}
                  placeholder="e.g., Primary energy consumption"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSaveFlow}>
              {editingFlow ? 'Update Flow' : 'Add Flow'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
