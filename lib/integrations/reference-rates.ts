// Static reference rates for the "Suggest costs" affordance.
//
// These are curated representative averages from free public sources, used in
// place of live API calls so the cost/factor flow works with zero API keys and
// no rate limits. For LCA this is methodologically fine — assessments want
// representative period averages, not real-time spot prices.
//
// Sources (update annually):
//   - Labor:    US BLS OEWS national mean hourly wage by occupation
//               https://www.bls.gov/oes/tables.htm
//   - Energy:   US EIA average retail electricity price
//               https://www.eia.gov/electricity/
//   - Material: USGS Mineral Commodity Summaries + public market averages
//               https://www.usgs.gov/centers/national-minerals-information-center
//   - Grid CO2: Electricity Maps published yearly zone averages
//               https://www.electricitymaps.com/
//
// Last reviewed: 2026-06 (values are representative, not authoritative).

export const REFERENCE_VINTAGE = '2026-06'

// ── Labor: USD / hour (BLS OEWS national mean) ──────────────────────────────
export const LABOR_RATES: Record<string, { rate: number; label: string; soc: string }> = {
  welder:     { rate: 25.83, label: 'Welders/cutters (51-4121)', soc: '51-4121' },
  machinist:  { rate: 24.40, label: 'Machinists (51-4041)',       soc: '51-4041' },
  assembler:  { rate: 18.60, label: 'Assemblers (51-2090)',       soc: '51-2090' },
  cnc:        { rate: 22.10, label: 'CNC operators (51-9161)',    soc: '51-9161' },
  generic:    { rate: 21.00, label: 'Production worker (avg)',    soc: '51-0000' },
}

// ── Energy: USD / kWh (EIA average retail) ──────────────────────────────────
export const ENERGY_RATES: Record<string, { rate: number; label: string }> = {
  electricity:            { rate: 0.13, label: 'Electricity, all-sector US avg' },
  // EIA Electric Power Monthly Table 5.3, 2025 full year: 8.62 cents/kWh
  // (released 2026-08-26).
  electricity_industrial: { rate: 0.0862, label: 'Electricity, industrial US avg 2025 (EIA)' },
  electricity_commercial: { rate: 0.13, label: 'Electricity, commercial US avg' },
  natural_gas:            { rate: 0.04, label: 'Natural gas, $/kWh-equiv' },
}

// ── Material: USD / kg (USGS + public market averages) ──────────────────────
// Keyword-matched against the component/substance name.
export const MATERIAL_RATES: Array<{ match: RegExp; rate: number; label: string }> = [
  { match: /alumin/i,                       rate: 2.10, label: 'Aluminum, primary' },
  { match: /stainless/i,                    rate: 3.50, label: 'Stainless steel' },
  { match: /steel|iron/i,                   rate: 0.95, label: 'Steel, hot-rolled' },
  { match: /copper/i,                       rate: 9.50, label: 'Copper' },
  { match: /zinc|galvani/i,                 rate: 2.80, label: 'Zinc' },
  { match: /nickel/i,                       rate: 18.0, label: 'Nickel' },
  { match: /pet\b|polyethylene tere/i,      rate: 1.50, label: 'PET resin' },
  { match: /hdpe|high.?density/i,           rate: 1.40, label: 'HDPE resin' },
  { match: /pvc/i,                          rate: 1.20, label: 'PVC resin' },
  { match: /plastic|polymer|resin/i,        rate: 1.45, label: 'Plastic resin (avg)' },
  { match: /glass/i,                        rate: 0.50, label: 'Glass' },
  { match: /cardboard|paper|carton/i,       rate: 0.60, label: 'Cardboard/paper' },
  { match: /wood|timber/i,                  rate: 0.45, label: 'Wood' },
]
export const MATERIAL_DEFAULT = { rate: 1.50, label: 'Generic material (avg)' }

// ── Grid carbon intensity: kg CO2-eq / kWh ──────────────────────────────────
// Used ONLY to fill a genuine gap (a zone with no factor on file). The US and
// Global values are kept consistent with the audited characterization factors
// (migrate-009): US = EPA eGRID 2023 national average (0.350), Global = Ember
// 2024 (0.473) — so a gap-fill can never reintroduce a coarser number than the
// engine already trusts. Other zones are Electricity Maps published yearly
// averages; refine them against a cited source before treating as ground truth.
export const GRID_CARBON: Record<string, { factor: number; label: string }> = {
  US:     { factor: 0.350, label: 'United States (EPA eGRID 2023 avg)' },
  'US-CAL-CISO': { factor: 0.24, label: 'California (CAISO)' },
  EU:     { factor: 0.25, label: 'European Union (avg)' },
  FR:     { factor: 0.05, label: 'France' },
  DE:     { factor: 0.38, label: 'Germany' },
  GB:     { factor: 0.21, label: 'Great Britain' },
  CN:     { factor: 0.55, label: 'China' },
  IN:     { factor: 0.63, label: 'India' },
  NO:     { factor: 0.03, label: 'Norway' },
  Global: { factor: 0.473, label: 'Global (Ember 2024 avg)' },
}

// ── Helpers ─────────────────────────────────────────────────────────────────
export function pickMaterialRate(nameOrSubstance?: string | null) {
  if (nameOrSubstance) {
    const hit = MATERIAL_RATES.find((m) => m.match.test(nameOrSubstance))
    if (hit) return hit
  }
  return MATERIAL_DEFAULT
}

export function getLaborRate(nameOrType?: string | null) {
  const s = (nameOrType || '').toLowerCase()
  if (/weld/.test(s)) return LABOR_RATES.welder
  if (/machin|mill|lathe|cnc/.test(s)) return LABOR_RATES.cnc
  if (/assembl/.test(s)) return LABOR_RATES.assembler
  return LABOR_RATES.generic
}

export function getEnergyRate() {
  return ENERGY_RATES.electricity
}

export function getGridCarbon(region?: string | null) {
  if (region && GRID_CARBON[region]) return GRID_CARBON[region]
  return GRID_CARBON.US
}

// ── Freight: USD / tonne-km (representative modal averages) ──────────────────
// COST, not emissions. Order-of-magnitude US freight averages so a transport
// leg can be costed from its real tonne-km; refine against a cited BTS/industry
// source before treating as ground truth. The user overrides after applying.
export const FREIGHT_RATES: Record<string, { rate: number; label: string }> = {
  truck: { rate: 0.12, label: 'Road freight (truck)' },
  rail: { rate: 0.04, label: 'Rail freight' },
  ocean: { rate: 0.006, label: 'Ocean freight' },
  air: { rate: 0.8, label: 'Air freight' },
}

/** Pick a freight rate from a transport substance name (mode), default truck. */
export function pickFreightRate(nameOrMode?: string | null) {
  const s = (nameOrMode || '').toLowerCase()
  if (/rail|train/.test(s)) return { mode: 'rail', ...FREIGHT_RATES.rail }
  if (/ocean|\bsea\b|marine|vessel|barge|maritime/.test(s))
    return { mode: 'ocean', ...FREIGHT_RATES.ocean }
  if (/\bair\b|plane|aviation/.test(s)) return { mode: 'air', ...FREIGHT_RATES.air }
  return { mode: 'truck', ...FREIGHT_RATES.truck }
}

// ── Fuel / energy prices: USD per the STATED unit (EIA-style averages) ───────
// Representative delivered-industrial averages. The flow's OWN unit selects the
// rate, so we price the REAL quantity rather than converting to a guess. A
// missing (carrier, unit) pair returns null → the caller NOTES it instead of
// inventing a cost. Values vary widely; the user overrides with their invoice.
export const FUEL_ENERGY_PRICES: Record<string, Record<string, { rate: number; label: string }>> = {
  electricity: { kwh: { rate: 0.13, label: 'Electricity ($/kWh, US avg)' } },
  natural_gas: {
    m3: { rate: 0.28, label: 'Natural gas ($/m³, industrial)' },
    mmbtu: { rate: 8.0, label: 'Natural gas ($/MMBtu, industrial)' },
    kwh: { rate: 0.04, label: 'Natural gas ($/kWh-eq)' },
  },
  coal: { mmbtu: { rate: 2.5, label: 'Coal ($/MMBtu)' }, kg: { rate: 0.1, label: 'Coal ($/kg)' } },
  fuel_oil: { mmbtu: { rate: 20.0, label: 'Fuel oil ($/MMBtu)' }, l: { rate: 0.9, label: 'Fuel oil ($/L)' } },
  lpg: { mmbtu: { rate: 25.0, label: 'LPG ($/MMBtu)' }, l: { rate: 0.75, label: 'LPG ($/L)' } },
  diesel: { l: { rate: 1.0, label: 'Diesel ($/L)' }, mmbtu: { rate: 22.0, label: 'Diesel ($/MMBtu)' } },
  wood: { mmbtu: { rate: 3.0, label: 'Wood ($/MMBtu)' }, kg: { rate: 0.06, label: 'Wood ($/kg)' } },
}

/** Classify an energy-carrier substance by name; null if it is not a carrier. */
export function classifyEnergyCarrier(substance?: string | null): string | null {
  const s = (substance || '').toLowerCase()
  if (/electric/.test(s)) return 'electricity'
  if (/natural\s*gas|methane/.test(s)) return 'natural_gas'
  if (/coal|lignite|anthracite/.test(s)) return 'coal'
  if (/fuel\s*oil|distillate|heavy fuel|\bhfo\b|#\s*\d\s*fuel/.test(s)) return 'fuel_oil'
  if (/\blpg\b|propane|liquefied petroleum/.test(s)) return 'lpg'
  if (/diesel|gas\s*oil/.test(s)) return 'diesel'
  if (/\bwood\b|biomass|wood residual/.test(s)) return 'wood'
  return null
}

/** $/unit for an energy flow priced in its OWN unit, or null if unpriceable. */
export function energyLineRate(
  substance: string,
  unit: string,
): { rate: number; label: string } | null {
  const carrier = classifyEnergyCarrier(substance)
  if (!carrier) return null
  const u = (unit || '').toLowerCase().replace('³', '3').replace(/\s/g, '')
  const key =
    u === 'm3'
      ? 'm3'
      : u === 'kwh'
        ? 'kwh'
        : u === 'mmbtu'
          ? 'mmbtu'
          : u === 'l' || u === 'liter' || u === 'litre'
            ? 'l'
            : u === 'kg'
              ? 'kg'
              : u
  return FUEL_ENERGY_PRICES[carrier]?.[key] ?? null
}
