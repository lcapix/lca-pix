import { describe, expect, it } from 'vitest'
import { amount, amountBox, caseTotal, co2Unit, fixed, money, share, answer, grouped, result3 } from '@/lib/ui/format'

describe('fixed: the decimal a person reads, half away from zero', () => {
  it('rounds what toFixed gets wrong', () => {
    // The bug it fixes: toFixed rounds the binary value.
    expect((0.0525).toFixed(3)).toBe('0.052')
    expect((1.005).toFixed(2)).toBe('1.00')
    expect(fixed(1.005, 2)).toBe('1.01')
    expect(fixed(2.675, 2)).toBe('2.68')
    expect(fixed(0.0175, 3)).toBe('0.018')
    // A product carries binary noise: 0.05 × 0.35 = 0.017499999999999998.
    expect(fixed(0.05 * 0.35, 3)).toBe('0.018')
    expect(fixed(1e-7, 3)).toBe('0.000')
    expect(fixed(0.0525, 3)).toBe('0.053')
    expect(fixed(1.7199667, 2)).toBe('1.72')
    expect(fixed(1.6674667, 3)).toBe('1.667')
    expect(fixed(-0.0525, 3)).toBe('-0.053')
    expect(fixed(-0.0004, 3)).toBe('0.000')
    expect(fixed(NaN, 2)).toBe('–')
  })
  it('totals, shares, amounts, money, units', () => {
    expect(caseTotal(1.7199667, 'base')).toBe('1.72')
    expect(caseTotal(1.6674667, 'comparative')).toBe('1.667')
    expect(share(1.537967, 1.72)).toBe('89.4%')
    expect(share(0.14, 1.72)).toBe('8.1%')
    expect(amount(0.8)).toBe('0.8')
    expect(amount(0.0013)).toBe('0.0013')
    expect(amountBox(0.8)).toBe('0.80')
    expect(amountBox(0.12)).toBe('0.12')
    expect(amountBox(12)).toBe('12')
    expect(amountBox(null)).toBe('')
    expect(money(0.38745)).toBe('$0.39')
    expect(money(1.75)).toBe('$1.75')
    expect(co2Unit('kg CO2 eq')).toBe('kg CO₂-eq')
  })
})

describe('display helpers', () => {
  it('groups thousands for reading, keeping the decimals rules.md sets', () => {
    expect(grouped('1520.158')).toBe('1,520.158')
    expect(grouped('-1234567')).toBe('-1,234,567')
    expect(grouped('0.017')).toBe('0.017')
    expect(answer(1520.157955, 'comparative')).toBe('1,520.158')
    expect(answer(1.719955, 'base')).toBe('1.72')
  })

  it('never shows a tiny non-zero result as nothing (RUN-2)', () => {
    expect(result3(3.5e-7)).toBe('< 0.001')
    expect(result3(-3.5e-7)).toBe('> −0.001')
    expect(result3(0)).toBe('0.000')
    expect(result3(0.0005)).toBe('0.001')
    expect(result3(1538.0004)).toBe('1,538.000')
  })
})
