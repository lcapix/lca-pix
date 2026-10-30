import { describe, expect, it } from 'vitest'
import { changeWords, climateOnlyFlows, comparableRun, previousComparable, runCosts, runLabel, stepDiffRows } from '@/lib/results/full-results-view'
import { compareNote } from '@/lib/workspace/results-view'
import { notCounted } from '@/lib/runs/method-categories-view'
import { snapshotRunSteps } from '@/lib/run-snapshot'

// Step names are the sample study's (lib/sample/sample-study.ts). The numbers
// are arithmetic inputs only: each test checks how the page reads a run.

const step = (id: number, name: string, parent: number | null, cost: number | null, kinds?: Record<string, number | null>) => ({
  component_id: id,
  name,
  parent_id: parent,
  type: 'operation',
  cost,
  currency: 'USD',
  kinds,
})

describe('runCosts', () => {
  it('reads every cost from the run as frozen, total and by kind (P53)', () => {
    const c = runCosts([
      step(1, 'Painted steel bracket', null, null),
      step(2, '10. Cut blank', 1, 1.0, { labor: 0.2, material: 0.8 }),
      step(3, '30. Powder coat and cure', 1, 0.75, { energy: 0.7, equipment: 0.05 }),
    ])!
    expect(c.total).toBeCloseTo(1.75, 10)
    expect(c.kinds.find((k) => k.kind === 'Material')!.amount).toBeCloseTo(0.8, 10)
    expect(c.kinds.find((k) => k.kind === 'Energy')!.amount).toBeCloseTo(0.7, 10)
    expect(c.kinds.reduce((t, k) => t + k.amount, 0)).toBeCloseTo(c.total, 10)
  })

  it('is null when the run froze no cost, so the page never shows $0.00 for "not entered"', () => {
    expect(runCosts([step(1, 'Painted steel bracket', null, null)])).toBeNull()
    expect(runCosts(undefined)).toBeNull()
  })

  it('snapshotRunSteps keeps each kind, so cost by kind comes from the run, not today', () => {
    const [s] = snapshotRunSteps({
      steps: [
        {
          component_id: 2, name: '10. Cut blank', parent_id: null, type: 'operation', process_type: null, hierarchy_level: 4,
          stage: null, quantity: 1, unit: null, flows_processed: 1, impacts: [],
          costs: { labor: 0.2, energy: null, material: 0.8, transportation: null, equipment: null, overhead: null, opex: null, capex: null, currency: 'USD' },
        },
      ],
    } as any)
    expect(s.cost).toBeCloseTo(1.0, 10)
    expect(s.kinds).toEqual({ labor: 0.2, energy: null, material: 0.8, transportation: null, equipment: null, overhead: null })
  })
})

describe('comparable runs (R03, P50)', () => {
  const runs = [
    { run_id: 5, calculation_method: 'TRACI 2.1', regionCode: 'US' },
    { run_id: 7, calculation_method: 'CML 2001', regionCode: 'US' },
    { run_id: 9, calculation_method: 'TRACI 2.1', regionCode: 'Global' },
  ]
  it('picks the newest run on the same method and region, or none', () => {
    expect(comparableRun(runs, { run_id: 20, calculation_method: 'TRACI 2.1', regionCode: 'US' })?.run_id).toBe(5)
    expect(comparableRun(runs, { run_id: 20, calculation_method: 'TRACI 2.1' })?.run_id).toBe(9)
    expect(comparableRun(runs, { run_id: 20, calculation_method: 'ReCiPe', regionCode: 'US' })).toBeNull()
  })
  it('the previous comparable run is an earlier one', () => {
    expect(previousComparable(runs, { run_id: 5, calculation_method: 'TRACI 2.1', regionCode: 'US' })).toBeNull()
    expect(previousComparable(runs, { run_id: 8, calculation_method: 'TRACI 2.1', regionCode: 'US' })?.run_id).toBe(5)
  })
})

describe('changeWords', () => {
  it('says up, down or the same, at the 3 decimals shown', () => {
    expect(changeWords(1.65, 1.72)).toBe('down 4.1%')
    expect(changeWords(1.8, 1.72)).toBe('up 4.7%')
    expect(changeWords(1.7201, 1.72)).toBe('the same')
    expect(changeWords(1, 0)).toBe('no base value to compare')
  })
})

describe('stepDiffRows (P56)', () => {
  const tree = (ids: [number, number, number]) => [
    step(ids[0], 'Painted steel bracket', null, null),
    step(ids[1], 'Fabrication line', ids[0], null),
    step(ids[2], '10. Cut blank', ids[1], null),
  ]
  const run = (ids: [number, number, number], value: number, extra?: { id: number; name: string; value: number }) => ({
    run_steps: [...tree(ids), ...(extra ? [step(extra.id, extra.name, ids[0], null)] : [])],
    componentBreakdown: [
      { component_id: ids[2], component_name: '10. Cut blank', impacts: [{ category_name: 'Global Warming', impact_value: value }] },
      ...(extra ? [{ component_id: extra.id, component_name: extra.name, impacts: [{ category_name: 'Global Warming', impact_value: extra.value }] }] : []),
    ],
  })

  it('matches a copy to its base by the path of names, not the ids a copy changes', () => {
    const rows = stepDiffRows(run([101, 102, 103], 1.5), run([1, 2, 3], 1.6), 'Global Warming')
    expect(rows).toHaveLength(1)
    expect(rows[0].path).toBe('Painted steel bracket / Fabrication line / 10. Cut blank')
    expect(rows[0].mine).toBe(1.5)
    expect(rows[0].theirs).toBe(1.6)
    expect(rows[0].diff).toBeCloseTo(-0.1, 10)
  })

  it('a step on one side only shows the other side as missing', () => {
    const rows = stepDiffRows(run([101, 102, 103], 1.5, { id: 104, name: '40. Pack and ship', value: 0.2 }), run([1, 2, 3], 1.5), 'Global Warming')
    const added = rows.find((r) => r.name === '40. Pack and ship')!
    expect(added.mine).toBe(0.2)
    expect(added.theirs).toBeNull()
    expect(rows.find((r) => r.name === '10. Cut blank')!.diff).toBe(0)
  })
})

describe('R20 a run is named by its place in its own case (finding 2.8)', () => {
  it('reads "Run 1", not the site-wide id', () => {
    expect(runLabel({ run_id: 57, case_run_number: 1 })).toBe('Run 1')
    expect(runLabel({ run_id: 57, case_run_number: null })).toBe('Run #57')
  })
  it('the note against the base case uses the base case\'s own run number', () => {
    expect(compareNote(1.72, { label: 'Base case', run_id: 301, case_run_number: 1, total: 1.72 }, true).chip).toBe('Same as the Base case, Run 1')
    expect(compareNote(1.72, { label: '', run_id: 300, case_run_number: 2, total: 1.8 }, false).chip).toBe('0.080 lower than Run 2')
  })
})

describe('R17 categories left out are named, not zero (findings 1.8, 2.11)', () => {
  it('R17 lists the method categories the run has no value for', () => {
    // TRACI 2.1's categories in the reference library (driver_impact_factors.method_name = 'TRACI 2.1').
    const traci = ['Acidification', 'Ecotoxicity', 'Eutrophication', 'Global Warming', 'Human Toxicity', 'Ozone Depletion', 'Photochemical Oxidation']
    expect(notCounted(traci, { 'Global Warming': {}, Acidification: {} })).toEqual(['Ecotoxicity', 'Eutrophication', 'Human Toxicity', 'Ozone Depletion', 'Photochemical Oxidation'])
    expect(notCounted(traci, Object.fromEntries(traci.map((c) => [c, {}])))).toEqual([])
    expect(notCounted(undefined, { 'Global Warming': {} })).toEqual([])
  })
})

describe('K03 materials are climate only', () => {
  const row = (flow_id: number, category_name: string, dir: 'IN' | 'OUT') => ({ flow_id, category_name, dir })
  it('K03 names an input counted only in Global Warming, once, and nothing else', () => {
    const rows = [
      row(1, 'Global Warming', 'IN'), // a material: climate factor only
      row(2, 'Global Warming', 'IN'), // electricity with an acidification factor too
      row(2, 'Acidification', 'IN'),
      row(3, 'Global Warming', 'OUT'), // an emission with one category is not a material
      row(4, 'Acidification', 'IN'),
    ]
    expect(climateOnlyFlows(rows).map((r) => r.flow_id)).toEqual([1])
    expect(climateOnlyFlows([])).toEqual([])
    expect(climateOnlyFlows(undefined)).toEqual([])
  })
})
