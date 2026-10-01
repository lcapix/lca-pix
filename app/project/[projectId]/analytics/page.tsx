'use client'

// Phase LI.2 — Analytics page ported from LCAPIX/pages-misc.jsx (ComparePage).
// Real-data fetching (cases → assessments → run details → categories/components)
// is PRESERVED verbatim from the prior Phase 8 Veridian implementation. Only
// the visual layer is swapped for the LCAPIX prototype shape: head-to-head
// case cards, verdict card, GroupedBarChart, and component-diff table.
//
// Loading and actions live in useAnalytics, derivations in lib/analytics, and
// each section's markup in ./_components.

import { useParams, useSearchParams } from 'next/navigation'
import { useAnalytics } from '@/lib/analytics/use-analytics'
import { deriveAnalytics } from '@/lib/analytics/derive'
import {
  analyticsAuthErrorView,
  analyticsBreadcrumb,
  analyticsLoadingView,
} from './_components/analytics-views'
import { AnalyticsHeader } from './_components/analytics-header'
import { NoDataCard } from './_components/no-data-card'
import { CaseCards } from './_components/case-cards'
import { VerdictCard } from './_components/verdict-card'
import { CategoryComparisonPanel } from './_components/category-comparison-panel'
import { CostAnalysisPanel } from './_components/cost-analysis-panel'
import { DeltaChartPanel } from './_components/delta-chart-panel'
import { ComponentBreakdownPanel } from './_components/component-breakdown-panel'
import { ComponentDiffTable } from './_components/component-diff-table'

export default function AnalyticsPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const projectId = params.projectId as string
  const filterCaseId = searchParams.get('caseId')

  const {
    assessmentData,
    projectName,
    isLoading,
    authError,
    errorMessage,
    refetch,
    handleExportPDF,
    goToProject,
    goToLogin,
  } = useAnalytics(projectId, filterCaseId)

  // ——— Derivations ———

  const {
    baseCase,
    hasRealData,
    barGroups,
    barSeriesLabels,
    allComponentNames,
    bestComparison,
  } = deriveAnalytics(assessmentData)

  // ——— Render ———

  // The loading and auth-error views are plain functions, not components, so
  // React keeps reconciling their Breadcrumb and root div with the loaded
  // view's in place.
  if (isLoading) {
    return analyticsLoadingView({ projectName, onProjectClick: goToProject })
  }

  if (authError) {
    return analyticsAuthErrorView({
      projectName,
      onProjectClick: goToProject,
      errorMessage,
      onLogin: goToLogin,
    })
  }

  const hasNoData = !isLoading && assessmentData.length === 0

  return (
    <>
      {analyticsBreadcrumb(projectName, goToProject)}

      <div
        style={{
          padding: '24px 32px 80px',
          maxWidth: 1440,
          margin: '0 auto',
        }}
      >
        {/* Header */}
        <AnalyticsHeader
          projectName={projectName}
          caseCount={assessmentData.length}
          onBack={goToProject}
          onExportPDF={handleExportPDF}
        />

        {hasNoData ? (
          <NoDataCard errorMessage={errorMessage} onRetry={refetch} />
        ) : (
          <>
            {/* Head-to-head case cards */}
            <CaseCards assessmentData={assessmentData} baseCase={baseCase} />

            {/* Verdict */}
            {bestComparison && (
              <VerdictCard bestComparison={bestComparison} baseCase={baseCase} />
            )}

            {/* Category visualizations: radar + normalized comparison */}
            <CategoryComparisonPanel
              groups={barGroups}
              seriesLabels={barSeriesLabels}
              demo={!hasRealData}
            />

            {/* Cost analysis — cost breakdown + cost-vs-impact. Cost must appear
                in analytics, not just on the summary. */}
            {hasRealData && (
              <CostAnalysisPanel assessmentData={assessmentData} />
            )}

            {/* Delta vs baseline */}
            {hasRealData && assessmentData.length >= 2 && (
              <DeltaChartPanel
                groups={barGroups}
                seriesLabels={barSeriesLabels}
              />
            )}

            {/* Component contribution — stacked horizontal bar per scenario */}
            {allComponentNames.length > 0 && (
              <ComponentBreakdownPanel
                assessmentData={assessmentData}
                allComponentNames={allComponentNames}
              />
            )}

            {/* Component diff table */}
            {allComponentNames.length > 0 && (
              <ComponentDiffTable
                assessmentData={assessmentData}
                allComponentNames={allComponentNames}
                baseCase={baseCase}
              />
            )}
          </>
        )}
      </div>
    </>
  )
}
