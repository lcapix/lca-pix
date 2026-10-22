'use client'

import Link from 'next/link'

/**
 * Footer: where the text came from (an AI model, checked against the run, or
 * LCAPIX's own computation), then open the case editor, or close.
 */
export function MagicInsightsFooter({
  projectId,
  caseId,
  onClose,
  usingAI = false,
  aiModel = '',
}: {
  projectId: string
  caseId: string
  onClose: () => void
  /** The text on screen is the model's narration (it passed the number check). */
  usingAI?: boolean
  aiModel?: string
}) {
  const source = usingAI
    ? `Written by an AI model${aiModel ? ` (${aiModel})` : ''} from this run's figures · every number checked against the run · not stored`
    : 'Computed by LCAPIX from this run · not stored'
  return (
    <div
      style={{
        padding: '14px 24px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--surface-base)',
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, minWidth: 0, marginRight: 12 }}>
        {source}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Link href={`/project/${projectId}/case/${caseId}`} className="btn btn-secondary btn-sm">
          Open editor
        </Link>
        <button type="button" onClick={onClose} className="btn btn-primary btn-sm">
          Got it
        </button>
      </div>
    </div>
  )
}
