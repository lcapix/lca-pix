'use client'

// What the case editor shows before it has a case: the first load, and a
// case that could not be loaded.

export function CaseEditorLoading() {
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

export function CaseEditorNotFound({ onHome }: { onHome: () => void }) {
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
      <button className="btn btn-secondary btn-sm" onClick={onHome}>
        Return to Home
      </button>
    </div>
  )
}
