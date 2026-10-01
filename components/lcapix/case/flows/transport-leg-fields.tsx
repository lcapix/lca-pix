'use client'

// Transport-leg calculator: mass (t) × distance (km) → tonne-km.

export function TransportLegFields({
  legMassT,
  legKm,
  legTkm,
  legInvalid,
  setLeg,
}: {
  legMassT: string
  legKm: string
  legTkm: number | null
  legInvalid: boolean
  /** Set both numbers; the quantity follows. */
  setLeg: (massT: string, km: string) => void
}) {
  return (
    <div
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 6,
        padding: '10px 12px',
        marginBottom: 10,
        background: 'oklch(from var(--brand-primary) l c h / 0.04)',
      }}
    >
      <div className="label" style={{ fontSize: 11, marginBottom: 6 }}>
        Transport leg — enter mass and distance, we compute tonne-km
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
        <div>
          <label className="label" style={{ fontSize: 10 }}>Mass (tonnes)</label>
          <input
            className="input"
            type="number"
            min={0}
            value={legMassT}
            onChange={(e) => setLeg(e.target.value, legKm)}
            placeholder="e.g. 1.2"
          />
        </div>
        <div>
          <label className="label" style={{ fontSize: 10 }}>Distance (km)</label>
          <input
            className="input"
            type="number"
            min={0}
            value={legKm}
            onChange={(e) => setLeg(legMassT, e.target.value)}
            placeholder="e.g. 450"
          />
        </div>
        <div className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)', paddingBottom: 8 }}>
          = {legTkm != null ? legTkm.toLocaleString() : '—'} tkm
        </div>
      </div>
      {legInvalid && (
        <div role="alert" style={{ fontSize: 11, color: 'var(--signal-error)', marginTop: 6 }}>
          Mass and distance must both be above 0.
        </div>
      )}
    </div>
  )
}
