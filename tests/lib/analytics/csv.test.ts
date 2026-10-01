import { describe, it, expect } from 'vitest'
import {
  analyticsCsvFilename,
  buildAnalyticsCsvRows,
  toCsvContent,
} from '@/lib/analytics/csv'
import { EMPTY_COSTS } from '@/lib/analytics/constants'
import type { AssessmentData } from '@/lib/analytics/types'

const mk = (caseName: string, caseType: string, categories: AssessmentData['categories']): AssessmentData => ({
  caseId: caseName,
  caseName,
  caseType,
  categories,
  components: [],
  totalScore: 0,
  costs: { ...EMPTY_COSTS },
})

describe('buildAnalyticsCsvRows', () => {
  it('has only the header without cases', () => {
    expect(buildAnalyticsCsvRows([])).toEqual([
      ['Case Name', 'Case Type', 'Category', 'Impact Value', 'Unit'],
    ])
  })

  it('writes one row per case and category with 4 decimals, signs kept', () => {
    const rows = buildAnalyticsCsvRows([
      mk('Steel', 'base', [
        { category_name: 'Global Warming', impact_value: -12.5, unit: 'kg CO2 eq' },
        { category_name: 'Ozone', impact_value: 4.2e-7, unit: 'kg CFC-11 eq' },
      ]),
      mk('Alu', 'comparative', [{ category_name: 'Global Warming', impact_value: 3, unit: 'kg CO2 eq' }]),
    ])
    expect(rows.slice(1)).toEqual([
      ['Steel', 'base', 'Global Warming', '-12.5000', 'kg CO2 eq'],
      ['Steel', 'base', 'Ozone', '0.0000', 'kg CFC-11 eq'],
      ['Alu', 'comparative', 'Global Warming', '3.0000', 'kg CO2 eq'],
    ])
  })

  it('keeps an undefined case type as is (joined as an empty field)', () => {
    const rows = buildAnalyticsCsvRows([
      mk('Steel', undefined as unknown as string, [{ category_name: 'GWP', impact_value: 1, unit: 'kg' }]),
    ])
    expect(rows[1][1]).toBeUndefined()
    expect(toCsvContent(rows).split('\n')[1]).toBe('Steel,,GWP,1.0000,kg')
  })
})

describe('toCsvContent', () => {
  it('joins with commas and newlines, without quoting', () => {
    expect(toCsvContent([['a', 'b'], ['c, d', 'e']])).toBe('a,b\nc, d,e')
    expect(toCsvContent([])).toBe('')
  })
})

describe('analyticsCsvFilename', () => {
  it('dates the file with the UTC day', () => {
    expect(analyticsCsvFilename(new Date('2026-09-30T23:30:00Z'))).toBe(
      'lca-assessment-analysis-2026-09-30.csv',
    )
    expect(analyticsCsvFilename(new Date('2026-01-02T00:00:00Z'))).toBe(
      'lca-assessment-analysis-2026-01-02.csv',
    )
  })
})
