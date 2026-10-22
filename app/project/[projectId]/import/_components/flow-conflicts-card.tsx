'use client'

import type { CostMode } from '@/lib/ingest/cost-columns'
import type { FlowConflict } from '@/lib/import/flow-conflicts'

/**
 * Appending: the steps that already have a flow of a substance this document
 * brings, in the same direction. Each says what is there and what the
 * document adds, and the reviewer keeps it (the default), replaces it, or adds
 * to it, so importing a document twice never doubles a material unseen. When
 * the existing flows could not be read, it says so instead of showing none.
 */
export function FlowConflictsCard({
  conflicts,
  modeOf,
  onModeChange,
  loadError,
}: {
  conflicts: FlowConflict[]
  modeOf: (key: string) => CostMode
  onModeChange: (key: string, mode: CostMode) => void
  loadError: string | null
}) {
  if (conflicts.length === 0 && !loadError) return null
  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>
        ALREADY IN THE CASE · {conflicts.length} FLOW{conflicts.length === 1 ? '' : 'S'}
      </div>
      {loadError && (
        <div role="alert" style={{ fontSize: 11.5, color: 'var(--signal-warn, #d97706)', marginBottom: 8 }}>
          {loadError}
        </div>
      )}
      {conflicts.length > 0 && (
        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 10 }}>
          These steps already have this substance. Keep leaves the step as it is, Replace swaps in the
          document&apos;s amount, Add counts both. Adding the same document twice counts its materials twice.
        </div>
      )}
      {conflicts.map((c) => (
        <div
          key={c.key}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12.5, flexWrap: 'wrap' }}
        >
          <span style={{ flex: 1, minWidth: 180 }}>
            {c.stepName} · {c.substanceName} ({c.direction}): already <span className="mono">{c.existing}</span>, this
            document <span className="mono">{c.incoming}</span>
          </span>
          <select
            className="input"
            style={{ height: 26, fontSize: 11.5, width: 170 }}
            value={modeOf(c.key)}
            onChange={(e) => onModeChange(c.key, e.target.value as CostMode)}
            aria-label={`What to do with the ${c.substanceName} ${c.direction} of ${c.stepName}`}
          >
            <option value="keep">Keep what is there</option>
            <option value="replace">Replace with the document</option>
            <option value="add">Add both</option>
          </select>
        </div>
      ))}
    </div>
  )
}
