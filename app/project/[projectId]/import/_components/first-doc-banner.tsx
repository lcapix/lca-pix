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
      <strong>Start with your process routing.</strong> A routing / bill-of-process
      document builds the case skeleton (lines → operations) that every other document
      attaches to. It's pre-selected below — upload it, or switch the type if a different
      document comes first.
    </div>
  )
}
