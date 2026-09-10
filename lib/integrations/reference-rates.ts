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
  electricity_industrial: { rate: 0.08, label: 'Electricity, industrial US avg' },
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

// ── Grid carbon intensity: kg CO2-eq / kWh (Electricity Maps yearly avg) ─────
// Used to seed the electricity characterization factor per region.
export const GRID_CARBON: Record<string, { factor: number; label: string }> = {
  US:     { factor: 0.42, label: 'United States (grid avg)' },
  'US-CAL-CISO': { factor: 0.24, label: 'California (CAISO)' },
  EU:     { factor: 0.25, label: 'European Union (avg)' },
  FR:     { factor: 0.05, label: 'France' },
  DE:     { factor: 0.38, label: 'Germany' },
  GB:     { factor: 0.21, label: 'Great Britain' },
  CN:     { factor: 0.55, label: 'China' },
  IN:     { factor: 0.63, label: 'India' },
  NO:     { factor: 0.03, label: 'Norway' },
  Global: { factor: 0.48, label: 'Global (avg)' },
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
