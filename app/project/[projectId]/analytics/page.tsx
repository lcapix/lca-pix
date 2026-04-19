"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, Area, AreaChart
} from "recharts"
import { Download, Printer, ArrowLeft, BarChart3, TrendingUp, PieChart as PieIcon, Activity, Layers, AlertCircle, RefreshCw, CheckCircle, ArrowDown, ArrowUp } from "lucide-react"
import { apiRequest } from "@/lib/api-client"
import { transformCaseFromDB } from "@/lib/data-transformers"
import { formatChemicalUnit } from "@/lib/format-utils"
import Link from "next/link"
import { DashboardGrid } from "@/components/analytics/dashboard-grid"
import { Num } from "@/components/ui/num"

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

// Veridian-aligned palette for case series
const CASE_COLORS = {
  base: {
    primary: "#006a44",    // primary emerald
    secondary: "#005234",
    light: "#5ddda1"
  },
  comparative: {
    primary: "#29695b",    // secondary teal
    secondary: "#065043",
    light: "#94d3c1"
  }
}

const getCaseColor = (caseType: string, index: number = 0): string => {
  if (caseType === 'base') {
    return index === 0 ? CASE_COLORS.base.primary : CASE_COLORS.base.secondary
  } else {
    return index === 0 ? CASE_COLORS.comparative.primary : CASE_COLORS.comparative.secondary
  }
}

export default function AnalyticsPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = params.projectId as string
  const filterCaseId = searchParams.get('caseId')

  const [assessmentData, setAssessmentData] = useState<AssessmentData[]>([])
  const [cases, setCases] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState("bar")
  const [authError, setAuthError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [debugInfo, setDebugInfo] = useState<any>(null)

  useEffect(() => {
    fetchCasesAndAssessments()
  }, [projectId])

  const fetchCasesAndAssessments = async () => {
    setIsLoading(true)
    setAuthError(false)
    setErrorMessage('')
    const debug: any = { steps: [] }

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem("auth_token") : null
      debug.steps.push({ step: 1, name: 'Auth Check', status: !!token ? 'success' : 'failed', token_exists: !!token })

      if (!token) {
        setAuthError(true)
        setErrorMessage('No authentication token found. Please log in.')
        setDebugInfo(debug)
        setIsLoading(false)
        return
      }

      const casesResponse = await apiRequest(`/api/projects/${projectId}/cases`)
      const casesData = await casesResponse.json()

      debug.steps.push({
        step: 2,
        name: 'Fetch Cases',
        status: casesData.success ? 'success' : 'failed',
        cases_count: casesData.cases?.length || 0,
        cases: casesData.cases?.map((c: any) => ({ id: c.case_id, name: c.case_name }))
      })

      if (!casesData.success || !casesData.cases?.length) {
        setErrorMessage('No cases found in project')
        setDebugInfo(debug)
        setIsLoading(false)
        return
      }

      const transformedCases = casesData.cases.map(transformCaseFromDB)

      let casesToFetch = transformedCases
      if (filterCaseId) {
        casesToFetch = transformedCases.filter(c => c.id === filterCaseId)
        if (casesToFetch.length === 0) {
          setErrorMessage(`Case not found (ID: ${filterCaseId})`)
          setDebugInfo(debug)
          setIsLoading(false)
          return
        }
      }

      setCases(casesToFetch)

      debug.steps.push({
        step: 3,
        name: 'Transform Cases',
        status: 'success',
        transformed_cases: transformedCases.map(c => ({ id: c.id, name: c.name, type: c.case_type })),
        filtered: !!filterCaseId,
        filter_case_id: filterCaseId,
        cases_to_fetch: casesToFetch.map(c => ({ id: c.id, name: c.name }))
      })

      const assessmentFetches: any[] = []

      const dataPromises = casesToFetch.map(async (caseItem: any, index: number) => {
        const caseDebug: any = { case_id: caseItem.id, case_name: caseItem.name, steps: [] }
        try {
          const assessmentsRes = await apiRequest(`/api/cases/${caseItem.id}/assessments`)
          const assessmentsData = await assessmentsRes.json()
          caseDebug.steps.push({ action: 'fetch_assessments', success: assessmentsData.success, count: assessmentsData.assessments?.length || 0 })

          if (!assessmentsData.success || !assessmentsData.assessments?.length) {
            caseDebug.result = 'no_assessments'
            assessmentFetches.push(caseDebug)
            return null
          }

          const completedAssessments = assessmentsData.assessments.filter(
            (a: any) => a.status === 'completed' || a.status === undefined || a.status === null
          )
          caseDebug.steps.push({ action: 'filter_completed', completed_count: completedAssessments.length, total_count: assessmentsData.assessments.length })

          if (!completedAssessments.length) {
            caseDebug.result = 'no_completed_assessments'
            assessmentFetches.push(caseDebug)
            return null
          }

          const latestRun = completedAssessments[0]
          const detailRes = await apiRequest(`/api/assessments/${latestRun.run_id}`)
          const detailData = await detailRes.json()
          caseDebug.steps.push({ action: 'fetch_details', run_id: latestRun.run_id, success: detailData.success, total_impacts: detailData.total_impacts?.length || 0, components: detailData.component_breakdown?.length || 0 })

          if (!detailData.success) {
            caseDebug.result = 'failed_to_fetch_details'
            assessmentFetches.push(caseDebug)
            return null
          }

          const categories = (detailData.total_impacts || []).map((cat: any) => ({
            category_name: cat.category_name,
            impact_value: parseFloat(Math.abs(cat.impact_value || 0).toString()),
            unit: cat.unit
          }))

          const components = (detailData.component_breakdown || []).map((comp: any) => ({
            component_name: comp.component_name,
            component_type: comp.component_type,
            impacts: comp.impacts.map((imp: any) => ({
              category_name: imp.category_name,
              impact_value: parseFloat(Math.abs(imp.impact_value || 0).toString())
            }))
          }))

          const totalScore = categories.reduce((sum: number, cat: any) => sum + cat.impact_value, 0)

          caseDebug.result = 'success'
          caseDebug.summary = { categories: categories.length, components: components.length, totalScore: totalScore.toFixed(2) }
          assessmentFetches.push(caseDebug)

          return {
            caseId: caseItem.id,
            caseName: caseItem.name,
            caseType: caseItem.case_type,
            categories,
            components,
            totalScore
          }
        } catch (caseError) {
          caseDebug.result = 'error'
          caseDebug.error = caseError instanceof Error ? caseError.message : String(caseError)
          assessmentFetches.push(caseDebug)
          return null
        }
      })

      const results = await Promise.all(dataPromises)
      const validResults = results.filter(Boolean) as AssessmentData[]

      debug.steps.push({ step: 4, name: 'Fetch All Assessments', status: validResults.length > 0 ? 'success' : 'no_data', case_details: assessmentFetches })

      debug.steps.push({
        step: 6,
        name: 'Final Results',
        status: 'success',
        total_cases: transformedCases.length,
        successful_cases: validResults.length,
        assessment_data: validResults.map(r => ({
          caseId: r.caseId,
          caseName: r.caseName,
          categoriesCount: r.categories.length,
          componentsCount: r.components.length,
          totalScore: r.totalScore
        }))
      })

      if (!validResults.length) {
        setErrorMessage(`Found ${transformedCases.length} case(s), but no completed assessments.`)
      }

      setAssessmentData(validResults)
      setDebugInfo(debug)
    } catch (error) {
      debug.steps.push({
        step: 'error',
        name: 'Fatal Error',
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })

      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase()
        if (errorMsg.includes('unauthorized') || errorMsg.includes('authentication required') || errorMsg.includes('401')) {
          setAuthError(true)
          setErrorMessage('Your session has expired. Please log in again.')
        } else {
          setErrorMessage(`Error loading data: ${error.message}`)
        }
      } else {
        setErrorMessage('An unexpected error occurred while loading assessment data.')
      }

      setDebugInfo(debug)
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

  // Chart-data derivations (UNCHANGED)
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

  // Heatmap data: categories x cases
  const heatmapData = () => {
    if (assessmentData.length === 0) return { categories: [] as string[], maxValues: {} as Record<string, number> }
    const allCategories = Array.from(new Set(assessmentData.flatMap(d => d.categories.map(c => c.category_name))))
    const maxValues: Record<string, number> = {}
    allCategories.forEach(cat => {
      let max = 0
      assessmentData.forEach(d => {
        const found = d.categories.find(c => c.category_name === cat)
        if (found && found.impact_value > max) max = found.impact_value
      })
      maxValues[cat] = max
    })
    return { categories: allCategories, maxValues }
  }

  const totalScoreComparisonData = () => {
    return assessmentData.map(data => ({ case: data.caseName, score: data.totalScore, type: data.caseType }))
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-surface-container-lowest border-b border-outline-variant/15">
        <div className="max-w-[1400px] mx-auto px-8 py-8">
          <div className="flex items-center justify-between flex-wrap gap-6">
            <div className="flex items-center gap-4">
              <Link href={`/project/${projectId}`}>
                <Button variant="ghost" size="sm" className="text-on-surface-variant hover:text-primary">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Project
                </Button>
              </Link>
              <div className="border-l border-outline-variant/30 h-8" />
              <div>
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-primary">Sustainability Assessment</span>
                <div className="flex items-center gap-3 mt-1">
                  <h1 className="text-3xl font-extrabold tracking-tighter text-on-surface leading-none">
                    Impact Analytics
                  </h1>
                  {filterCaseId && cases.length > 0 && (
                    <Badge variant="outline" className="bg-secondary-container text-on-secondary-container border-transparent">
                      {cases[0].name}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-on-surface-variant mt-2 max-w-xl">
                  {filterCaseId
                    ? `Analytics for selected case`
                    : `Environmental impact tiles across all completed assessments`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => fetchCasesAndAssessments()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button size="sm" onClick={handleExportPDF} className="veridian-gradient text-on-primary">
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto px-8 py-10">
        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <Activity className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-lg font-medium text-on-surface">Loading assessment data...</p>
            </div>
          </div>
        ) : authError ? (
          <div className="glass-panel rounded-2xl p-12 text-center bg-error-container/30">
            <div className="h-16 w-16 rounded-full bg-error-container flex items-center justify-center mb-4 mx-auto">
              <AlertCircle className="h-8 w-8 text-error" />
            </div>
            <p className="text-lg font-semibold text-on-surface mb-2">Authentication Required</p>
            <p className="text-sm text-on-surface-variant mb-6 max-w-md mx-auto">
              {errorMessage || 'Your session has expired. Please log in again to view analytics.'}
            </p>
            <div className="flex gap-3 justify-center">
              <Link href="/auth/login">
                <Button className="veridian-gradient text-on-primary">Log In Again</Button>
              </Link>
              <Link href={`/project/${projectId}`}>
                <Button variant="outline">Go to Project</Button>
              </Link>
            </div>
          </div>
        ) : assessmentData.length === 0 ? (
          <div className="space-y-6">
            <div className="bg-surface-container-low rounded-2xl p-16 text-center">
              <BarChart3 className="h-16 w-16 text-on-surface-variant/50 mx-auto mb-4" />
              <p className="text-lg font-medium text-on-surface">No assessment data available</p>
              {errorMessage && (
                <p className="text-sm text-error mt-2">Error: {errorMessage}</p>
              )}
              <p className="text-sm text-on-surface-variant mt-2">
                {cases.length === 0
                  ? 'No cases found in this project. Create a base case to get started.'
                  : `Found ${cases.length} case(s), but no completed assessments.`
                }
              </p>
              <div className="flex gap-3 mt-6 justify-center">
                <Link href={`/project/${projectId}`}>
                  <Button variant="outline">Go to Project Dashboard</Button>
                </Link>
                <Button variant="outline" onClick={() => fetchCasesAndAssessments()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </div>

            {debugInfo && (
              <Card className="border-outline-variant/20 bg-surface-container-low">
                <CardHeader>
                  <CardTitle className="text-sm font-mono">Debug Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs overflow-auto max-h-96 bg-surface-container-lowest p-4 rounded border border-outline-variant/20">
                    {JSON.stringify(debugInfo, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <DashboardGrid>
            {/* Headline total KPI — spans wide */}
            {assessmentData.length >= 1 && (
              <div className="col-span-12 lg:col-span-5 relative group">
                <div className="absolute -inset-1 veridian-gradient-soft rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000" />
                <div className="relative glass-panel p-10 rounded-3xl h-full flex flex-col justify-between min-h-[320px] shadow-botanical">
                  <div>
                    <span className="font-mono text-xs font-semibold text-secondary uppercase tracking-widest">
                      Total Impact (Baseline)
                    </span>
                    <h2 className="text-[5rem] font-extrabold tracking-tighter leading-none text-on-surface mt-4">
                      <Num
                        value={(assessmentData.find(d => d.caseType === 'base') ?? assessmentData[0]).totalScore}
                        precision={2}
                      />
                    </h2>
                    <p className="text-sm text-on-surface-variant mt-4 max-w-md">
                      Aggregated across <Num value={(assessmentData.find(d => d.caseType === 'base') ?? assessmentData[0]).categories.length} /> impact categories
                      for <span className="font-semibold text-on-surface">{(assessmentData.find(d => d.caseType === 'base') ?? assessmentData[0]).caseName}</span>.
                    </p>
                  </div>

                  {assessmentData.length === 2 && (() => {
                    const baseCase = assessmentData.find(d => d.caseType === 'base')
                    const compCase = assessmentData.find(d => d.caseType === 'comparative')
                    if (!baseCase || !compCase) return null
                    const improvement = ((baseCase.totalScore - compCase.totalScore) / baseCase.totalScore) * 100
                    const positive = improvement > 0
                    return (
                      <div className={`mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${positive ? 'bg-primary-fixed/30 text-on-primary-fixed-variant' : 'bg-error-container text-on-error-container'}`}>
                        {positive ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
                        <Num value={Math.abs(improvement)} precision={1} />% {positive ? 'Reduction' : 'Increase'} vs. Baseline
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}

            {/* Per-case cards */}
            <div className="col-span-12 lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {assessmentData.map((data, index) => {
                const isComparative = data.caseType === 'comparative'
                const baseCase = assessmentData.find(d => d.caseType === 'base')
                let improvementPercent = 0
                if (isComparative && baseCase) {
                  improvementPercent = baseCase.totalScore > 0
                    ? ((baseCase.totalScore - data.totalScore) / baseCase.totalScore) * 100
                    : 0
                }
                return (
                  <div
                    key={data.caseId}
                    className={`rounded-2xl p-6 ${data.caseType === 'base' ? 'bg-surface-container-low' : 'bg-secondary-container/40'} shadow-botanical`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-on-surface-variant truncate pr-2">{data.caseName}</span>
                      <Badge
                        variant="outline"
                        className={data.caseType === 'base'
                          ? 'bg-surface-container text-on-surface border-transparent'
                          : 'bg-primary-container/20 text-primary border-transparent'}
                      >
                        {data.caseType === 'base' ? 'Baseline' : 'Comparative'}
                      </Badge>
                    </div>
                    <div className="text-4xl font-extrabold tracking-tighter text-on-surface">
                      <Num value={data.totalScore} precision={2} />
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1">
                      <Num value={data.categories.length} /> categories
                    </p>
                    {isComparative && baseCase && (
                      <div className={`mt-3 text-sm font-semibold flex items-center gap-1 ${improvementPercent > 0 ? 'text-primary' : 'text-error'}`}>
                        {improvementPercent > 0 ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
                        <Num value={Math.abs(improvementPercent)} precision={1} />%
                        {improvementPercent > 0 ? ' reduction' : ' increase'}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Tabs + Charts */}
            <div className="col-span-12">
              <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
                <TabsList className="bg-surface-container-low border border-outline-variant/15 p-1 rounded-xl">
                  <TabsTrigger value="bar" className="data-[state=active]:veridian-gradient data-[state=active]:text-on-primary rounded-lg">
                    <BarChart3 className="h-4 w-4 mr-2" /> Per-Case
                  </TabsTrigger>
                  <TabsTrigger value="radar" className="data-[state=active]:veridian-gradient data-[state=active]:text-on-primary rounded-lg">
                    <Activity className="h-4 w-4 mr-2" /> Radar
                  </TabsTrigger>
                  <TabsTrigger value="pie" className="data-[state=active]:veridian-gradient data-[state=active]:text-on-primary rounded-lg">
                    <PieIcon className="h-4 w-4 mr-2" /> Pie
                  </TabsTrigger>
                  <TabsTrigger value="stacked" className="data-[state=active]:veridian-gradient data-[state=active]:text-on-primary rounded-lg">
                    <Layers className="h-4 w-4 mr-2" /> Stacked
                  </TabsTrigger>
                  <TabsTrigger value="heatmap" className="data-[state=active]:veridian-gradient data-[state=active]:text-on-primary rounded-lg">
                    <TrendingUp className="h-4 w-4 mr-2" /> Heatmap
                  </TabsTrigger>
                </TabsList>

                {/* Per-case multi-line / bar: Category Comparison */}
                <TabsContent value="bar" className="mt-6">
                  <DashboardGrid>
                    <div className="col-span-12 bg-surface-container-lowest rounded-2xl p-8 shadow-botanical">
                      <div className="mb-6">
                        <h3 className="text-xl font-bold tracking-tight text-on-surface">Impact Category Comparison</h3>
                        <p className="text-sm text-on-surface-variant">Per-case environmental impact across all categories</p>
                      </div>
                      <ResponsiveContainer width="100%" height={520}>
                        <LineChart data={categoryComparisonData()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(61,74,65,0.15)" />
                          <XAxis dataKey="category" angle={-35} textAnchor="end" height={110} stroke="#3d4a41" tick={{ fontSize: 11 }} />
                          <YAxis stroke="#3d4a41" tick={{ fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{
                              background: '#ffffff',
                              border: '1px solid rgba(188,202,191,0.4)',
                              borderRadius: 8,
                              fontFamily: 'IBM Plex Mono, monospace',
                              fontSize: 12,
                            }}
                          />
                          <Legend wrapperStyle={{ paddingTop: 20, fontSize: 12 }} iconType="circle" />
                          {assessmentData.map((caseData, index) => (
                            <Line
                              key={caseData.caseId}
                              type="monotone"
                              dataKey={caseData.caseName}
                              stroke={getCaseColor(caseData.caseType, index)}
                              strokeWidth={2.5}
                              dot={{ r: 4 }}
                              activeDot={{ r: 6 }}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </DashboardGrid>
                </TabsContent>

                {/* Radar */}
                <TabsContent value="radar" className="mt-6">
                  <div className="bg-surface-container-lowest rounded-2xl p-8 shadow-botanical">
                    <div className="mb-6">
                      <h3 className="text-xl font-bold tracking-tight text-on-surface">Multi-Dimensional Impact Profile</h3>
                      <p className="text-sm text-on-surface-variant">Normalized comparison across all impact categories</p>
                    </div>
                    <ResponsiveContainer width="100%" height={560}>
                      <RadarChart data={radarChartData()}>
                        <PolarGrid stroke="rgba(61,74,65,0.18)" />
                        <PolarAngleAxis dataKey="category" tick={{ fontSize: 11, fill: '#3d4a41' }} />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10, fill: '#6d7a71' }} />
                        <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid rgba(188,202,191,0.4)', borderRadius: 8, fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }} />
                        <Legend wrapperStyle={{ paddingTop: 16, fontSize: 12 }} iconType="circle" />
                        {assessmentData.map((caseData, index) => (
                          <Radar
                            key={caseData.caseId}
                            name={caseData.caseName}
                            dataKey={caseData.caseName}
                            stroke={getCaseColor(caseData.caseType, index)}
                            fill={getCaseColor(caseData.caseType, index)}
                            fillOpacity={0.28}
                          />
                        ))}
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>

                {/* Pie */}
                <TabsContent value="pie" className="mt-6">
                  <div className="bg-surface-container-lowest rounded-2xl p-8 shadow-botanical">
                    <div className="mb-6">
                      <h3 className="text-xl font-bold tracking-tight text-on-surface">Category Distribution — {assessmentData[0]?.caseName}</h3>
                      <p className="text-sm text-on-surface-variant">Percentage breakdown by impact category</p>
                    </div>
                    <ResponsiveContainer width="100%" height={500}>
                      <PieChart>
                        <Pie
                          data={pieChartData()}
                          cx="35%"
                          cy="50%"
                          labelLine={false}
                          label={false}
                          outerRadius={150}
                          fill="#006a44"
                          dataKey="value"
                        >
                          {pieChartData().map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={CATEGORY_COLORS[entry.name] || `hsl(${index * 36}, 60%, 45%)`}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: '#ffffff', border: '1px solid rgba(188,202,191,0.4)', borderRadius: 8, fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}
                          formatter={(value: any) => {
                            const numValue = Number(value);
                            return numValue >= 1000 ? `${(numValue / 1000).toFixed(2)}k` : numValue.toFixed(2);
                          }}
                        />
                        <Legend
                          layout="vertical"
                          align="right"
                          verticalAlign="middle"
                          wrapperStyle={{ paddingLeft: '20px', fontSize: '13px', lineHeight: '22px' }}
                          iconType="circle"
                          iconSize={10}
                          formatter={(value: string) => {
                            const dataItem = pieChartData().find(d => d.name === value);
                            if (!dataItem) return value;
                            const total = pieChartData().reduce((sum, d) => sum + d.value, 0);
                            const percentage = total > 0 ? ((dataItem.value / total) * 100).toFixed(1) : '0';
                            return `${value} (${percentage}%)`;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>

                {/* Stacked */}
                <TabsContent value="stacked" className="mt-6">
                  <div className="bg-surface-container-lowest rounded-2xl p-8 shadow-botanical">
                    <div className="mb-6">
                      <h3 className="text-xl font-bold tracking-tight text-on-surface">Component Contribution — {assessmentData[0]?.caseName}</h3>
                      <p className="text-sm text-on-surface-variant">How each component contributes to environmental impacts</p>
                    </div>
                    <ResponsiveContainer width="100%" height={600}>
                      <BarChart data={componentStackedData()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(61,74,65,0.15)" />
                        <XAxis dataKey="category" angle={-35} textAnchor="end" height={110} stroke="#3d4a41" tick={{ fontSize: 11 }} />
                        <YAxis stroke="#3d4a41" tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid rgba(188,202,191,0.4)', borderRadius: 8, fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }} />
                        <Legend wrapperStyle={{ paddingTop: 16, fontSize: 12 }} iconType="circle" iconSize={10} />
                        {assessmentData[0]?.components.map((comp, index) => (
                          <Bar
                            key={comp.component_name}
                            dataKey={comp.component_name}
                            stackId="a"
                            fill={`hsl(${(index * 360) / Math.max(1, assessmentData[0].components.length)}, 55%, 45%)`}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>

                {/* Heatmap */}
                <TabsContent value="heatmap" className="mt-6">
                  <div className="bg-surface-container-lowest rounded-2xl p-8 shadow-botanical">
                    <div className="mb-6">
                      <h3 className="text-xl font-bold tracking-tight text-on-surface">Intensity Heatmap</h3>
                      <p className="text-sm text-on-surface-variant">Relative impact intensity per category, per case</p>
                    </div>
                    {(() => {
                      const { categories, maxValues } = heatmapData()
                      if (!categories.length) return <p className="text-sm text-on-surface-variant">No data</p>
                      return (
                        <div className="overflow-x-auto">
                          <div
                            className="grid gap-1 min-w-[600px]"
                            style={{ gridTemplateColumns: `minmax(180px, 1fr) repeat(${assessmentData.length}, minmax(120px, 1fr))` }}
                          >
                            <div className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant px-3 py-2">Category</div>
                            {assessmentData.map(d => (
                              <div key={d.caseId} className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant px-3 py-2 text-center">
                                {d.caseName}
                              </div>
                            ))}
                            {categories.map((cat) => (
                              <React.Fragment key={cat}>
                                <div className="px-3 py-3 text-sm text-on-surface bg-surface-container-low rounded-md">{cat}</div>
                                {assessmentData.map((d) => {
                                  const found = d.categories.find(c => c.category_name === cat)
                                  const val = found ? found.impact_value : 0
                                  const max = maxValues[cat] || 1
                                  const intensity = max > 0 ? val / max : 0
                                  // interpolate surface-container-low -> primary
                                  const alpha = 0.08 + intensity * 0.85
                                  return (
                                    <div
                                      key={d.caseId + cat}
                                      className="px-3 py-3 rounded-md text-center text-sm font-semibold"
                                      style={{
                                        background: `rgba(0, 106, 68, ${alpha.toFixed(3)})`,
                                        color: intensity > 0.55 ? '#ffffff' : '#191c1b',
                                      }}
                                    >
                                      <Num value={val} precision={2} />
                                    </div>
                                  )
                                })}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Sankey placeholder */}
            <div className="col-span-12 lg:col-span-7 bg-surface-container-low rounded-2xl p-10 min-h-[280px] flex flex-col justify-between shadow-botanical relative overflow-hidden">
              <div>
                <span className="font-mono text-xs uppercase tracking-widest text-secondary">Flow Analysis</span>
                <h3 className="text-2xl font-bold tracking-tight text-on-surface mt-2">Sankey Flow — coming soon</h3>
                <p className="text-sm text-on-surface-variant mt-3 max-w-md">
                  Material &amp; energy flows visualization linking components to impact categories is on the way. For now, see the component stacked chart above.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs font-mono text-on-surface-variant/70">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Planned · Phase 9
              </div>
              <div
                className="absolute -right-20 -bottom-20 w-72 h-72 rounded-full opacity-40 blur-3xl pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(123,250,187,0.35) 0%, transparent 70%)' }}
              />
            </div>

            {/* Detailed comparison table (2-case) */}
            {assessmentData.length >= 2 && (() => {
              const baseCase = assessmentData.find(d => d.caseType === 'base')
              const compCase = assessmentData.find(d => d.caseType === 'comparative')
              if (!baseCase || !compCase) return null
              const allCategories = Array.from(
                new Set([...baseCase.categories, ...compCase.categories].map(c => c.category_name))
              )
              return (
                <div className="col-span-12 lg:col-span-5 bg-surface-container-lowest rounded-2xl p-8 shadow-botanical">
                  <div className="mb-6">
                    <h3 className="text-xl font-bold tracking-tight text-on-surface">Category Diff Table</h3>
                    <p className="text-sm text-on-surface-variant">Side-by-side across impact categories</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="text-left py-2 px-3 text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">Category</th>
                          <th className="text-right py-2 px-3 text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">Base</th>
                          <th className="text-right py-2 px-3 text-[10px] font-mono uppercase tracking-wider text-on-surface-variant">Comp.</th>
                          <th className="text-right py-2 px-3 text-[10px] font-mono uppercase tracking-wider text-primary">Δ%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allCategories.map((categoryName, index) => {
                          const baseCat = baseCase.categories.find(c => c.category_name === categoryName)
                          const compCat = compCase.categories.find(c => c.category_name === categoryName)
                          const baseValue = baseCat ? baseCat.impact_value : 0
                          const compValue = compCat ? compCat.impact_value : 0
                          const difference = baseValue - compValue
                          const percentChange = baseValue > 0 ? (difference / baseValue) * 100 : 0
                          const unit = baseCat?.unit || compCat?.unit || ''
                          const stripe = index % 2 === 0 ? 'bg-transparent' : 'bg-surface-container-low'
                          return (
                            <tr key={categoryName} className={stripe}>
                              <td className="py-2 px-3 text-sm text-on-surface">{categoryName}</td>
                              <td className="py-2 px-3 text-right text-sm">
                                <Num value={baseValue} precision={2} />
                                <span className="text-[10px] text-on-surface-variant ml-1">{formatChemicalUnit(unit)}</span>
                              </td>
                              <td className="py-2 px-3 text-right text-sm text-primary font-medium">
                                <Num value={compValue} precision={2} />
                              </td>
                              <td className="py-2 px-3 text-right text-sm font-bold">
                                <span className={percentChange > 0 ? 'text-primary' : percentChange < 0 ? 'text-error' : 'text-on-surface-variant'}>
                                  {percentChange > 0 ? '↓' : percentChange < 0 ? '↑' : '—'}
                                  {' '}
                                  <Num value={Math.abs(percentChange)} precision={1} />%
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-outline-variant/30">
                          <td className="py-3 px-3 text-sm font-bold text-on-surface">TOTAL</td>
                          <td className="py-3 px-3 text-right text-sm font-bold">
                            <Num value={baseCase.totalScore} precision={2} />
                          </td>
                          <td className="py-3 px-3 text-right text-sm font-bold text-primary">
                            <Num value={compCase.totalScore} precision={2} />
                          </td>
                          <td className="py-3 px-3 text-right text-sm font-bold text-primary">
                            ↓ <Num value={Math.abs((baseCase.totalScore - compCase.totalScore) / baseCase.totalScore * 100)} precision={1} />%
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )
            })()}
          </DashboardGrid>
        )}
      </div>
    </div>
  )
}
