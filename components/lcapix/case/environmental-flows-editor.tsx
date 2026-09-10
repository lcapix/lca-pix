'use client'

// EnvironmentalFlowsEditor — self-contained CRUD for a component's input/output
// flows, rendered inside the inspector's "Environmental Flows" section.
//
// - Loads the component's flows (GET /api/components/{id}/flows)
// - Loads the substance catalog (GET /api/substances) for the picker. The
//   catalog is populated from the public openLCA/PubChem imports, so this IS
//   the "suggest substances from the integrations" surface.
// - Add flow (POST) / delete flow (DELETE), then refreshes.
//
// Flows are where environmental impact comes from, so this is the core data
// entry of the whole LCA. Self-contained (own fetches) to keep the inspector
// presentational.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '@/components/lcapix/icon'
import { substanceSource } from '@/lib/substance-source'
import { compatibleUnits } from '@/lib/units'
import { toast } from 'sonner'

interface FlowRow {
  flow_id: number
  substance_id: number
  substance_name?: string
  substance_category?: string
  cas_number?: string
  flow_type: 'input' | 'output'
  quantity: number | string
  unit: string
}

interface Substance {
  substance_id: number
  substance_name: string
  unit?: string
  category?: string
  cas_number?: string
  /** '|'-joined method names that have non-zero factors for this substance. */
  methods_with_factors?: string
  factor_count?: number
}

/** Small badge: green when the substance has impact factors, loud when not —
 * picking a factorless substance used to silently contribute zero
 * (tool-review bug #1). */
function FactorCoverageBadge({ s }: { s: { methods_with_factors?: string; factor_count?: number } }) {
  const methods = (s.methods_with_factors || '').split('|').filter(Boolean)
  const has = (s.factor_count ?? 0) > 0 && methods.length > 0
  return (
    <span
      className="mono"
      style={{
        fontSize: 9,
        padding: '1px 6px',
        borderRadius: 999,
        background: has
          ? 'oklch(from var(--brand-primary) l c h / 0.14)'
          : 'oklch(from var(--signal-error) l c h / 0.14)',
        color: has ? 'var(--brand-primary)' : 'var(--signal-error)',
        whiteSpace: 'nowrap',
      }}
      title={
        has
          ? `Impact factors available: ${methods.join(', ')}`
          : 'No impact factors — flows of this substance will contribute ZERO to every category'
      }
    >
      {has ? `✓ ${methods.map((m) => m.split(' ')[0]).join(' · ')}` : 'no impact factors'}
    </span>
  )
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const t = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  if (t) h.Authorization = 'Bearer ' + t
  return h
}

export function EnvironmentalFlowsEditor({
  componentId,
  componentName = '',
  componentType = '',
}: {
  componentId: string
  componentName?: string
  componentType?: string
}) {
  const [flows, setFlows] = useState<FlowRow[]>([])
  const [substances, setSubstances] = useState<Substance[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  // In-place edit of an existing row's quantity/unit — a what-if is
  // "duplicate the case, tweak a few quantities, re-run"; without this the
  // only way to change 95 → 40 was delete + re-add.
  const [editing, setEditing] = useState<{ id: number; qty: string; unit: string } | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  // Add-form state
  const [search, setSearch] = useState('')
  const [substanceId, setSubstanceId] = useState<number | null>(null)
  const [dir, setDir] = useState<'input' | 'output'>('input')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState('kg')

  const loadFlows = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/components/${componentId}/flows`, { headers: authHeaders() })
      const d = await r.json().catch(() => ({}))
      setFlows(Array.isArray(d?.flows) ? d.flows : [])
    } finally {
      setLoading(false)
    }
  }, [componentId])

  useEffect(() => {
    loadFlows()
  }, [loadFlows])

  // Load the substance catalog once.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/substances?limit=500', { headers: authHeaders() })
        const d = await r.json().catch(() => ({}))
        if (!cancelled) setSubstances(d?.substances ?? d?.data ?? [])
      } catch {
        /* non-fatal — picker just shows empty */
      }
    })()
    return () => { cancelled = true }
  }, [])

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = q
      ? substances.filter((s) => s.substance_name?.toLowerCase().includes(q))
      : substances
    return base.slice(0, 8)
  }, [search, substances])

  // Suggested flows from the public substance catalog, tailored to this node.
  // Quantities are process-specific so we never invent them — only the
  // substance, direction, and default unit are suggested. Substances must
  // exist in the imported catalog (openLCA/PubChem) to be offered.
  const suggestions = useMemo(() => {
    const out: Array<{ sub: Substance; dir: 'input' | 'output'; unit: string; label: string }> = []
    const find = (re: RegExp) => substances.find((s) => re.test(s.substance_name || ''))
    const existingIds = new Set(flows.map((f) => f.substance_id))
    const name = (componentName || '').toLowerCase()
    const ty = (componentType || '').toLowerCase()

    // Material — if the node name mentions a material in the catalog (input).
    const MATERIALS: Array<[RegExp, string]> = [
      [/alumin/i, 'kg'], [/steel|iron/i, 'kg'], [/copper/i, 'kg'],
      [/plastic|polymer|pet|hdpe/i, 'kg'], [/glass/i, 'kg'], [/wood/i, 'kg'],
    ]
    for (const [re, u] of MATERIALS) {
      if (re.test(name)) {
        const m = find(re)
        if (m) out.push({ sub: m, dir: 'input', unit: m.unit || u, label: m.substance_name })
      }
    }
    // Energy — most operations / machine lines / elemental tasks draw power.
    // The power source does NOT have to be electricity: offer every energy
    // carrier present in the catalog (natural gas, coal, diesel, …) so the user
    // can model gas-fired / coal-fired steps, not just grid electricity.
    if (/machine|operation|elemental|line|cut|stamp|weld|form|process|heat|furnace|kiln|boiler|dry/.test(name + ' ' + ty)) {
      const ENERGY_SOURCES: Array<[RegExp, string, string]> = [
        [/electric/i, 'Electricity', 'kWh'],
        [/natural\s*gas|\bgas\b|methane fuel/i, 'Natural gas', 'm³'],
        [/coal|lignite|anthracite/i, 'Coal', 'kg'],
        [/diesel|gas\s*oil/i, 'Diesel', 'L'],
        [/heavy fuel oil|\bhfo\b|fuel oil/i, 'Fuel oil', 'L'],
        [/propane|lpg/i, 'Propane (LPG)', 'L'],
      ]
      for (const [re, label, u] of ENERGY_SOURCES) {
        // Prefer an energy-category match; fall back to a name match.
        const e =
          substances.find((s) => (s.category || '').toLowerCase() === 'energy' && re.test(s.substance_name || '')) ||
          find(re)
        if (e) out.push({ sub: e, dir: 'input', unit: e.unit || u, label })
      }
    }
    // Common output — CO2 emissions.
    const co2 = find(/carbon dioxide|^co2$|\(co2\)/i)
    if (co2) out.push({ sub: co2, dir: 'output', unit: co2.unit || 'kg', label: 'Carbon Dioxide' })

    // De-dup by substance, drop ones already added, cap at 6.
    const seen = new Set<number>()
    return out
      .filter((s) => !existingIds.has(s.sub.substance_id) && !seen.has(s.sub.substance_id) && seen.add(s.sub.substance_id))
      .slice(0, 6)
  }, [substances, flows, componentName, componentType])

  const resetForm = () => {
    setAdding(false)
    setSearch('')
    setSubstanceId(null)
    setDir('input')
    setQty('')
    setUnit('kg')
  }

  // Open the add form pre-filled from a suggestion. Quantity stays blank for
  // the user to fill — it's specific to their process and can't be inferred.
  const applySuggestion = (s: { sub: Substance; dir: 'input' | 'output'; unit: string }) => {
    setAdding(true)
    setSubstanceId(s.sub.substance_id)
    setSearch(s.sub.substance_name)
    setDir(s.dir)
    setUnit(s.unit)
    setQty('')
  }

  async function saveFlow() {
    if (!substanceId || !qty || isNaN(Number(qty))) return
    setSaving(true)
    try {
      const r = await fetch(`/api/components/${componentId}/flows`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          substance_id: substanceId,
          flow_type: dir,
          quantity: Number(qty),
          unit: unit.trim() || 'kg',
        }),
      })
      if (r.ok) {
        toast.success('Flow added')
        resetForm()
        await loadFlows()
        // Tell the canvas/sidebar to refresh flow counts.
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('lcapix:components-changed'))
        }
      } else {
        // Surfaces the server's unit-compatibility guard, among others.
        const body = await r.json().catch(() => null)
        toast.error(body?.error || 'Could not add flow')
      }
    } finally {
      setSaving(false)
    }
  }

  async function saveEdit() {
    if (!editing || editSaving) return
    const qtyNum = Number(editing.qty)
    if (editing.qty.trim() === '' || isNaN(qtyNum)) {
      toast.error('Quantity must be a number')
      return
    }
    setEditSaving(true)
    try {
      const r = await fetch(`/api/flows/${editing.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ quantity: qtyNum, unit: editing.unit.trim() || undefined }),
      })
      if (r.ok) {
        toast.success('Flow updated')
        setEditing(null)
        await loadFlows()
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('lcapix:components-changed'))
        }
      } else {
        // Surfaces the server's unit-compatibility guard, among others.
        const body = await r.json().catch(() => null)
        toast.error(body?.error || 'Could not update flow')
      }
    } finally {
      setEditSaving(false)
    }
  }

  async function deleteFlow(flowId: number) {
    const r = await fetch(`/api/flows/${flowId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (r.ok) {
      toast.success('Flow deleted')
      await loadFlows()
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('lcapix:components-changed'))
      }
    } else {
      toast.error('Could not delete flow')
    }
  }

  const selectedSubstance = substances.find((s) => s.substance_id === substanceId)

  return (
    <div>
      {/* Flow list */}
      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '4px 0' }}>
          Loading flows…
        </div>
      ) : flows.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '4px 0' }}>
          No flows yet. Add the substances this step consumes or emits.
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 6, overflow: 'hidden' }}>
          {flows.map((f, i) => (
            <div
              key={f.flow_id}
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
                  title={`Source database: ${substanceSource(f).label}`}
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
                  {substanceSource(f).label}
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
                <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                  <input
                    className="input mono"
                    type="number"
                    autoFocus
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
                  onClick={() =>
                    setEditing({ id: f.flow_id, qty: String(f.quantity), unit: f.unit })
                  }
                  title="Edit quantity/unit"
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
                onClick={() => deleteFlow(f.flow_id)}
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
          ))}
        </div>
      )}

      {/* Suggested flows from the public catalog (openLCA / PubChem). Click to
          pre-fill the add form; you set the quantity. */}
      {!adding && suggestions.length > 0 && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 8,
            background: 'color-mix(in oklab, var(--brand-primary) 5%, var(--surface-raised))',
            border: '1px solid color-mix(in oklab, var(--brand-primary) 16%, var(--border-subtle))',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: 'var(--text-secondary)',
              marginBottom: 8,
            }}
          >
            <span style={{ color: 'var(--brand-primary)' }}>✦</span>
            Suggested from the substance catalog
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {suggestions.map((s) => (
              <button
                key={s.sub.substance_id}
                type="button"
                onClick={() => applySuggestion(s)}
                className="btn btn-ghost btn-sm"
                style={{
                  fontSize: 11,
                  padding: '4px 9px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 999,
                }}
                title={`Add ${s.label} as ${s.dir} (${s.unit})`}
              >
                <Icon name="plus" size={11} />
                {s.label}
                <span style={{ color: 'var(--text-tertiary)' }}>
                  {' '}· {s.dir === 'input' ? 'IN' : 'OUT'} · {s.unit}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add-flow affordance */}
      {!adding ? (
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}
          type="button"
          onClick={() => setAdding(true)}
        >
          <Icon name="plus" size={12} /> Add flow
        </button>
      ) : (
        <div
          style={{
            marginTop: 8,
            padding: 10,
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            background: 'var(--surface-raised)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {/* Substance search/picker */}
          <div>
            <label className="label" style={{ fontSize: 11 }}>Substance</label>
            <input
              className="input"
              placeholder="Search substances…"
              value={selectedSubstance ? selectedSubstance.substance_name : search}
              onChange={(e) => {
                setSearch(e.target.value)
                setSubstanceId(null)
              }}
            />
            {!substanceId && (
              <div
                style={{
                  marginTop: 4,
                  border: matches.length ? '1px solid var(--border-subtle)' : 'none',
                  borderRadius: 6,
                  maxHeight: 160,
                  overflowY: 'auto',
                }}
              >
                {matches.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '6px 8px' }}>
                    {substances.length === 0
                      ? 'No substances in catalog. Import a factor pack from Integrations → openLCA.'
                      : 'No match.'}
                  </div>
                ) : (
                  matches.map((s) => (
                    <button
                      key={s.substance_id}
                      type="button"
                      onClick={() => {
                        setSubstanceId(s.substance_id)
                        if (s.unit) setUnit(s.unit)
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '6px 8px',
                        fontSize: 12,
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%' }}>
                        {s.substance_name}
                        <FactorCoverageBadge s={s} />
                      </span>
                      {s.category ? (
                        <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}> · {s.category}</span>
                      ) : null}
                      <span
                        className="mono"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                          marginTop: 2,
                          fontSize: 9.5,
                          color: 'var(--text-tertiary)',
                        }}
                      >
                        <Icon name="database" size={9} />
                        {substanceSource(s).label}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
            {/* Source database for the chosen substance — answers
                "what database is this coming from?" before the flow is saved. */}
            {selectedSubstance && (
              <div
                className="mono"
                style={{
                  marginTop: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 10,
                  color: 'var(--text-secondary)',
                  background: 'var(--surface-overlay)',
                  padding: '4px 8px',
                  borderRadius: 5,
                }}
              >
                <Icon name="database" size={11} />
                Source: {substanceSource(selectedSubstance).label}
                <FactorCoverageBadge s={selectedSubstance} />
              </div>
            )}
          </div>

          {/* Direction + qty + unit */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <label className="label" style={{ fontSize: 11 }}>Direction</label>
              <select
                className="input"
                value={dir}
                onChange={(e) => setDir(e.target.value as 'input' | 'output')}
              >
                <option value="input">Input</option>
                <option value="output">Output</option>
              </select>
            </div>
            <div>
              <label className="label" style={{ fontSize: 11 }}>Quantity</label>
              <input
                className="input"
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="0.0"
              />
            </div>
            <div>
              <label className="label" style={{ fontSize: 11 }}>Unit</label>
              <input
                className="input"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="kg"
                list="lcapix-flow-units"
              />
              <datalist id="lcapix-flow-units">
                {(selectedSubstance ? compatibleUnits(selectedSubstance.unit) : []).map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!substanceId || !qty || saving}
              onClick={saveFlow}
              style={{ fontSize: 11 }}
            >
              {saving ? 'Saving…' : 'Save flow'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={resetForm}
              style={{ fontSize: 11 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
