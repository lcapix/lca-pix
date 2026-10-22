'use client'

// Data-quality warnings frozen in the run snapshot.

export function DataQualityWarnings({ warnings }: { warnings: string[] }) {
  return (
    <div
      className="card"
      style={{
        marginBottom: 20,
        padding: '14px 18px',
        borderLeft: '4px solid var(--warning, #b8860b)',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 6 }}>
        DATA-QUALITY WARNINGS · {warnings.length}
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)' }}>
        {warnings.map((w, i) => (
          <li key={i} style={{ marginBottom: 4 }}>{w}</li>
        ))}
      </ul>
    </div>
  )
}
