"use client"

import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import { apiRequest } from "@/lib/api-client"
import { ComparisonResultCard } from "@/components/comparison-result-card"
import { ComparisonChart } from "@/components/comparison-chart"

interface CaseData {
  case_id: number
  case_name: string
  case_type: string
  environmentalLoad: number
  environmentalCost: number
  categoryBreakdown: {
    category_name: string
    impact_value: number
    unit: string
  }[]
}

export default function ComparisonPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const projectId = params.projectId as string

  const [baseCase, setBaseCase] = useState<CaseData | null>(null)
  const [comparativeCase, setComparativeCase] = useState<CaseData | null>(null)
  const [allCases, setAllCases] = useState<any[]>([])
  const [selectedComparativeCaseId, setSelectedComparativeCaseId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchComparisonData()
  }, [])

  const fetchComparisonData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Get case IDs from query params
      const caseIdsParam = searchParams.get("cases")
      if (!caseIdsParam) {
        setError("No cases selected for comparison")
        return
      }

      const caseIds = caseIdsParam.split(",").map(id => parseInt(id))
      if (caseIds.length < 2) {
        setError("At least 2 cases are required for comparison")
        return
      }

      console.log("🔍 Fetching comparison data for cases:", caseIds)

      // Fetch all cases in the project to enable switching
      const casesResponse = await apiRequest(`/api/projects/${projectId}/cases`)
      const casesData = await casesResponse.json()

      if (casesData.success && casesData.cases) {
        setAllCases(casesData.cases)
      }

      // Fetch data for both cases in parallel
      const [case1Data, case2Data] = await Promise.all([
        fetchCaseData(caseIds[0]),
        fetchCaseData(caseIds[1])
      ])

      // Determine which is base and which is comparative
      const base = case1Data.case_type === "base" ? case1Data : case2Data
      const comparative = case1Data.case_type === "base" ? case2Data : case1Data

      setBaseCase(base)
      setComparativeCase(comparative)
      setSelectedComparativeCaseId(comparative.case_id.toString())

      console.log("✅ Comparison data loaded successfully")
      console.log("Base case:", base)
      console.log("Comparative case:", comparative)

    } catch (error) {
      console.error("Failed to fetch comparison data:", error)
      setError("Failed to load comparison data. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCaseData = async (caseId: number): Promise<CaseData> => {
    // Fetch case details
    const caseResponse = await apiRequest(`/api/cases/${caseId}`)
    const caseData = await caseResponse.json()

    if (!caseData.success) {
      throw new Error(`Failed to fetch case ${caseId}`)
    }

    const caseInfo = caseData.case

    // Fetch assessment results
    const assessmentResponse = await apiRequest(`/api/cases/${caseId}/assessments`)
    const assessmentData = await assessmentResponse.json()

    let categoryBreakdown: any[] = []
    let environmentalLoad = 0

    if (assessmentData.success && assessmentData.assessments && assessmentData.assessments.length > 0) {
      // Get the latest assessment
      const latestAssessment = assessmentData.assessments[0]

      // Fetch assessment results
      const resultsResponse = await apiRequest(`/api/assessments/${latestAssessment.run_id}`)
      const resultsData = await resultsResponse.json()

      if (resultsData.success && resultsData.total_impacts) {
        // Use pre-aggregated total_impacts from the API
        categoryBreakdown = resultsData.total_impacts.map((impact: any) => ({
          category_name: impact.category_name,
          impact_value: parseFloat(impact.impact_value) || 0,
          unit: impact.unit || 'kg CO₂-eq'
        }))

        // Calculate total environmental load - ensure we're summing valid numbers
        environmentalLoad = categoryBreakdown.reduce((sum, cat) => {
          const value = isFinite(cat.impact_value) ? cat.impact_value : 0
          return sum + value
        }, 0)
      }
    }

    // Fetch components for cost calculation
    const componentsResponse = await apiRequest(`/api/cases/${caseId}/components`)
    const componentsData = await componentsResponse.json()

    let environmentalCost = 0
    if (componentsData.success && componentsData.components) {
      environmentalCost = componentsData.components.reduce((sum: number, comp: any) => {
        const capex = parseFloat(comp.capex) || 0
        const opex = parseFloat(comp.opex) || 0
        return sum + capex + opex
      }, 0)
    }

    return {
      case_id: caseInfo.case_id,
      case_name: caseInfo.case_name,
      case_type: caseInfo.case_type,
      environmentalLoad,
      environmentalCost,
      categoryBreakdown
    }
  }

  const handleComparativeCaseChange = async (newCaseId: string) => {
    if (!baseCase) return

    setIsLoading(true)
    try {
      const newComparativeData = await fetchCaseData(parseInt(newCaseId))
      setComparativeCase(newComparativeData)
      setSelectedComparativeCaseId(newCaseId)

      // Update URL without full page reload
      const newUrl = `/project/${projectId}/comparison?cases=${baseCase.case_id},${newCaseId}`
      window.history.pushState({}, '', newUrl)
    } catch (error) {
      console.error("Failed to switch comparative case:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const calculateDifferences = () => {
    if (!baseCase || !comparativeCase) return null

    // Prevent division by zero and handle edge cases
    const loadDiff = baseCase.environmentalLoad !== 0
      ? ((comparativeCase.environmentalLoad - baseCase.environmentalLoad) / baseCase.environmentalLoad) * 100
      : 0
    const costDiff = baseCase.environmentalCost !== 0
      ? ((comparativeCase.environmentalCost - baseCase.environmentalCost) / baseCase.environmentalCost) * 100
      : 0

    return {
      load: {
        percentage: isFinite(loadDiff) ? Math.abs(loadDiff) : 0,
        isImprovement: loadDiff < 0 // Lower is better for environmental load
      },
      cost: {
        percentage: isFinite(costDiff) ? Math.abs(costDiff) : 0,
        isImprovement: costDiff < 0 // Lower is better for cost
      }
    }
  }

  const prepareChartData = () => {
    if (!baseCase || !comparativeCase) return []

    const categoryNames = new Set([
      ...baseCase.categoryBreakdown.map(c => c.category_name),
      ...comparativeCase.categoryBreakdown.map(c => c.category_name)
    ])

    return Array.from(categoryNames).map(categoryName => {
      const baseCategory = baseCase.categoryBreakdown.find(c => c.category_name === categoryName)
      const compCategory = comparativeCase.categoryBreakdown.find(c => c.category_name === categoryName)

      return {
        category_name: categoryName,
        baseValue: baseCategory?.impact_value || 0,
        comparativeValue: compCategory?.impact_value || 0,
        unit: baseCategory?.unit || compCategory?.unit || "kg"
      }
    })
  }

  if (isLoading) {
    return (
      <div className="container max-w-7xl mx-auto px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold">Loading comparison data...</h2>
          </div>
        </div>
      </div>
    )
  }

  if (error || !baseCase || !comparativeCase) {
    return (
      <div className="container max-w-7xl mx-auto px-8 py-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-red-900 mb-2">Error Loading Comparison</h2>
              <p className="text-red-700 mb-4">{error || "Failed to load comparison data"}</p>
              <Link href={`/project/${projectId}`}>
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Project
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const differences = calculateDifferences()
  const chartData = prepareChartData()

  // Get comparative cases for the selector
  const comparativeCases = allCases.filter(c => c.case_type === 'comparative')

  return (
    <div className="container max-w-7xl mx-auto px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href={`/project/${projectId}`}>
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Project
          </Button>
        </Link>
        <h1 className="text-3xl font-bold mb-2">Case Comparison</h1>
        <p className="text-muted-foreground">
          Comparing {baseCase.case_name} vs {comparativeCase.case_name}
        </p>
      </div>

      {/* Case Selector - Only show if there are multiple comparative cases */}
      {comparativeCases.length > 1 && (
        <div className="mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-slate-700">
              Select Comparative Case:
            </label>
            <Select
              value={selectedComparativeCaseId}
              onValueChange={handleComparativeCaseChange}
            >
              <SelectTrigger className="w-[400px]">
                <SelectValue placeholder="Select a comparative case" />
              </SelectTrigger>
              <SelectContent>
                {comparativeCases.map((caseItem) => (
                  <SelectItem
                    key={caseItem.case_id}
                    value={caseItem.case_id.toString()}
                  >
                    {caseItem.case_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Side-by-Side Comparison Cards */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <ComparisonResultCard
          caseName={baseCase.case_name}
          caseType="base"
          environmentalLoad={baseCase.environmentalLoad}
          environmentalCost={baseCase.environmentalCost}
        />
        <ComparisonResultCard
          caseName={comparativeCase.case_name}
          caseType="comparative"
          environmentalLoad={comparativeCase.environmentalLoad}
          environmentalCost={comparativeCase.environmentalCost}
          loadDifference={differences?.load}
          costDifference={differences?.cost}
        />
      </div>

      {/* Category Breakdown Chart */}
      {chartData.length > 0 && (
        <ComparisonChart
          data={chartData}
          baseCaseName={baseCase.case_name}
          comparativeCaseName={comparativeCase.case_name}
        />
      )}

      {/* Summary Card */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Comparison Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">Base Case:</span>
              <span>{baseCase.case_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Comparative Case:</span>
              <span>{comparativeCase.case_name}</span>
            </div>
            <div className="border-t pt-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Environmental Load Difference:</span>
                <span className={differences?.load.isImprovement ? "text-green-600" : "text-red-600"}>
                  {differences?.load.isImprovement ? "↓" : "↑"} {differences?.load.percentage.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="font-medium">Environmental Cost Difference:</span>
                <span className={differences?.cost.isImprovement ? "text-green-600" : "text-red-600"}>
                  {differences?.cost.isImprovement ? "↓" : "↑"} {differences?.cost.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
