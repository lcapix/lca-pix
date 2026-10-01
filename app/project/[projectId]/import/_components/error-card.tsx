'use client'

/** The preview/apply error, with the matching assessment IDs when the server sent some. */
export function ErrorCard({ error, idHints }: { error: string; idHints: string[] }) {
  return (
    <div
      className="card"
      style={{ padding: '12px 16px', marginBottom: 16, borderLeft: '3px solid var(--signal-error, #dc2626)', fontSize: 13 }}
    >
      {error}
      {idHints.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
          Matching IDs in this workbook: {idHints.join(', ')}
        </div>
      )}
    </div>
  )
}
