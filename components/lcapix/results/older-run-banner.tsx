'use client'

// Shown while the Results page reads an older run: which run it is, that it is
// frozen as it ran, and the way back to the newest. role="status" announces
// the switch to screen readers.

export function OlderRunBanner({
  runId,
  runDate,
  latestRunId,
  onBack,
}: {
  runId: number
  runDate: string
  latestRunId: number
  onBack: () => void
}) {
  const d = new Date(runDate)
  const when = isNaN(d.getTime())
    ? ''
    : `, from ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  return (
    <div
      role="status"
      className="card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        padding: '12px 16px',
        marginBottom: 16,
        background: 'var(--surface-raised)',
        borderLeft: '3px solid var(--signal-warn)',
      }}
    >
      <div style={{ flex: 1, minWidth: 240, fontSize: 13, color: 'var(--text-primary)' }}>
        <strong>You are reading Run #{runId}{when}.</strong> It shows the inputs, factors and totals
        frozen when it ran, so nothing on this page changes it.
      </div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>
        Back to Run #{latestRunId}
      </button>
    </div>
  )
}
