"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { useProjectStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, BarChart3, DollarSign, Zap, Leaf, Play, X, CheckCircle, TrendingUp, AlertCircle, Activity, Download, Share, Calendar, Clock, Users, Target } from "lucide-react"
import { toast } from "sonner"

// Impact categories supported (same as v2)
const IMPACT_CATEGORIES = {
  "Global warming": { unit: "kg CO2-eq", color: "text-red-600", icon: "🌍" },
  "Ozone depletion": { unit: "kg CFC-11-eq", color: "text-blue-600", icon: "🛡️" },
  "Smog formation": { unit: "kg NOx-eq", color: "text-orange-600", icon: "🌫️" },
  "Freshwater ecotoxicity": { unit: "CTUe", color: "text-cyan-600", icon: "🐟" },
  "Acidification": { unit: "kg SO2-eq", color: "text-purple-600", icon: "🌧️" }
}

// Driver-based impact factors (enhanced from v2)
const DRIVER_IMPACT_FACTORS: Record<string, Record<string, number>> = {
  "Electricity (kWh)": {
    "Global warming": 0.5,
    "Ozone depletion": 0.0000001,
    "Smog formation": 0.0002,
    "Acidification": 0.001
  },
  "Natural Gas (m³)": {
    "Global warming": 2.0,
    "Ozone depletion": 0.0000002,
    "Smog formation": 0.001,
    "Acidification": 0.003
  },
  "Steel (kg)": {
    "Global warming": 1.8,
    "Acidification": 0.005,
    "Freshwater ecotoxicity": 0.02
  },
  "Aluminum (kg)": {
    "Global warming": 8.2,
    "Acidification": 0.08,
    "Freshwater ecotoxicity": 0.15
  },
  "Plastic (kg)": {
    "Global warming": 1.9,
    "Ozone depletion": 0.0000005,
    "Smog formation": 0.005
  },
  "Truck Transport (tkm)": {
    "Global warming": 0.1,
    "Smog formation": 0.0008,
    "Acidification": 0.0003
  },
  "Rail Transport (tkm)": {
    "Global warming": 0.04,
    "Smog formation": 0.0002,
    "Acidification": 0.0001
  },
  "Process Water (L)": {
    "Freshwater ecotoxicity": 0.001
  },
  "Solid Waste (kg)": {
    "Global warming": 0.8,
    "Acidification": 0.002
  },
  "Hazardous Waste (kg)": {
    "Global warming": 1.5,
    "Freshwater ecotoxicity": 0.5,
    "Acidification": 0.01
  }
}

interface AssessmentResult {
  id: string
  impacts: Record<string, { value: number; unit: string }>
  costs: {
    operational: number
    capital: number
    total: number
  }
  categories: string[]
  createdAt: Date
  driverContributions: Array<{
    componentName: string
    driver: string
    impacts: Record<string, number>
    operationalCostUSD: number
    capitalCostUSD: number
  }>
}

export default function ResultsPage() {
  const params = useParams()
  const router = useRouter()
  const { projects } = useProjectStore()

  const projectId = params.projectId as string
  const caseId = params.caseId as string

  const project = projects.find((p) => p.id === projectId)
  const case_ = project?.cases.find((c) => c.id === caseId)

  // Assessment state (similar to v2)
  const [showOptions, setShowOptions] = useState(false)
  const [isRunningAssessment, setIsRunningAssessment] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [assessmentResults, setAssessmentResults] = useState<AssessmentResult[]>([])
  const [currentAssessment, setCurrentAssessment] = useState<AssessmentResult | null>(null)

  const assessmentOptions = Object.keys(IMPACT_CATEGORIES).map(category => ({
    label: category,
    checked: selectedCategories.includes(category)
  }))

  const anyOptionSelected = selectedCategories.length > 0

  if (!case_) {
    return <div>Case not found</div>
  }

  // Calculate impacts from component drivers (enhanced calculation)
  const calculateLCA = async (categories: string[]): Promise<AssessmentResult> => {
    const componentsWithDrivers = case_.components.filter((c) => 
      c.driverCategory && c.drivers && c.drivers.length > 0
    )
    
    // Calculate driver-based impacts
    const impactResults: Record<string, number> = {}
    const driverContributions: AssessmentResult['driverContributions'] = []

    // Initialize impact results for selected categories
    categories.forEach(category => {
      impactResults[category] = 0
    })

    componentsWithDrivers.forEach((component) => {
      const baseAmount = Math.random() * 10 + 5 // Random amount between 5-15 (simulating usage)
      
      component.drivers?.forEach((driver) => {
        const impacts: Record<string, number> = {}
        const driverFactors = DRIVER_IMPACT_FACTORS[driver] || {}
        
        categories.forEach(category => {
          const factor = driverFactors[category] || 0
          const impact = baseAmount * factor
          impacts[category] = impact
          impactResults[category] = (impactResults[category] || 0) + impact
        })
        
        driverContributions.push({
          componentName: component.name,
          driver,
          impacts,
          operationalCostUSD: component.operationalCostUSD || 0,
          capitalCostUSD: component.capitalCostUSD || 0
        })
      })
    })

    // Calculate total costs
    const totalOperationalCost = componentsWithDrivers.reduce(
      (sum, c) => sum + (c.operationalCostUSD || 0), 0
    )
    const totalCapitalCost = componentsWithDrivers.reduce(
      (sum, c) => sum + (c.capitalCostUSD || 0), 0
    )

    // Format impacts with units
    const impacts: Record<string, { value: number; unit: string }> = {}
    Object.entries(impactResults).forEach(([category, value]) => {
      impacts[category] = {
        value: parseFloat(value.toFixed(3)),
        unit: IMPACT_CATEGORIES[category as keyof typeof IMPACT_CATEGORIES].unit
      }
    })

    const result: AssessmentResult = {
      id: `assessment-${Date.now()}`,
      impacts,
      costs: {
        operational: totalOperationalCost,
        capital: totalCapitalCost,
        total: totalOperationalCost + totalCapitalCost
      },
      categories,
      createdAt: new Date(),
      driverContributions
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

  const handleRunAssessment = async () => {
    // Validation checks before assessment
    const componentsWithDrivers = case_.components.filter((c) => 
      c.driverCategory && c.drivers && c.drivers.length > 0
    )

    if (componentsWithDrivers.length === 0) {
      toast.error("No components with drivers found. Please configure drivers for your components first.")
      return
    }

    if (!anyOptionSelected) {
      setShowOptions(true)
      toast.error("Please select at least one impact category")
      return
    }

    setIsRunningAssessment(true)
    
    try {
      toast.success(`Starting assessment with ${componentsWithDrivers.length} components...`)
      
      // Simulate assessment time (like v2)
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const result = await calculateLCA(selectedCategories)
      
      // Store result (in v2 this goes to Firestore, here we store locally)
      setAssessmentResults(prev => [result, ...prev])
      setCurrentAssessment(result)
      
      // Reset UI state
      setShowOptions(false)
      setSelectedCategories([])
      
      toast.success(`Assessment completed! Analyzed ${componentsWithDrivers.length} components across ${selectedCategories.length} impact categories.`)
      
    } catch (error) {
      console.error("Assessment failed:", error)
      toast.error("Assessment failed. Please try again.")
    } finally {
      setIsRunningAssessment(false)
    }
  }

  const handleCancel = () => {
    setSelectedCategories([])
    setShowOptions(false)
  }

  const mostRecentAssessment = assessmentResults[0] || currentAssessment

  // Component readiness analysis
  const allComponents = case_.components || []
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
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
                  <p className="text-slate-600 dark:text-slate-400">{case_.name}</p>
                  <div className="flex items-center text-sm text-slate-500 dark:text-slate-400">
                    <Calendar className="h-3 w-3 mr-1" />
                    {new Date().toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="outline" size="sm" className="hidden sm:flex">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm" className="hidden sm:flex">
                <Share className="h-4 w-4 mr-2" />
                Share
              </Button>
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

        {/* Component Readiness Status */}
        <Card className={`mb-8 border-2 ${assessmentReady 
          ? 'border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10' 
          : 'border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10'
        } shadow-sm`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                {assessmentReady ? (
                  <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
                    <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                ) : (
                  <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-full">
                    <AlertCircle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                )}
                <div>
                  <h3 className={`text-xl font-bold ${assessmentReady ? 'text-green-900 dark:text-green-100' : 'text-orange-900 dark:text-orange-100'}`}>
                    {assessmentReady ? 'Ready for Assessment' : 'Setup Required'}
                  </h3>
                  <p className={`text-sm ${assessmentReady ? 'text-green-700 dark:text-green-300' : 'text-orange-700 dark:text-orange-300'}`}>
                    {assessmentReady 
                      ? `${componentsWithDrivers.length} of ${allComponents.length} components configured with environmental drivers`
                      : `${componentsWithoutDrivers.length} components need driver configuration to proceed`
                    }
                  </p>
                </div>
              </div>
              {!assessmentReady && (
                <Button
                  onClick={() => router.push(`/project/${projectId}/case/${caseId}`)}
                  className="bg-orange-600 hover:bg-orange-700 text-white shadow-md"
                >
                  <Target className="h-4 w-4 mr-2" />
                  Configure Components
                </Button>
              )}
            </div>
            
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Configuration Progress</span>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {componentsWithDrivers.length}/{allComponents.length} ({Math.round((componentsWithDrivers.length / allComponents.length) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${assessmentReady ? 'bg-green-600' : 'bg-orange-500'}`}
                  style={{ width: `${(componentsWithDrivers.length / allComponents.length) * 100}%` }}
                ></div>
              </div>
            </div>
            
            {!assessmentReady && componentsWithoutDrivers.length > 0 && (
              <div className="pt-4 border-t border-orange-200 dark:border-orange-800">
                <p className="text-sm font-medium text-orange-700 dark:text-orange-300 mb-3">Components requiring setup:</p>
                <div className="flex flex-wrap gap-2">
                  {componentsWithoutDrivers.slice(0, 6).map((component) => (
                    <Badge key={component.id} variant="outline" className="border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100 dark:border-orange-600 dark:text-orange-300 dark:bg-orange-900/20">
                      {component.name}
                    </Badge>
                  ))}
                  {componentsWithoutDrivers.length > 6 && (
                    <Badge variant="outline" className="border-orange-300 text-orange-700 bg-orange-50 dark:border-orange-600 dark:text-orange-300 dark:bg-orange-900/20">
                      +{componentsWithoutDrivers.length - 6} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

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
                disabled={isRunningAssessment || !assessmentReady}
                className={`flex-1 py-4 font-bold shadow-lg hover:shadow-xl transition-all ${
                  assessmentReady 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                size="lg"
              >
                {isRunningAssessment && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>}
                <Play className="h-5 w-5 mr-2" />
                {runButtonText}
              </Button>
              {!showOptions && assessmentReady && (
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
                              <span className="mr-2 text-lg">{info.icon}</span>
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
                        disabled={!anyOptionSelected || isRunningAssessment}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Run Assessment ({selectedCategories.length} categories)
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
                        <CardTitle className="text-sm flex items-center gap-3">
                          <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                            <span className="text-lg">{categoryInfo?.icon}</span>
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">{category}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{impact.unit}</div>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className={`text-3xl font-bold mb-2 ${categoryInfo?.color}`}>
                          {impact.value.toLocaleString()}
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                          <div className={`h-2 rounded-full bg-gradient-to-r ${categoryInfo?.color?.includes('red') ? 'from-red-400 to-red-600' : 
                            categoryInfo?.color?.includes('blue') ? 'from-blue-400 to-blue-600' :
                            categoryInfo?.color?.includes('orange') ? 'from-orange-400 to-orange-600' :
                            categoryInfo?.color?.includes('cyan') ? 'from-cyan-400 to-cyan-600' :
                            'from-purple-400 to-purple-600'}`} style={{ width: '75%' }}></div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>

            {/* Cost Results */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center">
                  <DollarSign className="h-6 w-6 mr-3 text-blue-600" />
                  Financial Impact Analysis
                </h2>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  USD Currency
                </Badge>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border-blue-200 shadow-sm hover:shadow-lg transition-all duration-300">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-3">
                      <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                        <Activity className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-blue-900 dark:text-blue-100">Operational Costs</div>
                        <div className="text-xs text-blue-600 dark:text-blue-400">Recurring expenses</div>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-3xl font-bold text-blue-700 dark:text-blue-300 mb-2">
                      ${mostRecentAssessment.costs.operational.toLocaleString()}
                    </div>
                    <div className="text-sm text-blue-600 dark:text-blue-400">Per operational period</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/10 dark:to-violet-900/10 border-purple-200 shadow-sm hover:shadow-lg transition-all duration-300">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-3">
                      <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                        <Zap className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-purple-900 dark:text-purple-100">Capital Costs</div>
                        <div className="text-xs text-purple-600 dark:text-purple-400">Initial investment</div>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-3xl font-bold text-purple-700 dark:text-purple-300 mb-2">
                      ${mostRecentAssessment.costs.capital.toLocaleString()}
                    </div>
                    <div className="text-sm text-purple-600 dark:text-purple-400">One-time expenditure</div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 border-green-200 shadow-sm hover:shadow-lg transition-all duration-300 ring-2 ring-green-200 dark:ring-green-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-3">
                      <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-green-900 dark:text-green-100">Total Cost</div>
                        <div className="text-xs text-green-600 dark:text-green-400">Combined investment</div>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-4xl font-bold text-green-700 dark:text-green-300 mb-2">
                      ${mostRecentAssessment.costs.total.toLocaleString()}
                    </div>
                    <div className="text-sm text-green-600 dark:text-green-400">Complete lifecycle cost</div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Driver Contributions */}
            {mostRecentAssessment.driverContributions.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center">
                    <Activity className="h-6 w-6 mr-3 text-indigo-600" />
                    Component Driver Analysis
                  </h2>
                  <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                    {mostRecentAssessment.driverContributions.length} drivers analyzed
                  </Badge>
                </div>
                
                <div className="grid gap-6">
                  {mostRecentAssessment.driverContributions.map((contribution, index) => {
                    const totalImpact = Object.values(contribution.impacts).reduce((sum, val) => sum + val, 0)
                    const maxImpact = Math.max(...Object.values(contribution.impacts))
                    
                    return (
                      <Card key={index} className="bg-white/60 backdrop-blur-sm border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300">
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-6">
                            <div className="flex items-start space-x-4">
                              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg">
                                <Activity className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                              </div>
                              <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{contribution.componentName}</h3>
                                <div className="flex items-center space-x-3">
                                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-800">
                                    {contribution.driver}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    Total Impact: {totalImpact.toFixed(3)}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                                  <div className="text-blue-600 dark:text-blue-400 font-semibold">Operational</div>
                                  <div className="text-blue-800 dark:text-blue-200 font-bold">${contribution.operationalCostUSD.toLocaleString()}</div>
                                </div>
                                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                                  <div className="text-purple-600 dark:text-purple-400 font-semibold">Capital</div>
                                  <div className="text-purple-800 dark:text-purple-200 font-bold">${contribution.capitalCostUSD.toLocaleString()}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Environmental Impact Breakdown</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                              {Object.entries(contribution.impacts).map(([category, value]) => {
                                if (value <= 0) return null
                                const categoryInfo = IMPACT_CATEGORIES[category as keyof typeof IMPACT_CATEGORIES]
                                const percentage = maxImpact > 0 ? (value / maxImpact) * 100 : 0
                                
                                return (
                                  <div key={category} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-lg">{categoryInfo?.icon}</span>
                                      <div className="text-right">
                                        <div className="text-lg font-bold text-slate-900 dark:text-white">{value.toFixed(4)}</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">{categoryInfo?.unit}</div>
                                      </div>
                                    </div>
                                    <div className="mb-2">
                                      <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{category}</div>
                                      <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2">
                                        <div 
                                          className={`h-2 rounded-full transition-all duration-500 bg-gradient-to-r ${categoryInfo?.color?.includes('red') ? 'from-red-400 to-red-600' : 
                                            categoryInfo?.color?.includes('blue') ? 'from-blue-400 to-blue-600' :
                                            categoryInfo?.color?.includes('orange') ? 'from-orange-400 to-orange-600' :
                                            categoryInfo?.color?.includes('cyan') ? 'from-cyan-400 to-cyan-600' :
                                            'from-purple-400 to-purple-600'}`}
                                          style={{ width: `${percentage}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                      {percentage.toFixed(1)}% of max
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )}
            
            {/* Assessment History */}
            {assessmentResults.length > 1 && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center">
                    <Clock className="h-6 w-6 mr-3 text-amber-600" />
                    Assessment History
                  </h2>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    {assessmentResults.length} assessments completed
                  </Badge>
                </div>
                
                <Card className="bg-white/60 backdrop-blur-sm border-slate-200/60 shadow-sm">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {assessmentResults.slice(1, 4).map((assessment, index) => (
                        <div key={assessment.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                          <div className="flex items-center space-x-4">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                              <BarChart3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white">
                                Assessment #{assessmentResults.length - index - 1}
                              </div>
                              <div className="text-sm text-slate-600 dark:text-slate-400">
                                {assessment.createdAt.toLocaleDateString()} • {assessment.categories.length} categories
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-green-600 dark:text-green-400">
                              ${assessment.costs.total.toLocaleString()}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Total Cost</div>
                          </div>
                        </div>
                      ))}
                      {assessmentResults.length > 4 && (
                        <div className="text-center pt-2">
                          <Badge variant="outline" className="text-slate-600">
                            +{assessmentResults.length - 4} more assessments
                          </Badge>
                        </div>
                      )}
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
                  Start your first LCA assessment to analyze environmental impacts and financial costs across your configured components.
                </p>
                <div className="space-y-3">
                  <Button 
                    onClick={() => setShowOptions(true)}
                    disabled={!assessmentReady}
                    className={`w-full py-4 font-semibold shadow-lg transition-all ${
                      assessmentReady 
                        ? 'bg-slate-800 hover:bg-slate-900 text-white hover:shadow-xl' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                    size="lg"
                  >
                    <Play className="h-5 w-5 mr-2" />
                    {assessmentReady ? 'Start LCA Assessment' : 'Configure Components First'}
                  </Button>
                  {!assessmentReady && (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Complete component setup to enable assessments
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}