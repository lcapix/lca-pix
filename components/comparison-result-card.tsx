"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowDown, ArrowUp, Minus } from "lucide-react"

interface ComparisonResultCardProps {
  caseName: string
  caseType: "base" | "comparative"
  environmentalLoad: number
  environmentalCost: number
  loadDifference?: {
    percentage: number
    isImprovement: boolean
  }
  costDifference?: {
    percentage: number
    isImprovement: boolean
  }
}

export function ComparisonResultCard({
  caseName,
  caseType,
  environmentalLoad,
  environmentalCost,
  loadDifference,
  costDifference
}: ComparisonResultCardProps) {
  const isBase = caseType === "base"

  const renderDifference = (
    difference: { percentage: number; isImprovement: boolean } | undefined,
    isEnvLoad: boolean
  ) => {
    if (!difference) return null

    const { percentage, isImprovement } = difference
    const Icon = isImprovement ? ArrowDown : ArrowUp
    const colorClass = isImprovement ? "text-green-600" : "text-red-600"
    const bgClass = isImprovement ? "bg-green-50" : "bg-red-50"
    const label = isImprovement
      ? isEnvLoad ? "lower" : "cheaper"
      : isEnvLoad ? "higher" : "more expensive"

    return (
      <div className={`flex items-center gap-2 mt-2 px-3 py-2 rounded-lg ${bgClass}`}>
        <Icon className={`h-4 w-4 ${colorClass}`} />
        <span className={`text-sm font-medium ${colorClass}`}>
          {percentage.toFixed(1)}% {label}
        </span>
      </div>
    )
  }

  // Ensure numbers are valid and finite
  const safeLoad = isFinite(environmentalLoad) ? environmentalLoad : 0
  const safeCost = isFinite(environmentalCost) ? environmentalCost : 0

  return (
    <Card className={`flex-1 ${isBase ? 'border-blue-200 bg-blue-50/30' : 'border-green-200 bg-green-50/30'}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">{caseName}</CardTitle>
          <Badge variant={isBase ? "secondary" : "outline"} className={isBase ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}>
            {isBase ? "Base Case" : "Comparative"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Environmental Load */}
        <div>
          <div className="text-sm font-medium text-gray-600 mb-1">Environmental Load</div>
          <div className="text-3xl font-bold text-gray-900">
            {safeLoad.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-sm text-gray-500">kg CO₂-eq</div>
          {renderDifference(loadDifference, true)}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200" />

        {/* Environmental Cost */}
        <div>
          <div className="text-sm font-medium text-gray-600 mb-1">Environmental Cost</div>
          <div className="text-3xl font-bold text-gray-900">
            ${safeCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-sm text-gray-500">USD (CapEx + OpEx)</div>
          {renderDifference(costDifference, false)}
        </div>
      </CardContent>
    </Card>
  )
}
