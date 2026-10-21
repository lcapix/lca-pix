'use client'

import type { PlainNote } from '@/lib/import/review'

/** Notes from the read (F2.3): what the reader did or left out, each dismissible. */
export function NotesList({
  plainNotes,
  dismissedNotes,
  onDismiss,
}: {
  plainNotes: PlainNote[]
  dismissedNotes: Set<number>
  onDismiss: (noteIndex: number) => void
}) {
  const shown = plainNotes.filter((n) => !dismissedNotes.has(n.noteIndex))
  if (!shown.length) return null
  return (
    <section aria-labelledby="notes-h" style={{ marginTop: 8 }}>
      <h3 id="notes-h" className="ds-section-label" style={{ margin: '0 0 6px' }}>
        Notes from the read · {shown.length}
      </h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
        {shown.map((n) => (
          <li key={n.noteIndex} style={{ display: 'flex', gap: 12, alignItems: 'baseline', fontSize: 13, color: 'var(--ds-text-2)' }}>
            <span style={{ flex: 1 }}>{n.note.replace(/^NOTE:\s*/i, '')}</span>
            <button type="button" className="ds-link" style={{ fontSize: 13 }} onClick={() => onDismiss(n.noteIndex)} aria-label={`Dismiss: ${n.note}`}>
              Dismiss
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
