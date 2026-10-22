'use client'

// A file to a project (F2.2, F2.2b, F2.3, F2.4, F2.6): Add a file, Check what
// we read, Saved. The server reads the file into a plan (steps, lines with
// match scores and named unit conversions, costs, notes, where every fact came
// from); you check it; Save makes or fills the case in one transaction. The
// review is the trust step: nothing is written before it.
//
// State, effects and actions live in useImport (lib/import/use-import.ts);
// this file composes the sections under ./_components.

import * as React from 'react'
import { use, useMemo } from 'react'
import { useRouter } from 'next/navigation'

import { AuthGuard } from '@/components/auth-guard'
import { useImport } from '@/lib/import/use-import'
import { remainingNoteCount, remainingReviewCount, rolesFor } from '@/lib/import/review'
import { droppedWithChildren, stepsAndHours } from '@/lib/import/steps-hours'
import { startEmptyCase } from '@/lib/project/start-empty'
import { useShellData } from '@/lib/shell/use-shell'

import { CostConflictsCard } from './_components/cost-conflicts-card'
import { CostsCard } from './_components/costs-card'
import { FlowConflictsCard } from './_components/flow-conflicts-card'
import { DoneCard } from './_components/done-card'
import { ErrorCard } from './_components/error-card'
import { FirstDocBanner } from './_components/first-doc-banner'
import { FlowsTable } from './_components/flows-table'
import { HierarchyCard } from './_components/hierarchy-card'
import { ImportHeader } from './_components/import-header'
import { NeedsReviewCard } from './_components/needs-review-card'
import { NotesList } from './_components/notes-list'
import { PickForm } from './_components/pick-form'
import { ProjectStatusCard } from './_components/project-status-card'
import { ReviewActions } from './_components/review-actions'
import { StepsHoursCard } from './_components/steps-hours-card'
import type { StepPicker } from './_components/step-cell'
import { UnmappedColumnsCard } from './_components/unmapped-columns-card'

export default function ImportPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const router = useRouter()
  const imp = useImport(projectId, router)
  const { phase, plan, targetCaseId, projectStatus, error, applied } = imp
  const { projects } = useShellData()
  const projectName = projects.find((p) => p.project_id === Number(projectId))?.project_name ?? null
  const targetName = targetCaseId !== null ? imp.projectCases.find((c) => c.case_id === targetCaseId)?.case_name ?? 'the case' : null
  const appending = targetCaseId !== null
  const reviewing = !!plan && (phase === 'review' || phase === 'applying')

  const stepPicker: StepPicker = {
    placement: imp.placement,
    placementWhy: imp.placementWhy,
    steps: imp.placeSteps,
    attachComponentId: imp.attachComponentId,
    newStep: imp.newStep,
    onChoose: imp.chooseStep,
  }

  const stepRows = useMemo(() => (plan ? stepsAndHours(plan) : []), [plan])
  // "Save 5 steps": the steps in the Steps and hours table that stay ticked;
  // a file with no such table counts every step it gave.
  const keptSteps = plan
    ? stepRows.length
      ? stepRows.filter((r) => !imp.droppedSteps.has(r.name)).length
      : plan.nodes.length - droppedWithChildren(plan.nodes, imp.droppedSteps).size
    : 0
  const savedLines = plan ? plan.flows.filter((_, i) => imp.edits[i]?.include).length : 0
  const saveLabel = appending
    ? `Save ${savedLines} ${savedLines === 1 ? 'line' : 'lines'} to ${targetName}`
    : `Save ${keptSteps} ${keptSteps === 1 ? 'step' : 'steps'} to a new case`
  const blocked = appending
    ? imp.appendWaiting
      ? 'Reading the steps of this case first'
      : imp.unplacedCount > 0
        ? `Place every line on a step first (${imp.unplacedCount} left)`
        : null
    : keptSteps === 0
      ? 'Keep at least one step'
      : null

  const title = phase === 'done' && applied ? `Saved to ${applied.case_name ?? targetName ?? 'the case'}` : reviewing ? 'Check what we read' : 'Add a file'
  const readByAi = imp.isLLM && !!imp.file && /\.(pdf|html?|txt)$/i.test(imp.file.name)

  const startEmpty = async () => {
    try {
      const id = await startEmptyCase(Number(projectId))
      router.push(`/project/${projectId}/case/${id}`)
    } catch {
      router.push(`/project/${projectId}`)
    }
  }

  return (
    <AuthGuard>
      <div className="np ip-scope">
        <div className="ip-bar" style={{ borderBottom: reviewing ? undefined : 0, paddingBottom: reviewing ? 18 : 0 }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <ImportHeader
              projectName={projectName}
              targetName={phase === 'done' && applied ? applied.case_name ?? targetName : targetName}
              title={title}
            />
            {reviewing && imp.file && (
              <p style={{ margin: '-10px 0 0', fontSize: 13, color: 'var(--ds-text-2)' }}>
                {imp.file.name} · {readByAi ? 'read by AI' : 'read from the spreadsheet'}
              </p>
            )}
          </div>
          {reviewing && (
            <ReviewActions applying={phase === 'applying'} saveLabel={saveLabel} blockedReason={blocked} onApply={imp.apply} onBack={imp.startOver} />
          )}
        </div>

        {error && (
          <ErrorCard
            error={error}
            idHints={imp.idHints}
            failure={phase === 'pick' ? imp.readFailure : null}
            onChooseAnother={() => imp.setFile(null)}
            onStartEmpty={targetCaseId === null ? startEmpty : undefined}
          />
        )}

        {(phase === 'pick' || phase === 'previewing') && imp.firstDoc && <FirstDocBanner />}

        {(phase === 'pick' || phase === 'previewing') && projectStatus && (projectStatus.present.length > 0 || projectStatus.missing.length > 0) && (
          <ProjectStatusCard projectStatus={projectStatus} />
        )}

        {(phase === 'pick' || phase === 'previewing') && (
          <PickForm
            connector={imp.connector}
            onConnectorChange={imp.setConnector}
            doc={imp.doc}
            isLLM={imp.isLLM}
            projectCases={imp.projectCases}
            targetCaseId={targetCaseId}
            onTargetCaseChange={imp.setTargetCaseId}
            attachComponentId={imp.attachComponentId}
            onAttachComponentChange={imp.setAttachComponentId}
            placeSteps={imp.placeSteps}
            file={imp.file}
            onFileChange={imp.setFile}
            plantId={imp.plantId}
            onPlantIdChange={imp.setPlantId}
            lotSize={imp.lotSize}
            onLotSizeChange={imp.setLotSize}
            previewing={phase === 'previewing'}
            onPreview={imp.preview}
            onDownloadTemplate={imp.downloadTemplate}
            readsLeft={imp.readsLeft}
            onBack={imp.goBack}
          />
        )}

        {plan && reviewing && (
          <>
            <div className="ip-bar" style={{ paddingTop: 0 }}>
              {!appending && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 260 }}>
                  <span className="edu-field-label">Case name</span>
                  <input className="edu-input" style={{ maxWidth: 360 }} value={imp.caseName} onChange={(e) => imp.setCaseName(e.target.value)} />
                </label>
              )}
              {appending && <span style={{ flex: 1 }} />}
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 15, fontWeight: 600 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
                Nothing is saved until you press Save.{appending ? '' : ' No case exists until then.'}
              </span>
            </div>

            <div className="ip-review">
              <div className="ip-review-side">
                <div className="ip-notice">
                  <strong style={{ display: 'block' }}>{readByAi ? 'Read by AI.' : 'Read from the spreadsheet.'}</strong>
                  {appending
                    ? 'Lines at 90% or more are ticked. Check the rest, then place every line on a step.'
                    : readByAi
                      ? 'Check every step before you save. Untick a step to leave it out.'
                      : 'Check every line before you save. Lines at 90% or more are ticked.'}
                </div>
                <HierarchyCard
                  nodes={plan.nodes}
                  costs={plan.costs}
                  appending={appending}
                  nodeEdits={imp.nodeEdits}
                  onNodeEdit={imp.setNodeEdit}
                  stepActions={imp.stepActions}
                  onStepAction={imp.chooseStepAction}
                  targetComponents={imp.targetComponents}
                />
                {remainingReviewCount(plan.review, imp.dismissedReview) > 0 && (
                  <NeedsReviewCard review={plan.review} dismissedReview={imp.dismissedReview} onDismiss={imp.dismissReview} />
                )}
                {remainingNoteCount(imp.unmappedColumns, imp.dismissedNotes) > 0 && (
                  <UnmappedColumnsCard
                    unmappedColumns={imp.unmappedColumns}
                    dismissedNotes={imp.dismissedNotes}
                    onDismiss={imp.dismissNote}
                    columnRoles={imp.columnRoles}
                    onRoleChange={imp.setColumnRole}
                    roles={rolesFor(imp.connector)}
                  />
                )}
                {remainingNoteCount(imp.plainNotes, imp.dismissedNotes) > 0 && (
                  <NotesList plainNotes={imp.plainNotes} dismissedNotes={imp.dismissedNotes} onDismiss={imp.dismissNote} />
                )}
              </div>

              <div className="ip-review-main">
                {!appending && stepRows.length > 0 && (
                  <StepsHoursCard rows={stepRows} dropped={imp.droppedSteps} onToggle={imp.toggleDropStep} unit="unit" />
                )}
                {(plan.flows.length > 0 || appending) && (
                  <FlowsTable
                    flows={plan.flows}
                    edits={imp.edits}
                    onEditFlow={imp.setFlowEdit}
                    connector={imp.connector}
                    appending={appending}
                    picker={stepPicker}
                    title={imp.connector === 'bom' ? 'Materials from the bill of materials' : 'Lines we read'}
                    intro={
                      appending
                        ? `Place each line on the step in ${targetName} that uses it. We placed the ones the file names a step for.`
                        : 'What each step takes in and gives out, matched to the library.'
                    }
                  />
                )}
                {plan.costs.length > 0 && <CostsCard costs={plan.costs} appending={appending} picker={stepPicker} />}
                {appending && <CostConflictsCard conflicts={imp.costClashes} modeOf={imp.costModeOf} onModeChange={imp.setCostMode} />}
                {appending && (
                  <FlowConflictsCard conflicts={imp.flowClashes} modeOf={imp.flowModeOf} onModeChange={imp.setFlowMode} loadError={imp.existingFlowsError} />
                )}
                {imp.connector === 'routing' && !appending && (
                  <div className="ip-info">
                    <span aria-hidden>ⓘ</span>
                    <span>A routing gives the steps and their hours. Add the bill of materials next for materials, and the equipment list for machine energy.</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {phase === 'done' && applied && (
          <DoneCard
            projectId={projectId}
            applied={applied}
            fileName={imp.file?.name ?? null}
            readByAi={readByAi}
            stepCount={applied.appended ? undefined : keptSteps}
            caseName={targetName}
            onAddAnother={imp.addAnotherDocument}
            onOpenCase={imp.openCase}
            onStartNew={imp.startNewCase}
          />
        )}
      </div>
    </AuthGuard>
  )
}
