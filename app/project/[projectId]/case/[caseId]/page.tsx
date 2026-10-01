'use client'

// Case Editor — LCAPIX 3-pane IDE layout.
// Phase LF.3: UI layer ported from LCAPIX/pages-app.jsx (CaseEditorPage).
// Business logic (fetch / save / delete / create / run-assessment) is
// preserved from the prior implementation.

import { useState, type ChangeEvent } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

import { COMPONENT_TYPES } from '@/lib/case-editor/component-payload'
import { lessonStepNames } from '@/lib/case-editor/case-tree'
import { runButtonTitle } from '@/lib/case-editor/run-assessment'
import { deriveCaseStatus } from '@/lib/case-editor/case-status'
import { useCaseData } from '@/lib/case-editor/use-case-data'
import { useDuplicateCase } from '@/lib/case-editor/use-duplicate-case'
import { useEditorPanels } from '@/lib/case-editor/use-editor-panels'
import { useRunAssessment, useRunGate } from '@/lib/case-editor/use-run-assessment'
import { useEditForm } from '@/lib/case-editor/use-edit-form'
import { useCaseSelection, useCaseTree } from '@/lib/case-editor/use-case-selection'
import { useComponentActions } from '@/lib/case-editor/use-component-actions'

import { Breadcrumb, Icon } from '@/components/lcapix'
import {
  TreeCanvas,
  NodeDetailsStrip,
  InspectorPanel,
  type CanvasView,
} from '@/components/lcapix/case'
import { HIERARCHY_TYPES } from '@/lib/lcapix-demo'
import { GoalScopeCard } from '@/components/lcapix/case/goal-scope-card'
import { PhaseStepper } from '@/components/lcapix/case/phase-stepper'
import { ScaleDialog } from '@/components/lcapix/case/scale-dialog'
import { CaseNameDialog } from '@/components/lcapix/case/case-name-dialog'
import { ISO_HELP } from '@/components/lcapix/iso-help'
import { ReferencePane } from '@/components/lcapix/case/reference-pane'
import { LessonRail } from '@/components/lcapix/case/lesson-rail'

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
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          color: 'var(--text-tertiary)',
          fontSize: 13,
        }}
      >
        Loading case...
      </div>
    )
  }

  if (!currentCase) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 600 }}>Case not found</div>
        <button className="btn btn-secondary btn-sm" onClick={() => router.push('/home')}>
          Return to Home
        </button>
      </div>
    )
  }

  // Flows for a selected component are loaded live by EnvironmentalFlowsEditor
  // inside InspectorPanel (GET /api/components/:id/flows). The `flows` prop is
  // only a read-only fallback for non-editable contexts, so it stays empty here.

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

      {/* Toolbar */}
      <div
        style={{
          padding: '12px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'var(--surface-base)',
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            gap: 4,
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            padding: 2,
          }}
        >
          {(() => {
            const tabs = ['Tree', 'List', 'Graph'] as CanvasView[]
            const activeIdx = tabs.indexOf(canvasView)
            const tabW = 100 / tabs.length
            return (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 2,
                  bottom: 2,
                  left: `calc(${activeIdx} * ${tabW}% + 2px)`,
                  width: `calc(${tabW}% - 4px)`,
                  background: 'var(--surface-overlay)',
                  borderRadius: 4,
                  transition: 'left 240ms cubic-bezier(0.2, 0.8, 0.2, 1), width 240ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                  boxShadow: '0 1px 3px rgba(15,23,42,0.08)',
                  zIndex: 0,
                }}
              />
            )
          })()}
          {(['Tree', 'List', 'Graph'] as CanvasView[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setCanvasView(v)}
              style={{
                position: 'relative',
                zIndex: 1,
                padding: '6px 12px',
                borderRadius: 4,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color:
                  canvasView === v ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontSize: 12,
                fontFamily: 'var(--font-ui)',
                fontWeight: canvasView === v ? 500 : 400,
                transition: 'color 200ms',
                flex: '1 0 auto',
                textAlign: 'center',
              }}
            >
              {v === 'Graph' ? 'Plot' : v}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            padding: '0 10px',
            height: 32,
            width: 280,
          }}
        >
          <Icon name="search" size={14} style={{ color: 'var(--text-tertiary)' }} />
          <input
            placeholder="Find substance, component, or flow…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: 12,
              flex: 1,
              fontFamily: 'var(--font-ui)',
            }}
          />
        </div>

        <button
          className="btn btn-secondary btn-sm"
          type="button"
          onClick={() => {
            setSearchQuery('')
            setSidebarQuery('')
          }}
        >
          <Icon name="refresh" size={14} /> Reset
        </button>
        <button
          className={learnOpen ? 'btn btn-primary btn-sm' : 'btn btn-toggle btn-sm'}
          type="button"
          title="Five short lessons that follow the ISO phases, done on this case"
          onClick={() => setLearnOpen((v) => !v)}
          aria-pressed={learnOpen}
        >
          <Icon name="target" size={14} /> Learn
        </button>
        <button
          className={referenceOpen ? 'btn btn-primary btn-sm' : 'btn btn-toggle btn-sm'}
          type="button"
          title="Open the document you are reading your quantities from"
          onClick={() => setReferenceOpen((v) => !v)}
          aria-pressed={referenceOpen}
        >
          <Icon name="file" size={14} /> Reference
        </button>
        <button
          className="btn btn-secondary btn-sm"
          type="button"
          title="Copy this case (tree, flows, costs) as a what-if with one change"
          onClick={duplicate.openDuplicate}
        >
          <Icon name="layers" size={14} /> Duplicate
        </button>
        <button
          className="btn btn-primary btn-sm"
          type="button"
          onClick={handleRunAssessment}
          disabled={isRunning || !canRun}
          title={runButtonTitle(fuMissing, canRun)}
        >
          <Icon name="run" size={14} /> {isRunning ? 'Running…' : 'Run Assessment'}
        </button>
      </div>

      {/* Status panel — the "where am I / what's blocking me / what's next"
          orientation for a classroom user. Journey phase stepper + a plain
          headline (blocked / ready / assessed) + the single next action + the
          missing-layer checklist. Run is still gated on canRun. */}
      {completeness &&
        (() => {
          // Phases reflect the data actually in the case: a run on half an
          // inventory shows Impact as partial, never a free tick.
          const { phases, partialRun, addedLabels, status, accent, missingPhrase, ...view } =
            deriveCaseStatus({
              completeness,
              goalScopeLoaded: !!goalScope,
              fuMissing,
              canRun,
              hasAssessment,
            })
          const primary = {
            label: view.primary.label,
            run: view.primary.run,
            onClick:
              view.primary.action === 'set-functional-unit'
                ? openGoalScope
                : view.primary.action === 'add-inputs'
                  ? () => router.push(`/project/${projectId}/import`)
                  : view.primary.action === 'run'
                    ? handleRunAssessment
                    : () => router.push(`/project/${projectId}/case/${caseId}/results`),
          }
          return (
            <div
              className="card"
              style={{ margin: '0 0 12px', padding: '12px 16px', borderLeft: `3px solid ${accent}` }}
            >
              {/* Phase stepper — restores the 5-phase orientation from project setup */}
              <div style={{ marginBottom: 10 }}>
                <PhaseStepper phases={phases} accent={accent} />
              </div>
              {/* Headline + what's blocking + the next action */}
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {status === 'blocked'
                      ? fuMissing
                        ? 'Blocked — functional unit not set'
                        : 'Blocked — nothing to assess yet'
                      : status === 'ready'
                        ? 'Ready to run'
                        : partialRun
                          ? 'Assessed on partial data'
                          : 'Assessed'}{' '}
                    <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>
                      · Data added: {addedLabels.length ? addedLabels.join(', ') : 'nothing yet'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {status === 'blocked' && fuMissing ? (
                      <>
                        Every result is reported per functional unit (for example per bike, or per
                        1,000 km of riding). Next: set it in Goal &amp; scope below.
                      </>
                    ) : status === 'blocked' ? (
                      <>
                        This case has no inputs or emissions, so an assessment would be 0.
                        Next: add a material or energy input to a process step.
                      </>
                    ) : status === 'ready' ? (
                      missingPhrase ? (
                        <>
                          You can run now (partial). To make it complete, next add{' '}
                          <strong>{missingPhrase}</strong>.
                        </>
                      ) : (
                        <>All the data is in. Next: run the assessment.</>
                      )
                    ) : missingPhrase ? (
                      <>
                        Results are in. To improve accuracy, add <strong>{missingPhrase}</strong>{' '}
                        and re-run. Otherwise, interpret your results.
                      </>
                    ) : (
                      <>Results are in and all the data is in. Next: interpret them.</>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={primary.onClick}
                  disabled={primary.run && isRunning}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {primary.run && isRunning ? 'Running…' : primary.label} →
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => router.push(`/project/${projectId}/import`)}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <Icon name="file" size={13} /> Add a document
                </button>
              </div>
              {/* Full missing checklist: goal & scope first, then inventory layers */}
              {(fuMissing || completeness.missing.length > 0) && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {fuMissing && (
                    <span className="chip" style={{ fontSize: 10.5 }}>
                      To add: Functional unit → Goal &amp; scope
                    </span>
                  )}
                  {completeness.missing.map((m) => (
                    <span
                      key={m.layer}
                      className="chip"
                      title={
                        m.suggestedDocs.length
                          ? `Comes from: ${m.suggestedDocs.join(' or ')}`
                          : 'No document type for this yet: enter it by hand on the step that uses it.'
                      }
                      style={{ fontSize: 10.5 }}
                    >
                      To add: {m.label}
                      {m.suggestedDocs.length ? ` → ${m.suggestedDocs[0]}` : ' (by hand)'}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

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
        {/* Left sidebar */}
        <aside
          className="case-sidebar"
          style={{
            borderRight: '1px solid var(--border-subtle)',
            background: 'var(--surface-sunken)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            minWidth: 0,
          }}
        >
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--surface-raised)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                padding: '0 10px',
                height: 30,
              }}
            >
              <Icon name="search" size={13} style={{ color: 'var(--text-tertiary)' }} />
              <input
                placeholder="Components"
                value={sidebarQuery}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setSidebarQuery(e.target.value)
                }
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  flex: 1,
                  fontFamily: 'var(--font-ui)',
                }}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '8px 6px' }}>
            {filteredFlat.length === 0 && (
              <div
                style={{
                  padding: 16,
                  fontSize: 12,
                  color: 'var(--text-tertiary)',
                  textAlign: 'center',
                }}
              >
                {components.length === 0
                  ? 'No components yet.'
                  : 'No components match that search.'}
              </div>
            )}
            {filteredFlat.map((n) => {
              const active = selectedNode === n.id
              const t = HIERARCHY_TYPES.find((h) => h.id === n.type)
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleSelect(n.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    paddingLeft: 8 + n.depth * 14,
                    border: 'none',
                    borderLeft:
                      '3px solid ' +
                      (active ? 'var(--brand-primary)' : 'transparent'),
                    background: active ? 'var(--surface-overlay)' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'var(--font-ui)',
                    borderRadius: 4,
                    marginBottom: 1,
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: 9,
                      color: t?.color,
                      background: 'oklch(from ' + t?.color + ' l c h / 0.15)',
                      width: 16,
                      height: 16,
                      borderRadius: 3,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                    }}
                  >
                    {t?.short}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                      flex: 1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {n.label}
                  </span>
                </button>
              )
            })}
          </div>

          <div
            style={{
              padding: 10,
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <button
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', justifyContent: 'center' }}
              type="button"
              onClick={handleCreateComponent}
            >
              <Icon name="plus" size={12} /> Add Component
            </button>
          </div>
        </aside>

        {/* Center canvas */}
        <section
          style={{
            background: 'var(--surface-sunken)',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            id="case-canvas-host"
            style={{ position: 'relative', flex: 1, overflow: 'hidden', minHeight: 0 }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage:
                  'radial-gradient(var(--border-subtle) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
                opacity: 0.5,
                pointerEvents: 'none',
              }}
            />
            {tree ? (
              <TreeCanvas
                root={tree}
                flat={flat}
                selected={selectedNode}
                onSelect={handleSelect}
                view={canvasView}
                highlightQuery={searchQuery}
              />
            ) : (
              <div
                style={{
                  padding: 48,
                  color: 'var(--text-tertiary)',
                  textAlign: 'center',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                <div style={{ fontSize: 14, marginBottom: 10 }}>
                  No components in this case yet.
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  onClick={handleCreateComponent}
                >
                  <Icon name="plus" size={12} /> Create your first component
                </button>
              </div>
            )}
          </div>
          <NodeDetailsStrip
            node={selectedFlatNode}
            totalComponents={components.length}
            rolled={selectedRollup}
            hasChildren={!!selectedRollup?.hasChildren}
          />
        </section>

        {/* Right inspector */}
        <aside
          className="case-inspector"
          style={{
            borderLeft: '1px solid var(--border-subtle)',
            background: 'var(--surface-base)',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          }}
        >
          <InspectorPanel
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
        </aside>

        {referenceOpen && (
          <ReferencePane caseId={caseId} onClose={() => setReferenceOpen(false)} />
        )}
      </div>
    </div>
  )
}
