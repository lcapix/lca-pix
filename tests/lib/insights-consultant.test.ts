import { describe, expect, it } from 'vitest'

import { consultantRead, listOf, stepLabel } from '@/lib/insights/consultant'

// The touring-bike case, Global Warming rows (shape of the run's flow table).
const flows = [
  { name: 'Aluminum', value: 18.92, step: '10. Cut & miter frame tubes', tier: 'industry_average' },
  { name: 'Aluminum', value: 17.8, step: '60. Build & true wheels', tier: 'industry_average' },
  { name: 'Aluminum', value: 33.84, step: '70. Final assembly', tier: 'industry_average' },
  { name: 'Rubber', value: 5.07, step: '60. Build & true wheels', tier: 'industry_average' },
  { name: 'Steel', value: 4.8, step: '70. Final assembly', tier: 'industry_average' },
  { name: 'Cardboard', value: 3.15, step: '80. QA & pack', tier: 'authoritative' },
  { name: 'Electricity', value: 0.59, step: '40. Powder coat frame', tier: 'authoritative' },
  { name: 'Electricity', value: 0.43, step: '50. Cure coating', tier: 'authoritative' },
  { name: 'Electricity', value: 0.13, step: '20. TIG weld main triangle', tier: 'authoritative' },
]

describe('consultantRead', () => {
  const read = consultantRead(flows, { categoryLabel: 'Global Warming' })

  it('leads with the dominant material and names where it sits', () => {
    expect(read[0].title).toBe('Aluminum is the biggest lever')
    expect(read[0].why).toMatch(/of Global Warming, across 3 steps/)
    expect(read[0].moves.join(' ')).toMatch(/recycled/i)
  })

  it('points energy at the steps that draw it, and says when it is small', () => {
    const energy = read.find((i) => /electricity/i.test(i.title))!
    expect(energy.title).toBe('Shop electricity: start with Powder coat frame (step 40) and Cure coating (step 50)')
    expect(energy.why).toMatch(/not where to start/)
    expect(energy.moves.join(' ')).toMatch(/batches|variable-speed/i)
  })

  it('asks for supplier EPDs where the top items are only industry averages', () => {
    const epd = read.find((i) => /supplier data/i.test(i.title))!
    expect(epd.why).toBe("Aluminum, rubber and steel use industry-average factors, not your suppliers' own figures.")
    expect(epd.moves[0]).toMatch(/EPDs from the aluminum, rubber and steel suppliers/)
  })

  it('reads step names as words inside a sentence', () => {
    expect(stepLabel('70. Final assembly')).toBe('Final assembly (step 70)')
    expect(stepLabel('ASM-01 Assembly bench')).toBe('ASM-01 Assembly bench')
    expect(listOf(['a'])).toBe('a')
    expect(listOf(['a', 'b', 'c'])).toBe('a, b and c')
  })

  it('never states a number it was not given', () => {
    const text = read.map((i) => [i.why, ...i.moves].join(' ')).join(' ')
    // Only whole-percentage shares of the case's own total and step numbers:
    // no decimals, no savings estimates.
    expect(text.match(/\d+\.\d+/g) ?? []).toEqual([])
    expect(text).not.toMatch(/save|saving|reduce[sd]? by \d/i)
  })
})
