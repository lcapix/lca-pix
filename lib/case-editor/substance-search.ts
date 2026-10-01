// Finding a substance for a flow: the search list (with versions of a
// material right under it), the versions of the one selected, the catalog
// suggestions for a step, and what an existing flow can be swapped to.

import { compatibleUnits } from '@/lib/units'
import type { FlowRow, Substance } from './flow-types'

/**
 * Up to 10 matches for the search box. Versions of a matched material
 * (recycled aluminium, EAF steel) are shown right under their parent, so
 * "switch to recycled" is something you can see rather than something you
 * have to know exists.
 */
export function matchSubstances(search: string, substances: Substance[]): Substance[] {
  const q = search.trim().toLowerCase()
  const base = q ? substances.filter((s) => s.substance_name?.toLowerCase().includes(q)) : substances
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
}

/** The other versions of the selected substance, for the one-line switcher under the picker. */
export function versionsOf(substances: Substance[], substanceId: number | null): Substance[] {
  const cur = substances.find((x) => x.substance_id === substanceId)
  if (!cur) return []
  const familyId = cur.variant_of ?? cur.substance_id
  return substances.filter(
    (x) => (x.variant_of ?? x.substance_id) === familyId && x.substance_id !== cur.substance_id,
  )
}

export interface FlowSuggestion {
  sub: Substance
  dir: 'input' | 'output'
  unit: string
  label: string
}

/**
 * Suggested flows from the public substance catalog, tailored to this node.
 * Quantities are process-specific so they are never invented — only the
 * substance, direction, and default unit are suggested. Substances must
 * exist in the imported catalog (openLCA/PubChem) to be offered. De-duplicated,
 * minus what the step already has, at most 6.
 */
export function suggestFlowsFor({
  substances,
  flows,
  componentName,
  componentType,
}: {
  substances: Substance[]
  flows: FlowRow[]
  componentName: string
  componentType: string
}): FlowSuggestion[] {
  const out: FlowSuggestion[] = []
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
}

/**
 * What an existing flow's substance can be swapped to: same kind of
 * substance (a material for a material), a unit the flow can convert to, and
 * impact data. Versions of the same material come first.
 */
export function swapOptionsFor(substances: Substance[], substanceId: number) {
  const cur = substances.find((s) => s.substance_id === substanceId)
  const units = cur?.unit ? compatibleUnits(cur.unit) : []
  const options = substances.filter(
    (s) =>
      s.substance_id === substanceId ||
      ((s.factor_count ?? 0) > 0 &&
        (cur?.category ? s.category === cur.category : !/emission|waste/.test(s.category ?? '')) &&
        (!units.length || units.includes(s.unit ?? ''))),
  )
  // Variants of the same material (EAF steel, recycled aluminum) come first
  // and are labelled as versions of it, so "switch to recycled" is one choice
  // rather than a hunt through the whole catalog.
  const familyOf = (x: (typeof options)[number]) => (x as any).variant_of ?? x.substance_id
  const family = cur ? familyOf(cur) : null
  const variants = options.filter((s) => family != null && familyOf(s) === family)
  const others = options.filter((s) => !variants.includes(s))
  return { options, variants, others }
}

/** "Steel — EAF" for a version, else the name. */
export const substanceOptionLabel = (s: Substance) =>
  (s as any).variant_label ? `${s.substance_name} — ${(s as any).variant_label}` : s.substance_name
