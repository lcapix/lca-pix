import { describe, expect, it } from 'vitest'

import { listPlantIds, structureItac } from '@/lib/ingest/itac'
import { validateProcessModel } from '@/lib/ingest/schema'
import fixture from '../fixtures/itac/assess-rows.json'

// Real ASSESS rows from the DOE ITAC workbook, as the import preview reads
// them (scripts/fixtures/itac-assess-rows.mjs says how each plant was chosen).
const ROWS = fixture.rows.map((x) => x.row as Record<string, unknown>)
const plan = (id: string) => structureItac(ROWS, id, fixture.source.file)
const rowOf = (id: string) => ROWS.find((r) => r.ID === id)!

/** Every dollar a row states: the sum of its *_plant_cost cells. */
const statedDollars = (row: Record<string, unknown>) =>
  Object.entries(row)
    .filter(([k]) => k.endsWith('_plant_cost'))
    .reduce((s, [, v]) => s + Number(v), 0)
const costOn = (pm: ReturnType<typeof plan>, node: string) =>
  pm.costs.filter((c) => c.node === node).reduce((s, c) => s + c.amount, 0)
const flowsOn = (pm: ReturnType<typeof plan>, node: string) => pm.flows.filter((f) => f.node === node)

describe('structureItac on real ITAC rows', () => {
  it('keeps every dollar each row states, in a valid model', () => {
    for (const row of ROWS) {
      const pm = plan(String(row.ID))
      expect(validateProcessModel(pm)).toEqual([])
      expect(pm.costs.reduce((s, c) => s + c.amount, 0)).toBe(statedDollars(row))
    }
  })

  it('WV0661: electricity is three steps adding to $78,053, only the kWh carry carbon; gas is $23,097', () => {
    const pm = plan('WV0661')
    const energy = 'Electricity consumption FY2024'
    const demand = 'Electricity demand FY2024'
    const fees = 'Electricity fees FY2024'
    expect(costOn(pm, energy)).toBe(48194)
    expect(flowsOn(pm, energy).map((f) => [f.substance_text, f.quantity, f.unit])).toEqual([['Electricity', 466871, 'kWh']])
    expect(costOn(pm, demand)).toBe(21279)
    expect(flowsOn(pm, demand)).toEqual([])
    expect(pm.nodes.find((n) => n.name === demand)?.description).toBe('1953 kW-months a year (ED_plant_usage), a charge with no carbon.')
    expect(costOn(pm, fees)).toBe(8580)
    expect(flowsOn(pm, fees)).toEqual([])
    expect(costOn(pm, energy) + costOn(pm, demand) + costOn(pm, fees)).toBe(78053)
    expect(pm.costs.filter((c) => [energy, demand, fees].includes(c.node)).every((c) => c.category === 'energy')).toBe(true)

    expect(costOn(pm, 'Natural gas FY2024')).toBe(23097)
    expect(flowsOn(pm, 'Natural gas FY2024').map((f) => [f.substance_text, f.quantity, f.unit])).toEqual([['Natural Gas', 3845, 'MMBtu']])
    // Nothing the row does not report: product, facility and the four streams.
    expect(pm.nodes).toHaveLength(2 + 4)
    expect(pm.flows).toHaveLength(2)
  })

  it('reads the streams it used to skip: paper, other gas, other energy, hazardous liquid, gaseous waste', () => {
    const nl = plan('NL0136')
    const fy = rowOf('NL0136').FY
    expect(flowsOn(nl, `Paper FY${fy}`)[0]).toMatchObject({ substance_text: 'Paper', unit: 'MMBtu', direction: 'input' })
    expect(costOn(nl, `Paper FY${fy}`)).toBe(356933)
    expect(costOn(nl, `Other gas FY${fy}`)).toBe(30296)
    expect(flowsOn(nl, `Other energy FY${fy}`)[0]).toMatchObject({ substance_text: 'Other Energy', quantity: 908599 })
    expect(flowsOn(nl, `Other liquid disposal (haz) FY${fy}`)[0]).toMatchObject({
      substance_text: 'Hazardous Liquid Waste',
      quantity: 194252,
      unit: 'gal',
      direction: 'output',
    })
    expect(costOn(nl, `Other liquid disposal (haz) FY${fy}`)).toBe(761750)

    const ar = plan('AR0113')
    const afy = rowOf('AR0113').FY
    expect(flowsOn(ar, `Gaseous waste disposal FY${afy}`)[0]).toMatchObject({
      substance_text: 'Gaseous Waste',
      quantity: 67344192,
      unit: 'lbs',
      direction: 'output',
    })
    expect(costOn(ar, `Gaseous waste disposal FY${afy}`)).toBe(31800)
  })

  it('a cost with no usage is a cost-only step, named in a note (AM0287)', () => {
    const pm = plan('AM0287')
    const fy = rowOf('AM0287').FY
    for (const [step, cost] of [
      [`Other liquid disposal (non-haz) FY${fy}`, 103699],
      [`Other liquid disposal (haz) FY${fy}`, 5235],
      [`Solid waste disposal (non-haz) FY${fy}`, 2475565],
    ] as const) {
      expect(costOn(pm, step)).toBe(cost)
      expect(flowsOn(pm, step)).toEqual([])
    }
    expect(pm.notes).toContain(
      'ITAC gives a cost but no amount for: Other liquid disposal (non-haz) (W2), Other liquid disposal (haz) (W3), ' +
        'Solid waste disposal (non-haz) (W4). Those steps carry the cost only; their impact is not counted until an amount is entered.',
    )
  })

  it('a plant with no cost-only stream gets no such note', () => {
    expect(plan('WV0661').notes.some((n) => n.startsWith('ITAC gives a cost but no amount'))).toBe(false)
  })

  it('throws on an unknown plant id', () => {
    expect(() => structureItac(ROWS, 'NOPE', 'ITAC.xlsx')).toThrow('assessment NOPE not found')
  })

  it('every node, flow and cost carries provenance back to the workbook row', () => {
    const pm = plan('WV0661')
    for (const n of pm.nodes) expect(n.provenance?.locator).toContain('ID=WV0661')
    for (const f of pm.flows) expect(f.provenance?.doc).toBe(fixture.source.file)
    expect(pm.costs.find((c) => c.node === 'Electricity fees FY2024')?.provenance?.snippet).toBe('EF_plant_cost=8580')
  })
})

describe('listPlantIds', () => {
  it('filters by substring and caps the sample', () => {
    expect(listPlantIds(ROWS, 'WV')).toEqual({ total: 1, sample: ['WV0661'] })
    expect(listPlantIds(ROWS, 'a')).toEqual({ total: 2, sample: ['AR0113', 'AM0287'] })
    expect(listPlantIds(ROWS, '', 2)).toEqual({ total: 4, sample: ['WV0661', 'NL0136'] })
  })
})
