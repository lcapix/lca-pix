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
import { HelpTip } from '@/components/lcapix/help-tip'
import { ISO_HELP } from '@/components/lcapix/iso-help'
import { toast } from 'sonner'
import { ProcessLibrary } from '@/components/lcapix/case/process-library'

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
  /** Set when this substance is a version of another (migrate-022). */
  variant_of?: number | null
  variant_label?: string | null
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
  studyMethod,
}: {
  componentId: string
  componentName?: string
  componentType?: string
  /** The study's LCIA method, used as the default for a hand-added factor. */
  studyMethod?: string
}) {
  const [flows, setFlows] = useState<FlowRow[]>([])
  const [substances, setSubstances] = useState<Substance[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  // The process library: what a step of this kind consumes, in driver units.
  const [libraryOpen, setLibraryOpen] = useState(false)
  // A process picked while creating the step opens the library here, already on
  // that process (dispatched by the case editor after the step is created).
  const [libraryTemplateId, setLibraryTemplateId] = useState<number | null>(null)
  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent).detail?.templateId
      setLibraryTemplateId(typeof id === 'number' ? id : null)
      setAdding(true)
      setLibraryOpen(true)
    }
    window.addEventListener('lcapix:open-process-library', onOpen)
    return () => window.removeEventListener('lcapix:open-process-library', onOpen)
  }, [])
  const [saving, setSaving] = useState(false)
  // In-place edit of an existing row's quantity/unit — a what-if is
  // "duplicate the case, tweak a few quantities, re-run"; without this the
  // only way to change 95 → 40 was delete + re-add.
  // A flow's factor source comes from its catalog substance (the API returns
  // the cited sources of its factors as data_source).
  const sourceOf = (f: FlowRow) =>
    substanceSource(substances.find((s) => s.substance_id === f.substance_id) ?? f)
  // The substance can be swapped too (aluminum → steel): same flow, another
  // material, which is what a comparative case changes.
  const [editing, setEditing] = useState<{
    id: number
    qty: string
    unit: string
    substanceId: number
  } | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  // Add-form state
  const [search, setSearch] = useState('')
  const [substanceId, setSubstanceId] = useState<number | null>(null)
  // Adding a substance by hand: no library has everything, and picking
  // something "close enough" models the wrong material silently.
  const [addingSubstance, setAddingSubstance] = useState(false)
  const [newSub, setNewSub] = useState({
    name: '',
    kind: 'input' as 'input' | 'emission',
    unit: 'kg',
    method: 'TRACI 2.1',
    impactCategory: 'Global Warming',
    factorValue: '',
    source: '',
  })
  const [subError, setSubError] = useState<string | null>(null)
  const [subBusy, setSubBusy] = useState(false)
  const [impactCategories, setImpactCategories] = useState<Array<{ category_name: string; unit?: string }>>([])
  const [dir, setDir] = useState<'input' | 'output'>('input')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState('kg')
  // Transport-leg helper: for tonne-km substances a user shouldn't hand-compute
  // tkm. They enter mass (tonnes) and distance (km); we set quantity = t × km.
  const [legMassT, setLegMassT] = useState('')
  const [legKm, setLegKm] = useState('')

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

  // Other panels (e.g. the machine-energy calculator) add flows too; reload
  // when they announce it so the list never goes stale.
  useEffect(() => {
    const onChanged = () => loadFlows()
    window.addEventListener('lcapix:flows-changed', onChanged)
    return () => window.removeEventListener('lcapix:flows-changed', onChanged)
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

  useEffect(() => {
    if (!addingSubstance || impactCategories.length) return
    ;(async () => {
      try {
        const r = await fetch('/api/impact-categories', { headers: authHeaders() })
        const d = await r.json().catch(() => ({}))
        const list = (d?.categories ?? d?.impact_categories ?? d?.data ?? []) as any[]
        setImpactCategories(list.map((c) => ({ category_name: c.category_name, unit: c.unit })))
      } catch {
        /* the form still works: the name is validated server-side */
      }
    })()
  }, [addingSubstance, impactCategories.length])

  useEffect(() => {
    if (studyMethod) setNewSub((n) => ({ ...n, method: studyMethod }))
  }, [studyMethod])

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = q
      ? substances.filter((s) => s.substance_name?.toLowerCase().includes(q))
      : substances
    // Versions of a matched material (recycled aluminium, EAF steel) are shown
    // right under their parent, so "switch to recycled" is something you can
    // see rather than something you have to know exists.
    const byId = new Map(substances.map((x) => [x.substance_id, x]))
    const out: typeof base = []
    const seen = new Set<number>()
    const push = (x: (typeof base)[number]) => {
      if (x && !seen.has(x.substance_id)) {
        seen.add(x.substance_id)
        out.push(x)
      }
    }
    for (const m of base) {
      const parent = m.variant_of ? byId.get(m.variant_of) : m
      push(parent ?? m)
      for (const v of substances) if (v.variant_of && v.variant_of === (parent ?? m).substance_id) push(v)
      if (out.length >= 10) break
    }
    return out.slice(0, 10)
  }, [search, substances])

  /** Versions of whatever is selected, for the one-line switcher under the picker. */
  const versionsOfSelected = useMemo(() => {
    const cur = substances.find((x) => x.substance_id === substanceId)
    if (!cur) return []
    const familyId = cur.variant_of ?? cur.substance_id
    return substances.filter(
      (x) => (x.variant_of ?? x.substance_id) === familyId && x.substance_id !== cur.substance_id,
    )
  }, [substances, substanceId])

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
    setLegMassT('')
    setLegKm('')
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
          // A leg is entered as mass x distance but stored as tonne-km, which
          // cannot be read back (finding #70). Keep the two numbers with it.
          ...(isTransportLeg && legTkm != null
            ? {
                transport_mass_kg: Number(legMassT) * 1000,
                transport_distance_km: Number(legKm),
              }
            : {}),
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
      const before = flows.find((x) => x.flow_id === editing.id)
      const swapped = !!before && before.substance_id !== editing.substanceId
      const r = await fetch(`/api/flows/${editing.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          quantity: qtyNum,
          unit: editing.unit.trim() || undefined,
          ...(swapped ? { substance_id: editing.substanceId } : {}),
        }),
      })
      if (r.ok) {
        const to = substances.find((s) => s.substance_id === editing.substanceId)?.substance_name
        toast.success(swapped && to ? `Swapped to ${to}` : 'Flow updated')
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
  // A transport substance is quantified in tonne-km (freight work = mass ×
  // distance). Detect it from the catalog unit or the name so we can offer the
  // leg calculator instead of asking for a raw tkm figure.
  const isTransportLeg =
    !!selectedSubstance &&
    ((selectedSubstance.unit || '').toLowerCase() === 'tkm' ||
      /transport|freight|haul/i.test(selectedSubstance.substance_name || ''))
  const legTkm =
    legMassT && legKm && !isNaN(Number(legMassT)) && !isNaN(Number(legKm))
      ? Number(legMassT) * Number(legKm)
      : null

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
                  {(() => {
                    // Swap candidates: same kind of substance (a material for a
                    // material), a unit the flow can convert to, and impact data.
                    const cur = substances.find((s) => s.substance_id === f.substance_id)
                    const units = cur?.unit ? compatibleUnits(cur.unit) : []
                    const options = substances.filter(
                      (s) =>
                        s.substance_id === f.substance_id ||
                        ((s.factor_count ?? 0) > 0 &&
                          (cur?.category ? s.category === cur.category : !/emission|waste/.test(s.category ?? '')) &&
                          (!units.length || units.includes(s.unit ?? '')))
                    )
                    // Variants of the same material (EAF steel, recycled
                    // aluminum) come first and are labelled as versions of it,
                    // so "switch to recycled" is one choice rather than a hunt
                    // through the whole catalog.
                    const familyOf = (x: (typeof options)[number]) =>
                      (x as any).variant_of ?? x.substance_id
                    const family = cur ? familyOf(cur) : null
                    const variants = options.filter((s) => family != null && familyOf(s) === family)
                    const others = options.filter((s) => !variants.includes(s))
                    const optionLabel = (s: (typeof options)[number]) =>
                      (s as any).variant_label
                        ? `${s.substance_name} — ${(s as any).variant_label}`
                        : s.substance_name

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
                                {optionLabel(s)}
                              </option>
                            ))}
                          </optgroup>
                        ) : (
                          variants.map((s) => (
                            <option key={s.substance_id} value={s.substance_id}>
                              {optionLabel(s)}
                            </option>
                          ))
                        )}
                        {others.length > 0 && (
                          <optgroup label="Other materials">
                            {others.map((s) => (
                              <option key={s.substance_id} value={s.substance_id}>
                                {optionLabel(s)}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    ) : null
                  })()}
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
                  onClick={() =>
                    setEditing({
                      id: f.flow_id,
                      qty: String(f.quantity),
                      unit: f.unit,
                      substanceId: f.substance_id,
                    })
                  }
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

      {/* Add-flow affordance. The process library used to be reachable only
          from inside the add form, after opening it and before picking a
          substance, which is three steps away from anybody who does not already
          know it exists. It sits here instead, next to Add flow. */}
      {!adding && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ flex: 1, justifyContent: 'center' }}
            type="button"
            onClick={() => {
              setAdding(true)
              setLibraryOpen(true)
            }}
            title="Pick the kind of process this step is: the library lists what it consumes and in which unit"
          >
            <Icon name="list" size={12} /> Process library
          </button>
        </div>
      )}
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
            <label className="label" style={{ fontSize: 11 }}>
              Substance
              <HelpTip label="What is a substance?">{ISO_HELP.flowSubstance}</HelpTip>
            </label>
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
                        {s.variant_of ? '↳ ' : ''}
                        {s.substance_name}
                        <FactorCoverageBadge s={s} />
                        {s.variant_label && (
                          <span
                            style={{
                              fontSize: 9.5,
                              padding: '1px 5px',
                              borderRadius: 999,
                              background: 'color-mix(in oklab, var(--brand-primary) 12%, transparent)',
                              color: 'var(--brand-primary)',
                            }}
                          >
                            {s.variant_label}
                          </span>
                        )}
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
            {substanceId && versionsOfSelected.length > 0 && (
              <div
                style={{
                  marginTop: 6,
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: 'color-mix(in oklab, var(--brand-primary) 6%, transparent)',
                  fontSize: 11,
                  color: 'var(--text-secondary)',
                }}
              >
                <span style={{ marginRight: 6 }}>Versions of this material:</span>
                {versionsOfSelected.map((v) => (
                  <button
                    key={v.substance_id}
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '1px 6px', fontSize: 11 }}
                    title={`Switch to ${v.substance_name}${v.variant_label ? ` (${v.variant_label})` : ''}`}
                    onClick={() => {
                      setSubstanceId(v.substance_id)
                      if (v.unit) setUnit(v.unit)
                    }}
                  >
                    {v.variant_label || v.substance_name}
                  </button>
                ))}
              </div>
            )}
            {!substanceId && !addingSubstance && !libraryOpen && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 6, padding: '2px 0', fontSize: 11.5 }}
                  onClick={() => {
                    setSubError(null)
                    setNewSub((n) => ({ ...n, name: search.trim() || n.name }))
                    setAddingSubstance(true)
                  }}
                >
                  Not in the list? Add a substance
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 6, padding: '2px 0', fontSize: 11.5 }}
                  onClick={() => setLibraryOpen(true)}
                  title="Pick the kind of process this step is: the library lists what it consumes and in which unit"
                >
                  Don't know what to add? Use the process library
                </button>
              </div>
            )}
            {libraryOpen && (
              <ProcessLibrary
                componentId={componentId}
                initialTemplateId={libraryTemplateId}
                onAdded={() => {
                  loadFlows()
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('lcapix:components-changed'))
                  }
                }}
                onClose={() => setLibraryOpen(false)}
              />
            )}
            {addingSubstance && (
              <div
                style={{
                  marginTop: 8,
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid color-mix(in oklab, var(--brand-primary) 35%, transparent)',
                  background: 'var(--surface-base)',
                  display: 'grid',
                  gap: 8,
                }}
              >
                <div className="label" style={{ fontSize: 11 }}>
                  Add a substance
                  <HelpTip label="When should I add one?">
                    Add a material, fuel or emission the catalog does not have, rather than picking
                    something close and modelling the wrong thing. It is yours alone, and its factor
                    counts as unverified data until you replace the source with a published one.
                  </HelpTip>
                </div>
                <input
                  className="input"
                  placeholder="Name, e.g. Cork, expanded"
                  value={newSub.name}
                  onChange={(e) => setNewSub({ ...newSub, name: e.target.value })}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
                    What is it?
                    <select
                      className="input"
                      value={newSub.kind}
                      onChange={(e) => setNewSub({ ...newSub, kind: e.target.value as 'input' | 'emission' })}
                      style={{ marginTop: 2 }}
                    >
                      <option value="input">Something you buy or use</option>
                      <option value="emission">Something released</option>
                    </select>
                  </label>
                  <label style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
                    Measured in
                    <input
                      className="input"
                      placeholder="kg, kWh, MJ, m3, tkm"
                      value={newSub.unit}
                      onChange={(e) => setNewSub({ ...newSub, unit: e.target.value })}
                      style={{ marginTop: 2 }}
                    />
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
                    Method
                    <select
                      className="input"
                      value={newSub.method}
                      onChange={(e) => setNewSub({ ...newSub, method: e.target.value })}
                      style={{ marginTop: 2 }}
                    >
                      {['TRACI 2.1', 'CML 2001', 'ReCiPe Midpoint (H)'].map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
                    Impact category
                    <select
                      className="input"
                      value={newSub.impactCategory}
                      onChange={(e) => setNewSub({ ...newSub, impactCategory: e.target.value })}
                      style={{ marginTop: 2 }}
                    >
                      {(impactCategories.length
                        ? impactCategories.map((c) => c.category_name)
                        : ['Global Warming']
                      ).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
                  Factor, per {newSub.unit || 'unit'}
                  <input
                    className="input"
                    type="number"
                    step="any"
                    placeholder="e.g. 1.6"
                    value={newSub.factorValue}
                    onChange={(e) => setNewSub({ ...newSub, factorValue: e.target.value })}
                    style={{ marginTop: 2 }}
                  />
                </label>
                <label style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>
                  Where it comes from
                  <input
                    className="input"
                    placeholder="e.g. Amorim ICB EPD 2023, cradle-to-gate"
                    value={newSub.source}
                    onChange={(e) => setNewSub({ ...newSub, source: e.target.value })}
                    style={{ marginTop: 2 }}
                  />
                </label>
                {subError && (
                  <div role="alert" style={{ fontSize: 11.5, color: '#b45309', lineHeight: 1.45 }}>
                    {subError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={subBusy}
                    onClick={async () => {
                      setSubBusy(true)
                      setSubError(null)
                      try {
                        const catUnit = impactCategories.find(
                          (c) => c.category_name === newSub.impactCategory,
                        )?.unit
                        const r = await fetch('/api/substances', {
                          method: 'POST',
                          headers: authHeaders(),
                          body: JSON.stringify({
                            ...newSub,
                            factorUnit: catUnit ? `${catUnit} / ${newSub.unit}` : undefined,
                          }),
                        })
                        const d = await r.json().catch(() => ({}))
                        if (!r.ok || !d?.substance) {
                          setSubError(d?.error || 'Could not add the substance.')
                        } else {
                          setSubstances((list) => [...list, d.substance])
                          setSubstanceId(d.substance.substance_id)
                          setUnit(d.substance.unit || newSub.unit)
                          setSearch('')
                          setAddingSubstance(false)
                          setNewSub({
                            name: '',
                            kind: 'input',
                            unit: 'kg',
                            method: studyMethod || 'TRACI 2.1',
                            impactCategory: 'Global Warming',
                            factorValue: '',
                            source: '',
                          })
                        }
                      } catch {
                        setSubError('Could not add the substance.')
                      } finally {
                        setSubBusy(false)
                      }
                    }}
                  >
                    {subBusy ? 'Adding…' : 'Add and use it'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setAddingSubstance(false)
                      setSubError(null)
                    }}
                  >
                    Cancel
                  </button>
                </div>
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

          {/* Transport-leg calculator: mass (t) × distance (km) → tonne-km. */}
          {isTransportLeg && (
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
                    value={legMassT}
                    onChange={(e) => {
                      setLegMassT(e.target.value)
                      const t = Number(e.target.value)
                      const km = Number(legKm)
                      if (t && km) { setQty(String(t * km)); setUnit('tkm') }
                    }}
                    placeholder="e.g. 1.2"
                  />
                </div>
                <div>
                  <label className="label" style={{ fontSize: 10 }}>Distance (km)</label>
                  <input
                    className="input"
                    type="number"
                    value={legKm}
                    onChange={(e) => {
                      setLegKm(e.target.value)
                      const km = Number(e.target.value)
                      const t = Number(legMassT)
                      if (t && km) { setQty(String(t * km)); setUnit('tkm') }
                    }}
                    placeholder="e.g. 450"
                  />
                </div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)', paddingBottom: 8 }}>
                  = {legTkm != null ? legTkm.toLocaleString() : '—'} tkm
                </div>
              </div>
            </div>
          )}

          {/* Direction + qty + unit */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <label className="label" style={{ fontSize: 11 }}>
                Direction
                <HelpTip label="Input or output?">{ISO_HELP.flowDirection}</HelpTip>
              </label>
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
              <label className="label" style={{ fontSize: 11 }}>
                Quantity
                <HelpTip label="How much should I enter?">{ISO_HELP.flowQuantity}</HelpTip>
              </label>
              <input
                className="input"
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="0.0"
              />
            </div>
            <div>
              <label className="label" style={{ fontSize: 11 }}>
                Unit
                <HelpTip label="Which units work?">{ISO_HELP.flowUnit}</HelpTip>
              </label>
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
