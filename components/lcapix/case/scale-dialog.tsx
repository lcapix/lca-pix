'use client'

// Asks what a change to the product's quantity means before anything moves:
// scale every input and cost to the new number of units, or keep the inputs
// because they already describe that many units. Nothing changes on Cancel.

export interface PendingScale {
  from: number
  to: number
}

const fmt = (x: number) => (Number.isInteger(x) ? String(x) : String(Number(x.toPrecision(3))))

export function ScaleDialog({
  pending,
  unit,
  onChoose,
  onCancel,
}: {
  pending: PendingScale | null
  unit?: string
  onChoose: (mode: 'scale-inputs' | 'data-covers') => void
  onCancel: () => void
}) {
  if (!pending) return null
  const { from, to } = pending
  const u = !unit || unit.trim().toLowerCase() === 'unit' ? 'units' : unit
  const k = fmt(to / from)
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scale-dialog-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        className="card"
        style={{ maxWidth: 520, width: '100%', padding: '20px 22px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div id="scale-dialog-title" style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
          Change the product from {fmt(from)} to {fmt(to)} {u}?
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 14 }}>
          This number says how many {u} your entered data make (the data basis in Goal &amp;
          scope). What does the change mean?
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{
              justifyContent: 'flex-start',
              textAlign: 'left',
              height: 'auto',
              padding: '10px 12px',
              whiteSpace: 'normal',
              lineHeight: 1.35,
            }}
            onClick={() => onChoose('scale-inputs')}
          >
            <span>
              <strong>Scale everything ×{k}</strong>
              <br />
              <span style={{ fontSize: 11.5, opacity: 0.9, fontWeight: 400 }}>
                Every input and per-unit cost is multiplied by {k}, so the tree shows the inputs for{' '}
                {fmt(to)} {u}. Results per unit stay the same; totals grow ×{k}.
              </span>
            </span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{
              justifyContent: 'flex-start',
              textAlign: 'left',
              height: 'auto',
              padding: '10px 12px',
              whiteSpace: 'normal',
              lineHeight: 1.35,
            }}
            onClick={() => onChoose('data-covers')}
          >
            <span>
              <strong>My data already covers {fmt(to)} {u}</strong>
              <br />
              <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--text-secondary)' }}>
                Inputs stay exactly as entered. Results per unit are divided by {fmt(to)}.
              </span>
            </span>
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            Cancel, keep {fmt(from)}
          </button>
        </div>
      </div>
    </div>
  )
}
