'use client'

import { Icon } from '@/components/lcapix'
import { backLabel } from '@/lib/import/display'

/** Eyebrow, back link (to the target case or the project), title and intro. */
export function ImportHeader({
  targetCaseId,
  onBack,
}: {
  targetCaseId: number | null
  onBack: () => void
}) {
  return (
    <>
      <div className="eyebrow" style={{ fontSize: 11, marginBottom: 6 }}>
        DATA INGESTION
      </div>
      <button
        type="button"
        className="mono"
        onClick={() => onBack()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'transparent',
          border: 'none',
          padding: 0,
          marginBottom: 10,
          fontSize: 11,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
          cursor: 'pointer',
        }}
      >
        <Icon name="chevron-left" size={13} />
        {backLabel(targetCaseId)}
      </button>
      <h1 className="display" style={{ fontSize: 26, fontWeight: 600, margin: '0 0 6px' }}>
        Import a document
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: '0 0 24px', lineHeight: 1.55 }}>
        Upload a real document and review the extracted process model before anything is created.
        Every value keeps a pointer to where in the document it came from; nothing uncertain is
        applied silently.
      </p>
    </>
  )
}
