import { describe, it, expect } from 'vitest'
import { fmtSig } from '@/components/lcapix/formatters'

// RES-1: the stage panel printed 1000 as "1" and 2500.3 as "25" because it
// stripped trailing zeros off toPrecision output, integer zeros included.
// fmtSig is the shared significant-figure formatter the results screen uses.
describe('fmtSig (significant-figure formatter)', () => {
  it('keeps integer zeros and adds thousands separators', () => {
    expect(fmtSig(1000)).toBe('1,000')
  })

  it('rounds to four significant figures', () => {
    expect(fmtSig(2500.3)).toBe('2,500')
  })

  it('rounds up across a power of ten', () => {
    expect(fmtSig(999.96)).toBe('1,000')
  })

  it('never shows a tiny non-zero value as 0: scientific notation instead', () => {
    expect(fmtSig(0.0000042)).toBe('4.2e-6')
    expect(fmtSig(-0.0000042)).toBe('-4.2e-6')
    expect(fmtSig(4.2e-7)).toBe('4.2e-7')
  })

  it('keeps the sign of credits', () => {
    expect(fmtSig(-12.5)).toBe('-12.5')
  })

  it('prints zero as 0', () => {
    expect(fmtSig(0)).toBe('0')
  })

  it('keeps every integer digit of large values', () => {
    expect(fmtSig(123456.7)).toBe('123,457')
  })

  it('shows small values that still read well in plain decimals', () => {
    expect(fmtSig(0.0123456)).toBe('0.01235')
    expect(fmtSig(88.73)).toBe('88.73')
  })

  it('renders a placeholder for missing or non-finite values', () => {
    expect(fmtSig(null)).toBe('—')
    expect(fmtSig(undefined)).toBe('—')
    expect(fmtSig(NaN)).toBe('—')
  })

  it('never returns "0" for any non-zero value', () => {
    for (const v of [1e-300, 5e-7, 0.0004999, -1e-9, 3e-12]) {
      expect(fmtSig(v)).not.toMatch(/^-?0(\.0*)?$/)
    }
  })
})
