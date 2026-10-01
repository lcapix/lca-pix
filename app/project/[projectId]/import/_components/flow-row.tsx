'use client'

import { fmtSig } from '@/components/lcapix/formatters'
import type { MappedFlow, SubstanceCandidate } from '@/lib/ingest/maplca'
import { percent, scoreColor } from '@/lib/import/display'
import type { FlowEdit } from '@/lib/import/review'

import { StepCell, type StepPicker } from './step-cell'

/** One extracted flow: apply tick, source text, direction, quantity (with unit override), substance, match, step. */
export function FlowRow({
  flow: f,
  edit: e,
  onEdit,
  appending,
  stepKey,
  picker,
}: {
  flow: MappedFlow
  edit: FlowEdit
  onEdit: (edit: FlowEdit) => void
  appending: boolean
  stepKey: string
  picker: StepPicker
}) {
  return (
    <tr style={{ borderTop: '1px solid var(--border-subtle)', verticalAlign: 'top' }}>
      <td style={{ padding: '8px' }}>
        <input
          type="checkbox"
          checked={e.include}
          disabled={e.substance_id === null}
          onChange={(ev) =>
            onEdit({ ...e, include: ev.target.checked })
          }
          aria-label={`Apply flow ${f.substance_text}`}
        />
      </td>
      <td style={{ padding: '8px' }}>
        <div>
          {f.label && f.label !== f.substance_text && (
            <strong style={{ fontWeight: 600 }}>{f.label} · </strong>
          )}
          {f.substance_text}
        </div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
          {f.provenance}
        </div>
      </td>
      <td style={{ padding: '8px', textTransform: 'uppercase', fontSize: 10.5 }}>{f.direction}</td>
      <td style={{ padding: '8px' }}>
        <span className="mono">
          {fmtSig(Number(f.quantity))} {f.unit}
        </span>
        {f.conversion_note && (
          <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
            {f.conversion_note}
          </div>
        )}
        {f.unit_compatible === false && (
          <div style={{ marginTop: 2 }}>
            <div
              style={{
                fontSize: 10.5,
                color: 'var(--signal-error, #dc2626)',
                fontWeight: 600,
              }}
            >
              ⚠ unit won't convert to this substance — will be held
            </div>
            <div
              style={{
                display: 'flex',
                gap: 4,
                alignItems: 'center',
                marginTop: 3,
              }}
            >
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                override unit:
              </span>
              <input
                className="input mono"
                style={{ height: 24, fontSize: 11, width: 74 }}
                placeholder={f.unit}
                value={e.unit ?? ''}
                onChange={(ev) =>
                  onEdit({ ...e, unit: ev.target.value })
                }
                aria-label="Override unit"
              />
              <span style={{ fontSize: 9.5, color: 'var(--text-tertiary)' }}>
                e.g. "kg" for "kg CO2e"
              </span>
            </div>
          </div>
        )}
      </td>
      <td style={{ padding: '8px' }}>
        <select
          className="input"
          style={{ fontSize: 12, padding: '4px 8px', minWidth: 200 }}
          value={e.substance_id ?? ''}
          onChange={(ev) => {
            const sid = ev.target.value ? Number(ev.target.value) : null
            const cand = f.candidates.find((c: SubstanceCandidate) => c.substance_id === sid)
            onEdit({
              include: sid !== null,
              substance_id: sid,
              substance_name: cand?.substance_name ?? null,
            })
          }}
        >
          <option value="">— hold for review (not applied) —</option>
          {f.candidates.map((c: SubstanceCandidate) => (
            <option key={c.substance_id} value={c.substance_id}>
              {c.substance_name} · match {percent(c.score)}%
              {c.factor_count === 0 ? ' · NO IMPACT DATA' : ''}
            </option>
          ))}
        </select>
      </td>
      <td style={{ padding: '8px' }}>
        <span
          className="mono"
          style={{ fontSize: 11, fontWeight: 600, color: scoreColor(f.match_score) }}
        >
          {percent(f.match_score)}%
        </span>
      </td>
      {appending && (
        <td style={{ padding: '8px' }}><StepCell stepKey={stepKey} picker={picker} /></td>
      )}
    </tr>
  )
}
