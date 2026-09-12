import { describe, expect, it } from 'vitest'

import {
  parseEpaFuelFactors,
  mapEpaToSubstances,
  EPA_FUEL_TO_SUBSTANCE,
} from '@/lib/integrations/epa-factors'

// Rows shaped like the EPA Hub sheet (XLSX header:1): [ , , Fuel, HeatContent,
// CO2 kg/mmBtu, CH4 g/mmBtu, N2O g/mmBtu, ...]. Real values from Table 1.
const ROWS: unknown[][] = [
  [null, null, 'Fuel Type', 'Heat Content', 'CO2 Factor', 'CH4 Factor', 'N2O Factor'],
  [null, null, null, 'mmBtu per short ton', 'kg CO2 per mmBtu', 'g CH4 per mmBtu', 'g N2O per mmBtu'],
  [null, null, 'Bituminous', 24.93, 93.28, 11, 1.6],
  [null, null, 'Wood and Wood Residuals', 17.48, 93.8, 7.2, 3.6],
  [null, null, 'Distillate Fuel Oil No. 2', 0.138, 73.96, 3, 0.6],
  [null, null, 'Liquefied Petroleum Gases (LPG)', 0.092, 61.71, 3, 0.6],
  [null, null, 'Natural Gas', 0.1, 53.06, 1, 0.1],
]

describe('parseEpaFuelFactors', () => {
  it('extracts CO2/CH4/N2O and combines into CO2e at IPCC AR5 GWP100', () => {
    const parsed = parseEpaFuelFactors(ROWS)
    const lpg = parsed.find((f) => /LPG/.test(f.fuelName))!
    // 61.71 + (3/1000)*28 + (0.6/1000)*265 = 61.71 + 0.084 + 0.159 = 61.953
    expect(lpg.co2e_kg_per_mmbtu).toBeCloseTo(61.953, 3)
    const coal = parsed.find((f) => f.fuelName === 'Bituminous')!
    // 93.28 + (11/1000)*28 + (1.6/1000)*265 = 93.28 + 0.308 + 0.424 = 94.012
    expect(coal.co2e_kg_per_mmbtu).toBeCloseTo(94.012, 3)
  })

  it('skips header/unit rows (non-numeric CO2 column)', () => {
    const parsed = parseEpaFuelFactors(ROWS)
    expect(parsed.some((f) => /Fuel Type|per short ton/.test(f.fuelName))).toBe(false)
  })
})

describe('mapEpaToSubstances', () => {
  it('maps EPA fuel names to our substances and EXCLUDES natural gas', () => {
    const mapped = mapEpaToSubstances(parseEpaFuelFactors(ROWS))
    const names = mapped.map((m) => m.substance)
    expect(names).toEqual(expect.arrayContaining(['Coal', 'Wood', 'Fuel Oil', 'LPG']))
    // Natural Gas is m3-based in our catalog — must NOT be remapped here.
    expect(names).not.toContain('Natural Gas')
    expect(EPA_FUEL_TO_SUBSTANCE.some((m) => m.substance === 'Natural Gas')).toBe(false)
  })

  it('carries the EPA row as provenance', () => {
    const mapped = mapEpaToSubstances(parseEpaFuelFactors(ROWS))
    expect(mapped.find((m) => m.substance === 'Coal')!.epaRow).toContain('Bituminous')
  })
})
