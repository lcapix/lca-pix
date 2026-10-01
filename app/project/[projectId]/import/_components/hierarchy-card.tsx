'use client'

import { fmtSig } from '@/components/lcapix/formatters'
import type { IngestPlan } from '@/lib/ingest/maplca'
import { TIER_LABEL, tierDepth } from '@/lib/import/display'

/** The extracted node tree, indented by tier; hidden (still rendered) when appending. */
export function HierarchyCard({ nodes, appending }: { nodes: IngestPlan['nodes']; appending: boolean }) {
  // Appending, the lines go to the case's own steps (STEP column), so
  // the connector's placeholder tree would only mislead: hidden.
  return (
    <div
      className="card"
      style={{ padding: 20, display: appending ? 'none' : undefined }}
    >
      <div className="eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>
        HIERARCHY · {nodes.length} NODES
        {appending ? ' (context — not created)' : ''}
      </div>
      {nodes.map((n) => {
        const depth = tierDepth(n.tier)
        return (
          <div
            key={n.name}
            style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0', marginLeft: depth * 22, fontSize: 12.5 }}
          >
            <span className="chip" style={{ fontSize: 9, padding: '1px 7px' }}>
              {TIER_LABEL[n.tier]}
            </span>
            <span style={{ color: 'var(--text-primary)' }}>{n.name}</span>
            {n.quantity != null && (
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {fmtSig(Number(n.quantity))} {n.unit}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
