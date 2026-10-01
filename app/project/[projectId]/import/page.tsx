'use client'

// /project/[projectId]/import — document ingestion with a review gate.
//
// Upload a real document (DOE ITAC workbook for now) → the server returns an
// ingestion PLAN (tree, flows with match scores + named unit conversions,
// costs, needs-review list, provenance on every fact) → the user confirms or
// edits → apply creates the case atomically. The review screen is the trust
// mechanism: accuracy comes from the document, trust comes from showing the
// mapping before anything is written.
//
// State, effects and actions live in useImport (lib/import/use-import.ts);
// this file composes the sections under ./_components.

import * as React from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'

import { AuthGuard } from '@/components/auth-guard'
import { useImport } from '@/lib/import/use-import'
import { remainingNoteCount, remainingReviewCount, rolesFor } from '@/lib/import/review'

import { AppendBanner } from './_components/append-banner'
import { CaseNameCard } from './_components/case-name-card'
import { CostsCard } from './_components/costs-card'
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
import { SampleDialog } from './_components/sample-dialog'
import type { StepPicker } from './_components/step-cell'
import { UnmappedColumnsCard } from './_components/unmapped-columns-card'

export default function ImportPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const router = useRouter()
  const imp = useImport(projectId, router)
  const { phase, plan, targetCaseId, projectStatus, error, applied, sampleView } = imp

  const stepPicker: StepPicker = {
    placement: imp.placement,
    placementWhy: imp.placementWhy,
    steps: imp.placeSteps,
    attachComponentId: imp.attachComponentId,
    onChoose: imp.chooseStep,
  }

  return (
    <AuthGuard>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px 64px' }}>
        <ImportHeader targetCaseId={targetCaseId} onBack={imp.goBack} />

        {error && (
          <ErrorCard error={error} idHints={imp.idHints} />
        )}

        {(phase === 'pick' || phase === 'previewing') && imp.firstDoc && (
          <FirstDocBanner />
        )}

        {(phase === 'pick' || phase === 'previewing') &&
          projectStatus &&
          (projectStatus.present.length > 0 || projectStatus.missing.length > 0) && (
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
            onLoadSample={imp.loadSample}
            onViewSample={imp.viewSample}
            onDownloadTemplate={imp.downloadTemplate}
          />
        )}

        {plan && (phase === 'review' || phase === 'applying') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {targetCaseId !== null && (
              <AppendBanner unplacedCount={imp.unplacedCount} />
            )}
            {targetCaseId === null && (
              <CaseNameCard caseName={imp.caseName} onCaseNameChange={imp.setCaseName} />
            )}

            <HierarchyCard nodes={plan.nodes} appending={targetCaseId !== null} />

            <FlowsTable
              flows={plan.flows}
              edits={imp.edits}
              onEditFlow={imp.setFlowEdit}
              connector={imp.connector}
              appending={targetCaseId !== null}
              picker={stepPicker}
            />

            {plan.costs.length > 0 && (
              <CostsCard costs={plan.costs} appending={targetCaseId !== null} picker={stepPicker} />
            )}

            {remainingReviewCount(plan.review, imp.dismissedReview) > 0 && (
              <NeedsReviewCard
                review={plan.review}
                dismissedReview={imp.dismissedReview}
                onDismiss={imp.dismissReview}
              />
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
              <NotesList
                plainNotes={imp.plainNotes}
                dismissedNotes={imp.dismissedNotes}
                onDismiss={imp.dismissNote}
              />
            )}

            <ReviewActions
              applying={phase === 'applying'}
              appending={targetCaseId !== null}
              unplacedCount={imp.unplacedCount}
              onApply={imp.apply}
              onStartOver={imp.startOver}
            />
          </div>
        )}

        {phase === 'done' && applied && (
          <DoneCard
            applied={applied}
            completeness={imp.completeness}
            onAddAnother={imp.addAnotherDocument}
            onOpenCase={imp.openCase}
            onStartNew={imp.startNewCase}
          />
        )}
      </div>

      {/* The sample document itself, so nobody has to guess what is ingested. */}
      {sampleView && (
        <SampleDialog
          sampleView={sampleView}
          onClose={imp.closeSample}
          onLoad={imp.loadSample}
          onDownload={imp.downloadSample}
          onCopy={imp.copySample}
        />
      )}
    </AuthGuard>
  )
}
