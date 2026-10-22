import { describe, expect, it } from 'vitest'

import { validateCustomSubstance } from '@/lib/substances/custom'
import { classifyFactorSource } from '@/lib/lca-engine'

describe('validateCustomSubstance', () => {
  const good = {
    name: 'Cork, expanded',
    kind: 'input',
    unit: 'kg',
    method: 'TRACI 2.1',
    impactCategory: 'Global Warming',
    factorValue: '1.6',
    source: 'Amorim ICB EPD 2023, cradle-to-gate',
  }

  it('accepts a complete entry and stamps the source as user-entered', () => {
    const r = validateCustomSubstance(good)
    expect(r.ok).toBe(true)
    expect(r.value).toMatchObject({
      name: 'Cork, expanded',
      category: 'resource',
      factorBasis: 'embodied',
      unit: 'kg',
      factorValue: 1.6,
    })
    expect(r.value!.sourceReference).toMatch(/^User-entered \(not yet verified\): Amorim/)
  })

  it('grades a user-entered source as unverified, never as a published dataset', () => {
    const r = validateCustomSubstance(good)
    expect(classifyFactorSource(r.value!.sourceReference)).toBe('unverified')
  })

  it('treats an emission as an elementary flow', () => {
    const r = validateCustomSubstance({ ...good, kind: 'emission', name: 'Methane, fugitive' })
    expect(r.value).toMatchObject({ category: 'emission_air', factorBasis: 'elementary' })
  })

  it('refuses an entry the engine could not use, and says why', () => {
    const r = validateCustomSubstance({ ...good, name: 'x', unit: 'widgets', factorValue: 0, source: 'n/a' })
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(/name of at least 2/)
    expect(r.errors.join(' ')).toMatch(/unit the engine knows/)
    expect(r.errors.join(' ')).toMatch(/positive number/)
    expect(r.errors.join(' ')).toMatch(/where the factor comes from/)
  })

  it('normalizes the unit spelling', () => {
    expect(validateCustomSubstance({ ...good, unit: 'Kilograms' }).value!.unit).toBe('kg')
    expect(validateCustomSubstance({ ...good, unit: 'kwh' }).value!.unit).toBe('kWh')
  })
})
