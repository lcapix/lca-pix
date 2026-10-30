import { describe, expect, it } from 'vitest'
import { joinSource, splitSource } from '@/lib/workspace/step-text'

describe('joinSource (E21: editing a step description keeps its import provenance)', () => {
  it('appends the source an import stored', () => {
    expect(joinSource('Shears, welder', 'routing.csv · row 4')).toBe('Shears, welder [source: routing.csv · row 4]')
  })
  it('round-trips with splitSource', () => {
    const stored = joinSource('Cut to length', 'bom.xlsx · line 2')
    expect(splitSource(stored)).toEqual({ text: 'Cut to length', source: 'bom.xlsx · line 2' })
  })
  it('keeps the source when the text is cleared', () => {
    expect(joinSource('  ', 'routing.csv · row 4')).toBe('[source: routing.csv · row 4]')
    expect(splitSource('[source: routing.csv · row 4]')).toEqual({ text: null, source: 'routing.csv · row 4' })
  })
  it('a step made by hand stores only its text, or nothing', () => {
    expect(joinSource('Paint booth', null)).toBe('Paint booth')
    expect(joinSource('', null)).toBeNull()
  })
})
