import { describe, expect, it } from 'vitest'
import { exampleWriteUp, howSureLong, whatChanged, whatGoesIn } from '@/lib/home/sample-view'

const row = (o: any) => ({ flow_id: o.id, component_id: o.step, substance_id: 1, substance: o.s, direction: 'input', amount: o.a, unit: o.u ?? 'kg', substance_unit: 'kg', note: null, status: o.status ?? 'counted', climate: o.impact == null ? null : { category_id: 1, factor: o.f, unit: 'kg CO2 eq', impact: o.impact, conversion: null, scope: 'US', source: 'x', tag: 'regional' } })
const names: Record<number, string> = { 10: '10. Cut blank', 11: 'Deburr edges', 20: '20. Weld tab', 30: '30. Powder coat and cure', 40: '40. Pack and ship', 41: 'Fold and tape' }

describe('the sample Overview (E02) in its own numbers', () => {
  it('03 what goes in: the four largest lines, then the rest in one sentence', () => {
    const rows = [
      row({ id: 1, step: 10, s: 'Steel, cold-rolled', a: 0.8, f: 1.9, impact: 1.52 }),
      row({ id: 2, step: 10, s: 'Electricity', a: 0.05, u: 'kWh', f: 0.35, impact: 0.0175 }),
      row({ id: 3, step: 11, s: 'Electricity', a: 0.0013, u: 'kWh', f: 0.35, impact: 0.000455 }),
      row({ id: 4, step: 20, s: 'Electricity', a: 0.12, u: 'kWh', f: 0.35, impact: 0.042 }),
      row({ id: 5, step: 30, s: 'Electricity', a: 0.4, u: 'kWh', f: 0.35, impact: 0.14 }),
      row({ id: 6, step: 20, s: 'Argon', a: 0.02, status: 'no_factor' }),
      row({ id: 7, step: 30, s: 'Powder coating', a: 0.03, status: 'no_factor' }),
      row({ id: 8, step: 40, s: 'Scrap steel', a: 0.12, status: 'no_factor' }),
      row({ id: 9, step: 41, s: 'Packaging tape', a: 1, u: 'roll', status: 'left_out' }),
    ] as any
    const r = whatGoesIn(rows, (id) => names[id], 'TRACI 2.1')
    expect(r.shown.map((x) => x.flow_id)).toEqual([1, 5, 4, 2])
    expect(r.footnote).toBe(
      'Plus deburr edges electricity, 0.0005. Argon, powder coating and scrap steel have no climate factor in TRACI 2.1, so they add nothing. Packaging tape is left out: its unit can\'t convert.',
    )
  })

  it('05 what changed, and 04 how sure said in full', () => {
    const f = (step: string, a: number) => ({ step, substance: 'Electricity', direction: 'input' as const, amount: a, unit: 'kWh' })
    expect(whatChanged([f('30. Powder coat and cure', 0.4), f('20. Weld tab', 0.12)], [f('30. Powder coat and cure', 0.25), f('20. Weld tab', 0.12)], 1.72, 1.6674667).sentence).toBe(
      '0.053 kg less, all from 30. Powder coat and cure: its electricity went from 0.40 to 0.25 kWh.',
    )
    expect(whatChanged([f('a', 1)], [f('a', 1)], 1.72, 1.72).sentence).toBe('Nothing differs from the base case yet.')
    const groups = [{ kind: 'global' as const, share: '88.4%', fraction: 0.884, substances: ['steel'] }]
    expect(howSureLong('88% rests on one Global average, for steel.', groups, 'US', 1.7196, 'base')).toBe(
      'How sure: 88% rests on one Global average, for steel, because there is no US value. Read 1.72 as a sound estimate of where the impact sits, not a precise total.',
    )
  })

  it('06 the example write-up', () => {
    expect(
      exampleWriteUp({
        total: 1.7196,
        unit: 'kg CO₂-eq',
        perUnit: 'bracket',
        answerSentence: '89% comes from 10. Cut blank, almost all of it steel.',
        sure: { pct: 88, what: 'one Global average factor' },
        whatIf: { name: 'Shorter cure cycle', pct: '3.1%', lower: true, allFrom: 'electricity' },
      }),
    ).toBe(
      'One bracket is 1.72 kg CO₂-eq. 89% comes from 10. Cut blank, almost all of it steel, and 88% rests on one Global average factor, so the total is an estimate while the ranking holds. Shorter cure cycle saves 3.1%, all of it electricity.',
    )
  })
})
