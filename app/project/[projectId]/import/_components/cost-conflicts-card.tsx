'use client'

import { fmtNum } from '@/components/lcapix/formatters'
import type { CostMode } from '@/lib/ingest/cost-columns'
import { costAfter, type CostConflict } from '@/lib/import/cost-conflicts'

/**
 * Appending: the steps that already have a cost in a column this document
 * writes. Each one says what is there and what the document brings, and the
 * reviewer keeps it (the default), replaces it, or adds to it, so importing a
 * document twice never doubles a cost unseen.
 */
export function CostConflictsCard({
  conflicts,
  modeOf,
  onModeChange,
}: {
  conflicts: CostConflict[]
  modeOf: (key: string) => CostMode
  onModeChange: (key: string, mode: CostMode) => void
}) {
  if (conflicts.length === 0) return null
  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>
        ALREADY COSTED · {conflicts.length} STEP{conflicts.length === 1 ? '' : 'S'}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 10 }}>
        These steps already have a cost that this document also gives. Keep leaves the step as it is,
        Replace uses the document&apos;s figure, Add counts both. Adding the same document twice
        counts it twice.
      </div>
      {conflicts.map((c) => {
        const mode = modeOf(c.key)
        return (
          <div
            key={c.key}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12.5, flexWrap: 'wrap' }}
          >
            <span style={{ flex: 1, minWidth: 180 }}>
              {c.stepName} · {c.label}: already <span className="mono">${fmtNum(c.existing)}</span>, this document{' '}
              <span className="mono">${fmtNum(c.incoming)}</span>
            </span>
            <select
              className="input"
              style={{ height: 26, fontSize: 11.5, width: 210 }}
              value={mode}
              onChange={(e) => onModeChange(c.key, e.target.value as CostMode)}
              aria-label={`What to do with the ${c.label} cost of ${c.stepName}`}
            >
              <option value="keep">Keep ${fmtNum(c.existing)}</option>
              <option value="replace">Replace with ${fmtNum(c.incoming)}</option>
              <option value="add">Add: ${fmtNum(c.existing + c.incoming)}</option>
            </select>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 70 }}>
              → ${fmtNum(costAfter(c, mode))}
            </span>
          </div>
        )
      })}
    </div>
  )
}
