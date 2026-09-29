'use client'

/**
 * The result split by life-cycle stage, and whether the study covers what it
 * says it covers.
 *
 * A cradle-to-gate case has everything in Materials and Production, and this
 * panel says so in one line rather than pretending to be a full life cycle.
 * A case that declares cradle-to-grave and has nothing in Use or End of life
 * is told, on the screen, before it reaches a report.
 */

import { boundaryGaps, groupByStage, stageLabel, STAGES, type StageId } from '@/lib/life-cycle'
import { fmtSig } from '../formatters'

type Row = { component_name: string; life_cycle_stage?: string | null; value: number; flows: number }

export function StagePanel({
  categoryName,
  unit,
  rows,
  boundary,
  editHref,
}: {
  categoryName: string
  unit: string
  rows: Row[]
  boundary?: string | null
  /** Where to go to put a step in a stage. */
  editHref?: string
}) {
  const totals = groupByStage(rows.map((r) => ({ stage: r.life_cycle_stage, value: r.value })))

  const presence = STAGES.map((s) => {
    const mine = rows.filter((r) => (r.life_cycle_stage ?? 'production') === s.id)
    return {
      stage: s.id as StageId,
      steps: mine.length,
      flows: mine.reduce((n, r) => n + (r.flows || 0), 0),
    }
  })
  const gaps = boundaryGaps(boundary, presence)

  if (totals.length === 0) return null

  const single = totals.length === 1

  return (
    <section
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        background: 'var(--surface-raised)',
        padding: 18,
        marginBottom: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 650, color: 'var(--text-primary)' }}>
          By life-cycle stage
        </h3>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          {categoryName}
          {unit ? `, ${unit}` : ''}
        </span>
      </div>

      <p style={{ margin: '4px 0 14px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
        {single
          ? `Everything in this run sits in one stage: ${totals[0].label}. Put steps in other stages to widen the study.`
          : 'Where the impact falls across the product’s life. Each step carries the stage set on it.'}
      </p>

      {totals.map((t) => (
        <div key={t.stage} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span
            style={{ width: 110, fontSize: 12.5, color: 'var(--text-primary)' }}
            title={STAGES.find((s) => s.id === t.stage)?.hint}
          >
            {t.label}
          </span>
          <div
            style={{
              flex: 1,
              height: 14,
              borderRadius: 4,
              background: 'var(--surface-sunken, rgba(0,0,0,0.06))',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.max(1, t.share * 100)}%`,
                height: '100%',
                background: 'var(--brand-primary, #1d7848)',
              }}
            />
          </div>
          <span
            style={{
              width: 118,
              textAlign: 'right',
              fontSize: 12,
              color: 'var(--text-secondary)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmtSig(t.value)} ({(t.share * 100).toFixed(1)}%)
          </span>
        </div>
      ))}

      {(gaps.missing.length > 0 || gaps.outside.length > 0) && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--border-subtle)',
            fontSize: 12.5,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}
        >
          {gaps.missing.length > 0 && (
            <div>
              Your boundary claims {gaps.missing.map((s) => stageLabel(s)).join(', ')}, and nothing in
              this run sits there. Either model those steps or narrow the boundary in Goal &amp; scope.
            </div>
          )}
          {gaps.outside.length > 0 && (
            <div>
              {gaps.outside.map((s) => stageLabel(s)).join(', ')} {gaps.outside.length === 1 ? 'is' : 'are'}{' '}
              modelled but outside the boundary you declared, so the total counts something the scope says
              is excluded.
            </div>
          )}
          {editHref && (
            <a href={editHref} className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}>
              Set stages on the steps
            </a>
          )}
        </div>
      )}
    </section>
  )
}

export default StagePanel
