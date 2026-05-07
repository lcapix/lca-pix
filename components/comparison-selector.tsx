"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, BarChart3, Star, Plus, Package } from "lucide-react"
import { CaseMiniDashboardCard } from "./case-mini-dashboard-card"
import { apiRequest } from "@/lib/api-client"

interface Case {
  id: string
  name: string
  description?: string
  type: 'base' | 'comparative'
  createdAt?: Date
}

interface ComparisonSelectorProps {
  projectId: string
  cases: Case[]
  onRunComparison: (comparisonName: string, selectedCaseIds: string[]) => void
  isRunning?: boolean
}

export function ComparisonSelector({
  projectId,
  cases,
  onRunComparison,
  isRunning = false
}: ComparisonSelectorProps) {
  const [baseCaseId, setBaseCaseId] = useState<string>("")
  const [comparativeCases, setComparativeCases] = useState<Array<{id: string, slot: number}>>([])
  const [comparisonName, setComparisonName] = useState('')
  const [caseAssessments, setCaseAssessments] = useState<Record<string, any>>({})
  const [loadingAssessments, setLoadingAssessments] = useState(false)
  const [assessmentErrors, setAssessmentErrors] = useState<Record<string, string>>({})
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})

  // Auto-select first case as base case on mount
  useEffect(() => {
    if (cases && cases.length > 0 && !baseCaseId) {
      setBaseCaseId(cases[0].id.toString())
      // Auto-add one comparative slot
      setComparativeCases([{id: "", slot: 1}])
    }
  }, [cases, baseCaseId])

  // Auto-generate comparison name when cases are selected
  useEffect(() => {
    const selectedIds = comparativeCases.filter(c => c.id).map(c => c.id)
    if (baseCaseId && selectedIds.length >= 1) {
      const firstCase = cases.find(c => c.id === baseCaseId)
      const secondCase = cases.find(c => c.id === selectedIds[0])

      if (firstCase && secondCase) {
        const autoName = `Comparison: ${firstCase.name} vs ${secondCase.name}`
        setComparisonName(autoName)
      }
    } else if (!baseCaseId || selectedIds.length === 0) {
      setComparisonName('')
    }
  }, [baseCaseId, comparativeCases, cases])

  // Fetch assessment data to show impact categories (using two-step API pattern)
  useEffect(() => {
    const fetchAssessments = async () => {
      const allCaseIds = [baseCaseId, ...comparativeCases.map(c => c.id)].filter(Boolean)
      console.log('🔍 COMPARISON: Fetching assessments for case IDs:', allCaseIds)

      if (allCaseIds.length === 0) return

      setLoadingAssessments(true)
      setAssessmentErrors({})

      for (const caseId of allCaseIds) {
        // Set loading state for this specific case
        setLoadingStates(prev => ({ ...prev, [caseId]: true }))

        try {
          console.log(`📊 COMPARISON: Fetching assessment for case ${caseId}...`)

          // Fetch assessments list with impacts data
          const assessmentsResponse = await apiRequest(`/api/cases/${caseId}/assessments`)
          const assessmentsData = await assessmentsResponse.json()

          console.log(`📋 COMPARISON: Assessment response for case ${caseId}:`, {
            success: assessmentsData.success,
            count: assessmentsData.assessments?.length || 0,
            hasImpacts: !!assessmentsData.assessments?.[0]?.impacts,
            impactsType: typeof assessmentsData.assessments?.[0]?.impacts,
            impactsKeys: assessmentsData.assessments?.[0]?.impacts ? Object.keys(assessmentsData.assessments[0].impacts) : [],
            sampleData: assessmentsData.assessments?.[0]
          })

          if (assessmentsData.success && assessmentsData.assessments?.length > 0) {
            const latestAssessment = assessmentsData.assessments[0]
            console.log(`✅ COMPARISON: Found assessment run_id ${latestAssessment.run_id} for case ${caseId}`)
            console.log(`📦 COMPARISON: Assessment structure:`, {
              hasImpacts: !!latestAssessment.impacts,
              impactsType: typeof latestAssessment.impacts,
              isObject: typeof latestAssessment.impacts === 'object' && !Array.isArray(latestAssessment.impacts),
              keys: latestAssessment.impacts ? Object.keys(latestAssessment.impacts) : []
            })

            // Check if impacts object exists and transform it to total_impacts array
            if (latestAssessment.impacts && typeof latestAssessment.impacts === 'object' && !Array.isArray(latestAssessment.impacts)) {
              const impactKeys = Object.keys(latestAssessment.impacts)
              console.log(`🔄 COMPARISON: Transforming ${impactKeys.length} impact categories from impacts object`)

              if (impactKeys.length > 0) {
                // Transform impacts object to total_impacts array format
                const total_impacts = Object.entries(latestAssessment.impacts).map(
                  ([category_name, data]: [string, any]) => ({
                    category_name,
                    impact_value: data.value,
                    unit: data.unit
                  })
                )

                // Create summary from component breakdown if available
                const summary = {
                  total_components: latestAssessment.componentBreakdown?.length || 0,
                  components_with_flows: latestAssessment.componentBreakdown?.length || 0,
                  total_flows_processed: latestAssessment.componentBreakdown?.reduce(
                    (sum: number, comp: any) => sum + (comp.flows_processed || 0), 0
                  ) || 0,
                  impact_categories_calculated: total_impacts.length,
                  calculation_method: latestAssessment.calculation_method || 'CML 2001'
                }

                const transformedData = {
                  success: true,
                  assessment: latestAssessment,
                  summary,
                  total_impacts,
                  component_breakdown: latestAssessment.componentBreakdown || []
                }

                console.log(`✨ COMPARISON: Storing assessment data for case ${caseId}:`, {
                  impactCount: total_impacts.length,
                  componentCount: summary.total_components,
                  sampleImpact: total_impacts[0]
                })

                setCaseAssessments(prev => ({
                  ...prev,
                  [caseId]: transformedData
                }))
                setLoadingStates(prev => ({ ...prev, [caseId]: false }))
              } else {
                const error = 'Assessment exists but has no impact data'
                console.warn(`⚠️ COMPARISON: ${error} for case ${caseId}`)
                setAssessmentErrors(prev => ({ ...prev, [caseId]: error }))
                setLoadingStates(prev => ({ ...prev, [caseId]: false }))
              }
            } else {
              const error = 'No valid impacts object in assessment data'
              console.warn(`⚠️ COMPARISON: ${error} for case ${caseId}`)
              console.warn(`⚠️ COMPARISON: latestAssessment structure:`, latestAssessment)
              setAssessmentErrors(prev => ({ ...prev, [caseId]: error }))
              setLoadingStates(prev => ({ ...prev, [caseId]: false }))
            }
          } else {
            const error = 'No assessments found for this case'
            console.warn(`⚠️ COMPARISON: ${error} for case ${caseId}`)
            setAssessmentErrors(prev => ({
              ...prev,
              [caseId]: error
            }))
            setLoadingStates(prev => ({ ...prev, [caseId]: false }))
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          console.error(`❌ COMPARISON: Error fetching assessment for case ${caseId}:`, error)
          setAssessmentErrors(prev => ({
            ...prev,
            [caseId]: errorMsg
          }))
          // Clear loading state on error
          setLoadingStates(prev => ({ ...prev, [caseId]: false }))
        }
      }

      setLoadingAssessments(false)
      console.log('🏁 COMPARISON: Finished fetching all assessments (state will update asynchronously)', {
        errors: assessmentErrors,
        note: 'Watch for 🔄 STATE MONITOR log to see actual state updates'
      })
    }

    if (baseCaseId || comparativeCases.some(c => c.id)) {
      fetchAssessments()
    }
  }, [baseCaseId, comparativeCases])

  // Monitor state changes to verify data updates
  useEffect(() => {
    console.log('🔄 STATE MONITOR: caseAssessments updated', {
      caseIds: Object.keys(caseAssessments),
      count: Object.keys(caseAssessments).length,
      hasData: Object.keys(caseAssessments).length > 0,
      sample: Object.keys(caseAssessments)[0] ? {
        caseId: Object.keys(caseAssessments)[0],
        hasTotalImpacts: !!caseAssessments[Object.keys(caseAssessments)[0]]?.total_impacts,
        impactCount: caseAssessments[Object.keys(caseAssessments)[0]]?.total_impacts?.length || 0
      } : null
    })
  }, [caseAssessments])

  const updateComparativeCase = (slotIndex: number, caseId: string) => {
    setComparativeCases(prev =>
      prev.map((c, i) => i === slotIndex ? {...c, id: caseId} : c)
    )
  }

  const addComparativeSlot = () => {
    setComparativeCases(prev => [...prev, {id: "", slot: prev.length + 1}])
  }

  const removeComparativeSlot = (slotIndex: number) => {
    setComparativeCases(prev => prev.filter((_, i) => i !== slotIndex))
  }

  const canRunComparison =
    baseCaseId &&
    comparativeCases.filter(c => c.id).length >= 1 &&
    comparativeCases.filter(c => c.id).length <= 9 &&
    comparisonName.trim().length > 0

  const handleRunComparison = async () => {
    if (!canRunComparison) return

    const selectedIds = [baseCaseId, ...comparativeCases.filter(c => c.id).map(c => c.id)]

    try {
      await onRunComparison(comparisonName, selectedIds)
    } catch (error) {
      console.error('Error running comparison:', error)
    }
  }

  if (cases.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No cases available in this project. Create at least 2 cases to run comparisons.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Comparison Name Input */}
      <div className="space-y-2">
        <Label htmlFor="comparisonName" className="text-base font-semibold">
          Comparison Name
        </Label>
        <Input
          id="comparisonName"
          value={comparisonName}
          onChange={(e) => setComparisonName(e.target.value)}
          placeholder="Auto-generated (you can edit it)"
          className="text-base"
          disabled={isRunning}
        />
      </div>

      {/* CASES SECTION - Combined Base + Comparative Cases */}
      <div className="bg-white border-2 border-gray-300 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Select Cases to Compare</h3>
          {/* Add Case button hidden as per user request */}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
          {/* Base Case Card */}
          {baseCaseId && (
            <div className="relative h-full">
              <CaseMiniDashboardCard
                caseData={cases.find(c => c.id.toString() === baseCaseId)}
                assessmentData={caseAssessments[baseCaseId]}
                isBaseCase={true}
                showDropdown={false}
                isLoadingAssessment={loadingStates[baseCaseId] || false}
                assessmentError={assessmentErrors[baseCaseId]}
              />
            </div>
          )}

          {/* Comparative Cases Cards */}
          {comparativeCases.map((slot, index) => (
            <div key={slot.slot} className="relative h-full">
              <CaseMiniDashboardCard
                caseData={slot.id ? cases.find(c => c.id.toString() === slot.id) : null}
                assessmentData={slot.id ? caseAssessments[slot.id] : null}
                isBaseCase={false}
                showDropdown={true}
                slotNumber={index + 2}
                availableCases={cases.filter(c =>
                  c.id.toString() !== baseCaseId &&
                  !comparativeCases.some(comp => comp.id === c.id.toString() && comp.id !== slot.id)
                )}
                onCaseChange={(caseId) => updateComparativeCase(index, caseId)}
                onRemove={() => removeComparativeSlot(index)}
                isLoadingAssessment={slot.id ? (loadingStates[slot.id] || false) : false}
                assessmentError={slot.id ? assessmentErrors[slot.id] : undefined}
              />
            </div>
          ))}

          {comparativeCases.length === 0 && !baseCaseId && (
            <div className="col-span-full text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-2 text-gray-400" />
              <p>No cases available for comparison</p>
            </div>
          )}
        </div>
      </div>

      {/* Validation Messages */}
      {baseCaseId && comparativeCases.filter(c => c.id).length === 0 && (
        <Alert className="border-orange-500 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            Select at least 1 comparative case to run the comparison
          </AlertDescription>
        </Alert>
      )}

      {comparativeCases.filter(c => c.id).length > 9 && (
        <Alert className="border-red-500 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            Maximum 9 comparative cases allowed (10 total including base case)
          </AlertDescription>
        </Alert>
      )}

      {baseCaseId && comparativeCases.filter(c => c.id).length >= 1 && comparativeCases.filter(c => c.id).length <= 9 && (
        <Alert className="border-blue-200 bg-blue-50">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>{cases.find(c => c.id === baseCaseId)?.name}</strong> will be used as the baseline.
            All deltas and percentages will be calculated relative to this case.
          </AlertDescription>
        </Alert>
      )}

      {/* Compare Button */}
      <div className="flex justify-end pt-4 border-t">
        <Button
          onClick={handleRunComparison}
          disabled={!canRunComparison || isRunning}
          size="lg"
          className="min-w-[150px]"
        >
          {isRunning ? (
            <>
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Running...
            </>
          ) : (
            <>
              <BarChart3 className="mr-2 h-5 w-5" />
              Compare
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
