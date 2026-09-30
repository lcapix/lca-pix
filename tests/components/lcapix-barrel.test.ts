// @vitest-environment jsdom
// Item 19: fmtSig is reachable from the barrel like fmtNum / fmtInt, so pages
// importing from '@/components/lcapix' do not fall back to toLocaleString().
import { describe, it, expect } from 'vitest'
import { fmtSig, fmtNum } from '@/components/lcapix'

describe("'@/components/lcapix' barrel", () => {
  it('exports fmtSig, which never prints a small value as 0', () => {
    expect(fmtSig(0.0004)).toBe('4e-4')
    expect(fmtSig(4.2e-7)).toBe('4.2e-7')
    expect(fmtSig(88730.12)).toBe('88,730')
    expect(fmtNum(1.5)).toBe('1.50')
  })
})
