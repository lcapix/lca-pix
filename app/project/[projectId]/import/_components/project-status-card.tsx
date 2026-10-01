'use client'

import { layerLabel } from '@/lib/import/display'
import { docsHint, type ProjectStatus } from '@/lib/import/project-status'

/** "Documents & data added so far" across the project's cases, and what is still to add. */
export function ProjectStatusCard({ projectStatus }: { projectStatus: ProjectStatus }) {
  return (
    <div className="card" style={{ padding: '14px 18px', marginBottom: 16 }}>
      <div className="eyebrow" style={{ fontSize: 10, marginBottom: 8 }}>
        DOCUMENTS &amp; DATA ADDED SO FAR
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {projectStatus.present.length > 0 ? (
          projectStatus.present.map((l) => (
            <span
              key={l}
              className="chip"
              style={{
                fontSize: 11,
                background: 'oklch(from var(--accent, #4f8a6a) l c h / 0.14)',
              }}
            >
              ✓ {layerLabel(l)}
            </span>
          ))
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Nothing added yet. Start with the routing.
          </span>
        )}
      </div>
      {projectStatus.missing.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Still to add:{' '}
          {projectStatus.missing.map((m, idx) => (
            <span key={m.layer}>
              {idx > 0 ? ' · ' : ''}
              <strong>{m.label}</strong>
              {docsHint(m.docs)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
