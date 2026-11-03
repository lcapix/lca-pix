'use client'

// One line we read (F2.6), lean (F2): the tick, what the file says (with where
// it says it, on one line), what it matched with its score, the amount, the
// step it goes on (adding to a case) and its status. The edits (the match,
// the amount and unit, the step) sit behind the line's own Edit, closed until
// asked for, so the table stays one line per line.

import { fmtSig } from '@/components/lcapix/formatters'
import type { MappedFlow, SubstanceCandidate } from '@/lib/ingest/maplca'
import { percent } from '@/lib/import/display'
import { correctedQuantity, type FlowEdit } from '@/lib/import/review'
import { LINE_STATUS_WORD, lineStatus } from '@/lib/import/line-status'
import { lineKind, lineKindWord } from '@/lib/import/line-kind'

import { StepCell, stepChoiceText, type StepPicker } from './step-cell'

function shown(value: string | null | undefined, empty: string): string {
  const text = (value ?? '').replace(/[—–]/g, '-').trim()
  return text || empty
}

const STATUS_TONE = { counted: 'counted', no_factor: 'warn', check_match: 'warn', pick_match: 'error' } as const

export function FlowRow({
  flow: f,
  edit: e,
  onEdit,
  appending,
  stepKey,
  picker,
  placed,
  open,
  onToggle,
  columns,
  onSearchLibrary,
}: {
  flow: MappedFlow
  edit: FlowEdit
  onEdit: (edit: FlowEdit) => void
  appending: boolean
  stepKey: string
  picker: StepPicker
  placed: boolean
  /** Whether this line's edits are open. */
  open: boolean
  onToggle: () => void
  /** How many columns the table has, for the edit row's span. */
  columns: number
  onSearchLibrary?: () => void
}) {
  const status = lineStatus(f, e)
  const chosen = f.candidates.find((c) => c.substance_id === e.substance_id)
  const score = chosen?.score ?? f.match_score
  const tone = score >= 0.9 ? 'good' : score >= 0.55 ? 'mid' : 'low'
  const kind = lineKind({ substance_text: f.substance_text, substance_name: e.substance_name ?? chosen?.substance_name, unit: e.unit?.trim() || f.unit })
  const editId = `ip-line-edit-${stepKey.replace(/[^a-zA-Z0-9_-]/g, '-')}`
  const name = `${f.label && f.label !== f.substance_text ? `${f.label} · ` : ''}${f.substance_text}`
  const amount = e.quantity ?? String(f.quantity)
  const unit = e.unit?.trim() || f.unit
  return (
    <>
      <tr
        className={`ip-line-row${status === 'pick_match' || !placed ? ' ws-row-warn' : ''}`}
        data-open={open || undefined}
        // The whole line opens its changes (the checkbox and buttons keep their own click).
        onClick={(ev) => {
          if (!(ev.target as HTMLElement).closest('input, button, select, a, label')) onToggle()
        }}
      >
        <td>
          <input
            type="checkbox"
            className="ws-check"
            checked={e.include}
            disabled={e.substance_id === null}
            onChange={(ev) => onEdit({ ...e, include: ev.target.checked })}
            aria-label={`Save ${f.substance_text} as ${lineKindWord(kind)}`}
          />
        </td>
        <td>
          <strong className="ip-line-name">{name}</strong>
          <span className="ip-line-meta ds-mono" title={f.provenance || undefined}>
            {f.direction === 'output' ? 'Output' : 'Input'}
            {f.provenance ? ` · ${f.provenance}` : ''}
          </span>
        </td>
        <td>
          <span className="ip-line-match">{e.substance_id === null ? 'No match yet' : shown(e.substance_name ?? chosen?.substance_name, 'Picked')}</span>
          <span className={`ip-score ip-score--${tone}`}>{e.substance_id === null ? `best ${percent(f.match_score)}%` : `${percent(score)}% match`}</span>
        </td>
        <td className="ds-mono" style={{ textAlign: 'right' }}>
          {amount} {unit}
          {correctedQuantity(f, e) !== null && <span className="ip-line-note">file said {fmtSig(Number(f.quantity))}</span>}
          {f.unit_compatible === false && !e.unit?.trim() && <span className="ip-line-note" style={{ color: 'var(--ds-error)' }}>unit can&apos;t convert</span>}
        </td>
        {appending && (
          <td>
            <span className="ip-line-step" data-unplaced={!placed || undefined}>
              {stepChoiceText(stepKey, picker)}
            </span>
          </td>
        )}
        <td>
          <span className={`ip-status ip-status--${STATUS_TONE[status]}`}>{LINE_STATUS_WORD[status]}</span>
        </td>
        <td style={{ textAlign: 'right' }}>
          <button type="button" className="ds-btn ds-btn--small ip-edit-toggle" aria-expanded={open} aria-controls={editId} aria-label={`${open ? 'Close' : 'Edit'} ${f.substance_text}`} onClick={onToggle}>
            {open ? 'Close' : 'Edit'}
          </button>
        </td>
      </tr>
      {open && (
        <tr className="ip-line-edit-row">
          <td colSpan={columns}>
            <div id={editId} className="ip-line-edit" role="group" aria-label={`Edits of ${f.substance_text}`}>
              <div className="ip-line-field ip-line-field--wide">
                <span className="edu-field-label" aria-hidden>
                  Matched to
                </span>
                <select
                  className="ds-input"
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
                      {c.substance_name} · {percent(c.score)}% · {c.factor_value == null ? 'factor not set' : `${c.factor_value} ${shown(c.factor_unit, '')}`.trim()} · {shown(c.unit, 'unit not set')} · {shown(c.variant, 'variant not set')} · {shown(c.source, 'source not set')}
                    </option>
                  ))}
                </select>
                {onSearchLibrary && (
                  <button type="button" className="ds-link" onClick={onSearchLibrary} style={{ justifySelf: 'start' }}>
                    Search the whole library
                  </button>
                )}
              </div>
              <label className="ip-line-field">
                <span className="edu-field-label">Amount</span>
                <input
                  className="ds-input ds-mono"
                  style={{ textAlign: 'right' }}
                  value={amount}
                  inputMode="decimal"
                  aria-label={`Amount of ${f.substance_text}`}
                  title="What the file said. Correct it here if it was read wrong; the file's figure is kept with the line."
                  onChange={(ev) => onEdit({ ...e, quantity: ev.target.value })}
                />
                {correctedQuantity(f, e) !== null && <span className="ip-line-note">The file said {fmtSig(Number(f.quantity))} {f.unit}.</span>}
              </label>
              <label className="ip-line-field">
                <span className="edu-field-label">Unit</span>
                <input
                  className="ds-input ds-mono"
                  placeholder={f.unit}
                  value={e.unit ?? ''}
                  aria-label={`Unit to use for ${f.substance_text}`}
                  onChange={(ev) => onEdit({ ...e, unit: ev.target.value })}
                />
                {f.unit_compatible === false ? (
                  <span className="ip-line-note" style={{ color: 'var(--ds-error)' }}>
                    {f.unit} can&apos;t convert to this match&apos;s unit. Type one that can.
                  </span>
                ) : (
                  f.conversion_note && <span className="ip-line-note">{f.conversion_note}</span>
                )}
              </label>
              {appending && (
                <div className="ip-line-field ip-line-field--wide">
                  <span className="edu-field-label">Step it is used at</span>
                  <StepCell stepKey={stepKey} picker={picker} />
                </div>
              )}
              {f.provenance && (
                <p className="ip-line-note ip-line-field--all ds-mono" style={{ margin: 0 }}>
                  From {f.provenance}
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
