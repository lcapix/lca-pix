/**
 * UX 6: one line per case about Global averages, not a notice on every flow:
 * how many counted flows fall back to the Global average for the case's
 * region, naming the first three. Nothing for a Global case or none falling back.
 */
import { describe, expect, it } from 'vitest'
import { globalAveragesLine } from '@/lib/workspace/inventory'

const row = (substance: string, tag: string | null) => ({ substance, climate: tag ? { tag } : null })

describe('globalAveragesLine', () => {
  it('a Global case, or no flow falling back: no line', () => {
    expect(globalAveragesLine([row('Steel, hot-rolled', 'global')], 'Global')).toBeNull()
    expect(globalAveragesLine([row('Electricity, grid', 'regional')], 'US')).toBeNull()
  })

  it('counts only counted flows and names them once each', () => {
    const rows = [row('Steel, hot-rolled', 'global'), row('Steel, hot-rolled', 'global'), row('Electricity, grid', 'regional'), row('Gasket', null)]
    expect(globalAveragesLine(rows, 'US')).toBe(
      '2 of 3 flows use the Global average, because there is no US factor for steel. Only electricity has US factors today. To use your own number for a flow, open it with Edit more.',
    )
  })

  it('names three, then says how many more', () => {
    const rows = ['Steel', 'Aluminium, primary', 'Epoxy powder', 'Rubber'].map((s) => row(s, 'global'))
    expect(globalAveragesLine(rows, 'EU')).toMatch(/^4 of 4 flows use the Global average, because there is no EU factor for steel, aluminium, epoxy powder and 1 more\./)
    expect(globalAveragesLine([row('Steel', 'global')], 'EU')).toMatch(/^1 of 1 flow uses the Global average/)
  })
})
