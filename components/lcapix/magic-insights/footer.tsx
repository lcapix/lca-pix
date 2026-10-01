'use client'

import Link from 'next/link'

/** Footer actions: open the case editor, or close. */
export function MagicInsightsFooter({
  projectId,
  caseId,
  onClose,
}: {
  projectId: string
  caseId: string
  onClose: () => void
}) {
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
      <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
        Generated locally · not stored
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
