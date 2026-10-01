import { describe, it, expect } from 'vitest'
import {
  buildCostBreakdownRows,
  buildCostVsImpactRows,
  costPanelCurrency,
  costRowsFromResponse,
  fmtMoney,
  hasAnyCost,
  sumComponentCosts,
} from '@/lib/analytics/costs'
import { EMPTY_COSTS } from '@/lib/analytics/constants'
import type { AssessmentData, CostBreakdown } from '@/lib/analytics/types'

const caseWith = (
  caseName: string,
  totalScore: number,
  costs: Partial<CostBreakdown> = {},
): AssessmentData => ({
  caseId: caseName,
  caseName,
  caseType: undefined as unknown as string,
  categories: [],
  components: [],
  totalScore,
  costs: { ...EMPTY_COSTS, ...costs },
})

describe('costRowsFromResponse', () => {
  it('reads components, else data, else none', () => {
    expect(costRowsFromResponse({ components: [{ a: 1 }], data: [{ b: 2 }] })).toEqual([{ a: 1 }])
    expect(costRowsFromResponse({ data: [{ b: 2 }] })).toEqual([{ b: 2 }])
    expect(costRowsFromResponse({ components: null, data: [{ b: 2 }] })).toEqual([{ b: 2 }])
    expect(costRowsFromResponse({})).toEqual([])
    expect(costRowsFromResponse(null)).toEqual([])
    expect(costRowsFromResponse(undefined)).toEqual([])
  })
})

describe('sumComponentCosts', () => {
  it('returns zeroed USD costs for no rows', () => {
    expect(sumComponentCosts([])).toEqual(EMPTY_COSTS)
  })

  it('does not mutate EMPTY_COSTS when no accumulator is given', () => {
    sumComponentCosts([{ labor_cost: 5 }])
    expect(EMPTY_COSTS.labor).toBe(0)
    expect(EMPTY_COSTS.total).toBe(0)
  })

  it('sums snake_case columns (DB strings) and uses the ABC total', () => {
    const costs = sumComponentCosts([
      { labor_cost: '10.50', energy_cost: '2.25', opex: '100.00' },
      { material_cost: 3, transportation_cost: 4, equipment_cost: 5, overhead_cost: 6 },
    ])
    expect(costs).toMatchObject({
      labor: 10.5,
      energy: 2.25,
      material: 3,
      transport: 4,
      equipment: 5,
      overhead: 6,
      opex: 100,
      capex: 0,
      currency: 'USD',
    })
    // The ABC breakdown wins over opex+capex when it is positive.
    expect(costs.total).toBeCloseTo(30.75)
  })

  it('falls back to camelCase fields', () => {
    const costs = sumComponentCosts([
      {
        laborCost: 1,
        energyCost: 2,
        materialCost: 3,
        transportationCost: 4,
        equipmentCost: 5,
        overheadCost: 6,
        operationalCostUSD: 7,
        capitalCostUSD: 8,
      },
    ])
    expect(costs).toMatchObject({
      labor: 1,
      energy: 2,
      material: 3,
      transport: 4,
      equipment: 5,
      overhead: 6,
      opex: 7,
      capex: 8,
      total: 21,
    })
  })

  it('prefers the snake_case column even when it is 0', () => {
    const costs = sumComponentCosts([{ labor_cost: 0, laborCost: 9 }])
    expect(costs.labor).toBe(0)
  })

  it('reads non-numeric values as 0', () => {
    const costs = sumComponentCosts([
      { labor_cost: 'abc', energy_cost: null, material_cost: '', opex: 'n/a' },
    ])
    expect(costs.labor).toBe(0)
    expect(costs.energy).toBe(0)
    expect(costs.material).toBe(0)
    expect(costs.opex).toBe(0)
    expect(costs.total).toBe(0)
  })

  it('uses opex + capex as the total when the ABC sum is not positive', () => {
    expect(sumComponentCosts([{ opex: 100, capex: 50 }]).total).toBe(150)
    // Credits in the ABC columns that net to <= 0 also fall back.
    const costs = sumComponentCosts([{ labor_cost: 10, energy_cost: -10, opex: 40, capex: 2 }])
    expect(costs.labor).toBe(10)
    expect(costs.energy).toBe(-10)
    expect(costs.total).toBe(42)
  })

  it('keeps a negative ABC sum out of the total (opex+capex may be 0)', () => {
    expect(sumComponentCosts([{ labor_cost: -5 }]).total).toBe(0)
  })

  it('takes the currency of the last row that has one', () => {
    expect(
      sumComponentCosts([{ currency: 'EUR' }, { currency: 'GBP' }, { currency: '' }]).currency,
    ).toBe('GBP')
    expect(sumComponentCosts([{ labor_cost: 1 }]).currency).toBe('USD')
  })

  it('adds into and returns the accumulator it is given', () => {
    const into: CostBreakdown = { ...EMPTY_COSTS, labor: 1 }
    const out = sumComponentCosts([{ labor_cost: 2 }], into)
    expect(out).toBe(into)
    expect(into.labor).toBe(3)
    expect(into.total).toBe(3)
  })

  it('leaves earlier rows summed and the total untouched when a row throws', () => {
    const into: CostBreakdown = { ...EMPTY_COSTS }
    expect(() =>
      sumComponentCosts([{ labor_cost: 4, currency: 'EUR' }, null, { labor_cost: 6 }], into),
    ).toThrow(TypeError)
    expect(into.labor).toBe(4)
    expect(into.currency).toBe('EUR')
    expect(into.total).toBe(0)
  })

  it('throws on non-iterable rows without touching the accumulator', () => {
    const into: CostBreakdown = { ...EMPTY_COSTS }
    expect(() => sumComponentCosts({ length: 1 } as any, into)).toThrow(TypeError)
    expect(into).toEqual(EMPTY_COSTS)
  })
})

describe('fmtMoney', () => {
  const intl = (v: number, currency: string, digits: number) =>
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: digits,
    }).format(v)

  it('drops decimals from 1000 up', () => {
    expect(fmtMoney(1234.567, 'USD')).toBe(intl(1234.567, 'USD', 0))
    expect(fmtMoney(1000, 'EUR')).toBe(intl(1000, 'EUR', 0))
  })

  it('keeps at most two decimals below 1000, negatives included', () => {
    expect(fmtMoney(12.345, 'USD')).toBe(intl(12.345, 'USD', 2))
    expect(fmtMoney(-5000, 'USD')).toBe(intl(-5000, 'USD', 2))
    expect(fmtMoney(0)).toBe(intl(0, 'USD', 2))
  })

  it('defaults to USD', () => {
    expect(fmtMoney(5)).toBe(fmtMoney(5, 'USD'))
  })

  it('falls back to a "$" prefix for an invalid currency code', () => {
    expect(fmtMoney(5, 'not-a-code')).toBe(`$${(5).toLocaleString()}`)
  })
})

describe('costPanelCurrency', () => {
  it('uses the first case currency, else USD', () => {
    expect(costPanelCurrency([])).toBe('USD')
    expect(
      costPanelCurrency([caseWith('A', 1, { currency: 'EUR' }), caseWith('B', 1, { currency: 'GBP' })]),
    ).toBe('EUR')
    expect(costPanelCurrency([caseWith('A', 1, { currency: '' })])).toBe('USD')
  })
})

describe('hasAnyCost', () => {
  it('is true only when some case has a positive total', () => {
    expect(hasAnyCost([])).toBe(false)
    expect(hasAnyCost([caseWith('A', 1), caseWith('B', 1, { total: -3 })])).toBe(false)
    expect(hasAnyCost([caseWith('A', 1), caseWith('B', 1, { total: 0.01 })])).toBe(true)
  })
})

describe('buildCostBreakdownRows', () => {
  it('maps each case to a scenario row of cost types', () => {
    expect(buildCostBreakdownRows([])).toEqual([])
    expect(
      buildCostBreakdownRows([
        caseWith('Steel', 1, { labor: 1, energy: 2, material: 3, transport: 4, equipment: 5, overhead: 6, opex: 99 }),
      ]),
    ).toEqual([
      { scenario: 'Steel', Labor: 1, Energy: 2, Material: 3, Transport: 4, Equipment: 5, Overhead: 6 },
    ])
  })
})

describe('buildCostVsImpactRows', () => {
  it('pairs cost with the GWP headline and the cost per unit of impact', () => {
    expect(buildCostVsImpactRows([caseWith('A', 4, { total: 10 })])).toEqual([
      { scenario: 'A', cost: 10, impact: 4, intensity: 2.5 },
    ])
  })

  it('has zero intensity for a zero or negative (credit) impact', () => {
    expect(buildCostVsImpactRows([caseWith('A', 0, { total: 10 })])[0].intensity).toBe(0)
    expect(buildCostVsImpactRows([caseWith('B', -2, { total: 10 })])[0]).toEqual({
      scenario: 'B',
      cost: 10,
      impact: -2,
      intensity: 0,
    })
  })

  it('is empty without cases', () => {
    expect(buildCostVsImpactRows([])).toEqual([])
  })
})
