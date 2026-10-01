'use client'

// Where a first-time user goes next, in one line: what drives the result,
// duplicate and change one thing, compare cases.

import Link from 'next/link'

export function NextStepsBar({
  projectId,
  caseId,
  setMagicOpen,
}: {
  projectId: string
  caseId: string
  setMagicOpen: (open: boolean) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        padding: '10px 14px',
        marginBottom: 20,
        borderRadius: 8,
        border: '1px solid var(--border-subtle)',
        background: 'var(--surface-raised)',
        fontSize: 12.5,
        color: 'var(--text-secondary)',
      }}
    >
      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Next</span>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setMagicOpen(true)}
        title="A plain-language read of what drives this result"
      >
        See what drives it
      </button>
      {/* Opens the case editor's Duplicate dialog (RES-6). */}
      <Link href={`/project/${projectId}/case/${caseId}?duplicate=1`} className="btn btn-ghost btn-sm">
        Duplicate and change one thing
      </Link>
      <Link href={`/project/${projectId}/comparison`} className="btn btn-ghost btn-sm">
        Compare cases
      </Link>
      <span style={{ color: 'var(--text-tertiary)' }}>or export the report above.</span>
    </div>
  )
}
