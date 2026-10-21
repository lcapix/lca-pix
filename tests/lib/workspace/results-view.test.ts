import { describe, expect, it } from 'vitest'
import { answerSentence, compareNote, costBeside, deltaChip, howSure, whatBuilds } from '@/lib/workspace/results-view'
import { basisLine, basisTag, rateText } from '@/lib/workspace/cost-text'

// The sample study as rules.md fixes it: 1.72 kg CO2-eq per bracket, built by
// 10. Cut blank 1.538, 30. Powder coat and cure 0.140, 20. Weld tab 0.042,
// 40. Pack and ship 0; steel 0.80 kg x 1.900 = 1.520 on a Global average.
const GW = 'Global Warming'
const steps = [
  { component_id: 1, name: 'Painted steel bracket', parent_id: null, type: 'product', cost: null },
  { component_id: 2, name: 'Fabrication line', parent_id: 1, type: 'machine_line', cost: null },
  { component_id: 3, name: 'Cutting', parent_id: 2, type: 'subprocess', cost: null },
  { component_id: 4, name: '10. Cut blank', parent_id: 3, type: 'operation', cost: 0.9 },
  { component_id: 5, name: 'Deburr edges', parent_id: 4, type: 'elemental_task', cost: null },
  { component_id: 6, name: '20. Weld tab', parent_id: 3, type: 'operation', cost: 0.55 },
  { component_id: 7, name: '30. Powder coat and cure', parent_id: 2, type: 'operation', cost: 0.21 },
  { component_id: 8, name: '40. Pack and ship', parent_id: 1, type: 'operation', cost: 0.09 },
]
const flow = (component_id: number, substance: string, impact: number, scope: string) => ({
  component_id,
  substance,
  category_name: GW,
  impact,
  scope,
  source: null,
})
const run = {
  run_id: 101,
  impacts: { [GW]: { value: 1.72, unit: 'kg CO2 eq' }, Acidification: { value: 0.004, unit: 'kg SO2 eq' } },
  componentBreakdown: [
    { component_id: 4, impacts: [{ category_name: GW, impact_value: 1.5375 }] },
    { component_id: 5, impacts: [{ category_name: GW, impact_value: 0.0005 }] },
    { component_id: 6, impacts: [{ category_name: GW, impact_value: 0.042 }] },
    { component_id: 7, impacts: [{ category_name: GW, impact_value: 0.14 }] },
  ],
  flowDetail: [
    flow(4, 'Steel, cold-rolled', 1.52, 'Global'),
    flow(4, 'Electricity', 0.0175, 'US'),
    flow(5, 'Electricity', 0.0005, 'US'),
    flow(6, 'Electricity', 0.042, 'US'),
    flow(7, 'Electricity', 0.14, 'US'),
  ],
  run_steps: steps,
  regionCode: 'US',
}

describe('results view (E05, rules.md facts)', () => {
  it('builds the number by operation, with shares of the total as shown', () => {
    const rows = whatBuilds(run, 'base')
    expect(rows.map((r) => [r.name, r.value.toFixed(3), r.share])).toEqual([
      ['10. Cut blank', '1.538', '89.4%'],
      ['30. Powder coat and cure', '0.140', '8.1%'],
      ['20. Weld tab', '0.042', '2.4%'],
      ['40. Pack and ship', '0.000', '0.0%'],
    ])
    expect(answerSentence(run, rows)).toBe('89% comes from 10. Cut blank, almost all of it steel.')
  })

  it('says how sure in one sentence and splits the total by source', () => {
    const sure = howSure(run, 'base')!
    expect(sure.sentence).toBe('88% rests on one Global average, for steel.')
    expect(sure.groups.map((g) => `${g.kind} ${g.share}`)).toEqual(['global 88.4%', 'regional 11.6%'])
  })

  it('notes the change against the Base case at the 3 decimals shown', () => {
    expect(compareNote(1.72, { label: 'Base case', run_id: 101, total: 1.72 }, true)).toEqual({
      chip: 'Same as the Base case, Run #101',
      note: 'Nothing in your copy differs yet.',
    })
    expect(compareNote(1.667, { label: 'Base case', run_id: 301, total: 1.72 }, false)).toEqual({
      chip: '0.053 lower than the Base case, Run #301',
      note: '3.1% lower',
    })
    expect(deltaChip(1.682, { label: 'Base case', total: 1.72 })).toBe('▼ 2.2% vs the Base case')
    expect(compareNote(1.72, { label: '', run_id: 100, total: 1.72 }, false).chip).toBe('Same as Run #100')
  })

  it('puts the frozen cost beside the impact: $1.75 over four operations', () => {
    const c = costBeside(run)!
    expect(c.total.toFixed(2)).toBe('1.75')
    expect(c.rows.map((r) => `${r.name} ${r.cost.toFixed(2)} ${r.share}`)).toEqual([
      '10. Cut blank 0.90 51.4%',
      '20. Weld tab 0.55 31.4%',
      '30. Powder coat and cure 0.21 12.0%',
      '40. Pack and ship 0.09 5.1%',
    ])
  })
})

describe('cost text (E14)', () => {
  it('reads labor as hours x rate with its tag', () => {
    const b = { driver_quantity: 0.015, driver_unit: 'h', rate: 25.83, rate_unit: '$/h', rate_label: 'Welders/cutters' }
    expect(basisLine(b)).toBe('0.015 h × $25.83/h · Welders/cutters')
    expect(basisTag({ source_kind: 'reference', source_name: 'Reference', vintage: '2026-06' })).toEqual({ kind: 'reference', text: 'Reference 2026-06' })
    expect(basisTag({ source_kind: 'live', source_name: 'BLS OEWS 2025', vintage: '2025' }).text).toBe('BLS OEWS 2025 · live')
    expect(rateText(0.0862, '$/kWh')).toBe('$0.0862/kWh')
    expect(rateText(0.95, '$/kg')).toBe('$0.95/kg')
    expect(rateText(0.105, '$/kg')).toBe('$0.105/kg')
  })
})
