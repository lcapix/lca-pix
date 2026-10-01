'use client'

// The active case's actions under the right rail: Run Assessment (gated by
// the CaseJourney readiness), Results, Rename and Delete.

import { Icon } from '@/components/lcapix'
import type { CaseRunReadiness } from '@/components/lcapix/case/case-journey'

export interface CaseActionsProps {
  activeCase: any | null
  projectId: string
  router: { push: (href: string) => void }
  isRunningAssessment: boolean
  activeReadiness: CaseRunReadiness | null
  onRun: () => void
  setRenameOpen: (open: boolean) => void
  handleDeleteCase: (caseId: string) => void
}

export function CaseActions({
  activeCase,
  projectId,
  router,
  isRunningAssessment,
  activeReadiness,
  onRun,
  setRenameOpen,
  handleDeleteCase,
}: CaseActionsProps) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        type="button"
        className="btn btn-primary"
        style={{ flex: 1, justifyContent: 'center' }}
        disabled={
          isRunningAssessment ||
          !activeCase ||
          (activeReadiness !== null && !activeReadiness.canRun)
        }
        title={activeReadiness?.canRun === false ? activeReadiness.reason ?? undefined : undefined}
        onClick={onRun}
      >
        <Icon name="run" size={14} />{' '}
        {isRunningAssessment ? 'Running…' : 'Run Assessment'}
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={!activeCase}
        onClick={() =>
          activeCase &&
          router.push(
            `/project/${projectId}/case/${activeCase.id}/results`,
          )
        }
      >
        Results
      </button>
      {activeCase && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setRenameOpen(true)}
          aria-label="Rename case"
          title="Rename case"
        >
          <Icon name="edit" size={14} />
        </button>
      )}
      {activeCase && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => handleDeleteCase(activeCase.id)}
          aria-label="Delete case"
          title="Delete case"
        >
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  )
}
