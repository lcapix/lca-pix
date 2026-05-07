"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, Area, AreaChart
} from "recharts"
import { Download, Printer, ArrowLeft, BarChart3, TrendingUp, PieChart as PieIcon, Activity, Layers, AlertCircle } from "lucide-react"
import { apiRequest } from "@/lib/api-client"
import { transformCaseFromDB } from "@/lib/data-transformers"
import Link from "next/link"

interface AssessmentData {
  caseId: string
  caseName: string
  caseType: string
  categories: {
    category_name: string
    impact_value: number
    unit: string
  }[]
  components: {
    component_name: string
    component_type: string
    impacts: {
      category_name: string
      impact_value: number
    }[]
  }[]
  totalScore: number
}

const CATEGORY_COLORS: Record<string, string> = {
  "Global Warming": "#ef4444",
  "Ozone Depletion": "#3b82f6",
  "Acidification": "#f97316",
  "Eutrophication": "#10b981",
  "Photochemical Oxidation": "#8b5cf6",
  "Human Toxicity": "#ec4899",
  "Ecotoxicity Aquatic": "#06b6d4",
  "Ecotoxicity Terrestrial": "#059669",
  "Resource Depletion": "#f59e0b",
  "Land Use": "#84cc16"
}

export default function AnalyticsPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const [assessmentData, setAssessmentData] = useState<AssessmentData[]>([])
  const [cases, setCases] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState("bar")
  const [authError, setAuthError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    fetchCasesAndAssessments()
  }, [projectId])

  const fetchCasesAndAssessments = async () => {
    setIsLoading(true)
    setAuthError(false)
    setErrorMessage('')

    try {
      // Check if token exists
      const token = typeof window !== 'undefined' ? localStorage.getItem("auth_token") : null
      console.log('🔐 Analytics: Auth token exists:', !!token)
      if (token) {
        console.log('🔐 Analytics: Token preview:', token.substring(0, 20) + '...')
      } else {
        console.warn('⚠️ Analytics: No auth token found in localStorage!')
        setAuthError(true)
        setErrorMessage('No authentication token found. Please log in.')
        setIsLoading(false)
        return
      }

      // Fetch cases
      console.log('📡 Analytics: Fetching cases from /api/projects/' + projectId + '/cases')
      const casesResponse = await apiRequest(`/api/projects/${projectId}/cases`)
      console.log('📡 Analytics: Cases response status:', casesResponse.status)

      const casesData = await casesResponse.json()

      console.log('📊 Analytics: Fetched cases:', casesData.cases)
      console.log('📊 Analytics: Case field names:', casesData.cases?.[0] ? Object.keys(casesData.cases[0]) : 'No cases')

      if (casesData.success && casesData.cases) {
        // Transform cases to use consistent field names (id, name instead of case_id, case_name)
        const transformedCases = casesData.cases.map(transformCaseFromDB)
        console.log('📊 Analytics: Transformed cases:', transformedCases)
        setCases(transformedCases)

        // Fetch assessments for all cases
        const dataPromises = transformedCases.map(async (caseItem: any) => {
          console.log(`📊 Analytics: Fetching assessments for case ${caseItem.id} (${caseItem.name})`)
          const assessmentsRes = await apiRequest(`/api/cases/${caseItem.id}/assessments`)
          const assessmentsData = await assessmentsRes.json()

          console.log(`📊 Analytics: Case ${caseItem.id} assessments:`, assessmentsData)

          if (assessmentsData.success && assessmentsData.assessments?.length > 0) {
            // FALLBACK: If status column doesn't exist (before migration), treat all assessments as completed
            const completedAssessments = assessmentsData.assessments.filter(
              (a: any) => a.status === 'completed' || a.status === undefined || a.status === null
            )
            console.log(`📊 Analytics: Case ${caseItem.id} completed assessments:`, completedAssessments)

            if (completedAssessments.length > 0) {
              const latestRun = completedAssessments[0]
              console.log(`📊 Analytics: Fetching details for run_id ${latestRun.run_id}`)

              // Fetch detailed results
              const detailRes = await apiRequest(`/api/assessments/${latestRun.run_id}`)
              const detailData = await detailRes.json()

              console.log(`📊 Analytics: Assessment ${latestRun.run_id} details:`, detailData)

              if (detailData.success) {
                const categories = (detailData.total_impacts || []).map((cat: any) => ({
                  category_name: cat.category_name,
                  impact_value: Math.abs(cat.impact_value),
                  unit: cat.unit
                }))

                const components = (detailData.component_breakdown || []).map((comp: any) => ({
                  component_name: comp.component_name,
                  component_type: comp.component_type,
                  impacts: comp.impacts.map((imp: any) => ({
                    category_name: imp.category_name,
                    impact_value: Math.abs(imp.impact_value)
                  }))
                }))

                const totalScore = categories.reduce((sum: number, cat: any) => sum + cat.impact_value, 0)

                return {
                  caseId: caseItem.id,
                  caseName: caseItem.name,
                  caseType: caseItem.case_type,
                  categories,
                  components,
                  totalScore
                }
              }
            }
          }

          return null
        })

        const results = await Promise.all(dataPromises)
        const validResults = results.filter(Boolean) as AssessmentData[]
        console.log('📊 Analytics: Final assessment data:', validResults)
        console.log(`📊 Analytics: Successfully loaded ${validResults.length} assessments from ${transformedCases.length} cases`)

        // Debug: Check if Case 2 (Renewable Energy Scenario) is loaded
        const case2Data = validResults.find(r => r.caseId === '2');
        console.log('📊 Analytics: Case 2 (Renewable Energy) data:', case2Data ? 'FOUND ✅' : 'NOT FOUND ❌');
        if (case2Data) {
          console.log('📊 Analytics: Case 2 details:', {
            caseName: case2Data.caseName,
            categories: case2Data.categories.length,
            components: case2Data.components.length,
            totalScore: case2Data.totalScore
          });
        } else {
          console.log('📊 Analytics: All loaded case IDs:', validResults.map(r => r.caseId));
        }

        setAssessmentData(validResults)
      }
    } catch (error) {
      console.error('❌ Analytics: Failed to fetch assessment data:', error)
      console.error('❌ Analytics: Error details:', {
        projectId,
        casesCount: cases.length,
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error
      })

      // Check if this is an authentication error
      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase()
        if (errorMsg.includes('unauthorized') ||
            errorMsg.includes('authentication required') ||
            errorMsg.includes('401')) {
          console.error('🔐 Analytics: Authentication error detected!')
          setAuthError(true)
          setErrorMessage('Your session has expired. Please log in again.')
        } else {
          setErrorMessage(`Error loading data: ${error.message}`)
        }
      } else {
        setErrorMessage('An unexpected error occurred while loading assessment data.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportPDF = () => {
    window.print()
  }

  const handleExportCSV = () => {
    const csvRows = []
    csvRows.push(['Case Name', 'Case Type', 'Category', 'Impact Value', 'Unit'])

    assessmentData.forEach(data => {
      data.categories.forEach(cat => {
        csvRows.push([
          data.caseName,
          data.caseType,
          cat.category_name,
          cat.impact_value.toFixed(4),
          cat.unit
        ])
      })
    })

    const csvContent = csvRows.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lca-assessment-analysis-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  // Prepare data for different chart types
  const categoryComparisonData = () => {
    if (assessmentData.length === 0) return []

    const allCategories = Array.from(new Set(assessmentData.flatMap(d => d.categories.map(c => c.category_name))))

    return allCategories.map(categoryName => {
      const dataPoint: any = { category: categoryName }
      assessmentData.forEach(caseData => {
        const categoryData = caseData.categories.find(c => c.category_name === categoryName)
        dataPoint[caseData.caseName] = categoryData ? categoryData.impact_value : 0
      })
      return dataPoint
    })
  }

  const radarChartData = () => {
    if (assessmentData.length === 0) return []

    const maxValues: Record<string, number> = {}

    assessmentData.forEach(caseData => {
      caseData.categories.forEach(cat => {
        if (!maxValues[cat.category_name] || cat.impact_value > maxValues[cat.category_name]) {
          maxValues[cat.category_name] = cat.impact_value
        }
      })
    })

    const allCategories = Object.keys(maxValues)

    return allCategories.map(categoryName => {
      const dataPoint: any = { category: categoryName }
      assessmentData.forEach(caseData => {
        const categoryData = caseData.categories.find(c => c.category_name === categoryName)
        const rawValue = categoryData ? categoryData.impact_value : 0
        const maxValue = maxValues[categoryName]
        dataPoint[caseData.caseName] = maxValue > 0 ? (rawValue / maxValue) * 100 : 0
      })
      return dataPoint
    })
  }

  const pieChartData = () => {
    if (assessmentData.length === 0) return []

    const firstCase = assessmentData[0]
    return firstCase.categories.map(cat => ({
      name: cat.category_name,
      value: cat.impact_value
    }))
  }

  const componentStackedData = () => {
    if (assessmentData.length === 0 || assessmentData[0].components.length === 0) return []

    const firstCase = assessmentData[0]
    const allCategories = Array.from(new Set(firstCase.components.flatMap(c => c.impacts.map(i => i.category_name))))

    return allCategories.map(categoryName => {
      const dataPoint: any = { category: categoryName }
      firstCase.components.forEach(comp => {
        const impact = comp.impacts.find(i => i.category_name === categoryName)
        dataPoint[comp.component_name] = impact ? impact.impact_value : 0
      })
      return dataPoint
    })
  }

  const totalScoreComparisonData = () => {
    return assessmentData.map(data => ({
      case: data.caseName,
      score: data.totalScore,
      type: data.caseType
    }))
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="container max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href={`/project/${projectId}`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Project
                </Button>
              </Link>
              <div className="border-l border-slate-300 h-8"></div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Assessment Analytics Dashboard</h1>
                <p className="text-sm text-slate-600 mt-1">
                  Comprehensive visualization of environmental impact assessments
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-7xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <Activity className="h-12 w-12 animate-spin text-slate-500 mx-auto mb-4" />
              <p className="text-lg font-medium text-slate-700">Loading assessment data...</p>
            </div>
          </div>
        ) : authError ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <p className="text-lg font-semibold text-red-900 mb-2">Authentication Required</p>
              <p className="text-sm text-red-700 mb-4 text-center max-w-md">
                {errorMessage || 'Your session has expired. Please log in again to view analytics.'}
              </p>
              <div className="flex gap-3">
                <Link href="/auth/login">
                  <Button className="bg-red-600 hover:bg-red-700">
                    Log In Again
                  </Button>
                </Link>
                <Link href={`/project/${projectId}`}>
                  <Button variant="outline">
                    Go to Project
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : assessmentData.length === 0 ? (
          <Card className="border-slate-200">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <BarChart3 className="h-16 w-16 text-slate-400 mb-4" />
              <p className="text-lg font-medium text-slate-700">No assessment data available</p>
              {errorMessage && (
                <p className="text-sm text-red-600 mt-2 mb-2">
                  Error: {errorMessage}
                </p>
              )}
              <p className="text-sm text-slate-500 mt-2">
                {cases.length === 0
                  ? 'No cases found in this project. Create a base case to get started.'
                  : `Found ${cases.length} case(s), but no completed assessments.`
                }
              </p>
              <p className="text-sm text-slate-500">
                {cases.length > 0 && 'Run assessments on your cases to see analytics data here.'}
              </p>
              <Link href={`/project/${projectId}`}>
                <Button className="mt-4" variant="outline">
                  Go to Project Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 bg-white border border-slate-200">
              <TabsTrigger value="bar">
                <BarChart3 className="h-4 w-4 mr-2" />
                Bar Chart
              </TabsTrigger>
              <TabsTrigger value="radar">
                <Activity className="h-4 w-4 mr-2" />
                Radar
              </TabsTrigger>
              <TabsTrigger value="pie">
                <PieIcon className="h-4 w-4 mr-2" />
                Pie Chart
              </TabsTrigger>
              <TabsTrigger value="stacked">
                <Layers className="h-4 w-4 mr-2" />
                Stacked
              </TabsTrigger>
              <TabsTrigger value="trend">
                <TrendingUp className="h-4 w-4 mr-2" />
                Comparison
              </TabsTrigger>
            </TabsList>

            {/* Bar Chart - Category Comparison */}
            <TabsContent value="bar" className="space-y-4 mt-6">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-slate-900">Impact Category Comparison</CardTitle>
                  <CardDescription>Compare environmental impacts across different assessment categories</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={600}>
                    <BarChart data={categoryComparisonData()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="category" angle={-45} textAnchor="end" height={120} />
                      <YAxis />
                      <Tooltip />
                      <Legend
                        wrapperStyle={{ paddingTop: '20px' }}
                        iconType="square"
                      />
                      {assessmentData.map((caseData, index) => (
                        <Bar
                          key={caseData.caseId}
                          dataKey={caseData.caseName}
                          fill={index === 0 ? "#64748b" : "#94a3b8"}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Radar Chart */}
            <TabsContent value="radar" className="space-y-4 mt-6">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-slate-900">Multi-Dimensional Impact Profile</CardTitle>
                  <CardDescription>Normalized comparison across all impact categories</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={600}>
                    <RadarChart data={radarChartData()}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="category" />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} />
                      <Tooltip />
                      <Legend
                        wrapperStyle={{ paddingTop: '20px' }}
                        iconType="square"
                      />
                      {assessmentData.map((caseData, index) => (
                        <Radar
                          key={caseData.caseId}
                          name={caseData.caseName}
                          dataKey={caseData.caseName}
                          stroke={index === 0 ? "#64748b" : "#94a3b8"}
                          fill={index === 0 ? "#64748b" : "#94a3b8"}
                          fillOpacity={0.3}
                        />
                      ))}
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Pie Chart */}
            <TabsContent value="pie" className="space-y-4 mt-6">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-slate-900">
                    Category Distribution - {assessmentData[0]?.caseName}
                  </CardTitle>
                  <CardDescription>Percentage breakdown of environmental impacts by category</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={500}>
                    <PieChart>
                      <Pie
                        data={pieChartData()}
                        cx="35%"
                        cy="50%"
                        labelLine={false}
                        label={false}
                        outerRadius={140}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieChartData().map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CATEGORY_COLORS[entry.name] || `hsl(${index * 36}, 70%, 50%)`}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any) => {
                          const numValue = Number(value);
                          return numValue >= 1000
                            ? `${(numValue / 1000).toFixed(2)}k`
                            : numValue.toFixed(2);
                        }}
                      />
                      <Legend
                        layout="vertical"
                        align="right"
                        verticalAlign="middle"
                        wrapperStyle={{ paddingLeft: '20px', fontSize: '14px', lineHeight: '24px' }}
                        iconType="circle"
                        iconSize={10}
                        formatter={(value: string, entry: any) => {
                          const dataItem = pieChartData().find(d => d.name === value);
                          if (!dataItem) return value;
                          const total = pieChartData().reduce((sum, d) => sum + d.value, 0);
                          const percentage = total > 0 ? ((dataItem.value / total) * 100).toFixed(1) : '0';
                          return `${value} (${percentage}%)`;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Stacked Bar Chart - Component Contribution */}
            <TabsContent value="stacked" className="space-y-4 mt-6">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-slate-900">
                    Component Contribution by Category - {assessmentData[0]?.caseName}
                  </CardTitle>
                  <CardDescription>See how each component contributes to environmental impacts</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={600}>
                    <BarChart data={componentStackedData()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="category" angle={-45} textAnchor="end" height={120} />
                      <YAxis />
                      <Tooltip />
                      <Legend
                        wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }}
                        iconType="square"
                        iconSize={10}
                      />
                      {assessmentData[0]?.components.map((comp, index) => (
                        <Bar
                          key={comp.component_name}
                          dataKey={comp.component_name}
                          stackId="a"
                          fill={`hsl(${index * (360 / assessmentData[0].components.length)}, 70%, 50%)`}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Total Score Comparison */}
            <TabsContent value="trend" className="space-y-4 mt-6">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-slate-900">Total Environmental Impact Comparison</CardTitle>
                  <CardDescription>Overall impact scores across all cases</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={totalScoreComparisonData()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="case" />
                      <YAxis />
                      <Tooltip />
                      <Legend
                        wrapperStyle={{ paddingTop: '20px' }}
                        iconType="square"
                      />
                      <Bar dataKey="score" fill="#64748b">
                        {totalScoreComparisonData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.type === 'base' ? '#64748b' : '#94a3b8'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Summary Statistics */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                {assessmentData.map((data) => (
                  <Card key={data.caseId} className="border-slate-200 bg-white">
                    <CardHeader className="pb-3">
                      <CardDescription className="text-slate-600">{data.caseName}</CardDescription>
                      <CardTitle className="text-3xl font-bold text-slate-900">{data.totalScore.toFixed(2)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-500">{data.categories.length} categories analyzed</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}
