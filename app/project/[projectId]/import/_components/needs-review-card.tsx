'use client'

/** The plan's human-attention items, each dismissible once handled. */
export function NeedsReviewCard({
  review,
  dismissedReview,
  onDismiss,
}: {
  review: string[]
  dismissedReview: Set<number>
  onDismiss: (i: number) => void
}) {
  return (
    <div
      className="card"
      style={{ padding: 20, borderLeft: '3px solid var(--signal-warn, #d97706)' }}
    >
      <div className="eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>
        NEEDS HUMAN REVIEW
      </div>
      {review.map((r, i) =>
        dismissedReview.has(i) ? null : (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'baseline',
              fontSize: 12.5,
              padding: '3px 0',
              color: 'var(--text-secondary)',
            }}
          >
            <button
              type="button"
              onClick={() => onDismiss(i)}
              title="Dismiss — I've handled this"
              aria-label="Dismiss review item"
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--text-tertiary)',
                fontSize: 14,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
            <span>! {r}</span>
          </div>
        ),
      )}
    </div>
  )
}
