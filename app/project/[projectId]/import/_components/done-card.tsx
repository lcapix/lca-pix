'use client'

import { Icon } from '@/components/lcapix'
import { doneSummary, doneTitle } from '@/lib/import/done-summary'

import { CompletenessChecklist } from './completeness-checklist'

/** After apply: what was created or added, the case's completeness, and where to go next. */
export function DoneCard({
  applied,
  completeness,
  onAddAnother,
  onOpenCase,
  onStartNew,
}: {
  applied: any
  completeness: any
  onAddAnother: () => void
  onOpenCase: () => void
  onStartNew: () => void
}) {
  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Icon name="check" size={16} />
        <span style={{ fontSize: 15, fontWeight: 600 }}>
          {doneTitle(applied)}
        </span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        {doneSummary(applied)}
      </div>
      {Array.isArray(applied.held_details) && applied.held_details.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
          {applied.held_details.map((h: string, i: number) => (
            <div key={i}>held: {h}</div>
          ))}
        </div>
      )}

      {/* Case completeness — which layers are present, what to add next. */}
      {completeness && (
        <CompletenessChecklist completeness={completeness} />
      )}

      <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {(completeness?.missing ?? []).length > 0 && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onAddAnother()}
          >
            Add another document to this case
          </button>
        )}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onOpenCase()}
        >
          Open case
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => onStartNew()}
        >
          Start a new case
        </button>
      </div>
    </div>
  )
}
