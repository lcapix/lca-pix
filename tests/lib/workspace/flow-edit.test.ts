/**
 * The editor's pure rules (A1, A2, E7): a unit change converts the amount and
 * never relabels it; units that cannot convert are refused with a reason; an
 * own factor follows its unit so the impact stays the same physical number;
 * factors read 8.6, not 8.6000000000; the factor's basis comes from the
 * engine's conversion note.
 */
import { describe, expect, it } from 'vitest'
import { amountChanged, basisUnitOf, convertForUnitChange, convertOwnFactor, directionWord, factorText, perUnitText, readAmount, tidy } from '@/lib/workspace/flow-edit'

describe('A1 a unit change converts the amount', () => {
  it('0.035 kg is 35 g, and 30 g is 0.03 kg: the same mass, never a relabel', () => {
    expect(convertForUnitChange(0.035, 'kg', 'g')).toEqual({ ok: true, amount: 35, note: '0.035 kg = 35 g' })
    expect(convertForUnitChange(30, 'g', 'kg')).toEqual({ ok: true, amount: 0.03, note: '30 g = 0.03 kg' })
    expect(convertForUnitChange(0.0013, 'kWh', 'Wh')).toEqual({ ok: true, amount: 1.3, note: '0.0013 kWh = 1.3 Wh' })
    expect(convertForUnitChange(2, 'lb', 'kg')).toMatchObject({ ok: true, amount: 0.90718474 })
  })

  it('no amount yet stays no amount; the same unit changes nothing', () => {
    expect(convertForUnitChange(null, 'kg', 'g')).toEqual({ ok: true, amount: null, note: null })
    expect(convertForUnitChange(0.8, 'kg', 'kg')).toEqual({ ok: true, amount: 0.8, note: null })
  })

  it('units that measure different things are refused, with what to do instead', () => {
    const r = convertForUnitChange(3, 'kg', 'kWh')
    expect(r.ok).toBe(false)
    expect(!r.ok && r.reason).toBe('kg and kWh measure different things, so 3 kg cannot be turned into kWh. Type the amount in kWh too, then Save.')
  })

  it('the arithmetic reads clean (0.035 × 1000 is 35, not 35.00000000000001)', () => {
    expect(tidy(0.035 * 1000)).toBe(35)
    expect(tidy(0.1 + 0.2)).toBe(0.3)
  })
})

describe('A2 an own factor follows its unit', () => {
  it('8.5 per g is 8,500 per kg, and the impact of the same mass is unchanged', () => {
    const perKg = convertOwnFactor(8.5, 'g', 'kg')
    expect(perKg).toBe(8500)
    // 35 g × 8.5 per g = 297.5; the same 0.035 kg × 8,500 per kg = 297.5.
    expect(tidy(35 * 8.5)).toBe(tidy(0.035 * perKg!))
    expect(convertOwnFactor(2, 'kWh', 'MWh')).toBe(2000)
    expect(convertOwnFactor(2, 'kg', 'kg')).toBe(2)
  })

  it('a unit the factor cannot apply to is refused (null)', () => {
    expect(convertOwnFactor(8.5, 'g', 'kWh')).toBeNull()
  })

  it('the basis reads in words: "kg CO₂-eq per g"', () => {
    expect(perUnitText('kg CO2 eq', 'g')).toBe('kg CO₂-eq per g')
    expect(perUnitText(null, 'kWh')).toBe('kg CO₂-eq per kWh')
  })

  it("the factor's basis unit comes from the engine's conversion note", () => {
    expect(basisUnitOf('g', '1 g = 0.001 kg')).toBe('kg')
    expect(basisUnitOf('kWh', 'kWh = kWh')).toBe('kWh')
    expect(basisUnitOf('kg', null)).toBe('kg')
    expect(basisUnitOf('lb', '1 lb = 0.45359237 kg')).toBe('kg')
  })
})

describe('E7 factors read as a person would write them', () => {
  it('8.6, not 8.6000000000; four significant digits; thousands grouped', () => {
    expect(factorText('8.6000000000')).toBe('8.6')
    expect(factorText(1.9)).toBe('1.9')
    expect(factorText(0.012345)).toBe('0.01235')
    expect(factorText(1520.158)).toBe('1,520')
    expect(factorText(0)).toBe('0')
    expect(factorText(null)).toBe('–')
    expect(factorText(0.0000198)).toBe('1.98e-5')
  })
})

describe('the draft helpers', () => {
  it('an amount box reads a number of 0 or more, or nothing', () => {
    expect(readAmount('')).toEqual({ ok: true, value: null })
    expect(readAmount(' 0.8 ')).toEqual({ ok: true, value: 0.8 })
    expect(readAmount('-1').ok).toBe(false)
    expect(readAmount('abc').ok).toBe(false)
  })

  it('a box left as shown is no change', () => {
    expect(amountChanged('0.80', '0.80')).toBe(false)
    expect(amountChanged('0.8 ', '0.80')).toBe(true)
  })

  it('the Saved line names the direction that was stored', () => {
    expect(directionWord('input')).toBe('an input (In)')
    expect(directionWord('output')).toBe('an output (Out)')
  })
})
