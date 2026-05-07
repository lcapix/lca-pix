"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { DollarSign, Package } from "lucide-react"

interface ChildComponent {
  id: string
  name: string
  type: string
  opex: number
  capex: number
}

interface AbcCostingProps {
  componentId: number
  componentName: string
  opex: number
  capex: number
  quantity: number
  unit: string
  driverType?: string
  driverQuantity?: number
  childComponents?: ChildComponent[]
}

export function AbcCosting({
  componentId,
  componentName,
  opex = 0,
  capex = 0,
  quantity = 1,
  unit = "unit",
  driverType,
  driverQuantity,
  childComponents = []
}: AbcCostingProps) {
  // Calculate totals
  const totalCost = opex + capex
  const costPerUnit = quantity > 0 ? totalCost / quantity : 0

  // Calculate rolled-up costs from children
  const childTotalOpex = childComponents.reduce((sum, child) => sum + (child.opex || 0), 0)
  const childTotalCapex = childComponents.reduce((sum, child) => sum + (child.capex || 0), 0)
  const childTotalCost = childTotalOpex + childTotalCapex

  const grandTotalCost = totalCost + childTotalCost

  // Prepare pie chart data
  const pieData = [
    { name: "Operational Cost", value: opex, color: "#3b82f6" },
    { name: "Capital Cost", value: capex, color: "#10b981" }
  ].filter(item => item.value > 0)

  // Prepare child components bar chart data
  const childCostData = childComponents.map(child => ({
    name: child.name.length > 20 ? child.name.substring(0, 20) + "..." : child.name,
    OpEx: child.opex || 0,
    CapEx: child.capex || 0,
    Total: (child.opex || 0) + (child.capex || 0)
  })).sort((a, b) => b.Total - a.Total).slice(0, 10) // Top 10 by cost

  const hasChildCosts = childComponents.length > 0 && childTotalCost > 0
  const hasCosts = totalCost > 0 || childTotalCost > 0

  // Custom tooltip for pie chart
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]
      const percentage = totalCost > 0 ? ((data.value / totalCost) * 100).toFixed(1) : "0"
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900">{data.name}</p>
          <p className="text-sm text-gray-600">
            ${data.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-500">{percentage}% of total</p>
        </div>
      )
    }
    return null
  }

  if (!hasCosts) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <DollarSign className="h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500 text-center">
            No cost data available for this component
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Add OpEx or CapEx values to see ABC analysis
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cost Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Operational Cost Card */}
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-3">
            <CardDescription className="text-sm font-medium text-blue-900">
              Operational Cost (OpEx)
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-blue-900">
              ${opex.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-blue-700">
              {totalCost > 0 ? `${((opex / totalCost) * 100).toFixed(1)}% of direct costs` : "No direct costs"}
            </p>
            {hasChildCosts && (
              <p className="text-xs text-blue-600 mt-1">
                + ${childTotalOpex.toLocaleString()} from children
              </p>
            )}
          </CardContent>
        </Card>

        {/* Capital Cost Card */}
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader className="pb-3">
            <CardDescription className="text-sm font-medium text-green-900">
              Capital Cost (CapEx)
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-green-900">
              ${capex.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-green-700">
              {totalCost > 0 ? `${((capex / totalCost) * 100).toFixed(1)}% of direct costs` : "No direct costs"}
            </p>
            {hasChildCosts && (
              <p className="text-xs text-green-600 mt-1">
                + ${childTotalCapex.toLocaleString()} from children
              </p>
            )}
          </CardContent>
        </Card>

        {/* Total Cost Card */}
        <Card className="border-slate-300 bg-slate-50">
          <CardHeader className="pb-3">
            <CardDescription className="text-sm font-medium text-slate-900">
              {hasChildCosts ? "Total Cost (Incl. Children)" : "Total Direct Cost"}
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-slate-900">
              ${(hasChildCosts ? grandTotalCost : totalCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {quantity > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-slate-200 text-slate-800">
                  ${costPerUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {unit}
                </Badge>
              </div>
            )}
            {hasChildCosts && (
              <p className="text-xs text-slate-600 mt-2">
                Direct: ${totalCost.toLocaleString()} | Children: ${childTotalCost.toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cost Breakdown Visualization */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pie Chart - OpEx vs CapEx */}
        {totalCost > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cost Breakdown</CardTitle>
              <CardDescription>Operational vs Capital expenditure split</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Cost Efficiency Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cost Efficiency</CardTitle>
            <CardDescription>Key cost metrics and rates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {quantity > 0 ? (
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">Cost per Unit</span>
                </div>
                <span className="text-2xl font-bold text-slate-900">
                  ${costPerUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {unit}
                </span>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Package className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                <p className="text-sm">No quantity data available</p>
                <p className="text-xs text-slate-400 mt-1">Add quantity to see cost per unit</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Child Components Cost Analysis */}
      {hasChildCosts && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Child Components Cost Analysis</CardTitle>
            <CardDescription>
              Cost breakdown across {childComponents.length} sub-components
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Bar Chart */}
            {childCostData.length > 0 && (
              <div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={childCostData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: any) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    />
                    <Legend />
                    <Bar dataKey="OpEx" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="CapEx" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-300">
                    <th className="text-left py-2 px-3 font-semibold text-slate-700 text-sm">Component</th>
                    <th className="text-right py-2 px-3 font-semibold text-blue-700 text-sm">OpEx</th>
                    <th className="text-right py-2 px-3 font-semibold text-green-700 text-sm">CapEx</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-700 text-sm">Total</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-700 text-sm">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {childComponents
                    .map(child => ({
                      ...child,
                      total: (child.opex || 0) + (child.capex || 0)
                    }))
                    .sort((a, b) => b.total - a.total)
                    .map((child, index) => {
                      const percentage = childTotalCost > 0 ? (child.total / childTotalCost) * 100 : 0
                      return (
                        <tr
                          key={child.id}
                          className={`border-b border-slate-200 hover:bg-slate-50 ${
                            index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                          }`}
                        >
                          <td className="py-2 px-3 text-sm font-medium text-slate-900">{child.name}</td>
                          <td className="py-2 px-3 text-sm text-right text-blue-700">
                            ${(child.opex || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-sm text-right text-green-700">
                            ${(child.capex || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-sm text-right font-semibold text-slate-900">
                            ${child.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-sm text-right">
                            <Badge variant="secondary" className="bg-slate-200 text-slate-800">
                              {percentage.toFixed(1)}%
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold">
                    <td className="py-3 px-3 text-sm text-slate-900">TOTAL</td>
                    <td className="py-3 px-3 text-sm text-right text-blue-900">
                      ${childTotalOpex.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-sm text-right text-green-900">
                      ${childTotalCapex.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-sm text-right text-slate-900">
                      ${childTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-sm text-right text-slate-900">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
