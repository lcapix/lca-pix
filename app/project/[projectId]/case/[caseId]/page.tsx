'use client'

// Case Editor — LCAPIX 3-pane IDE layout.
//
// This page is composition only. Data and behaviour live in hooks under
// lib/case-editor (fetching, selection, the edit form, save / delete /
// rescale / duplicate / run), and the markup in components/lcapix/case/editor
// (toolbar, status strip, outline, canvas pane, inspector pane). A redesign
// can replace the markup and keep the hooks.

import { useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

import { COMPONENT_TYPES } from '@/lib/case-editor/component-payload'
import { lessonStepNames } from '@/lib/case-editor/case-tree'
import { useCaseData } from '@/lib/case-editor/use-case-data'
import { useDuplicateCase } from '@/lib/case-editor/use-duplicate-case'
import { useEditorPanels } from '@/lib/case-editor/use-editor-panels'
import { useRunAssessment, useRunGate } from '@/lib/case-editor/use-run-assessment'
import { useEditForm } from '@/lib/case-editor/use-edit-form'
import { useCaseSelection, useCaseTree } from '@/lib/case-editor/use-case-selection'
import { useComponentActions } from '@/lib/case-editor/use-component-actions'

import { Breadcrumb } from '@/components/lcapix'
import type { CanvasView } from '@/components/lcapix/case'
import { GoalScopeCard } from '@/components/lcapix/case/goal-scope-card'
import { ScaleDialog } from '@/components/lcapix/case/scale-dialog'
import { CaseNameDialog } from '@/components/lcapix/case/case-name-dialog'
import { ISO_HELP } from '@/components/lcapix/iso-help'
import { ReferencePane } from '@/components/lcapix/case/reference-pane'
import { LessonRail } from '@/components/lcapix/case/lesson-rail'
import { CaseEditorLoading, CaseEditorNotFound } from '@/components/lcapix/case/editor/case-editor-states'
import { CaseToolbar } from '@/components/lcapix/case/editor/case-toolbar'
import { CaseStatusStrip } from '@/components/lcapix/case/editor/case-status-strip'
import { CaseOutline } from '@/components/lcapix/case/editor/case-outline'
import { CaseCanvasPane } from '@/components/lcapix/case/editor/case-canvas-pane'
import { CaseInspectorPane } from '@/components/lcapix/case/editor/case-inspector-pane'

export default function CaseViewPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = params.projectId as string
  const caseId = params.caseId as string
  // Deep-link target: the results page links each flow row to
  // ?component=<name> so "click a flow → edit its component" works.
  const preselectComponent = searchParams.get('component')
  // ?componentId=<id>: the same, by id (the old /component/:id/edit URL lands here).
  const preselectComponentId = searchParams.get('componentId')

  // ---------- Server data ----------
  const {
    currentCase,
    components,
    isLoading,
    refreshKey,
    refresh,
    reloadComponents,
    projectName,
    studyMethod,
    completeness,
    hasAssessment,
    topStep,
    hasComparableCase,
    learningState,
    hasWriteUp,
  } = useCaseData({ projectId, caseId, router })

  // Duplicate asks for the copy's name before creating it.
  const duplicate = useDuplicateCase({ projectId, caseId, router, currentCase, searchParams })

  // Guided lessons and the reference document beside the editor.
  const { learnOpen, setLearnOpen, referenceOpen, setReferenceOpen } = useEditorPanels()

  // ISO 14044 goal & scope + inventory: may this case run?
  const { goalScope, setGoalScope, goalOpenSignal, openGoalScope, fuMissing, canRun } =
    useRunGate(completeness)

  // ---------- UI state ----------
  const [canvasView, setCanvasView] = useState<CanvasView>('Tree')
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarQuery, setSidebarQuery] = useState('')

  // ---------- Selection, edit form, tree ----------
  const form = useEditForm()
  const { editFormData, patchForm } = form
  const { selectedNode, setSelectedNode, handleSelect } = useCaseSelection({
    components,
    loadFormFor: form.loadFormFor,
    setIsEditing: form.setIsEditing,
    preselectComponent,
    preselectComponentId,
  })
  const { tree, flat, filteredFlat, selectedFlatNode, selectedComponent, selectedRollup, parentOptions } =
    useCaseTree(components, selectedNode, sidebarQuery)

  // ---------- Actions ----------
  const { isRunning, handleRunAssessment } = useRunAssessment({
    projectId,
    caseId,
    router,
    canRun,
    fuMissing,
    openGoalScope,
  })
  const {
    handleCreateComponent,
    handleSaveComponent,
    handleApplyCosts,
    handleDeleteSelected,
    applyScale,
    cancelScale,
    pendingScale,
    handleGoalScopeSaved,
  } = useComponentActions({
    projectId,
    caseId,
    router,
    components,
    selectedNode,
    setSelectedNode,
    selectedComponent,
    form,
    reloadComponents,
    refresh,
  })

  // ---------- Render ----------
  if (isLoading) {
    return <CaseEditorLoading />
  }

  if (!currentCase) {
    return <CaseEditorNotFound onHome={() => router.push('/home')} />
  }

  return (
    <div
      className="app-shell"
      style={{
        // Fix the editor to the viewport below the 56px AppTopBar —
        // the page itself must NOT scroll. Each pane (left tree, center
        // canvas, right Inspector) scrolls internally so the bottom
        // details + right inspector stay reachable regardless of how
        // tall the process hierarchy gets.
        height: 'calc(100vh - 56px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Breadcrumb
        items={[
          { label: 'Projects', page: 'home' },
          {
            label: projectName || 'Project',
            onClick: () => router.push(`/project/${projectId}`),
          },
          { label: currentCase.name },
        ]}
      />

      <CaseToolbar
        canvasView={canvasView}
        onViewChange={setCanvasView}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onReset={() => {
          setSearchQuery('')
          setSidebarQuery('')
        }}
        learnOpen={learnOpen}
        onToggleLearn={() => setLearnOpen((v) => !v)}
        referenceOpen={referenceOpen}
        onToggleReference={() => setReferenceOpen((v) => !v)}
        onDuplicate={duplicate.openDuplicate}
        onRun={handleRunAssessment}
        isRunning={isRunning}
        canRun={canRun}
        fuMissing={fuMissing}
      />

      {completeness && (
        <CaseStatusStrip
          completeness={completeness}
          goalScopeLoaded={!!goalScope}
          fuMissing={fuMissing}
          canRun={canRun}
          hasAssessment={hasAssessment}
          isRunning={isRunning}
          onSetFunctionalUnit={openGoalScope}
          onAddInputs={() => router.push(`/project/${projectId}/import`)}
          onRun={handleRunAssessment}
          onViewResults={() => router.push(`/project/${projectId}/case/${caseId}/results`)}
          onAddDocument={() => router.push(`/project/${projectId}/import`)}
        />
      )}

      <CaseNameDialog
        open={duplicate.dupOpen}
        title="Duplicate this case"
        initialName={`${currentCase.name} (copy)`}
        confirmLabel="Duplicate"
        help={ISO_HELP.caseCopyName}
        busy={duplicate.dupBusy}
        error={duplicate.dupError}
        onCancel={duplicate.cancelDuplicate}
        onSubmit={duplicate.submitDuplicate}
      />

      <ScaleDialog
        pending={pendingScale}
        unit={components.find((c) => c.type === COMPONENT_TYPES.PRODUCT)?.massUnit}
        onChoose={applyScale}
        onCancel={cancelScale}
      />

      <GoalScopeCard
        key={`goal-scope-${refreshKey}`}
        projectId={projectId}
        caseId={caseId}
        openSignal={goalOpenSignal}
        onChange={setGoalScope}
        onSaved={handleGoalScopeSaved}
      />

      {learnOpen && (
        <LessonRail
          caseId={caseId}
          initialState={learningState}
          facts={{
            functionalUnitSet: !!goalScope && !fuMissing,
            layers: completeness?.present ?? [],
            hasRun: hasAssessment,
            hasComparableCase,
            hasWriteUp,
          }}
          steps={lessonStepNames(components)}
          topStep={topStep}
          onClose={() => setLearnOpen(false)}
        />
      )}

      {/* 3-pane */}
      <div
        className="case-panes"
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: referenceOpen
            ? '220px minmax(320px, 1fr) 340px 420px'
            : '220px minmax(400px, 1fr) 340px',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <CaseOutline
          query={sidebarQuery}
          onQueryChange={setSidebarQuery}
          items={filteredFlat}
          totalComponents={components.length}
          selectedId={selectedNode}
          onSelect={handleSelect}
          onAdd={handleCreateComponent}
        />

        <CaseCanvasPane
          tree={tree}
          flat={flat}
          selected={selectedNode}
          onSelect={handleSelect}
          view={canvasView}
          highlightQuery={searchQuery}
          onCreate={handleCreateComponent}
          selectedFlatNode={selectedFlatNode}
          totalComponents={components.length}
          rolled={selectedRollup}
        />

        <CaseInspectorPane
          node={selectedFlatNode}
          studyMethod={studyMethod}
          editFormData={selectedComponent ? editFormData : undefined}
          onChange={selectedComponent ? patchForm : undefined}
          onSave={selectedComponent ? () => handleSaveComponent() : undefined}
          onDelete={selectedComponent ? handleDeleteSelected : undefined}
          parentOptions={parentOptions}
          hasChildren={!!selectedRollup?.hasChildren}
          rolled={selectedRollup}
          onApplyCosts={selectedComponent ? handleApplyCosts : undefined}
        />

        {referenceOpen && (
          <ReferencePane caseId={caseId} onClose={() => setReferenceOpen(false)} />
        )}
      </div>
    </div>
  )
}
