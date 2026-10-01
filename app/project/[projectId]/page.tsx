'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/lcapix'
import { CaseJourney, type CaseRunReadiness } from '@/components/lcapix/case/case-journey'
import { CaseNameDialog } from '@/components/lcapix/case/case-name-dialog'
import { ProjectHeader } from '@/components/lcapix/project/project-header'
import { WorkspaceKpis } from '@/components/lcapix/project/workspace-kpis'
import { ComparisonBanner } from '@/components/lcapix/project/comparison-banner'
import { CaseTabs } from '@/components/lcapix/project/case-tabs'
import { CaseDescription } from '@/components/lcapix/project/case-description'
import { CaseTreePanel } from '@/components/lcapix/project/case-tree-panel'
import { ImpactOverviewCard } from '@/components/lcapix/project/impact-overview-card'
import { TopContributorsCard } from '@/components/lcapix/project/top-contributors-card'
import { CostSummaryCard } from '@/components/lcapix/project/cost-summary-card'
import { CaseActions } from '@/components/lcapix/project/case-actions'
import { HierarchyDialog } from '@/components/lcapix/project/hierarchy-dialog'
import { useProject } from '@/lib/project/use-project'
import { useProjectActions } from '@/lib/project/use-project-actions'
import { useHierarchyDialog } from '@/lib/project/use-hierarchy-dialog'
import { workspaceView } from '@/lib/project/workspace'

// NOTE: AuthGuard + top nav are provided by app/project/layout.tsx
// (AuthGuard → AppShell). Do not render AppTopBar here or we get a
// duplicate top nav.

// Number of impact categories the methodology reports — kept in sync with the
// results page's IMPACT_CATEGORIES (Global warming, Ozone depletion, Smog
// formation, Freshwater ecotoxicity, Acidification). Was hardcoded to 6 here,
// which disagreed with the results page (5) and looked like inconsistent data.

export default function ProjectPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  // Project + cases, the active case's tree and its latest run (lib/project).
  const {
    project,
    setProject,
    isLoading,
    activeCaseId,
    setActiveCaseId,
    caseTree,
    selectedTreeNode,
    setSelectedTreeNode,
    isLoadingCaseTree,
    caseImpact,
  } = useProject(projectId, router)
  const actions = useProjectActions({ projectId, router, project, setProject, activeCaseId, setActiveCaseId })
  // Same run gate as the case editor (functional unit + at least one input or
  // emission), reported by the CaseJourney block for the selected case.
  const [activeReadiness, setActiveReadiness] = useState<CaseRunReadiness | null>(null)
  // Tree Modal State (preserved from previous implementation)
  const hierarchy = useHierarchyDialog()

  if (isLoading || !project) {
    return (
      <div
        className="app-shell"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: '2px solid var(--border-subtle)',
              borderTopColor: 'var(--brand-primary)',
              borderRadius: '50%',
              margin: '0 auto 16px',
              animation: 'spin 1s linear infinite',
            }}
          />
          <h2 className="title" style={{ fontSize: 16 }}>
            Loading project...
          </h2>
        </div>
      </div>
    )
  }

  const {
    cases,
    baseCases,
    comparativeCases,
    activeCase,
    projectTypeLabel,
    assessed,
    totalImpact,
    impactUnit,
    componentCount,
    driverCount,
    contributors,
    showComparisonBanner,
    kpis,
  } = workspaceView(project, activeCaseId, caseImpact)

  return (
    <div className="app-shell">
      <Breadcrumb
        items={[
          { label: 'Projects', page: 'home' },
          { label: project.name || 'Project' },
        ]}
      />

      <div style={{ padding: '24px 32px 80px', maxWidth: 1440, margin: '0 auto' }}>
        {/* Project header card */}
        <ProjectHeader
          project={project}
          projectId={projectId}
          projectTypeLabel={projectTypeLabel}
          activeCase={activeCase}
          cases={cases}
          router={router}
          onAddCase={actions.handleAddCase}
          onDeleteProject={actions.handleDeleteProject}
        />

        {/* Mini-dashboard KPI strip */}
        <WorkspaceKpis kpis={kpis} />

        {/* Comparison banner */}
        {showComparisonBanner && (
          <ComparisonBanner cases={cases} baseCases={baseCases} comparativeCases={comparativeCases} />
        )}

        {/* Case tabs — base card (fixed) + COMP card with case toggle */}
        <CaseTabs
          baseCases={baseCases}
          comparativeCases={comparativeCases}
          activeCaseId={activeCaseId}
          onSelect={(id) => setActiveCaseId(id)}
          onAdd={actions.handleAddCase}
        />

        {/* Active case description — what this scenario actually represents */}
        {activeCase?.description && <CaseDescription activeCase={activeCase} />}

        {/* Two-pane */}
        <div
          style={{
            marginTop: 20,
            display: 'grid',
            gridTemplateColumns: '1.5fr 1fr',
            gap: 16,
          }}
        >
          {/* Left: case tree */}
          <CaseTreePanel
            project={project}
            projectId={projectId}
            activeCase={activeCase}
            caseTree={caseTree}
            selectedTreeNode={selectedTreeNode}
            setSelectedTreeNode={setSelectedTreeNode}
            isLoadingCaseTree={isLoadingCaseTree}
            caseImpact={caseImpact}
            router={router}
            openTreeModal={hierarchy.openTreeModal}
            onCloneFromBase={actions.handleCloneFromBase}
          />

          {/* Right: stacked cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ImpactOverviewCard
              assessed={assessed}
              caseImpact={caseImpact}
              project={project}
              totalImpact={totalImpact}
              impactUnit={impactUnit}
              componentCount={componentCount}
              driverCount={driverCount}
            />

            <TopContributorsCard contributors={contributors} cases={cases} />

            <CostSummaryCard caseImpact={caseImpact} />

            {/* Where this case is in the ISO journey + what it already has */}
            {activeCase && (
              <CaseJourney
                key={activeCase.id}
                projectId={projectId}
                caseId={activeCase.id}
                onReadiness={setActiveReadiness}
              />
            )}

            <CaseActions
              activeCase={activeCase}
              projectId={projectId}
              router={router}
              isRunningAssessment={actions.isRunningAssessment}
              activeReadiness={activeReadiness}
              onRun={() => actions.handleRunAssessment(activeCase)}
              setRenameOpen={actions.setRenameOpen}
              handleDeleteCase={actions.handleDeleteCase}
            />
          </div>
        </div>
      </div>

      <CaseNameDialog
        open={actions.renameOpen && !!activeCase}
        title="Rename case"
        initialName={activeCase?.name ?? ''}
        confirmLabel="Rename"
        busy={actions.renameBusy}
        error={actions.renameError}
        onCancel={actions.cancelRename}
        onSubmit={(name) => activeCase && actions.handleRenameCase(activeCase.id, name)}
      />

      {/* Tree Visualization Modal — preserved verbatim from prior page */}
      <HierarchyDialog state={hierarchy} />
    </div>
  )
}
