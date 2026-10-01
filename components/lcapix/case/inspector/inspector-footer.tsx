'use client'

// The inspector's sticky footer: Delete, the invalid-number notice, Save.

export function InspectorFooter({
  onSave,
  onDelete,
  saveBlocked,
  invalidNumbers,
  guardSave,
}: {
  onSave?: () => void
  onDelete?: () => void
  saveBlocked: boolean
  invalidNumbers: boolean
  /** Runs Save unless a typed number is invalid. */
  guardSave: (onSave: () => void) => void
}) {
  return (
    <div
      style={{
        padding: 16,
        borderTop: '1px solid var(--border-subtle)',
        marginTop: 'auto',
        display: 'flex',
        gap: 8,
        position: 'sticky',
        bottom: 0,
        background: 'var(--surface-base)',
      }}
    >
      {onDelete && (
        <button
          className="btn btn-ghost btn-sm"
          style={{ color: 'var(--signal-error)' }}
          type="button"
          onClick={onDelete}
        >
          Delete
        </button>
      )}
      <div style={{ flex: 1 }} />
      {saveBlocked && invalidNumbers && (
        <span role="alert" style={{ fontSize: 11, color: 'var(--signal-error)', alignSelf: 'center' }}>
          Fix the highlighted number first.
        </span>
      )}
      {onSave && (
        <button
          className="btn btn-primary btn-sm"
          type="button"
          onClick={() => guardSave(onSave)}
        >
          Save
        </button>
      )}
    </div>
  )
}
