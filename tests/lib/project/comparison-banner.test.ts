import { describe, expect, it } from 'vitest'
import { comparisonBanner } from '@/lib/project/comparison-banner'

// Arithmetic inputs only (the sample's two case names): each test checks when
// the Overview's line may print a number.
const kase = (name: string, isBase: boolean, region: string, climate: number, status = 'ok') => ({
  caseId: name,
  name,
  isBase,
  status,
  run: { runId: isBase ? 1 : 2, method: 'TRACI 2.1', region, functionalUnit: '1 bracket' },
  totals: [{ category: 'Global Warming', unit: 'kg CO2 eq', value: climate }],
  costs: [],
})

describe('P13 the Overview comparison line', () => {
  it('P13 prints the change only for two current runs on the same method, region and unit', () => {
    const b = comparisonBanner([kase('Painted steel bracket', true, 'US', 2), kase('My bracket', false, 'US', 1.5)])
    expect(b).toMatchObject({ line: '25.0% lower climate impact', why: null })
  })
  it('P13 a different region gives no number, and says why', () => {
    const b = comparisonBanner([kase('Painted steel bracket', true, 'US', 2), kase('My bracket', false, 'Global', 1.5)])
    expect(b?.line).toBeNull()
    expect(b?.why).toBe('Region differs: US vs Global')
  })
  it('P13 an incomplete run gives no number', () => {
    const b = comparisonBanner([kase('Painted steel bracket', true, 'US', 2), kase('My bracket', false, 'US', 0, 'incomplete')])
    expect(b?.line).toBeNull()
    expect(b?.why).toBe('My bracket has no complete run yet.')
  })
})
