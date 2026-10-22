// lib/integrations/epa-factors.ts
//
// Parse the EPA GHG Emission Factors Hub workbook (Table 1, Stationary
// Combustion) into per-MMBtu Global-Warming factors, so combustion factors come
// from an authoritative published source instead of hand-entered SQL.
// Source: https://www.epa.gov/climateleadership/ghg-emission-factors-hub (xlsx).
//
// The single "Emission Factors Hub" sheet holds several sub-tables. Table 1's
// fuel rows look like: [ , , <Fuel Type>, <Heat Content>, <CO2 kg/mmBtu>,
// <CH4 g/mmBtu>, <N2O g/mmBtu>, ...]. We read CO2/CH4/N2O and combine into a
// CO2e per MMBtu with IPCC AR5 GWP100 (CH4=28, N2O=265) — more correct than the
// CO2-only first pass.

export interface EpaFuelFactor {
  fuelName: string; // as printed in the EPA table
  co2_kg_per_mmbtu: number;
  ch4_g_per_mmbtu: number;
  n2o_g_per_mmbtu: number;
  co2e_kg_per_mmbtu: number; // CO2 + CH4*28/1000 + N2O*265/1000
}

const GWP100 = { ch4: 28, n2o: 265 }; // IPCC AR5

// EPA fuel-name → our substance name. Only the MMBtu-based ITAC fuels.
// Natural Gas is EXCLUDED on purpose — it's stored per-m³ (audited 1.877 kg/m³)
// and ITAC gas is converted MMBtu→m³ at ingestion, so an MMBtu factor here would
// be mis-applied against the m³ unit.
export const EPA_FUEL_TO_SUBSTANCE: Array<{ match: RegExp; substance: string }> = [
  { match: /^Bituminous$/i, substance: 'Coal' },
  { match: /^Liquefied Petroleum Gases \(LPG\)$/i, substance: 'LPG' },
  { match: /^Distillate Fuel Oil No\. 2$/i, substance: 'Fuel Oil' },
  { match: /^Wood and Wood Residuals$/i, substance: 'Wood' },
];

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Extract fuel factors from the sheet's array-of-rows form
 * (XLSX.utils.sheet_to_json(sheet, { header: 1 })).
 *
 * A fuel row = a string in column index 2 with a positive CO2 value in index 4,
 * within Table 1 (we stop before the mobile-combustion / eGRID sections, which
 * start well past row ~300). Header/unit rows (col 4 non-numeric) are skipped.
 */
export function parseEpaFuelFactors(rows: unknown[][]): EpaFuelFactor[] {
  const out: EpaFuelFactor[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < rows.length && i < 120; i++) {
    const r = rows[i];
    if (!Array.isArray(r)) continue;
    const name = typeof r[2] === 'string' ? (r[2] as string).trim() : '';
    const co2 = num(r[4]);
    if (!name || co2 === null || co2 <= 0) continue;
    if (seen.has(name)) continue;
    const ch4 = num(r[5]) ?? 0;
    const n2o = num(r[6]) ?? 0;
    seen.add(name);
    out.push({
      fuelName: name,
      co2_kg_per_mmbtu: co2,
      ch4_g_per_mmbtu: ch4,
      n2o_g_per_mmbtu: n2o,
      co2e_kg_per_mmbtu:
        Math.round((co2 + (ch4 / 1000) * GWP100.ch4 + (n2o / 1000) * GWP100.n2o) * 1000) / 1000,
    });
  }
  return out;
}

/** Map parsed EPA rows to our substances (only the fuels we ingest). */
export function mapEpaToSubstances(
  factors: EpaFuelFactor[],
): Array<{ substance: string; co2e: number; epaRow: string }> {
  const result: Array<{ substance: string; co2e: number; epaRow: string }> = [];
  for (const f of factors) {
    const hit = EPA_FUEL_TO_SUBSTANCE.find((m) => m.match.test(f.fuelName));
    if (hit) {
      result.push({
        substance: hit.substance,
        co2e: f.co2e_kg_per_mmbtu,
        epaRow: `${f.fuelName}: CO2 ${f.co2_kg_per_mmbtu}, CH4 ${f.ch4_g_per_mmbtu}g, N2O ${f.n2o_g_per_mmbtu}g /MMBtu`,
      });
    }
  }
  return result;
}
