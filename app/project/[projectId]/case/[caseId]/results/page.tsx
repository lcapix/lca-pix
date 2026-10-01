'use client'

// Results page: the case's latest run — total impact and contributors per
// category, the ISO 14044 summary, life-cycle stages, the author's write-up,
// data-quality warnings, the flow-level detail and the run history.
// Data and actions live in lib/results/use-results.ts, derivations in
// lib/results/results-view.ts and lib/results/run-math.ts; the sections are in
// components/lcapix/results/.

import { useParams, useRouter } from 'next/navigation'

import { RunAssessmentModal } from '@/components/assessments/run-assessment-modal'
import { Breadcrumb } from '@/components/lcapix'
import { WriteUpCard } from '@/components/lcapix/case/write-up-card'
import { MagicInsightsModal } from '@/components/lcapix/magic-insights-modal'
import { IsoRunSummary } from '@/components/lcapix/results/iso-run-summary'
import { StagePanel } from '@/components/lcapix/results/stage-panel'
import { fmtSig } from '@/components/lcapix/formatters'
import { caseNotFoundView, resultsLoadingView } from '@/components/lcapix/results/results-states'
import { ResultsHeader } from '@/components/lcapix/results/results-header'
import { DashboardHero } from '@/components/lcapix/results/dashboard-hero'
import { NextStepsBar } from '@/components/lcapix/results/next-steps-bar'
import { DataQualityWarnings } from '@/components/lcapix/results/data-quality-warnings'
import { FlowTable } from '@/components/lcapix/results/flow-table'
import { HistoricalRunsCard } from '@/components/lcapix/results/historical-runs-card'
import { useResults } from '@/lib/results/use-results'
import { deltaVsPreviousRun, initialRunScope, rankContributors } from '@/lib/results/run-math'
import {
  IMPACT_CATEGORIES,
  buildCategoryItems,
  flowTableRows,
  historyTimelineRuns,
  lastRunLabel,
  primaryCategoryKey,
  stagePanelInput,
} from '@/lib/results/results-view'
import { realCaseCost } from '@/lib/results/insights-inputs'

export default function ResultsPage() {
  const params = useParams()
  const router = useRouter()

  const projectId = params.projectId as string
  const caseId = params.caseId as string

  const {
    currentCase,
    projectName,
    isLoadingCase,
    caseLoadError,
    assessmentsError,
    caseRegion,
    isRunningAssessment,
    assessmentResults,
    assessOpen,
    setAssessOpen,
    magicOpen,
    setMagicOpen,
    flagshipGlow,
    magicPulse,
    setMagicPulse,
    activeCategoryKey,
    setActiveCategoryKey,
    pickedMethod,
    setPickedMethod,
    pickedRegion,
    setPickedRegion,
    flowFilter,
    setFlowFilter,
    writeUp,
    studyMethod,
    studyRegion,
    mostRecentAssessment,
    insightsBreakdown,
    insightsMaterials,
    insightsStepCosts,
    exporting,
    handleExport,
    handleRunAssessment,
    handleAssessmentCompleted,
  } = useResults(projectId, caseId)

  // Loading state
  if (isLoadingCase) {
    return resultsLoadingView()
  }

  // Case not found
  if (!currentCase) {
    return caseNotFoundView({ caseLoadError, router })
  }

  // What a re-run starts from (RUN-5): the displayed run, else the study's
  // method and the case's (then the project's) region. Unknown stays unset so
  // the run modal applies its own lookup instead of a hard-coded US grid.
  const runScope = initialRunScope({
    latestRun: mostRecentAssessment,
    caseRegion,
    projectRegion: studyRegion,
    studyMethod,
  })
  const method = pickedMethod ?? runScope.method ?? 'CML 2001'
  const region = pickedRegion ?? runScope.region ?? 'Global'

  // Category items for the hero's categories list. Prefer real data, fall
  // back to the canonical IMPACT_CATEGORIES ordering.
  const impactCount = mostRecentAssessment ? Object.keys(mostRecentAssessment.impacts).length : 0
  const categoryItems = buildCategoryItems(mostRecentAssessment)

  // Default active category — primary (global-warming-ish) if possible.
  const activeKey = activeCategoryKey ?? primaryCategoryKey(categoryItems)
  const activeCat = categoryItems.find((c) => c.key === activeKey) ?? categoryItems[0]

  // Contributors to the active category (RES-4): credits stay in, ranked by
  // size, each share of the sum of absolute step values.
  const contributors =
    mostRecentAssessment && activeCat
      ? rankContributors(mostRecentAssessment.componentBreakdown || [], activeCat.key)
      : []
  // "No contributors yet" is for a case with no run at all; a run whose steps
  // carry nothing in this category says so differently.
  const usingDemoContributors = !mostRecentAssessment

  // Flow table — real per-flow rows for the active category, filtered by the
  // input/output toggle. Empty when the active category has no driver flows.
  const flowRows = flowTableRows(mostRecentAssessment, activeCat, flowFilter)
  // The region the displayed run was computed with (not the selector, which
  // only sets the next run), so "Global (fallback)" describes that run.
  const runRegion = mostRecentAssessment?.regionCode ?? region

  // Historical runs — every real run with a value in the active category. 0
  // runs → empty timeline + empty state; never demo runs.
  const historyRuns = historyTimelineRuns(assessmentResults, activeCat)

  // KPIs — real component + category counts.
  const allComponents = currentCase.components || []
  // Real case cost = the component cost columns (what the case-page Cost summary
  // shows). The assessment RUN has no cost fields, so mostRecentAssessment.costs
  // is always zero — feeding THAT to Magic Insights made it report "no costs"
  // even when the case clearly has them. Sum the real component columns instead.
  const caseCost = realCaseCost(allComponents)
  const activeCategoriesCount = impactCount || Object.keys(IMPACT_CATEGORIES).length

  const totalImpactDisplay = activeCat ? fmtSig(activeCat.value) : '—'

  // Breadcrumb: Projects → <project> → Results. The case name sits on the
  // page title row instead of a breadcrumb level.
  const breadcrumbItems = [
    { label: 'Projects', page: 'home' },
    {
      label: projectName || 'Project',
      onClick: () => router.push(`/project/${projectId}`),
    },
    { label: 'Results' },
  ]

  // Where the impact falls across the product's life cycle.
  const stage = mostRecentAssessment ? stagePanelInput(mostRecentAssessment) : null

  return (
    <div className="app-shell" style={{ minHeight: '100vh' }}>
      <Breadcrumb items={breadcrumbItems} />

      <div style={{ padding: '24px 32px 80px', maxWidth: 1440, margin: '0 auto' }}>
        {/* Header */}
        <ResultsHeader
          currentCase={currentCase}
          mostRecentAssessment={mostRecentAssessment}
          assessmentsError={assessmentsError}
          method={method}
          region={region}
          setPickedMethod={setPickedMethod}
          setPickedRegion={setPickedRegion}
          exporting={exporting}
          handleExport={handleExport}
          magicPulse={magicPulse}
          setMagicPulse={setMagicPulse}
          setMagicOpen={setMagicOpen}
          handleRunAssessment={handleRunAssessment}
          isRunningAssessment={isRunningAssessment}
        />

        {/* Hero dashboard — total impact · contributors · all categories */}
        <DashboardHero
          activeCat={activeCat}
          totalImpactDisplay={totalImpactDisplay}
          flagshipGlow={flagshipGlow}
          contributors={contributors}
          usingDemoContributors={usingDemoContributors}
          categoryItems={categoryItems}
          activeKey={activeKey}
          onSelectCategory={setActiveCategoryKey}
          // Δ vs the previous run with the same method and region (RES-2).
          deltaPct={activeCat ? deltaVsPreviousRun(assessmentResults, activeCat.key) : null}
          methodLabel={mostRecentAssessment?.calculation_method || 'CML 2001'}
          activeCategoriesCount={activeCategoriesCount}
          componentsAssessed={allComponents.length}
          lastRunLabel={lastRunLabel(mostRecentAssessment)}
        />

        {/* Where a first-time user goes next, in one line. */}
        {mostRecentAssessment && (
          <NextStepsBar projectId={projectId} caseId={caseId} setMagicOpen={setMagicOpen} />
        )}

        {/* ISO 14044: goal & scope, per-functional-unit results, data quality */}
        {mostRecentAssessment && (
          <IsoRunSummary
            goalScope={mostRecentAssessment.goalScope}
            dataQuality={mostRecentAssessment.dataQuality}
            impacts={mostRecentAssessment.impacts}
            editHref={`/project/${projectId}/case/${caseId}`}
          />
        )}

        {/* Where the impact falls across the product's life, and whether the
            study covers the boundary it declares. */}
        {mostRecentAssessment &&
          (stage ? (
            <StagePanel
              categoryName={stage.categoryName}
              unit={stage.unit}
              rows={stage.rows}
              boundary={mostRecentAssessment.goalScope?.system_boundary ?? null}
              editHref={`/project/${projectId}/case/${caseId}`}
            />
          ) : null)}

        {/* The part only the author can write; both print in the report. */}
        {mostRecentAssessment && (
          <WriteUpCard
            caseId={caseId}
            initialInterpretation={writeUp.interpretation}
            initialAssumptions={writeUp.assumptions}
            initialFinal={writeUp.isFinal}
          />
        )}

        {/* Data-quality warnings frozen in the run snapshot */}
        {(mostRecentAssessment?.warnings?.length ?? 0) > 0 && (
          <DataQualityWarnings warnings={mostRecentAssessment!.warnings!} />
        )}

        {/* Row 3 — Flow table */}
        <FlowTable
          flowRows={flowRows}
          flowFilter={flowFilter}
          setFlowFilter={setFlowFilter}
          router={router}
          projectId={projectId}
          caseId={caseId}
          runRegion={runRegion}
          mostRecentAssessment={mostRecentAssessment}
          activeCat={activeCat}
        />

        {/* Historical runs */}
        <HistoricalRunsCard historyRuns={historyRuns} handleRunAssessment={handleRunAssessment} />
      </div>

      <RunAssessmentModal
        open={assessOpen}
        onClose={() => setAssessOpen(false)}
        caseId={Number(caseId)}
        onCompleted={handleAssessmentCompleted}
        initialMethod={pickedMethod ?? runScope.method}
        initialRegion={pickedRegion ?? runScope.region}
      />

      <MagicInsightsModal
        open={magicOpen}
        onClose={() => setMagicOpen(false)}
        caseName={currentCase?.name ?? 'this case'}
        method={mostRecentAssessment?.calculation_method ?? 'CML 2001'}
        impacts={mostRecentAssessment?.impacts}
        componentBreakdown={insightsBreakdown}
        materialBreakdown={insightsMaterials}
        totalCost={caseCost > 0 ? caseCost : undefined}
        stepCosts={insightsStepCosts}
        initialCategory={activeKey}
        projectId={projectId}
        caseId={caseId}
      />
    </div>
  )
}
