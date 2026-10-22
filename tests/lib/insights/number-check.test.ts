import { describe, expect, it } from 'vitest'

import { checkNarrationNumbers, numbersIn } from '@/lib/insights/number-check'

// The facts block the model is given, for the designed sample.
const FACTS = [
  'Case: Base case',
  'LCIA method: TRACI 2.1',
  'Category total: 1.7195 kg CO₂-eq',
  'Total activity-based cost: $1.75',
  'Contributors (share of active category, absolute value):',
  '  - 10. Cut blank: 89.4% (1.5375 kg CO₂-eq)',
  '  - 30. Powder coat and cure: 8.1% (0.14 kg CO₂-eq)',
  '  - 20. Weld tab: 2.4% (0.042 kg CO₂-eq)',
  '  - Credit from scrap: -0.4% (-0.0068 kg CO₂-eq)',
].join('\n')

describe('reading numbers out of text', () => {
  it('reads decimals, thousands separators and signs, and skips identifiers', () => {
    expect(numbersIn('1,538.4 and -0.042 and 89%').map((t) => t.value)).toEqual([1538.4, 0.042, 89])
    expect(numbersIn('CO2, CH4, PM2.5, AR5, N2O and kg CO₂-eq')).toEqual([])
    expect(numbersIn('1.72')[0]).toMatchObject({ decimals: 2, kind: 'plain' })
    expect(numbersIn('89.4% and $1.75 and 12 percent').map((t) => t.kind)).toEqual(['percent', 'money', 'percent'])
  })
})

describe('the number check on an AI reply', () => {
  it('accepts numbers the facts support at the precision written', () => {
    const reply =
      '10. Cut blank drives 89.4% of the 1.72 kg CO₂-eq per bracket, almost all of it steel. ' +
      '30. Powder coat and cure adds 8.1% (0.14). The bracket costs $1.75. The 3 largest steps cover nearly all of it.'
    expect(checkNarrationNumbers(reply, FACTS)).toEqual({ ok: true, unmatched: [] })
    expect(checkNarrationNumbers('About 89% comes from cutting.', FACTS).ok).toBe(true)
    expect(checkNarrationNumbers('A credit of 0.0068 from scrap.', FACTS).ok).toBe(true)
  })

  it('drops a reply with an invented or loosely rounded number', () => {
    expect(checkNarrationNumbers('Cutting is roughly 90% of the total.', FACTS)).toEqual({ ok: false, unmatched: ['90'] })
    expect(checkNarrationNumbers('Switching to recycled steel saves 35%.', FACTS).unmatched).toEqual(['35'])
    // $1.75 rounds to 1.8 but is money: it cannot vouch for a quantity.
    expect(checkNarrationNumbers('The total is 1.8 kg.', FACTS).ok).toBe(false)
    expect(checkNarrationNumbers('Cutting costs 89.4.', FACTS).ok).toBe(false)
    expect(checkNarrationNumbers('It is 1.72 percent of the total.', FACTS).ok).toBe(false)
    expect(checkNarrationNumbers('By 2030 the grid will be cleaner.', FACTS).unmatched).toEqual(['2030'])
  })

  it('treats a reply with no numbers as checked', () => {
    expect(checkNarrationNumbers('Start with the steel blank.', FACTS).ok).toBe(true)
  })
})
