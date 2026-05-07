"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { formatChemicalUnit } from "@/lib/format-utils"

interface CategoryData {
  category_name: string
  baseValue: number
  comparativeValue: number
  unit: string
}

interface ComparisonChartProps {
  data: CategoryData[]
  baseCaseName: string
  comparativeCaseName: string
}

export function ComparisonChart({ data, baseCaseName, comparativeCaseName }: ComparisonChartProps) {
  // Transform data for recharts
  const chartData = data.map(item => ({
    name: item.category_name,
    [baseCaseName]: item.baseValue,
    [comparativeCaseName]: item.comparativeValue,
    unit: item.unit
  }))

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{data.name}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-700">{entry.name}:</span>
              <span className="font-medium">
                {entry.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} {formatChemicalUnit(data.unit)}
              </span>
            </div>
          ))}
          {payload.length === 2 && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <span className="text-xs text-gray-600">
                Difference: {Math.abs(payload[1].value - payload[0].value).toLocaleString(undefined, { maximumFractionDigits: 2 })} {formatChemicalUnit(data.unit)}
              </span>
            </div>
          )}
        </div>
      )
    }
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Impact Category Breakdown</CardTitle>
        <CardDescription>
          Comparison of environmental impacts across different categories
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              barCategoryGap="20%"
              barGap={8}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={100}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                label={{ value: 'Impact Value', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="rect"
              />
              <Bar
                dataKey={baseCaseName}
                fill="#3b82f6"
                fillOpacity={0.9}
                radius={[4, 4, 0, 0]}
                name={baseCaseName}
              />
              <Bar
                dataKey={comparativeCaseName}
                fill="#6366f1"
                fillOpacity={0.9}
                radius={[4, 4, 0, 0]}
                name={comparativeCaseName}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
