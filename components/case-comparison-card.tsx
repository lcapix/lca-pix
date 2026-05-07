"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Star, Package, Network, BarChart3, Calendar } from "lucide-react"

interface CaseComparisonCardProps {
  caseData: {
    case_id: number
    case_name: string
    case_description?: string
    case_type?: string
    created_at?: string
  }
  componentCount?: number
  totalImpact?: number
  isBaseCase?: boolean
  assessmentData?: {
    run_id: number
    status: string
    total_impact?: number
    component_breakdown_count?: number
    created_at: string
  }
}

export function CaseComparisonCard({
  caseData,
  componentCount = 0,
  totalImpact,
  isBaseCase = false,
  assessmentData
}: CaseComparisonCardProps) {
  return (
    <Card className={`h-full ${isBaseCase ? 'border-2 border-blue-500 bg-blue-50/30' : 'border-2 border-purple-500 bg-purple-50/30'}`}>
      <CardHeader className={`${isBaseCase ? 'bg-gradient-to-r from-blue-50 to-blue-100' : 'bg-gradient-to-r from-purple-50 to-purple-100'} pb-3`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 text-base">
              {isBaseCase && <Star className="h-4 w-4 text-blue-600 fill-blue-600" />}
              {caseData.case_name}
            </CardTitle>
            <CardDescription className="mt-1">
              {isBaseCase ? (
                <Badge variant="default" className="mt-1 text-xs">
                  Base Case
                </Badge>
              ) : (
                <Badge variant="secondary" className="mt-1 text-xs bg-purple-100 text-purple-800">
                  Comparative Case
                </Badge>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {/* Description */}
        {caseData.case_description && (
          <div className="pb-2 border-b">
            <p className="text-xs text-gray-700 leading-relaxed line-clamp-2">
              {caseData.case_description}
            </p>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-2">
          {/* Component Count */}
          <div className="bg-white rounded-lg p-2 border">
            <div className="flex items-center gap-1 mb-1">
              <Package className="h-3 w-3 text-gray-500" />
              <span className="text-[10px] font-medium text-gray-600 uppercase">Components</span>
            </div>
            <p className="text-xl font-bold text-gray-900">
              {componentCount}
            </p>
          </div>

          {/* Total Impact */}
          {totalImpact !== undefined && (
            <div className="bg-white rounded-lg p-2 border">
              <div className="flex items-center gap-1 mb-1">
                <BarChart3 className="h-3 w-3 text-gray-500" />
                <span className="text-[10px] font-medium text-gray-600 uppercase">Total Impact</span>
              </div>
              <p className="text-xl font-bold text-gray-900">
                {totalImpact.toFixed(2)}
              </p>
            </div>
          )}
        </div>

        {/* Assessment Info */}
        {assessmentData && (
          <div className="bg-white rounded-lg p-2 border space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Network className="h-3 w-3 text-gray-500" />
                <span className="text-[10px] font-medium text-gray-600 uppercase">Assessment</span>
              </div>
              <Badge
                variant={assessmentData.status === 'completed' ? 'default' : 'secondary'}
                className={`text-[10px] ${assessmentData.status === 'completed' ? 'bg-green-100 text-green-800' : ''}`}
              >
                {assessmentData.status}
              </Badge>
            </div>
            {assessmentData.created_at && (
              <div className="flex items-center gap-1 text-[10px] text-gray-600">
                <Calendar className="h-3 w-3" />
                {new Date(assessmentData.created_at).toLocaleDateString()}
              </div>
            )}
          </div>
        )}

        {/* Case Type */}
        {caseData.case_type && (
          <div className="pt-2 border-t">
            <p className="text-[10px] text-gray-600">
              Type: <span className="font-medium text-gray-900">{caseData.case_type}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
