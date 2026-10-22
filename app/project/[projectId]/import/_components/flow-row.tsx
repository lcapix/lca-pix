'use client'

// One line we read (F2.6): the tick (saved as a material), what the file says
// and where, what it matched with its score (and the picker), the amount (a
// correction keeps what the file said), the step it goes on, and its status.

import { fmtSig } from '@/components/lcapix/formatters'
import type { MappedFlow, SubstanceCandidate } from '@/lib/ingest/maplca'
import { percent } from '@/lib/import/display'
import { correctedQuantity, type FlowEdit } from '@/lib/import/review'
import { LINE_STATUS_WORD, lineStatus } from '@/lib/import/line-status'
import { shortLocator } from '@/lib/import/steps-hours'

import { StepCell, type StepPicker } from './step-cell'

const STATUS_TONE = { counted: 'counted', no_factor: 'warn', check_match: 'warn', pick_match: 'error' } as const

export function FlowRow({
  flow: f,
  edit: e,
  onEdit,
  appending,
  stepKey,
  picker,
  placed,
}: {
  flow: MappedFlow
  edit: FlowEdit
  onEdit: (edit: FlowEdit) => void
  appending: boolean
  stepKey: string
  picker: StepPicker
  placed: boolean
}) {
  const status = lineStatus(f, e)
  const score = f.candidates.find((c) => c.substance_id === e.substance_id)?.score ?? f.match_score
  const tone = score >= 0.9 ? 'good' : score >= 0.55 ? 'mid' : 'low'
  return (
    <tr className={status === 'pick_match' || !placed ? 'ws-row-warn' : undefined}>
      <td>
        <input
          type="checkbox"
          className="ws-check"
          checked={e.include}
          disabled={e.substance_id === null}
          onChange={(ev) => onEdit({ ...e, include: ev.target.checked })}
          aria-label={`Save ${f.substance_text} as a material`}
        />
      </td>
      <td>
        <strong style={{ display: 'block', fontSize: 15 }}>
          {f.label && f.label !== f.substance_text ? `${f.label} · ` : ''}
          {f.substance_text}
        </strong>
        <span className="ds-mono" style={{ fontSize: 12, color: 'var(--ds-text-2)' }}>
          {shortLocator(String(f.provenance ?? '').split(' · ')[0] || null) ?? ''}
          {f.direction === 'output' ? ' · OUT' : ''}
        </span>
      </td>
      <td>
        <select
          className="ds-input"
          style={{ minWidth: 200, maxWidth: 260 }}
          value={e.substance_id ?? ''}
          aria-label={`What ${f.substance_text} matches in the library`}
          onChange={(ev) => {
            const sid = ev.target.value ? Number(ev.target.value) : null
            const cand = f.candidates.find((c: SubstanceCandidate) => c.substance_id === sid)
            onEdit({
              // Choosing a match is the reviewer's confirmation: it ticks the line.
              include: sid !== null,
              substance_id: sid,
              substance_name: cand?.substance_name ?? null,
              // A corrected quantity is about the file, not the match: keep it.
              quantity: e.quantity,
              unit: e.unit,
            })
          }}
        >
          <option value="">No match yet (held, not saved)</option>
          {f.candidates.map((c: SubstanceCandidate) => (
            <option key={c.substance_id} value={c.substance_id}>
              {c.substance_name} · {percent(c.score)}%{c.factor_count === 0 ? ' · no climate factor' : ''}
            </option>
          ))}
        </select>
        <span className={`ip-score ip-score--${tone}`}>
          {e.substance_id === null ? `best ${percent(f.match_score)}%` : `${percent(score)}% match`}
        </span>
      </td>
      <td style={{ textAlign: 'right' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input
            className="ds-input ds-mono"
            style={{ width: 92, textAlign: 'right' }}
            value={e.quantity ?? String(f.quantity)}
            inputMode="decimal"
            aria-label={`Amount of ${f.substance_text}`}
            title="What the file said. Correct it here if it was read wrong; the file's figure is kept with the line."
            onChange={(ev) => onEdit({ ...e, quantity: ev.target.value })}
          />
          <span className="ds-mono" style={{ fontSize: 13 }}>
            {e.unit?.trim() || f.unit}
          </span>
        </span>
        {correctedQuantity(f, e) !== null && <span style={{ display: 'block', fontSize: 12, color: 'var(--ds-text-2)' }}>file said {fmtSig(Number(f.quantity))}</span>}
        {f.conversion_note && <span style={{ display: 'block', fontSize: 12, color: 'var(--ds-text-2)' }}>{f.conversion_note}</span>}
        {f.unit_compatible === false && (
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, fontSize: 12, color: 'var(--ds-error)' }}>
            Unit can&apos;t convert. Use
            <input
              className="ds-input ds-mono"
              style={{ width: 72, height: 30 }}
              placeholder={f.unit}
              value={e.unit ?? ''}
              aria-label={`Unit to use for ${f.substance_text}`}
              onChange={(ev) => onEdit({ ...e, unit: ev.target.value })}
            />
          </label>
        )}
      </td>
      {appending && (
        <td>
          <StepCell stepKey={stepKey} picker={picker} />
        </td>
      )}
      <td>
        <span className={`ip-status ip-status--${STATUS_TONE[status]}`}>{LINE_STATUS_WORD[status]}</span>
      </td>
    </tr>
  )
}
