'use client'

/** Review banner when adding to an existing case, with how many lines still need a step. */
export function AppendBanner({ unplacedCount }: { unplacedCount: number }) {
  return (
    <div
      className="card"
      style={{ padding: '12px 16px', borderLeft: '3px solid var(--brand-primary)', fontSize: 12.5 }}
    >
      Adding to an existing case. Each line goes to the step in its <strong>STEP</strong>{' '}
      column, suggested from the document; change any that are wrong. Only the flows and
      costs below are added; each one keeps its source row.
      {unplacedCount > 0 && (
        <div style={{ marginTop: 4, color: 'var(--signal-warn, #d97706)', fontWeight: 600 }}>
          {unplacedCount} line(s) still need a step.
        </div>
      )}
    </div>
  )
}
