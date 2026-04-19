"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { type Case } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  ArrowLeft,
  BarChart3,
  Play,
  X,
  AlertCircle,
  Target,
  Loader2,
  ChevronDown,
} from "lucide-react"
import { toast } from "sonner"
import { apiRequest } from "@/lib/api-client"
import { transformCaseFromDB } from "@/lib/data-transformers"
import { RunAssessmentModal } from "@/components/assessments/run-assessment-modal"
import { ProjectShell } from "@/components/project/project-shell"
import { TotalImpactDisplay } from "@/components/results/total-impact-display"
import { ContributionChart } from "@/components/results/contribution-chart"
import { FlowLevelDetail } from "@/components/results/flow-level-detail"
import { HistoricalComparison } from "@/components/results/historical-comparison"
import { Num } from "@/components/ui/num"

// Impact categories supported
const IMPACT_CATEGORIES = {
  "Global warming": { unit: "kg CO₂-eq", color: "text-red-600" },
  "Ozone depletion": { unit: "kg CFC-11-eq", color: "text-blue-600" },
  "Smog formation": { unit: "kg NOₓ-eq", color: "text-orange-600" },
  "Freshwater ecotoxicity": { unit: "CTUe", color: "text-cyan-600" },
  "Acidification": { unit: "kg SO₂-eq", color: "text-purple-600" },
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

  // Assessment state (PRESERVED from previous page — handlers untouched)
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
        const [caseResponse, componentsResponse] = await Promise.all([
          apiRequest(`/api/cases/${caseId}`),
          apiRequest(`/api/cases/${caseId}/components`),
        ])

        if (caseResponse.ok) {
          const caseData = await caseResponse.json()
          const componentsData = await componentsResponse.json()

          if (caseData.success && caseData.case) {
            const transformedCase = transformCaseFromDB(caseData.case)

            if (componentsData.success && componentsData.components) {
              const { transformComponentFromDB } = await import("@/lib/data-transformers")
              transformedCase.components = componentsData.components.map((c: any) =>
                transformComponentFromDB(c),
              )
            }

            setCurrentCase(transformedCase)
          }
        }
      } catch (error) {
        console.error("Failed to fetch case:", error)
      } finally {
        setIsLoadingCase(false)
      }
    }

    if (caseId) {
      fetchCaseData()
    }
  }, [caseId])

  const anyOptionSelected = selectedCategories.length > 0

  // Load historical assessments on mount
  useEffect(() => {
    const fetchAssessments = async () => {
      try {
        const response = await apiRequest(`/api/cases/${caseId}/assessments`)
        if (response.ok) {
          const data = await response.json()
          if (data.assessments && data.assessments.length > 0) {
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
                total: 0,
              },
              componentBreakdown: assessment.componentBreakdown || [],
            }))
            setAssessmentResults(transformedAssessments)
            if (transformedAssessments.length > 0) {
              setCurrentAssessment(transformedAssessments[0])
              setExpandedAssessments(new Set([transformedAssessments[0].run_id]))
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch assessments:", error)
      }
    }

    if (caseId) {
      fetchAssessments()
    }
  }, [caseId])

  // Loading state
  if (isLoadingCase) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-on-surface-variant">Loading case data...</p>
        </div>
      </div>
    )
  }

  // Case not found
  if (!currentCase) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-on-surface-variant mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-on-surface mb-2">Case not found</h2>
          <p className="text-on-surface-variant mb-4">The requested case could not be loaded.</p>
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
          unit: impact.unit,
        }
      })
    }

    const componentsWithDrivers =
      currentCase?.components?.filter(
        (c) => c.driverCategory && c.drivers && c.drivers.length > 0,
      ) || []
    const totalOperationalCost = componentsWithDrivers.reduce(
      (sum, c) => sum + (c.operationalCostUSD || 0),
      0,
    )
    const totalCapitalCost = componentsWithDrivers.reduce(
      (sum, c) => sum + (c.capitalCostUSD || 0),
      0,
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
        total: totalOperationalCost + totalCapitalCost,
      },
      componentBreakdown: data.component_breakdown || [],
      algorithmSteps: data.algorithm_steps || [],
    }

    return result
  }

  const handleCategoryChange = (category: string, checked: boolean) => {
    if (checked) {
      setSelectedCategories((prev) => [...prev, category])
    } else {
      setSelectedCategories((prev) => prev.filter((c) => c !== category))
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

      setAssessmentResults((prev) => [result, ...prev])
      setCurrentAssessment(result)

      setShowOptions(false)
      setSelectedCategories([])

      toast.success(`Assessment completed! Run ID: ${result.run_id}`)
      console.log("Assessment result:", result)
    } catch (error: any) {
      console.error("Failed to process assessment result:", error)
      toast.error(`Failed to process assessment result: ${error.message}`)
    }
  }

  const handleCancel = () => {
    setSelectedCategories([])
    setShowOptions(false)
  }

  const mostRecentAssessment = currentAssessment || assessmentResults[0]

  // Component readiness analysis
  const allComponents = currentCase?.components || []
  const componentsWithDrivers = allComponents.filter(
    (c) => c.driverCategory && c.drivers && c.drivers.length > 0,
  )

  const buttonText = mostRecentAssessment ? "Re-run Assessment" : "Run Assessment"
  const runButtonText = isRunningAssessment
    ? "Please wait, assessment in progress..."
    : showOptions && anyOptionSelected
      ? "Run Assessment with Selected Options"
      : buttonText

  // Derive view data from the current assessment
  const impactEntries = mostRecentAssessment
    ? Object.entries(mostRecentAssessment.impacts)
    : []

  // Pick primary (global warming) if available, else first impact
  const primaryEntry =
    impactEntries.find(([k]) => /global\s*warming|carbon|co2/i.test(k)) || impactEntries[0]

  // Delta% vs previous run for the primary category
  let primaryDelta: number | null = null
  if (primaryEntry && assessmentResults.length > 1) {
    const [catKey] = primaryEntry
    const sorted = [...assessmentResults].sort(
      (a, b) => new Date(a.run_date).getTime() - new Date(b.run_date).getTime(),
    )
    const curIdx = sorted.findIndex(
      (r) => r.run_id === (mostRecentAssessment as AssessmentResult).run_id,
    )
    if (curIdx > 0) {
      const prev = sorted[curIdx - 1]
      const prevVal = prev.impacts?.[catKey]?.value
      const curVal = sorted[curIdx].impacts?.[catKey]?.value
      if (typeof prevVal === "number" && typeof curVal === "number" && prevVal !== 0) {
        primaryDelta = ((curVal - prevVal) / prevVal) * 100
      }
    }
  }

  // Contribution chart data (per component, primary category)
  const contributionData =
    mostRecentAssessment && primaryEntry
      ? (mostRecentAssessment.componentBreakdown || [])
          .map((c) => {
            const match = c.impacts.find((i) => i.category_name === primaryEntry[0])
            return {
              label: c.component_name,
              value: match?.impact_value || 0,
              unit: match?.unit || primaryEntry[1].unit,
            }
          })
          .filter((d) => d.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, 8)
      : []

  // Flow-level rows
  const flowRows =
    mostRecentAssessment?.componentBreakdown?.map((c) => ({
      id: c.component_id,
      componentName: c.component_name,
      componentType: c.component_type,
      flowsProcessed: c.flows_processed,
      impacts: c.impacts.map((i) => ({
        categoryName: i.category_name,
        value: i.impact_value,
        unit: i.unit,
      })),
    })) || []

  // Historical runs for primary category
  const historicalRuns = primaryEntry
    ? assessmentResults
        .filter((r) => typeof r.impacts?.[primaryEntry[0]]?.value === "number")
        .map((r) => ({
          runId: r.run_id,
          runDate: r.run_date,
          value: r.impacts[primaryEntry[0]].value,
          unit: r.impacts[primaryEntry[0]].unit,
        }))
    : []

  return (
    <ProjectShell
      projectName={currentCase.name || "Case"}
      projectId={projectId}
      activeSection="analysis"
    >
      <div className="max-w-[1600px] mx-auto px-6 md:px-10 py-8">
        {/* Breadcrumb */}
        <nav className="font-mono text-[11px] uppercase tracking-[0.12em] text-on-surface-variant mb-4">
          <button
            onClick={() => router.push(`/project/${projectId}`)}
            className="hover:text-primary transition-colors"
          >
            Project
          </button>
          <span className="mx-2 opacity-50">/</span>
          <button
            onClick={() => router.push(`/project/${projectId}/case/${caseId}`)}
            className="hover:text-primary transition-colors"
          >
            {currentCase.name}
          </button>
          <span className="mx-2 opacity-50">/</span>
          <span className="text-on-surface">Results</span>
        </nav>

        {/* Page header with primary action */}
        <div className="flex flex-wrap justify-between items-end gap-4 mb-10">
          <div className="space-y-1">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-on-surface">
              LCAPIX <span className="text-primary">Results</span>
            </h1>
            <p className="text-on-surface-variant font-mono text-xs">
              CASE: {currentCase.name}
              {mostRecentAssessment && (
                <>
                  {" · "}RUN_ID: {mostRecentAssessment.run_id}
                  {" · "}
                  {new Date(mostRecentAssessment.run_date)
                    .toISOString()
                    .replace(/[-:T]/g, ".")
                    .slice(0, 19)}
                </>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {!showOptions && (
              <Button
                onClick={() => setShowOptions(true)}
                variant="outline"
                className="h-11"
                size="lg"
              >
                <Target className="h-4 w-4 mr-2" />
                Customize
              </Button>
            )}
            <Button
              onClick={handleRunAssessment}
              disabled={isRunningAssessment}
              size="lg"
              className="h-11 veridian-gradient text-on-primary font-bold shadow-[0_8px_20px_-6px_rgba(0,106,68,0.4)] hover:scale-[1.02] transition-transform"
            >
              {isRunningAssessment ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {runButtonText}
            </Button>
          </div>
        </div>

        {/* KPI strip — per-category top-line */}
        {impactEntries.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {impactEntries.slice(0, 4).map(([cat, imp], idx) => (
              <div
                key={cat}
                className={`bg-surface-container-low p-6 rounded-xl ${
                  idx === 0 ? "border-l-4 border-primary" : ""
                }`}
              >
                <p className="font-mono text-[10px] text-on-surface-variant uppercase mb-1 truncate">
                  {cat}
                </p>
                <p className="text-2xl font-bold num text-on-surface">
                  <Num value={imp.value} precision={imp.value >= 100 ? 1 : 2} />
                  <span className="text-xs font-normal ml-1 text-on-surface-variant">
                    {imp.unit}
                  </span>
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Customize categories panel (preserved logic, restyled) */}
        {showOptions && (
          <div className="mb-10 animate-in slide-in-from-top-2 duration-500">
            <div className="bg-surface-container-low rounded-2xl p-6">
              <h4 className="font-bold text-lg mb-1 text-on-surface flex items-center">
                <Target className="h-5 w-5 mr-2 text-primary" />
                Select Impact Categories
              </h4>
              <p className="text-on-surface-variant text-sm mb-6">
                Choose which environmental impact categories to include in your assessment.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                {Object.entries(IMPACT_CATEGORIES).map(([category, info]) => (
                  <div
                    key={category}
                    className="bg-surface-container-lowest rounded-lg p-4 hover:bg-surface-container transition-colors"
                  >
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        checked={selectedCategories.includes(category)}
                        onCheckedChange={(checked) =>
                          handleCategoryChange(category, checked as boolean)
                        }
                        disabled={isRunningAssessment}
                        className="data-[state=checked]:bg-primary data-[state=checked]:text-on-primary mt-1"
                      />
                      <div
                        className="cursor-pointer flex-1"
                        onClick={() =>
                          handleCategoryChange(category, !selectedCategories.includes(category))
                        }
                      >
                        <div className="flex items-center mb-1">
                          <span className="text-on-surface font-medium text-sm">{category}</span>
                        </div>
                        <span className="font-mono text-[10px] uppercase text-on-surface-variant">
                          {info.unit}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4">
                <div className="text-on-surface-variant text-sm font-mono">
                  {selectedCategories.length} of {Object.keys(IMPACT_CATEGORIES).length} selected
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleCancel}
                    disabled={isRunningAssessment}
                    variant="outline"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    onClick={handleRunAssessment}
                    disabled={isRunningAssessment}
                    className="veridian-gradient text-on-primary font-semibold"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Run Assessment
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {mostRecentAssessment && primaryEntry ? (
          <>
            {/* Main Bento Grid */}
            <div className="grid grid-cols-12 gap-6 mb-12">
              <div className="col-span-12 lg:col-span-5">
                <TotalImpactDisplay
                  value={primaryEntry[1].value}
                  unit={primaryEntry[1].unit}
                  categoryLabel={primaryEntry[0]}
                  deltaPct={primaryDelta}
                  equivalentText={
                    /co2|carbon|warming/i.test(primaryEntry[0])
                      ? "Aggregated across all configured components in this case."
                      : undefined
                  }
                  targetMet={
                    typeof primaryDelta === "number" ? primaryDelta < 0 : undefined
                  }
                />
              </div>

              <div className="col-span-12 lg:col-span-7">
                <ContributionChart
                  data={contributionData}
                  title={`Contribution by Component · ${primaryEntry[0]}`}
                />
              </div>
            </div>

            {/* Flow-level detail */}
            <div className="mb-12">
              <FlowLevelDetail rows={flowRows} highlightCategory={primaryEntry[0]} />
            </div>

            {/* Historical comparison */}
            <HistoricalComparison
              runs={historicalRuns}
              currentRunId={mostRecentAssessment.run_id}
              onSelect={(runId) => {
                const match = assessmentResults.find((r) => r.run_id === runId)
                if (match) setCurrentAssessment(match)
              }}
            />

            {/* Assessment history list (preserved functionality) */}
            {assessmentResults.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold tracking-tight text-on-surface">
                    Assessment History
                  </h3>
                  <div className="flex items-center gap-3">
                    {assessmentResults.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPreviousAssessments(!showPreviousAssessments)}
                      >
                        <ChevronDown
                          className={`h-4 w-4 mr-1 transition-transform ${
                            showPreviousAssessments ? "" : "-rotate-90"
                          }`}
                        />
                        {showPreviousAssessments
                          ? "Hide Previous"
                          : `Show Previous (${assessmentResults.length - 1})`}
                      </Button>
                    )}
                    <Badge variant="outline" className="bg-secondary-container text-primary">
                      {assessmentResults.length} run{assessmentResults.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </div>

                <div className="bg-surface-container-lowest rounded-2xl p-6 space-y-3">
                  {(showPreviousAssessments
                    ? assessmentResults
                    : assessmentResults.slice(0, 1)
                  ).map((assessment) => {
                    const isSelected = mostRecentAssessment?.run_id === assessment.run_id
                    const isExpanded = expandedAssessments.has(assessment.run_id)
                    const entries = Object.entries(assessment.impacts || {})

                    return (
                      <div
                        key={assessment.run_id}
                        className={`p-4 rounded-xl transition-all ${
                          isSelected
                            ? "bg-secondary-container/50 ring-2 ring-primary/40"
                            : "bg-surface-container-low hover:bg-surface-container"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div
                            className="flex items-center space-x-4 flex-1 cursor-pointer"
                            onClick={() => setCurrentAssessment(assessment)}
                          >
                            <div
                              className={`p-2 rounded-lg ${
                                isSelected ? "veridian-gradient" : "bg-surface-container-high"
                              }`}
                            >
                              <BarChart3
                                className={`h-4 w-4 ${
                                  isSelected ? "text-on-primary" : "text-on-surface-variant"
                                }`}
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-on-surface">
                                  {assessment.run_name || `Run #${assessment.run_id}`}
                                </span>
                                {isSelected && (
                                  <Badge className="bg-primary text-on-primary text-xs">
                                    Selected
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-on-surface-variant font-mono">
                                {new Date(assessment.run_date).toLocaleString()} ·{" "}
                                {assessment.calculation_method}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-xs font-mono text-on-surface-variant">
                              {entries.length} categories
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpandedAssessments((prev) => {
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
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${
                                  isExpanded ? "" : "-rotate-90"
                                }`}
                              />
                            </Button>
                          </div>
                        </div>

                        {isExpanded && entries.length > 0 && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4 pt-4">
                            {entries.map(([category, impact]) => (
                              <div
                                key={category}
                                className="bg-surface-container-lowest rounded-lg p-3"
                              >
                                <div
                                  className="font-mono text-[10px] uppercase text-on-surface-variant truncate"
                                  title={category}
                                >
                                  {category}
                                </div>
                                <div className="num font-bold text-sm text-on-surface mt-1">
                                  <Num
                                    value={typeof impact.value === "number" ? impact.value : 0}
                                    precision={2}
                                  />
                                </div>
                                <div className="font-mono text-[10px] text-on-surface-variant">
                                  {impact.unit}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-surface-container-lowest rounded-2xl p-16 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-24 h-24 rounded-full veridian-gradient mx-auto mb-6 flex items-center justify-center shadow-[0_8px_20px_-6px_rgba(0,106,68,0.4)]">
                <Play className="h-10 w-10 text-on-primary" />
              </div>
              <h3 className="text-2xl font-bold text-on-surface mb-3">Ready to Run Assessment</h3>
              <p className="text-on-surface-variant mb-8 leading-relaxed">
                {componentsWithDrivers.length > 0
                  ? `${componentsWithDrivers.length} component${
                      componentsWithDrivers.length === 1 ? "" : "s"
                    } configured with drivers. Run the first LCA pass to see impacts.`
                  : "Configure components with drivers first, then return here to run your assessment."}
              </p>
              <Button
                onClick={handleRunAssessment}
                disabled={isRunningAssessment}
                size="lg"
                className="veridian-gradient text-on-primary font-semibold shadow-[0_8px_20px_-6px_rgba(0,106,68,0.4)]"
              >
                {isRunningAssessment && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Play className="h-4 w-4 mr-2" />
                {isRunningAssessment ? "Running Assessment..." : "Run Assessment"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <RunAssessmentModal
        open={assessOpen}
        onClose={() => setAssessOpen(false)}
        caseId={Number(caseId)}
        onCompleted={handleAssessmentCompleted}
      />
    </ProjectShell>
  )
}
