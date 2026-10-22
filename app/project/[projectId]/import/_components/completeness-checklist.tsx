'use client'

import { layerLabel } from '@/lib/import/display'
import { missingLayerHint } from '@/lib/import/done-summary'

/** The case's completeness after an apply: layers present, and each layer still to add with its source. */
export function CompletenessChecklist({ completeness }: { completeness: any }) {
  return (
    <div
      style={{
        marginTop: 16,
        paddingTop: 16,
        borderTop: '1px solid var(--border-subtle)',
      }}
    >
      <div className="eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>
        DOCUMENTS &amp; DATA ADDED
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {(completeness.present ?? []).map((layer: string) => (
          <span
            key={layer}
            className="chip"
            style={{
              fontSize: 11,
              padding: '3px 10px',
              background: 'color-mix(in oklab, var(--signal-success, #16a34a) 12%, transparent)',
              color: 'var(--signal-success, #16a34a)',
            }}
          >
            ✓ {layerLabel(layer)}
          </span>
        ))}
      </div>
      {(completeness.missing ?? []).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {completeness.missing.map((m: any) => (
            <div key={m.layer} style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              <span style={{ fontWeight: 600 }}>Still to add: {m.label}</span>
              {missingLayerHint(m)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
