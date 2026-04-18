"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { type Case } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, BarChart3, Leaf, Play, X, CheckCircle, AlertCircle, Activity, Calendar, Clock, Target, Loader2, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { formatChemicalUnit } from "@/lib/format-utils"
import { apiRequest } from "@/lib/api-client"
import { transformCaseFromDB } from "@/lib/data-transformers"
import { RunAssessmentModal } from "@/components/assessments/run-assessment-modal"

// Impact categories supported
const IMPACT_CATEGORIES = {
  "Global warming": { unit: "kg CO₂-eq", color: "text-red-600" },
  "Ozone depletion": { unit: "kg CFC-11-eq", color: "text-blue-600" },
  "Smog formation": { unit: "kg NOₓ-eq", color: "text-orange-600" },
  "Freshwater ecotoxicity": { unit: "CTUe", color: "text-cyan-600" },
  "Acidification": { unit: "kg SO₂-eq", color: "text-purple-600" }
}

// API Response Types
interface APIComponentBreakdown {
  component_id: number
  component_name: string
  component_type: string
  flows_processed: number
  impacts: Array<{
    category_id: number
    category_name: string
    impact_value: number
    unit: string
  }>
}

interface AssessmentResult {
  run_id: number
  run_name: string
  calculation_method: string
  status: string
  run_date: string
  executed_by_username: string
  impacts: Record<string, { value: number; unit: string }>
  costs: {
    operational: number
    capital: number
    total: number
  }
  componentBreakdown: APIComponentBreakdown[]
  algorithmSteps?: string[]
}

export default function ResultsPage() {
  const params = useParams()
  const router = useRouter()

  const projectId = params.projectId as string
  const caseId = params.caseId as string

  // Case data from API
  const [currentCase, setCurrentCase] = useState<Case | null>(null)
  const [isLoadingCase, setIsLoadingCase] = useState(true)

  // Assessment state (similar to v2)
  const [showOptions, setShowOptions] = useState(false)
  const [isRunningAssessment, setIsRunningAssessment] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [assessmentResults, setAssessmentResults] = useState<AssessmentResult[]>([])
  const [currentAssessment, setCurrentAssessment] = useState<AssessmentResult | null>(null)
  const [expandedAssessments, setExpandedAssessments] = useState<Set<number>>(new Set())
  const [showPreviousAssessments, setShowPreviousAssessments] = useState(false)
  const [assessOpen, setAssessOpen] = useState(false)

  // Fetch case data and components from API
  useEffect(() => {
    const fetchCaseData = async () => {
      setIsLoadingCase(true)
      try {
        // Fetch case and components in parallel
        const [caseResponse, componentsResponse] = await Promise.all([
          apiRequest(`/api/cases/${caseId}`),
          apiRequest(`/api/cases/${caseId}/components`)
        ])

        if (caseResponse.ok) {
          const caseData = await caseResponse.json()
          const componentsData = await componentsResponse.json()

          if (caseData.success && caseData.case) {
            const transformedCase = transformCaseFromDB(caseData.case)

            // Add components to case
            if (componentsData.success && componentsData.components) {
              const { transformComponentFromDB } = await import('@/lib/data-transformers')
              transformedCase.components = componentsData.components.map((c: any) => transformComponentFromDB(c))
            }

            setCurrentCase(transformedCase)
          }
        }
      } catch (error) {
        console.error('Failed to fetch case:', error)
      } finally {
        setIsLoadingCase(false)
      }
    }

    if (caseId) {
      fetchCaseData()
    }
  }, [caseId])

  const assessmentOptions = Object.keys(IMPACT_CATEGORIES).map(category => ({
    label: category,
    checked: selectedCategories.includes(category)
  }))

  const anyOptionSelected = selectedCategories.length > 0

  // Load historical assessments on mount
  useEffect(() => {
    const fetchAssessments = async () => {
      try {
        const response = await apiRequest(`/api/cases/${caseId}/assessments`)
        if (response.ok) {
          const data = await response.json()
          if (data.assessments && data.assessments.length > 0) {
            // Use API-provided data including impacts and componentBreakdown
            const transformedAssessments = data.assessments.map((assessment: any) => ({
              run_id: assessment.run_id,
              run_name: assessment.run_name,
              calculation_method: assessment.calculation_method,
              status: assessment.status,
              run_date: assessment.run_date,
              executed_by_username: assessment.executed_by_username,
              impacts: assessment.impacts || {},
              costs: assessment.costs || {
                operational: 0,
                capital: 0,
                total: 0
              },
              componentBreakdown: assessment.componentBreakdown || []
            }))
            setAssessmentResults(transformedAssessments)
            if (transformedAssessments.length > 0) {
              setCurrentAssessment(transformedAssessments[0])
              // Auto-expand the first (most recent) assessment
              setExpandedAssessments(new Set([transformedAssessments[0].run_id]))
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch assessments:', error)
      }
    }

    if (caseId) {
      fetchAssessments()
    }
  }, [caseId])

  // Loading state
  if (isLoadingCase) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <p className="text-gray-500">Loading case data...</p>
        </div>
      </div>
    )
  }

  // Case not found
  if (!currentCase) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Case not found</h2>
          <p className="text-gray-500 mb-4">The requested case could not be loaded.</p>
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  // Transform API assessment response into AssessmentResult for display
  const buildAssessmentResult = (data: any): AssessmentResult => {
    const impacts: Record<string, { value: number; unit: string }> = {}
    if (data.total_impacts) {
      data.total_impacts.forEach((impact: any) => {
        impacts[impact.category_name] = {
          value: impact.impact_value,
          unit: impact.unit
        }
      })
    }

    // Calculate total costs from component breakdown
    const componentsWithDrivers = currentCase?.components?.filter((c) =>
      c.driverCategory && c.drivers && c.drivers.length > 0
    ) || []
    const totalOperationalCost = componentsWithDrivers.reduce(
      (sum, c) => sum + (c.operationalCostUSD || 0), 0
    )
    const totalCapitalCost = componentsWithDrivers.reduce(
      (sum, c) => sum + (c.capitalCostUSD || 0), 0
    )

    const result: AssessmentResult = {
      run_id: data.assessment.run_id,
      run_name: data.assessment.run_name,
      calculation_method: data.assessment.calculation_method,
      status: data.assessment.status,
      run_date: data.assessment.run_date,
      executed_by_username: data.assessment.executed_by_username,
      impacts,
      costs: {
        operational: totalOperationalCost,
        capital: totalCapitalCost,
        total: totalOperationalCost + totalCapitalCost
      },
      componentBreakdown: data.component_breakdown || [],
      algorithmSteps: data.algorithm_steps || []
    }

    return result
  }

  const handleCategoryChange = (category: string, checked: boolean) => {
    if (checked) {
      setSelectedCategories(prev => [...prev, category])
    } else {
      setSelectedCategories(prev => prev.filter(c => c !== category))
    }
  }

  // Open method + region selector modal; modal performs the actual POST
  const handleRunAssessment = () => {
    setAssessOpen(true)
  }

  // Called by RunAssessmentModal with the raw API response after a successful run
  const handleAssessmentCompleted = (data: any) => {
    try {
      const result = buildAssessmentResult(data)

      setAssessmentResults(prev => [result, ...prev])
      setCurrentAssessment(result)

      setShowOptions(false)
      setSelectedCategories([])

      toast.success(`Assessment completed! Run ID: ${result.run_id}`)
      console.log('Assessment result:', result)
    } catch (error: any) {
      console.error("Failed to process assessment result:", error)
      toast.error(`Failed to process assessment result: ${error.message}`)
    }
  }

  const handleCancel = () => {
    setSelectedCategories([])
    setShowOptions(false)
  }

  const mostRecentAssessment = assessmentResults[0] || currentAssessment

  // Component readiness analysis
  const allComponents = currentCase?.components || []
  const componentsWithDrivers = allComponents.filter((c) =>
    c.driverCategory && c.drivers && c.drivers.length > 0
  )
  const componentsWithoutDrivers = allComponents.filter((c) =>
    !c.driverCategory || !c.drivers || c.drivers.length === 0
  )
  const assessmentReady = componentsWithDrivers.length > 0

  const buttonText = mostRecentAssessment ? "Re-run Assessment" : "Run Assessment"
  const runButtonText = isRunningAssessment 
    ? "Please wait, assessment in progress..." 
    : (showOptions && anyOptionSelected ? "Run Assessment with Selected Options" : buttonText)

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header Section */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => router.push(`/project/${projectId}/case/${caseId}`)}
                className="hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Components
              </Button>
              <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Assessment Results</h1>
                <div className="flex items-center mt-1 space-x-4">
                  <p className="text-slate-600 dark:text-slate-400">{currentCase.name}</p>
                  <div className="flex items-center text-sm text-slate-500 dark:text-slate-400">
                    <Calendar className="h-3 w-3 mr-1" />
                    {new Date().toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">

        {/* Quick Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/60 backdrop-blur-sm border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Components</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{allComponents.length}</p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <Activity className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/60 backdrop-blur-sm border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Configured</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{componentsWithDrivers.length}</p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/60 backdrop-blur-sm border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Pending Setup</p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{componentsWithoutDrivers.length}</p>
                </div>
                <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/60 backdrop-blur-sm border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Assessments Run</p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{assessmentResults.length}</p>
                </div>
                <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                  <Target className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Assessment Control Panel */}
        <Card className="mb-8 bg-white/60 backdrop-blur-sm border-slate-200/60 shadow-sm">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <div className="p-4 bg-blue-100 dark:bg-blue-900/20 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Play className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Run LCA Assessment</h2>
              <p className="text-slate-600 dark:text-slate-400">
                {mostRecentAssessment ? 'Run a new assessment or modify parameters' : 'Start your first environmental impact analysis'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Button
                onClick={handleRunAssessment}
                disabled={isRunningAssessment}
                className="flex-1 py-4 font-bold shadow-lg hover:shadow-xl transition-all bg-blue-600 hover:bg-blue-700 text-white"
                size="lg"
              >
                {isRunningAssessment && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>}
                <Play className="h-5 w-5 mr-2" />
                {runButtonText}
              </Button>
              {!showOptions && (
                <Button
                  onClick={() => setShowOptions(true)}
                  variant="outline"
                  className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/20"
                  size="lg"
                >
                  <Target className="h-4 w-4 mr-2" />
                  Customize Categories
                </Button>
              )}
            </div>

            {/* Assessment Options (clean design) */}
            {showOptions && (
              <div className="mt-8 animate-in slide-in-from-top-2 duration-500">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
                  <h4 className="font-bold text-lg mb-2 text-slate-900 dark:text-white flex items-center">
                    <Target className="h-5 w-5 mr-2 text-blue-600" />
                    Select Impact Categories
                  </h4>
                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">Choose which environmental impact categories to include in your assessment.</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {Object.entries(IMPACT_CATEGORIES).map(([category, info]) => (
                      <div key={category} className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                        <div className="flex items-start space-x-3">
                          <Checkbox
                            checked={selectedCategories.includes(category)}
                            onCheckedChange={(checked) => handleCategoryChange(category, checked as boolean)}
                            disabled={isRunningAssessment}
                            className="data-[state=checked]:bg-blue-600 data-[state=checked]:text-white mt-1"
                          />
                          <div className="cursor-pointer flex-1" onClick={() => handleCategoryChange(category, !selectedCategories.includes(category))}>
                            <div className="flex items-center mb-1">
                              <span className="text-slate-900 dark:text-white font-medium text-sm">{category}</span>
                            </div>
                            <span className="text-slate-500 dark:text-slate-400 text-xs">{info.unit}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="text-slate-600 dark:text-slate-400 text-sm">
                      {selectedCategories.length} of {Object.keys(IMPACT_CATEGORIES).length} categories selected
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={handleCancel}
                        disabled={isRunningAssessment}
                        variant="outline"
                        className="border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                      <Button
                        onClick={handleRunAssessment}
                        disabled={isRunningAssessment}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Run Assessment
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {mostRecentAssessment ? (
          <div className="grid gap-8">
            {/* Impact Categories Results */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center">
                  <Leaf className="h-6 w-6 mr-3 text-green-600" />
                  Environmental Impact Results
                </h2>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  {Object.keys(mostRecentAssessment.impacts).length} categories assessed
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {Object.entries(mostRecentAssessment.impacts).map(([category, impact]) => {
                  const categoryInfo = IMPACT_CATEGORIES[category as keyof typeof IMPACT_CATEGORIES]
                  return (
                    <Card key={category} className="bg-white/60 backdrop-blur-sm border-slate-200/60 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-105">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">{category}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{formatChemicalUnit(impact.unit)}</div>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className={`text-3xl font-bold ${categoryInfo?.color}`}>
                          {(impact.value || 0).toLocaleString()}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>

            {/* Assessment History */}
            {assessmentResults.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center">
                    <Clock className="h-6 w-6 mr-3 text-amber-600" />
                    Assessment History
                  </h2>
                  <div className="flex items-center gap-3">
                    {assessmentResults.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPreviousAssessments(!showPreviousAssessments)}
                        className="h-8"
                      >
                        <ChevronDown className={`h-4 w-4 mr-1 transition-transform ${showPreviousAssessments ? '' : '-rotate-90'}`} />
                        {showPreviousAssessments ? 'Hide Previous' : `Show Previous (${assessmentResults.length - 1})`}
                      </Button>
                    )}
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      {assessmentResults.length} assessment{assessmentResults.length !== 1 ? 's' : ''} completed
                    </Badge>
                  </div>
                </div>

                <Card className="bg-white/60 backdrop-blur-sm border-slate-200/60 shadow-sm">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {(showPreviousAssessments ? assessmentResults : assessmentResults.slice(0, 1)).map((assessment, index) => {
                        const isSelected = mostRecentAssessment?.run_id === assessment.run_id
                        const isExpanded = expandedAssessments.has(assessment.run_id)
                        const impactEntries = Object.entries(assessment.impacts || {})

                        return (
                          <div
                            key={assessment.run_id}
                            className={`p-4 rounded-lg transition-all border-2 ${
                              isSelected
                                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 shadow-md'
                                : 'bg-slate-50 dark:bg-slate-800 border-transparent hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                          >
                            {/* Header row */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4 flex-1 cursor-pointer" onClick={() => setCurrentAssessment(assessment)}>
                                <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-amber-100 dark:bg-amber-900/20'}`}>
                                  <BarChart3 className={`h-4 w-4 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-900 dark:text-white">
                                      {assessment.run_name || `Run #${assessment.run_id}`}
                                    </span>
                                    {isSelected && (
                                      <Badge variant="default" className="bg-blue-600 text-xs">
                                        Selected
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-sm text-slate-600 dark:text-slate-400">
                                    {new Date(assessment.run_date).toLocaleString()} • {assessment.calculation_method}
                                    <Badge variant={assessment.status === 'completed' ? 'default' : 'secondary'} className={`ml-2 text-xs ${assessment.status === 'completed' ? 'bg-green-100 text-green-700' : ''}`}>
                                      {assessment.status}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                  {impactEntries.length} categories
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setExpandedAssessments(prev => {
                                      const newSet = new Set(prev)
                                      if (newSet.has(assessment.run_id)) {
                                        newSet.delete(assessment.run_id)
                                      } else {
                                        newSet.add(assessment.run_id)
                                      }
                                      return newSet
                                    })
                                  }}
                                >
                                  <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                                </Button>
                              </div>
                            </div>

                            {/* Impact summary grid - only show when expanded */}
                            {isExpanded && impactEntries.length > 0 && (
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                                {impactEntries.map(([category, impact]) => (
                                  <div key={category} className="bg-white dark:bg-slate-900 rounded p-2">
                                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate" title={category}>
                                      {category}
                                    </div>
                                    <div className="font-semibold text-sm text-slate-900 dark:text-white">
                                      {typeof impact.value === 'number' ? impact.value.toFixed(2) : '0.00'}
                                    </div>
                                    <div className="text-xs text-slate-400">
                                      {formatChemicalUnit(impact.unit)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        ) : (
          <Card className="bg-white/60 backdrop-blur-sm border-slate-200/60 shadow-sm">
            <CardContent className="text-center py-16">
              <div className="max-w-md mx-auto">
                <div className="p-6 bg-green-100 dark:bg-green-900/20 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                  <Leaf className="h-12 w-12 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Ready to Run Assessment</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                  Start your first LCA assessment to analyze environmental impacts and financial costs across your components.
                </p>
                <div className="space-y-3">
                  <Button
                    onClick={handleRunAssessment}
                    disabled={isRunningAssessment}
                    className="w-full py-4 font-semibold shadow-lg transition-all bg-blue-600 hover:bg-blue-700 text-white hover:shadow-xl"
                    size="lg"
                  >
                    {isRunningAssessment && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>}
                    <Play className="h-5 w-5 mr-2" />
                    {isRunningAssessment ? 'Running Assessment...' : 'Run Assessment'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <RunAssessmentModal
        open={assessOpen}
        onClose={() => setAssessOpen(false)}
        caseId={Number(caseId)}
        onCompleted={handleAssessmentCompleted}
      />
    </div>
  )
}