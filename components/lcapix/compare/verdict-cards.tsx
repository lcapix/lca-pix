'use client'

// The verdict (P51) and the change by category (P54): case B against case A.
// Both read lib/compare/verdict.ts, which holds the number back when a check
// fails and names categories one side lacks instead of drawing them at zero.

import { useMemo } from 'react'
import { fixed } from '@/lib/ui/format'
import { sentenceCase } from '@/lib/compare/compare-view'
import { caseVerdict, deltaByCategory } from '@/lib/compare/verdict'
import type { CompareCase } from './types'

interface Pair {
  a: CompareCase
  b: CompareCase
  /** B's letter on the page ("B", or "C" when A is compared against C). */
  letterB: string
}

export function VerdictCard({ a, b, letterB, category }: Pair & { category: string }) {
  const v = useMemo(() => caseVerdict(a, b, category), [a, b, category])
  return (
    <section className="ds-card ds-card-pad cmp-vd-card" aria-label="Verdict">
      <span className="ds-section-label">Verdict · {sentenceCase(category)}</span>
      <h2 className="pp-card-h cmp-vd-title">
        {v.ahead ? `${v.ahead} comes out ahead` : v.line ? 'Neither comes out ahead' : 'No verdict yet'}
      </h2>
      <p className="cmp-vd-line" data-down={(v.pct !== null && v.ahead === b.name) || undefined} data-up={(v.pct !== null && v.ahead === a.name) || undefined}>
        {v.line ?? v.why}
      </p>
      {v.cost && <p className="cmp-vd-cost">{v.cost}</p>}
      <p className="cmp-vd-foot">
        {letterB} · {b.name} against A · {a.name}. Lower is a smaller impact.
      </p>
    </section>
  )
}

export function DeltaCard({ a, b, letterB }: Pair) {
  const d = useMemo(() => deltaByCategory(a, b), [a, b])
  const max = Math.max(0, ...d.rows.map((r) => Math.abs(r.pct)))
  return (
    <section className="ds-card ds-card-pad cmp-dv" aria-labelledby="cmp-dv-h">
      <span className="ds-section-label">
        {letterB} against A, every category
      </span>
      <h2 id="cmp-dv-h" className="pp-card-h cmp-vd-title">
        Change by category
      </h2>
      {d.why ? (
        <p className="cmp-vd-line">No change by category yet: {d.why.replace(/\.$/, '')}.</p>
      ) : d.rows.length === 0 ? (
        <p className="cmp-vd-line">No category has a result in both runs with A above 0.</p>
      ) : (
        <>
          <p className="cmp-vd-foot" style={{ marginTop: 4 }}>
            Percent of A. Left of the line (green) is lower than A; right is higher.
          </p>
          {/* One accessible picture: its name reads every bar, so the bars themselves are not announced. */}
          <div role="img" aria-label={d.summary} className="cmp-dv-plot">
            {d.rows.map((r) => {
              const shown = fixed(Math.abs(r.pct), 1)
              const same = shown === '0.0'
              const w = max > 0 ? (Math.abs(r.pct) / max) * 50 : 0
              return (
                <div key={r.category} className="cmp-dv-row">
                  <span className="cmp-dv-cat">{sentenceCase(r.category)}</span>
                  <span className="cmp-dv-track">
                    {!same && (
                      <span
                        className="cmp-dv-bar"
                        data-down={r.pct < 0 || undefined}
                        style={r.pct < 0 ? { right: '50%', width: `${w}%` } : { left: '50%', width: `${w}%` }}
                      />
                    )}
                  </span>
                  <span className="cmp-dv-val ds-mono" data-down={(!same && r.pct < 0) || undefined} data-up={(!same && r.pct > 0) || undefined}>
                    {same ? 'same' : `${r.pct < 0 ? '−' : '+'}${shown}%`}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
      {d.zeroBase.length > 0 && (
        <p className="cmp-vd-foot">
          No percentage where {a.name} is 0: {d.zeroBase.map(sentenceCase).join(', ')}.
        </p>
      )}
      {d.notCounted.length > 0 && (
        <p className="cmp-vd-foot">
          Not counted, a run has no result: {d.notCounted.map((n) => `${sentenceCase(n.category)} (none in ${n.missingIn})`).join(', ')}.
        </p>
      )}
    </section>
  )
}
