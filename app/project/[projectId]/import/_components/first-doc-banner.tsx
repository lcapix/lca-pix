'use client'

/** Guided intake (?first=1): start with the process routing. */
export function FirstDocBanner() {
  return (
    <div
      className="card"
      style={{
        padding: '12px 16px',
        marginBottom: 16,
        borderLeft: '3px solid var(--accent, #4f8a6a)',
        fontSize: 13,
      }}
    >
      <strong>Start with your routing.</strong> A routing gives the case its steps (lines,
      then operations), and every other file attaches to them. It is picked below: add it,
      or pick another kind if a different file comes first.
    </div>
  )
}
