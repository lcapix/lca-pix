"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, Area, AreaChart
} from "recharts"
import { Download, Printer, X, BarChart3, TrendingUp, PieChart as PieIcon, Activity, Layers } from "lucide-react"
import { apiRequest } from "@/lib/api-client"

interface AnalyticsDashboardProps {
  open: boolean
  onClose: () => void
  projectId: string
  cases: any[]
}

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

export function AssessmentAnalyticsDashboard({ open, onClose, projectId, cases }: AnalyticsDashboardProps) {
  const [assessmentData, setAssessmentData] = useState<AssessmentData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState("bar")

  useEffect(() => {
    if (open && cases.length > 0) {
      fetchAllAssessments()
    }
  }, [open, cases])

  const fetchAllAssessments = async () => {
    setIsLoading(true)
    try {
      const dataPromises = cases.map(async (caseItem) => {
        // Fetch assessments for this case
        const assessmentsRes = await apiRequest(`/api/cases/${caseItem.id}/assessments`)
        const assessmentsData = await assessmentsRes.json()

        if (assessmentsData.success && assessmentsData.assessments?.length > 0) {
          const completedAssessments = assessmentsData.assessments.filter((a: any) => a.status === 'completed')

          if (completedAssessments.length > 0) {
            const latestRun = completedAssessments[0]

            // Fetch detailed results
            const detailRes = await apiRequest(`/api/assessments/${latestRun.run_id}`)
            const detailData = await detailRes.json()

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
                caseType: caseItem.type,
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
      setAssessmentData(results.filter(Boolean) as AssessmentData[])
    } catch (error) {
      console.error('Failed to fetch assessment data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportPDF = () => {
    window.print()
  }

  const handleExportCSV = () => {
    // Prepare CSV data
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

    // Normalize all values to 0-100 scale for radar chart
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

    // Use first case for pie chart
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">Assessment Analytics Dashboard</DialogTitle>
              <DialogDescription>
                Comprehensive visualization of environmental impact assessments
              </DialogDescription>
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
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <Activity className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-lg font-medium">Loading assessment data...</p>
            </div>
          </div>
        ) : assessmentData.length === 0 ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-600">No assessment data available</p>
              <p className="text-sm text-gray-500 mt-2">Run assessments on your cases to see analytics</p>
            </div>
          </div>
        ) : (
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
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
            <TabsContent value="bar" className="space-y-4">
              <div className="bg-white p-6 rounded-lg border">
                <h3 className="text-lg font-semibold mb-4">Impact Category Comparison</h3>
                <ResponsiveContainer width="100%" height={500}>
                  <BarChart data={categoryComparisonData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" angle={-45} textAnchor="end" height={120} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {assessmentData.map((caseData, index) => (
                      <Bar
                        key={caseData.caseId}
                        dataKey={caseData.caseName}
                        fill={index === 0 ? "#3b82f6" : "#10b981"}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>

            {/* Radar Chart */}
            <TabsContent value="radar" className="space-y-4">
              <div className="bg-white p-6 rounded-lg border">
                <h3 className="text-lg font-semibold mb-4">Multi-Dimensional Impact Profile (Normalized)</h3>
                <ResponsiveContainer width="100%" height={500}>
                  <RadarChart data={radarChartData()}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="category" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    {assessmentData.map((caseData, index) => (
                      <Radar
                        key={caseData.caseId}
                        name={caseData.caseName}
                        dataKey={caseData.caseName}
                        stroke={index === 0 ? "#3b82f6" : "#10b981"}
                        fill={index === 0 ? "#3b82f6" : "#10b981"}
                        fillOpacity={0.3}
                      />
                    ))}
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>

            {/* Pie Chart */}
            <TabsContent value="pie" className="space-y-4">
              <div className="bg-white p-6 rounded-lg border">
                <h3 className="text-lg font-semibold mb-4">
                  Category Distribution - {assessmentData[0]?.caseName}
                </h3>
                <ResponsiveContainer width="100%" height={500}>
                  <PieChart>
                    <Pie
                      data={pieChartData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                      outerRadius={150}
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
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>

            {/* Stacked Bar Chart - Component Contribution */}
            <TabsContent value="stacked" className="space-y-4">
              <div className="bg-white p-6 rounded-lg border">
                <h3 className="text-lg font-semibold mb-4">
                  Component Contribution by Category - {assessmentData[0]?.caseName}
                </h3>
                <ResponsiveContainer width="100%" height={500}>
                  <BarChart data={componentStackedData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" angle={-45} textAnchor="end" height={120} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
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
              </div>
            </TabsContent>

            {/* Total Score Comparison */}
            <TabsContent value="trend" className="space-y-4">
              <div className="bg-white p-6 rounded-lg border">
                <h3 className="text-lg font-semibold mb-4">Total Environmental Impact Comparison</h3>
                <ResponsiveContainer width="100%" height={500}>
                  <BarChart data={totalScoreComparisonData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="case" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="score" fill="#8b5cf6">
                      {totalScoreComparisonData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.type === 'base' ? '#3b82f6' : '#10b981'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Summary Statistics */}
              <div className="grid grid-cols-3 gap-4">
                {assessmentData.map((data) => (
                  <div key={data.caseId} className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-100">
                    <p className="text-sm text-gray-600 mb-1">{data.caseName}</p>
                    <p className="text-3xl font-bold text-gray-900">{data.totalScore.toFixed(2)}</p>
                    <p className="text-xs text-gray-500 mt-1">{data.categories.length} categories analyzed</p>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
