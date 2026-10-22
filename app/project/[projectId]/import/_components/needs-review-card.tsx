'use client'

/**
 * The plan's lines that need a person to look (F2.3, F2.6): each in plain
 * words, naming the document's line, dismissible once handled. A line that
 * came out word for word twice shows once.
 */
export function NeedsReviewCard({
  review,
  dismissedReview,
  onDismiss,
}: {
  review: string[]
  dismissedReview: Set<number>
  onDismiss: (i: number) => void
}) {
  const seen = new Set<string>()
  const shown = review
    .map((text, i) => ({ text, i }))
    .filter(({ text, i }) => {
      if (dismissedReview.has(i) || seen.has(text)) return false
      seen.add(text)
      return true
    })
  if (!shown.length) return null
  return (
    <section className="ds-card" aria-labelledby="review-h" style={{ padding: 18, borderLeft: '3px solid var(--ds-warn, #8f5b00)' }}>
      <h3 id="review-h" className="ds-section-label" style={{ margin: '0 0 8px' }}>
        Check these before you save · {shown.length}
      </h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
        {shown.map(({ text, i }) => (
          <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'baseline', fontSize: 13, color: 'var(--ds-text)' }}>
            <span style={{ flex: 1 }}>{text}</span>
            <button type="button" className="ds-link" style={{ fontSize: 13 }} onClick={() => onDismiss(i)} aria-label={`Dismiss: ${text}`}>
              Dismiss
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
