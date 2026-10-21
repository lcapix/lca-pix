/**
 * Server-side rate lookups for a step cost (migrate-035, E14). The caller names
 * what to price (an occupation code and hours, or an energy carrier and an
 * amount in its unit) and a region; the rate, its source and its vintage come
 * from here, never from the request. A live answer (BLS, EIA, or the cached
 * copy of one) is tagged live; otherwise the dated reference table is used and
 * tagged reference.
 *
 * Energy is priced in the unit the amount is in: a live $/Mcf gas price is
 * turned into $/m3 for an amount in m3. Where no rate can apply to that unit,
 * the lookup says so instead of multiplying across units.
 */

import { getOrFetchRate, type CostRate } from '@/lib/integrations/cost-rates'
import { fetchMedianHourlyWage } from '@/lib/integrations/bls/client'
import { fetchElectricityPrice, fetchNaturalGasPrice } from '@/lib/integrations/eia/client'
import {
  LABOR_RATES,
  REFERENCE_VINTAGE,
  energyReferencePrice,
} from '@/lib/integrations/reference-rates'
import { convertQuantity, splitFactorUnit } from '@/lib/units'
import { vintageOf, type CostSourceKind } from './cost-basis'

export interface ResolvedRate {
  /** USD per one driver_unit. */
  rate: number
  rate_unit: string
  driver_unit: string
  rate_label: string
  rate_code: string
  region: string
  source_kind: CostSourceKind
  source_name: string
  vintage: string | null
}

export class RateNotFound extends Error {}

/** The reference occupation for a BLS OEWS code, or the production-worker average. */
export function laborReference(code: string): { rate: number; label: string; soc: string } {
  return Object.values(LABOR_RATES).find((r) => r.soc === code) ?? LABOR_RATES.generic
}

/** "Welders/cutters (51-4121)" → "Welders/cutters". */
const occupationName = (label: string) => label.replace(/\s*\([^)]*\)\s*$/, '').trim()

/**
 * Run getOrFetchRate and tell a live (or cached live) answer from the reference
 * fallback. The baseline seeds reference values into the shared cache
 * ("BLS OEWS reference 2026-06"), so a cached row that says reference is one.
 */
async function lookup(
  params: Parameters<typeof getOrFetchRate>[0],
): Promise<{ rate: CostRate; reference: boolean }> {
  let reference = false
  const fallback = params.staticFallback
  const rate = await getOrFetchRate({
    ...params,
    staticFallback: fallback
      ? async () => {
          reference = true
          return fallback()
        }
      : undefined,
  })
  return { rate, reference: reference || /reference/i.test(rate.source) }
}

/** The dated reference wage for an occupation: the national mean, no outside call. */
export function laborReferenceRate(code: string): ResolvedRate {
  const ref = laborReference(code)
  return {
    rate: ref.rate,
    rate_unit: '$/h',
    driver_unit: 'h',
    rate_label: occupationName(ref.label),
    rate_code: ref.soc,
    region: 'US',
    source_kind: 'reference',
    source_name: 'Reference',
    vintage: REFERENCE_VINTAGE,
  }
}

/** Hourly wage for an occupation in a state (or 'US'). */
export async function resolveLaborRate(code: string, region: string): Promise<ResolvedRate> {
  const ref = laborReference(code)
  const { rate, reference } = await lookup({
    type: 'labor',
    key: code,
    region,
    fetcher: async () => {
      const w = await fetchMedianHourlyWage(code, region)
      if (!w) throw new Error('no BLS data')
      return { rateValue: w.hourlyRate, unit: '$/hr', source: `BLS OEWS ${w.year}`, effectiveDate: `${w.year}-05-01` }
    },
    staticFallback: () => ({
      rateValue: ref.rate,
      unit: '$/hr',
      source: `Reference ${REFERENCE_VINTAGE}`,
      effectiveDate: `${REFERENCE_VINTAGE}-01`,
    }),
  })
  // The reference is a national mean for the matched occupation (or the
  // production-worker average when the code is not in the table).
  if (reference) return laborReferenceRate(code)
  return {
    rate: rate.rateValue,
    rate_unit: '$/h',
    driver_unit: 'h',
    rate_label: ref.soc === code ? occupationName(ref.label) : `Occupation ${code}`,
    rate_code: code,
    region,
    source_kind: 'live',
    source_name: rate.source,
    vintage: vintageOf(rate.effectiveDate)?.slice(0, 4) ?? null,
  }
}

const CARRIERS = {
  electricity: { label: 'Electricity', substance: 'electricity' },
  natural_gas: { label: 'Natural gas', substance: 'natural gas' },
} as const
export type EnergyCarrier = keyof typeof CARRIERS
export const isEnergyCarrier = (v: string): v is EnergyCarrier => v in CARRIERS

/**
 * USD per one `driverUnit` of an energy carrier in a region. A live price is
 * used when its unit converts from the amount's unit; otherwise the reference
 * price for the amount's own unit; otherwise RateNotFound.
 */
export async function resolveEnergyRate(
  carrier: EnergyCarrier,
  region: string,
  driverUnit: string,
): Promise<ResolvedRate> {
  const live = await lookup(
    carrier === 'electricity'
      ? {
          type: 'electricity',
          key: 'grid',
          region,
          fetcher: async () => {
            const p = await fetchElectricityPrice(region)
            if (!p) throw new Error('no EIA data')
            return { rateValue: p.rateValue, unit: p.unit, source: `EIA ${p.period}`, effectiveDate: `${p.period}-01` }
          },
        }
      : {
          type: 'natural_gas',
          key: 'industrial',
          region,
          fetcher: async () => {
            const p = await fetchNaturalGasPrice(region)
            if (!p) throw new Error('no EIA data')
            return { rateValue: p.rateValue, unit: p.unit, source: `EIA ${p.period}`, effectiveDate: `${p.period}-01` }
          },
        },
  ).catch(() => null)

  if (live && !live.reference) {
    // Price per the amount's unit: $/Mcf x (Mcf per m3) = $/m3.
    const per = splitFactorUnit(live.rate.unit).denominator
    const oneDriver = per ? convertQuantity(1, driverUnit, per) : null
    if (oneDriver) {
      return {
        rate: live.rate.rateValue * oneDriver.quantity,
        rate_unit: `$/${driverUnit}`,
        driver_unit: driverUnit,
        rate_label: CARRIERS[carrier].label,
        rate_code: carrier,
        region,
        source_kind: 'live',
        source_name: live.rate.source,
        vintage: vintageOf(live.rate.effectiveDate),
      }
    }
  }

  return energyReferenceRate(carrier, driverUnit)
}

/** The dated reference price of an energy carrier per the amount's unit; no outside call. */
export function energyReferenceRate(carrier: EnergyCarrier, driverUnit: string): ResolvedRate {
  // Reference: the price for the amount's own unit, national.
  const ref = energyReferencePrice(CARRIERS[carrier].substance, driverUnit)
  if (!ref) {
    throw new RateNotFound(`No ${CARRIERS[carrier].label.toLowerCase()} price applies to an amount in '${driverUnit}'.`)
  }
  return {
    rate: ref.rate,
    rate_unit: `$/${driverUnit}`,
    driver_unit: driverUnit,
    rate_label: CARRIERS[carrier].label,
    rate_code: carrier,
    region: 'US',
    source_kind: 'reference',
    source_name: 'Reference',
    vintage: REFERENCE_VINTAGE,
  }
}
