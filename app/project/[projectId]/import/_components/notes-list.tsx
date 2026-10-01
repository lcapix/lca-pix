'use client'

import type { PlainNote } from '@/lib/import/review'

/** The plan's plain notes, each dismissible. */
export function NotesList({
  plainNotes,
  dismissedNotes,
  onDismiss,
}: {
  plainNotes: PlainNote[]
  dismissedNotes: Set<number>
  onDismiss: (noteIndex: number) => void
}) {
  return (
    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
      {plainNotes.map((n) =>
        dismissedNotes.has(n.noteIndex) ? null : (
          <div
            key={n.noteIndex}
            style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '2px 0' }}
          >
            <button
              type="button"
              onClick={() => onDismiss(n.noteIndex)}
              title="Dismiss note"
              aria-label="Dismiss note"
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
            <span>NOTE: {n.note}</span>
          </div>
        ),
      )}
    </div>
  )
}
