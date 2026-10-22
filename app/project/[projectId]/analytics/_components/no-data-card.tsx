'use client'

// Empty state of the analytics page: no case has a completed assessment.

export function NoDataCard({
  errorMessage,
  onRetry,
}: {
  errorMessage: string
  /** Reloads cases and assessments. */
  onRetry: () => void
}) {
  return (
    <div
      className="card"
      style={{
        padding: 48,
        textAlign: 'center',
        color: 'var(--text-tertiary)',
      }}
    >
      <div
        style={{
          fontSize: 14,
          color: 'var(--text-primary)',
          marginBottom: 8,
        }}
      >
        No assessment data
      </div>
      <div style={{ fontSize: 13 }}>
        {errorMessage ||
          'Run an assessment on any case to populate analytics.'}
      </div>
      <div style={{ marginTop: 16 }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onRetry()}
        >
          Try again
        </button>
      </div>
    </div>
  )
}
