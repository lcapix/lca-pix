// A substance a person adds by hand, because no library has everything.
//
// The rules here are what keeps a hand-entered number honest: a real name, a
// unit the engine can convert, a positive factor, the method and category it
// belongs to, and a source the reader can check. The source is stored with a
// "User-entered" prefix so the engine grades it as unverified and the run's
// data-quality statement says so.
//
// Pure module: no DB, no network.

import { normalizeUnit } from '@/lib/units'

export const CUSTOM_METHODS = ['CML 2001', 'ReCiPe Midpoint (H)', 'TRACI 2.1'] as const
export type CustomMethod = (typeof CUSTOM_METHODS)[number]

/** What the substance is, which decides how the engine may use it. */
export const CUSTOM_KINDS = {
  /** Something bought and brought in: a material, a fuel, freight. Carries a cradle-to-gate factor. */
  input: { category: 'resource', factorBasis: 'embodied' },
  /** Something released by the process: an emission to air. Carries an elementary-flow factor. */
  emission: { category: 'emission_air', factorBasis: 'elementary' },
} as const
export type CustomKind = keyof typeof CUSTOM_KINDS

export interface CustomSubstanceInput {
  name?: unknown
  kind?: unknown
  unit?: unknown
  method?: unknown
  impactCategory?: unknown
  factorValue?: unknown
  factorUnit?: unknown
  source?: unknown
  casNumber?: unknown
}

export interface CustomSubstance {
  name: string
  kind: CustomKind
  category: string
  factorBasis: string
  unit: string
  method: CustomMethod
  impactCategory: string
  factorValue: number
  factorUnit: string
  /** Stored source text, already prefixed so its tier reads as unverified. */
  sourceReference: string
  casNumber: string | null
}

export interface CustomSubstanceResult {
  ok: boolean
  errors: string[]
  value?: CustomSubstance
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/** Validate and normalize what the add-a-substance form sent. */
export function validateCustomSubstance(input: CustomSubstanceInput): CustomSubstanceResult {
  const errors: string[] = []

  const name = str(input.name)
  if (name.length < 2) errors.push('Give the substance a name of at least 2 characters.')
  if (name.length > 120) errors.push('Keep the name under 120 characters.')

  const kind = str(input.kind) as CustomKind
  if (!(kind in CUSTOM_KINDS)) errors.push('Say whether this is an input you buy or an emission you release.')

  const unit = normalizeUnit(str(input.unit))
  if (!unit) errors.push('Use a unit the engine knows, such as kg, kWh, MJ, m3, tkm or units.')

  const method = str(input.method) as CustomMethod
  if (!CUSTOM_METHODS.includes(method)) errors.push('Pick the impact-assessment method this factor belongs to.')

  const impactCategory = str(input.impactCategory)
  if (!impactCategory) errors.push('Pick the impact category this factor is for.')

  const factorValue = Number(input.factorValue)
  if (!Number.isFinite(factorValue) || factorValue <= 0) {
    errors.push('The factor must be a positive number, e.g. 8.6 kg CO2 eq per kg.')
  }

  const source = str(input.source)
  if (source.length < 4) {
    errors.push('Name where the factor comes from (a supplier EPD, a paper, a datasheet). Every number has to be traceable.')
  }
  if (source.length > 400) errors.push('Keep the source under 400 characters.')

  const factorUnit = str(input.factorUnit)
  const casNumber = str(input.casNumber)

  if (errors.length) return { ok: false, errors }

  return {
    ok: true,
    errors: [],
    value: {
      name,
      kind,
      category: CUSTOM_KINDS[kind].category,
      factorBasis: CUSTOM_KINDS[kind].factorBasis,
      unit: unit as string,
      method,
      impactCategory,
      factorValue,
      factorUnit: factorUnit || `per ${unit}`,
      sourceReference: `User-entered (not yet verified): ${source}`,
      casNumber: casNumber || null,
    },
  }
}
