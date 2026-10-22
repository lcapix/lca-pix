'use client'

// On a phone, Home, the case outline and Results are read only (stage 8.3):
// this bar says so and where editing happens.

export function ReadOnlyBar() {
  return (
    <div className="ro-bar" role="note">
      <span className="ro-bar-icon" aria-hidden>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="4" y="5" width="16" height="11" rx="1.5" />
          <path d="M2 19h20" />
        </svg>
      </span>
      <span>
        <strong>Read only on a phone.</strong>
        <span>Open on a larger screen to edit.</span>
      </span>
    </div>
  )
}
