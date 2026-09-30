import { describe, it, expect } from 'vitest'
import {
  analyticsImpacts,
  normalizeByMaxAbs,
  signedLog10,
} from '@/components/lcapix/results/analytics-impacts'

// ANA-1: analytics applied Math.abs to every category and component impact,
// so net credits were shown as burdens.
describe('analyticsImpacts', () => {
  const detail = {
    total_impacts: [
      { category_name: 'Global Warming', impact_value: -12.5, unit: 'kg CO2 eq' },
      { category_name: 'Ozone Depletion', impact_value: 4.2e-7, unit: 'kg CFC-11 eq' },
      { category_name: 'Acidification', impact_value: '0.0073', unit: 'kg SO2 eq' },
    ],
    component_breakdown: [
      {
        component_name: 'Recycling',
        component_type: 'operation',
        impacts: [{ category_name: 'Global Warming', impact_value: -30 }],
      },
      {
        component_name: 'Frame',
        component_type: 'operation',
        impacts: [{ category_name: 'Global Warming', impact_value: 17.5 }],
      },
    ],
  }

  it('keeps credits negative in category totals', () => {
    const { categories } = analyticsImpacts(detail)
    expect(categories).toEqual([
      { category_name: 'Global Warming', impact_value: -12.5, unit: 'kg CO2 eq' },
      { category_name: 'Ozone Depletion', impact_value: 4.2e-7, unit: 'kg CFC-11 eq' },
      { category_name: 'Acidification', impact_value: 0.0073, unit: 'kg SO2 eq' },
    ])
  })

  it('keeps credits negative per component', () => {
    const { components } = analyticsImpacts(detail)
    expect(components[0].impacts[0].impact_value).toBe(-30)
    expect(components[1].impacts[0].impact_value).toBe(17.5)
  })

  it('treats missing values as 0', () => {
    expect(analyticsImpacts({}).categories).toEqual([])
    expect(analyticsImpacts({ total_impacts: [{ category_name: 'X', impact_value: null, unit: 'u' }] }).categories[0].impact_value).toBe(0)
  })
})

describe('chart transforms that used to assume positive values', () => {
  it('normalises by the largest magnitude, so a credit stays below zero', () => {
    expect(normalizeByMaxAbs([-50, 25, 100])).toEqual([-50, 25, 100])
    expect(normalizeByMaxAbs([-200, 100])).toEqual([-100, 50])
    expect(normalizeByMaxAbs([0, 0])).toEqual([0, 0])
  })

  it('takes a signed log, so a credit is not flattened to 0', () => {
    expect(signedLog10(99)).toBeCloseTo(2, 10)
    expect(signedLog10(-99)).toBeCloseTo(-2, 10)
    expect(signedLog10(0)).toBe(0)
  })
})
