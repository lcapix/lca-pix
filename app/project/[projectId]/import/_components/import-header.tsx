'use client'

// The import page's header (F2.2, F2.3, F2.4): where the file goes ("Aluminium
// enclosure · into a new case" or "· into Base case") and what this step is.

export function ImportHeader({
  projectName,
  targetName,
  title,
}: {
  projectName: string | null
  /** The case the file goes into; null for a new case. */
  targetName: string | null
  title: string
}) {
  return (
    <header className="np-head">
      <p style={{ margin: 0, fontSize: 13, color: 'var(--ds-text-2)' }}>
        {projectName ? `${projectName} · ` : ''}
        {targetName ? `into ${targetName}` : 'into a new case'}
      </p>
      <h1 className="ds-title" style={{ margin: '4px 0 0' }}>
        {title}
      </h1>
    </header>
  )
}
