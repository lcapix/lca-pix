"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, TrendingUp, TrendingDown, Activity } from "lucide-react"
import { apiRequest } from "@/lib/api-client"
import { formatChemicalUnit } from "@/lib/format-utils"

interface CaseMiniVisualizationProps {
  caseId: string
  caseName: string
}

interface CategoryImpact {
  category_name: string
  impact_value: number
  unit: string
}

interface AssessmentSummary {
  total_components: number
  impact_categories_calculated: number
  top_categories: CategoryImpact[]
  total_score: number
  status: 'assessed' | 'not_assessed'
}

const CATEGORY_COLORS: Record<string, string> = {
  "Global Warming": "bg-red-500",
  "Ozone Depletion": "bg-blue-500",
  "Acidification": "bg-orange-500",
  "Eutrophication": "bg-green-500",
  "Photochemical Oxidation": "bg-purple-500",
  "Human Toxicity": "bg-pink-500",
  "Ecotoxicity Aquatic": "bg-cyan-500",
  "Ecotoxicity Terrestrial": "bg-emerald-500",
  "Resource Depletion": "bg-amber-500",
  "Land Use": "bg-lime-500"
}

// CATEGORY_ICONS removed - emojis no longer used per UI requirements

export function CaseMiniVisualization({ caseId, caseName }: CaseMiniVisualizationProps) {
  const [summary, setSummary] = useState<AssessmentSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchAssessmentSummary = async () => {
      try {
        setIsLoading(true)

        // Fetch latest assessments for this case
        const response = await apiRequest(`/api/cases/${caseId}/assessments`)
        const data = await response.json()

        console.log(`🔍 [Case ${caseId}] Raw API response:`, data)
        console.log(`🔍 [Case ${caseId}] Assessments found:`, data.assessments?.length || 0)
        if (data.assessments?.[0]) {
          console.log(`🔍 [Case ${caseId}] First assessment structure:`, Object.keys(data.assessments[0]))
          console.log(`🔍 [Case ${caseId}] First assessment data:`, data.assessments[0])
        }

        if (data.success && data.assessments && data.assessments.length > 0) {
          // Get the most recent completed assessment
          // FALLBACK: If status column doesn't exist (before migration), treat all assessments as completed
          const completedAssessments = data.assessments.filter(
            (a: any) => a.status === 'completed' || a.status === undefined || a.status === null
          )

          console.log(`🔍 [Case ${caseId}] Completed assessments:`, completedAssessments.length)
          console.log(`🔍 [Case ${caseId}] Completed assessments data:`, completedAssessments)

          if (completedAssessments.length > 0) {
            const latestAssessment = completedAssessments[0]

            // Fetch full assessment details
            const detailResponse = await apiRequest(`/api/assessments/${latestAssessment.run_id}`)
            const detailData = await detailResponse.json()

            if (detailData.success && detailData.total_impacts) {
              // Get top 3 categories by impact value
              const sortedCategories = [...detailData.total_impacts]
                .sort((a, b) => Math.abs(b.impact_value) - Math.abs(a.impact_value))
                .slice(0, 3)
                .map(cat => ({
                  category_name: cat.category_name,
                  impact_value: cat.impact_value,
                  unit: cat.unit
                }))

              // Calculate total score (sum of absolute values)
              const totalScore = detailData.total_impacts.reduce(
                (sum: number, cat: any) => sum + Math.abs(cat.impact_value),
                0
              )

              setSummary({
                total_components: detailData.summary?.total_components || 0,
                impact_categories_calculated: detailData.total_impacts.length,
                top_categories: sortedCategories,
                total_score: totalScore,
                status: 'assessed'
              })
            }
          } else {
            // No completed assessments
            setSummary({
              total_components: 0,
              impact_categories_calculated: 0,
              top_categories: [],
              total_score: 0,
              status: 'not_assessed'
            })
          }
        } else {
          // No assessments at all
          setSummary({
            total_components: 0,
            impact_categories_calculated: 0,
            top_categories: [],
            total_score: 0,
            status: 'not_assessed'
          })
        }
      } catch (error) {
        console.error('Failed to fetch assessment summary:', error)
        setSummary({
          total_components: 0,
          impact_categories_calculated: 0,
          top_categories: [],
          total_score: 0,
          status: 'not_assessed'
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchAssessmentSummary()
  }, [caseId])

  if (isLoading) {
    return (
      <div className="border-t pt-4 mt-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
        <div className="space-y-2">
          <div className="h-6 bg-gray-200 rounded"></div>
          <div className="h-6 bg-gray-200 rounded"></div>
          <div className="h-6 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!summary || summary.status === 'not_assessed') {
    return (
      <div className="border-t pt-4 mt-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-500">Assessment Status</span>
        </div>
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-dashed">
          <XCircle className="h-5 w-5 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-600">Not Yet Assessed</p>
            <p className="text-xs text-gray-500">Run an assessment to see impact data</p>
          </div>
        </div>
      </div>
    )
  }

  // Get max value for scaling bars
  const maxValue = Math.max(...summary.top_categories.map(c => Math.abs(c.impact_value)))

  return (
    <div className="border-t pt-4 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-gray-700">Impact Overview</span>
        </div>
        <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Assessed
        </Badge>
      </div>

      {/* Total Score Card */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-3 mb-4 border border-blue-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-600 mb-1">Total Environmental Impact</p>
            <p className="text-2xl font-bold text-gray-900">
              {Number(summary.total_score || 0).toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {summary.total_components} components • {summary.impact_categories_calculated} categories
            </p>
          </div>
          <div className="text-right">
            {Number(summary.total_score || 0) > 100 ? (
              <TrendingUp className="h-8 w-8 text-red-500" />
            ) : (
              <TrendingDown className="h-8 w-8 text-green-500" />
            )}
          </div>
        </div>
      </div>

      {/* Top 3 Categories - Simple Table Style */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">Top Impact Categories</p>

        <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
          {summary.top_categories.map((category, index) => (
            <div
              key={index}
              className={`flex items-center justify-between px-4 py-3 hover:bg-gray-100 transition-colors ${
                index !== summary.top_categories.length - 1 ? 'border-b border-gray-200' : ''
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="flex-shrink-0 text-sm font-bold text-gray-400">
                  {index + 1}.
                </span>
                <span className="font-medium text-gray-900 text-sm truncate">
                  {category.category_name}
                </span>
              </div>

              <div className="flex items-baseline gap-1.5 flex-shrink-0">
                <span className="text-base font-bold text-gray-900 tabular-nums">
                  {Number(category.impact_value || 0).toFixed(2)}
                </span>
                <span className="text-xs text-gray-500">
                  {formatChemicalUnit(category.unit)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Component Count Badge */}
      {summary.total_components > 0 && (
        <div className="mt-4 pt-3 border-t flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-blue-500"></div>
              <span>{summary.total_components} Components Analyzed</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
