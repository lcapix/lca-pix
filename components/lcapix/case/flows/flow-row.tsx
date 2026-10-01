'use client'

// One flow in the list: IN/OUT, the substance and where its factors come
// from, then its quantity (click to edit in place, or swap the material) and
// a delete button.

import { Icon } from '@/components/lcapix/icon'
import { substanceSource } from '@/lib/substance-source'
import { compatibleUnits } from '@/lib/units'
import type { FlowRow, Substance } from '@/lib/case-editor/flow-types'
import { substanceOptionLabel, swapOptionsFor } from '@/lib/case-editor/substance-search'
import type { FlowEdit } from '@/lib/case-editor/use-flows'

export interface FlowRowItemProps {
  f: FlowRow
  i: number
  substances: Substance[]
  editing: FlowEdit | null
  setEditing: (edit: FlowEdit | null) => void
  editSaving: boolean
  startEdit: (f: FlowRow) => void
  saveEdit: () => void
  onDelete: (flowId: number) => void
}

export function FlowRowItem({
  f,
  i,
  substances,
  editing,
  setEditing,
  editSaving,
  startEdit,
  saveEdit,
  onDelete,
}: FlowRowItemProps) {
  // A flow's factor source comes from its catalog substance (the API returns
  // the cited sources of its factors as data_source).
  const sourceOf = (f: FlowRow) =>
    substanceSource(substances.find((s) => s.substance_id === f.substance_id) ?? f)
  return (
    <div
      style={{
        padding: '10px 12px',
        borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
      }}
    >
      <span
        style={{
          fontSize: 9,
          padding: '2px 6px',
          borderRadius: 3,
          textTransform: 'uppercase',
          background:
            f.flow_type === 'input'
              ? 'oklch(from var(--signal-info) l c h / 0.18)'
              : 'oklch(from var(--signal-warn) l c h / 0.18)',
          color: f.flow_type === 'input' ? 'var(--signal-info)' : 'var(--signal-warn)',
          fontWeight: 600,
        }}
      >
        {f.flow_type === 'input' ? 'IN' : 'OUT'}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <span
          style={{
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {f.substance_name ?? `Substance ${f.substance_id}`}
        </span>
        <span
          className="mono"
          title={`Factor source: ${sourceOf(f).label}`}
          style={{
            fontSize: 9.5,
            color: 'var(--text-tertiary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <Icon name="database" size={9} />
          {sourceOf(f).label}
          {(() => {
            const sub = substances.find((s) => s.substance_id === f.substance_id)
            if (sub && (sub.factor_count ?? 0) === 0) {
              return (
                <span
                  style={{ color: 'var(--signal-error)', fontWeight: 600 }}
                  title="This substance has no impact factors — this flow contributes ZERO to every category."
                >
                  · no impact data
                </span>
              )
            }
            return null
          })()}
        </span>
      </span>
      {editing?.id === f.flow_id ? (
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <FlowSwapSelect substances={substances} flow={f} editing={editing} setEditing={setEditing} />
          <input
            className="input mono"
            type="number"
            step="any"
            autoFocus
            // Select the whole value on focus so typing replaces it
            // cleanly — number inputs otherwise keep the old digits when
            // the caret lands mid-value (the "1.40005 instead of 0.5" bug).
            onFocus={(e) => e.target.select()}
            value={editing.qty}
            onChange={(e) => setEditing({ ...editing, qty: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit()
              if (e.key === 'Escape') setEditing(null)
            }}
            style={{ width: 84, fontSize: 12, padding: '3px 6px' }}
            aria-label="Flow quantity"
          />
          <input
            className="input"
            value={editing.unit}
            onChange={(e) => setEditing({ ...editing, unit: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit()
              if (e.key === 'Escape') setEditing(null)
            }}
            list={`lcapix-flow-units-${f.flow_id}`}
            style={{ width: 56, fontSize: 12, padding: '3px 6px' }}
            aria-label="Flow unit"
          />
          <datalist id={`lcapix-flow-units-${f.flow_id}`}>
            {(() => {
              const sub = substances.find((s) => s.substance_id === f.substance_id)
              return (sub?.unit ? compatibleUnits(sub.unit) : []).map((u) => (
                <option key={u} value={u} />
              ))
            })()}
          </datalist>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={editSaving}
            onClick={saveEdit}
            style={{ fontSize: 10, padding: '3px 8px' }}
          >
            {editSaving ? '…' : 'Save'}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setEditing(null)}
            style={{ fontSize: 10, padding: '3px 6px' }}
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => startEdit(f)}
          title="Edit the quantity or unit, or swap the material"
          aria-label={`Edit quantity of ${f.substance_name ?? 'flow'}`}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 4,
            padding: '2px 4px',
            borderRadius: 4,
          }}
        >
          <span className="mono" style={{ color: 'var(--text-secondary)' }}>
            {Number(f.quantity).toLocaleString()}
          </span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{f.unit}</span>
          <Icon name="edit" size={10} />
        </button>
      )}
      <button
        type="button"
        aria-label="Delete flow"
        onClick={() => onDelete(f.flow_id)}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-tertiary)',
          cursor: 'pointer',
          padding: 2,
          display: 'inline-flex',
        }}
      >
        <Icon name="x" size={12} />
      </button>
    </div>
  )
}

/**
 * Swap candidates: same kind of substance (a material for a material), a
 * unit the flow can convert to, and impact data. Versions of the same
 * material come first and are labelled as versions of it. Nothing to swap
 * to: no select.
 */
function FlowSwapSelect({
  substances,
  flow: f,
  editing,
  setEditing,
}: {
  substances: Substance[]
  flow: FlowRow
  editing: FlowEdit
  setEditing: (edit: FlowEdit | null) => void
}) {
  const { options, variants, others } = swapOptionsFor(substances, f.substance_id)

  return options.length > 1 ? (
    <select
      className="input"
      value={editing.substanceId}
      onChange={(e) => setEditing({ ...editing, substanceId: Number(e.target.value) })}
      title="Swap the material: a version of the same material, or another substance with impact data"
      aria-label="Swap substance"
      style={{ width: 170, fontSize: 12, padding: '3px 6px' }}
    >
      {variants.length > 1 ? (
        <optgroup label="Versions of this material">
          {variants.map((s) => (
            <option key={s.substance_id} value={s.substance_id}>
              {substanceOptionLabel(s)}
            </option>
          ))}
        </optgroup>
      ) : (
        variants.map((s) => (
          <option key={s.substance_id} value={s.substance_id}>
            {substanceOptionLabel(s)}
          </option>
        ))
      )}
      {others.length > 0 && (
        <optgroup label="Other materials">
          {others.map((s) => (
            <option key={s.substance_id} value={s.substance_id}>
              {substanceOptionLabel(s)}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  ) : null
}
