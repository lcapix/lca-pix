"use client"

import React, { useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Star, Package, BarChart3, X, AlertCircle, TrendingDown, CheckCircle } from "lucide-react"

interface CaseMiniDashboardCardProps {
  caseData: any | null
  assessmentData?: any
  isBaseCase: boolean
  showDropdown: boolean
  slotNumber?: number
  availableCases?: any[]
  onCaseChange?: (caseId: string) => void
  onRemove?: () => void
  isLoadingAssessment?: boolean
  assessmentError?: string
}

export function CaseMiniDashboardCard({
  caseData,
  assessmentData,
  isBaseCase,
  showDropdown,
  slotNumber,
  availableCases = [],
  onCaseChange,
  onRemove,
  isLoadingAssessment = false,
  assessmentError
}: CaseMiniDashboardCardProps) {

  // Debug logging
  useEffect(() => {
    if (caseData) {
      console.log(`🎯 CARD DEBUG [${isBaseCase ? 'BASE' : 'COMP'}] Case ${caseData.id}:`, {
        hasAssessmentData: !!assessmentData,
        hasTotalImpacts: !!assessmentData?.total_impacts,
        isArray: Array.isArray(assessmentData?.total_impacts),
        impactsCount: assessmentData?.total_impacts?.length || 0,
        isLoading: isLoadingAssessment,
        hasError: !!assessmentError,
        assessmentDataStructure: assessmentData ? Object.keys(assessmentData) : [],
        sampleImpact: assessmentData?.total_impacts?.[0]
      })
    }
  }, [caseData, assessmentData, isLoadingAssessment, assessmentError, isBaseCase])

  // Get top impact categories from assessment data
  const getTopCategories = () => {
    if (!assessmentData?.total_impacts || !Array.isArray(assessmentData.total_impacts)) {
      console.log(`⚠️ CARD: No valid total_impacts for case ${caseData?.id}`)
      return []
    }

    // total_impacts is an array of {category_name, impact_value, unit}
    const categories = assessmentData.total_impacts
      .map((impact: any) => ({
        name: impact.category_name,
        value: typeof impact.impact_value === 'number' ? Math.abs(impact.impact_value) : 0,
        unit: impact.unit
      }))
      .filter(cat => cat.value > 0) // Only show categories with actual impact
      .sort((a, b) => b.value - a.value)
      .slice(0, 3) // Show top 3 categories

    console.log(`📊 CARD: Processed ${categories.length} categories for case ${caseData?.id}`)
    return categories
  }

  const topCategories = getTopCategories()

  // Calculate total environmental impact
  const getTotalImpact = () => {
    if (!assessmentData?.total_impacts || !Array.isArray(assessmentData.total_impacts)) {
      console.log('⚠️ CARD: No valid total_impacts', {
        caseId: caseData?.id,
        hasData: !!assessmentData,
        hasTotalImpacts: !!assessmentData?.total_impacts,
        isArray: Array.isArray(assessmentData?.total_impacts)
      })
      return 0
    }

    const total = assessmentData.total_impacts.reduce((sum: number, cat: any) => {
      const value = typeof cat.impact_value === 'number' ? Math.abs(cat.impact_value) :
                    (typeof cat.value === 'number' ? Math.abs(cat.value) : 0)
      return sum + value
    }, 0)

    console.log('📊 CARD: Calculated total impact', {
      caseId: caseData?.id,
      count: assessmentData.total_impacts.length,
      total: total
    })

    return total
  }

  const totalImpact = getTotalImpact()
  const componentCount = assessmentData?.summary?.total_components || 0
  const categoryCount = assessmentData?.total_impacts?.length || 0

  // DEBUG: Log what the card actually receives
  console.log('🎯 CARD RENDER DEBUG:', {
    caseId: caseData?.id,
    caseName: caseData?.name,
    hasAssessmentData: !!assessmentData,
    assessmentDataKeys: assessmentData ? Object.keys(assessmentData) : [],
    hasTotalImpacts: !!assessmentData?.total_impacts,
    isArray: Array.isArray(assessmentData?.total_impacts),
    impactsCount: assessmentData?.total_impacts?.length || 0,
    totalImpact: totalImpact,
    willShowData: totalImpact > 0,
    sampleImpact: assessmentData?.total_impacts?.[0]
  })

  // Empty state for dropdown
  if (showDropdown && !caseData) {
    return (
      <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <Badge variant="secondary" className="text-xs">
              Case {slotNumber}
            </Badge>
            {onRemove && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRemove}
                aria-label="Remove case"
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <Select value="" onValueChange={onCaseChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a case..." />
            </SelectTrigger>
            <SelectContent>
              {availableCases.map(c => (
                <SelectItem key={c.id} value={c.id.toString()}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="mt-4 text-center py-6 text-gray-400">
            <Package className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">No case selected</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!caseData) return null

  return (
    <Card className={`border-2 h-full min-h-[380px] flex flex-col shadow-sm bg-white ${
      isBaseCase
        ? 'border-blue-400'
        : 'border-gray-200'
    }`}>
      <CardContent className="p-5 flex-1 flex flex-col">
        {/* Header with Case Name and Actions */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {isBaseCase && <Star className="h-4 w-4 text-blue-600 fill-blue-600" />}
              <h3 className="font-bold text-lg text-gray-900">{caseData.name}</h3>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                className={`text-xs font-semibold ${
                  isBaseCase ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {isBaseCase ? "Base Case" : `Case ${slotNumber}`}
              </Badge>
              {!isBaseCase && (
                <span className="text-xs text-gray-500 font-medium">Comparative</span>
              )}
              {totalImpact > 0 && (
                <Badge variant="outline" className="text-xs border-green-500 text-green-700 bg-green-50">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Assessed
                </Badge>
              )}
            </div>
          </div>

          {showDropdown && onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              aria-label="Remove case"
              className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-600"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Dropdown for comparative cases */}
        {showDropdown && onCaseChange && (
          <div className="mb-4">
            <Select value={caseData.id.toString()} onValueChange={onCaseChange}>
              <SelectTrigger className="w-full h-9 text-sm border-gray-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={caseData.id.toString()}>
                  {caseData.name}
                </SelectItem>
                {availableCases.filter(c => c.id !== caseData.id).map(c => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Assessment Content */}
        <div className="flex-1 flex flex-col min-h-[180px]">
          {isLoadingAssessment ? (
            // Loading state
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-4 w-24" />
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          ) : assessmentError ? (
            // Error state
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center py-6">
                <AlertCircle className="h-10 w-10 mx-auto mb-3 text-red-500" />
                <p className="text-sm font-semibold text-red-600 mb-1">Error Loading Data</p>
                <p className="text-xs text-red-500">{assessmentError}</p>
              </div>
            </div>
          ) : (assessmentData?.total_impacts?.length > 0) ? (
            // Success state with new design matching screenshot 2
            <div className="space-y-4">
              {/* Total Environmental Impact Section */}
              <div className={`rounded-lg p-4 border ${
                isBaseCase
                  ? 'bg-gradient-to-br from-blue-100 to-cyan-100 border-blue-200'
                  : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-700">Total Environmental Impact</h4>
                  <TrendingDown className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900">{totalImpact.toFixed(2)}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {componentCount} component{componentCount !== 1 ? 's' : ''} • {categoryCount} categor{categoryCount !== 1 ? 'ies' : 'y'}
                </p>
              </div>

              {/* Top Impact Categories - Numbered List */}
              {topCategories.length > 0 && (
                <div>
                  <h5 className="text-sm font-bold text-gray-900 mb-3">Top Impact Categories</h5>
                  <div className="space-y-2">
                    {topCategories.map((category, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <span className="text-sm font-semibold text-gray-400 w-6">{idx + 1}.</span>
                          <span className="text-sm font-medium text-gray-700">{category.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-gray-900">{category.value.toFixed(2)}</span>
                          <span className="text-xs text-gray-500 ml-1">{category.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Components Analyzed Footer */}
              {componentCount > 0 && (
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                    <span className="font-medium">{componentCount} Component{componentCount !== 1 ? 's' : ''} Analyzed</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Empty state
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center py-8">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm font-medium text-gray-600 mb-1">No Assessment Data</p>
                <p className="text-xs text-gray-400">Run an assessment to see impact results</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
