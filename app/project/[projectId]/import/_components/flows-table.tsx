'use client'

// The lines a file gave (F2.3, F2.6): All lines, Need a step, Need a match;
// each line with what we read, what it matched (with its score), the amount,
// the step it goes on (adding to a case) and its status. "Lines at 90% or
// more are ticked"; an unticked line is not saved as a material.

import { useState } from 'react'
import { authHeaders } from '@/lib/import/auth-headers'
import { matchSubstance, type CatalogSubstance, type MappedFlow, type SubstanceCandidate } from '@/lib/ingest/maplca'
import { noFlowsMessage } from '@/lib/import/display'
import { flowKey, type FlowEdit } from '@/lib/import/review'
import { lineShows, lineStatus, type LineFilter } from '@/lib/import/line-status'

import { FlowRow } from './flow-row'
import type { StepPicker } from './step-cell'

export function FlowsTable({
  flows,
  edits,
  onEditFlow,
  connector,
  appending,
  picker,
  title,
  intro,
  onSearchLibrary,
}: {
  flows: MappedFlow[]
  edits: Record<number, FlowEdit>
  onEditFlow: (i: number, edit: FlowEdit) => void
  connector: string
  appending: boolean
  picker: StepPicker
  title?: string
  intro?: string
  onSearchLibrary?: (index: number) => void
}) {
  const [filter, setFilter] = useState<LineFilter>('all')
  const placed = (i: number) =>
    !appending || picker.placement[flowKey(flows[i], i)] != null || !!picker.newStep?.[flowKey(flows[i], i)] || picker.attachComponentId != null
  const rows = flows.map((f, i) => ({ f, i, e: edits[i] })).filter((r) => r.e)
  const status = (r: (typeof rows)[number]) => lineStatus(r.f, r.e)
  const counts: Record<LineFilter, number> = {
    all: rows.length,
    need_step: rows.filter((r) => !placed(r.i)).length,
    need_match: rows.filter((r) => lineShows('need_match', status(r), true)).length,
  }
  const [wider, setWider] = useState<Record<number, SubstanceCandidate[]>>({})
  const shown = rows.filter((r) => lineShows(filter, status(r), placed(r.i)))
  const ticked = rows.filter((r) => r.e.include).length
  const widen = async (flow: MappedFlow, index: number) => {
    const r = await fetch('/api/substances?method=CML%202001', { headers: authHeaders() })
    const d = await r.json().catch(() => ({}))
    const catalog: CatalogSubstance[] = (d.substances ?? []).map((s: CatalogSubstance & { climate_factor?: number; climate_unit?: string; variant_label?: string; data_source?: string }) => ({
      substance_id: s.substance_id,
      substance_name: s.substance_name,
      unit: s.unit,
      category: s.category,
      factor_count: s.factor_count,
      factor_value: s.climate_factor,
      factor_unit: s.climate_unit,
      variant: s.variant_label,
      factor_source: s.data_source,
    }))
    const { candidates } = matchSubstance(flow.substance_text, catalog, catalog.length || 1)
    setWider((prev) => ({ ...prev, [index]: candidates }))
  }

  return (
    <section className="np-card ip-lines" style={{ maxWidth: 'none' }} aria-labelledby="lines-h">
      <div style={{ padding: '22px 24px 8px' }}>
        <h2 id="lines-h" className="np-h2" style={{ fontSize: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          {title ?? 'Lines we read'} <span className="ds-count">{rows.length}</span>
        </h2>
        {intro && <p className="np-sub" style={{ marginTop: 4 }}>{intro}</p>}
        <div className="ws-pills" role="group" aria-label="Show lines" style={{ marginTop: 14 }}>
          {(['all', ...(appending ? ['need_step'] : []), 'need_match'] as LineFilter[]).map((k) => (
            <button key={k} type="button" className="ws-pill" aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {k === 'all' ? 'All lines' : k === 'need_step' ? 'Need a step' : 'Need a match'}
              <span className="ds-mono" style={{ fontWeight: 500 }}>
                {counts[k]}
              </span>
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 && <p style={{ padding: '0 24px 16px', fontSize: 14, color: 'var(--ds-text-2)' }}>{noFlowsMessage(connector)}</p>}
      <div style={{ overflowX: 'auto' }}>
        <table className="ds-table ip-lines-table">
          <thead>
            <tr>
              <th scope="col">
                <span className="ds-sr-only">Save as a material</span>
              </th>
              <th scope="col">What we read</th>
              <th scope="col">Matched to</th>
              <th scope="col" style={{ textAlign: 'right' }}>
                Amount
              </th>
              {appending && <th scope="col">Place on step</th>}
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ f, e, i }) => (
              <FlowRow
                key={i}
                flow={wider[i] ? { ...f, candidates: wider[i] } : f}
                edit={e}
                onEdit={(edit) => onEditFlow(i, edit)}
                appending={appending}
                stepKey={flowKey(f, i)}
                picker={picker}
                placed={placed(i)}
                onSearchLibrary={() => void widen(f, i)}
              />
            ))}
            {!shown.length && rows.length > 0 && (
              <tr>
                <td colSpan={appending ? 6 : 5} style={{ color: 'var(--ds-text-3)' }}>
                  No line here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="ip-lines-foot">
        <span style={{ flex: 1 }}>
          The {ticked} ticked {ticked === 1 ? 'line is' : 'lines are'} saved as {ticked === 1 ? 'a material' : 'materials'}. Unticked lines are not, only their cost.
        </span>
        {appending && counts.need_step > 0 && (
          <strong style={{ color: 'var(--ds-warn)' }}>
            {counts.need_step} {counts.need_step === 1 ? 'line still needs' : 'lines still need'} a step
          </strong>
        )}
      </p>
    </section>
  )
}
