import { describe, it, expect } from 'vitest'
import { consultantRead } from '@/lib/insights/consultant'
import {
  INSIGHT_CHIPS,
  OVERALL_KEY,
  OVERALL_LABEL,
  REDUCE_DEBOUNCE_MS,
  REDUCE_PRESETS,
  buildCategoryOptions,
  buildCostView,
  buildInsightFacts,
  chipLabel,
  clampReduceTarget,
  consultantForCategory,
  exampleQuestions,
  initialCategoryKey,
  materialShares,
  narrationView,
  resolveActiveCategory,
  type ComponentBreakdownEntry,
  type InsightFactsInput,
  type MaterialFlowRow,
} from '@/lib/insights/magic-insights'

const IMPACTS = {
  'Global Warming': { value: 100, unit: 'kg CO2 eq' },
  Acidification: { value: 2, unit: 'kg SO2 eq' },
}
const gw = (v: number) => ({ category_name: 'Global Warming', impact_value: v, unit: 'kg CO2 eq' })
const ac = (v: number) => ({ category_name: 'Acidification', impact_value: v, unit: 'kg SO2 eq' })

describe('constants and chips', () => {
  it('keeps the overall key, label, debounce and presets', () => {
    expect(OVERALL_KEY).toBe('__overall__')
    expect(OVERALL_LABEL).toBe('Overall environmental load')
    expect(REDUCE_DEBOUNCE_MS).toBe(400)
    expect(REDUCE_PRESETS).toEqual([10, 20, 30, 50])
  })

  it('lists the five chips in order', () => {
    expect(INSIGHT_CHIPS.map((c) => [c.id, c.label, c.icon])).toEqual([
      ['summary', 'Summary', 'sparkle'],
      ['reduce', 'Reduce environmental load by X%', 'arrow-down'],
      ['tradeoff', 'Cost vs environmental load trade-off', 'dollar'],
      ['base', 'Compare to base', 'layers'],
      ['custom', 'Ask anything', 'message'],
    ])
  })

  it('shows the reduce target in the reduce chip only', () => {
    expect(chipLabel(INSIGHT_CHIPS[1], 35)).toBe('Reduce environmental load by 35%')
    expect(chipLabel(INSIGHT_CHIPS[0], 35)).toBe('Summary')
    expect(chipLabel(INSIGHT_CHIPS[4], 35)).toBe('Ask anything')
  })
})

describe('buildCategoryOptions', () => {
  it('offers only the overall option without impacts', () => {
    expect(buildCategoryOptions(undefined)).toEqual([{ key: OVERALL_KEY, label: OVERALL_LABEL }])
    expect(buildCategoryOptions({})).toEqual([{ key: OVERALL_KEY, label: OVERALL_LABEL }])
  })

  it('puts overall first, then every category in key order', () => {
    expect(buildCategoryOptions(IMPACTS)).toEqual([
      { key: OVERALL_KEY, label: OVERALL_LABEL },
      { key: 'Global Warming', label: 'Global Warming' },
      { key: 'Acidification', label: 'Acidification' },
    ])
  })
})

describe('initialCategoryKey', () => {
  it('uses the initial category only when the run has it', () => {
    expect(initialCategoryKey('Global Warming', IMPACTS)).toBe('Global Warming')
    expect(initialCategoryKey('Missing', IMPACTS)).toBe(OVERALL_KEY)
    expect(initialCategoryKey(undefined, IMPACTS)).toBe(OVERALL_KEY)
    expect(initialCategoryKey('', IMPACTS)).toBe(OVERALL_KEY)
    expect(initialCategoryKey('Global Warming', undefined)).toBe(OVERALL_KEY)
  })
})

describe('clampReduceTarget', () => {
  it('skips text that is not a number', () => {
    expect(clampReduceTarget('')).toBeNull()
    expect(clampReduceTarget('abc')).toBeNull()
    expect(clampReduceTarget('-')).toBeNull()
  })

  it('rounds and clamps to 1–100', () => {
    expect(clampReduceTarget('35')).toBe(35)
    expect(clampReduceTarget('12.4')).toBe(12)
    expect(clampReduceTarget('12.5')).toBe(13)
    expect(clampReduceTarget('0.4')).toBe(1)
    expect(clampReduceTarget('0')).toBe(1)
    expect(clampReduceTarget('-3')).toBe(1)
    expect(clampReduceTarget('150')).toBe(100)
    expect(clampReduceTarget('Infinity')).toBe(100)
  })

  it('reads a leading number like parseFloat', () => {
    expect(clampReduceTarget('7abc')).toBe(7)
    expect(clampReduceTarget(' 42 ')).toBe(42)
  })
})

describe('resolveActiveCategory: one category', () => {
  const breakdown: ComponentBreakdownEntry[] = [
    { component_id: 1, component_name: 'A', impacts: [gw(50), ac(1)] },
    { component_id: 2, component_name: 'B', impacts: [gw(30)] },
    { component_id: 'x3', component_name: 'C', impacts: [gw(-5)] },
    { component_id: 4, component_name: 'D', impacts: [gw(0)] },
    { component_id: 5, component_name: 'E', impacts: [ac(1)] },
    { component_id: 6, component_name: 'F', impacts: [gw(10)] },
    { component_id: 7, component_name: 'G', impacts: [gw(5)] },
    { component_id: 8, component_name: 'H', impacts: [gw(3)] },
    { component_id: 9, component_name: 'I', impacts: [gw(2)] },
  ]

  it('takes the label, unit and total from the run', () => {
    const r = resolveActiveCategory('Global Warming', IMPACTS, breakdown)
    expect(r.activeLabel).toBe('Global Warming')
    expect(r.activeUnit).toBe('kg CO2 eq')
    expect(r.activeTotal).toBe(100)
  })

  it('keeps the top five positive steps, shares taken over every positive step', () => {
    const r = resolveActiveCategory('Global Warming', IMPACTS, breakdown)
    expect(r.contributors).toEqual([
      { id: '1', name: 'A', value: 50, pct: 50 },
      { id: '2', name: 'B', value: 30, pct: 30 },
      { id: '6', name: 'F', value: 10, pct: 10 },
      { id: '7', name: 'G', value: 5, pct: 5 },
      { id: '8', name: 'H', value: 3, pct: 3 },
    ])
    // Zero, negative and missing values are left out; the sixth step keeps its share.
    expect([...r.stepShares.entries()]).toEqual([
      ['1', 50],
      ['2', 30],
      ['6', 10],
      ['7', 5],
      ['8', 3],
      ['9', 2],
    ])
  })

  it('has no contributors, unit or total for a category the run lacks', () => {
    const r = resolveActiveCategory('Ozone Depletion', IMPACTS, breakdown)
    expect(r.activeLabel).toBe('Ozone Depletion')
    expect(r.activeUnit).toBe('')
    expect(r.activeTotal).toBeUndefined()
    expect(r.contributors).toEqual([])
    expect(r.stepShares.size).toBe(0)
  })

  it('handles a missing breakdown', () => {
    const r = resolveActiveCategory('Global Warming', IMPACTS, undefined)
    expect(r.contributors).toEqual([])
    expect(r.activeTotal).toBe(100)
  })
})

describe('resolveActiveCategory: overall', () => {
  it('sums each step’s normalized share across categories', () => {
    const breakdown: ComponentBreakdownEntry[] = [
      { component_id: 1, component_name: 'A', impacts: [gw(50), ac(1)] }, // 0.5 + 0.5
      { component_id: 2, component_name: 'B', impacts: [gw(30), ac(-1)] }, // 0.3, negative ignored
      { component_id: 3, component_name: 'C', impacts: [ac(0.5)] }, // 0.25
      { component_id: 4, component_name: 'D', impacts: [{ category_name: 'Unknown', impact_value: 5, unit: 'x' }] },
      { component_id: 5, component_name: 'E', impacts: [gw(0)] },
    ]
    const r = resolveActiveCategory(OVERALL_KEY, IMPACTS, breakdown)
    expect(r.activeLabel).toBe(OVERALL_LABEL)
    expect(r.activeUnit).toBe('normalized share')
    expect(r.activeTotal).toBeUndefined()
    expect(r.contributors.map((c) => c.id)).toEqual(['1', '2', '3'])
    expect(r.contributors[0].value).toBeCloseTo(1, 10)
    expect(r.contributors[0].pct).toBeCloseTo((1 / 1.55) * 100, 10)
    expect(r.contributors[1].pct).toBeCloseTo((0.3 / 1.55) * 100, 10)
    expect(r.contributors[2].pct).toBeCloseTo((0.25 / 1.55) * 100, 10)
    expect(r.stepShares.size).toBe(3)
  })

  it('ignores categories whose total is zero or negative', () => {
    const r = resolveActiveCategory(
      OVERALL_KEY,
      { Z: { value: 0, unit: 'u' }, N: { value: -1, unit: 'u' } },
      [{ component_id: 1, component_name: 'A', impacts: [
        { category_name: 'Z', impact_value: 5, unit: 'u' },
        { category_name: 'N', impact_value: 5, unit: 'u' },
      ] }],
    )
    expect(r.contributors).toEqual([])
  })

  it('is empty without a breakdown', () => {
    const r = resolveActiveCategory(OVERALL_KEY, undefined, undefined)
    expect(r.contributors).toEqual([])
    expect(r.stepShares.size).toBe(0)
  })
})

describe('materialShares', () => {
  const rows: MaterialFlowRow[] = [
    { category_name: 'Global Warming', name: 'Aluminum', value: 50, step: 's1' },
    { category_name: 'Global Warming', name: 'Aluminum', value: 30, step: 's2' },
    { category_name: 'Global Warming', name: 'Aluminum', value: 10, step: 's1' },
    { category_name: 'Global Warming', name: 'Electricity', value: 20, step: 's2' },
    { category_name: 'Global Warming', name: 'Steel', value: 0, step: 's3' },
    { category_name: 'Global Warming', name: 'Rubber', value: -5, step: 's3' },
    { category_name: 'Global Warming', name: 'Glass', value: NaN, step: 's3' },
    { category_name: 'Acidification', name: 'Truck', value: 9, step: 's4' },
  ]

  it('is empty for no rows or the overall view', () => {
    expect(materialShares(undefined, 'Global Warming')).toEqual([])
    expect(materialShares([], 'Global Warming')).toEqual([])
    expect(materialShares(rows, OVERALL_KEY)).toEqual([])
  })

  it('groups the category’s positive flows by material and counts distinct steps', () => {
    const m = materialShares(rows, 'Global Warming')
    expect(m.map((x) => [x.name, x.value, x.steps])).toEqual([
      ['Aluminum', 90, 2],
      ['Electricity', 20, 1],
    ])
    expect(m[0].pct).toBeCloseTo((90 / 110) * 100, 10)
    expect(m[1].pct).toBeCloseTo((20 / 110) * 100, 10)
  })

  it('is empty when nothing is positive in the category', () => {
    expect(materialShares(rows, 'Ozone')).toEqual([])
  })
})

describe('consultantForCategory', () => {
  const rows: MaterialFlowRow[] = [
    { category_name: 'Global Warming', name: 'Aluminum', value: 80, step: '10. Frame', tier: 'industry_average' },
    { category_name: 'Global Warming', name: 'Electricity', value: 20, step: '20. Weld' },
    { category_name: 'Acidification', name: 'Truck transport', value: 5, step: 'Ship' },
  ]

  it('is empty for no rows or the overall view', () => {
    expect(consultantForCategory(undefined, 'Global Warming')).toEqual([])
    expect(consultantForCategory([], 'Global Warming')).toEqual([])
    expect(consultantForCategory(rows, OVERALL_KEY)).toEqual([])
  })

  it('reads only the selected category’s flows, tier defaulting to null', () => {
    const items = consultantForCategory(rows, 'Global Warming')
    expect(items).toEqual(
      consultantRead(
        [
          { name: 'Aluminum', value: 80, step: '10. Frame', tier: 'industry_average' },
          { name: 'Electricity', value: 20, step: '20. Weld', tier: null },
        ],
        { categoryLabel: 'Global Warming' },
      ),
    )
    expect(items[0].title).toBe('Aluminum is the biggest lever')
  })
})

describe('buildCostView', () => {
  it('is null without a positive cost', () => {
    expect(buildCostView(undefined, new Map())).toBeNull()
    expect(buildCostView([], new Map())).toBeNull()
    expect(buildCostView([{ id: '1', name: 'a', labor: 0, material: 0, energy: 0, other: 0 }], new Map())).toBeNull()
    expect(buildCostView([{ id: '1', name: 'a', labor: -5, material: 0, energy: 0, other: 0 }], new Map())).toBeNull()
  })

  it('splits cost by kind (negatives ignored) and sets each step’s cost against its impact share', () => {
    const v = buildCostView(
      [
        { id: '1', name: 'Cut', labor: 100, material: 300, energy: 50, other: 0 },
        { id: '2', name: 'Weld', labor: 50, material: -20, energy: 0, other: 20 },
        { id: '3', name: 'Paint', labor: 0, material: 0, energy: 0, other: 0 },
        { id: '4', name: 'Credit', labor: -10, material: 0, energy: 0, other: 0 },
      ],
      new Map([
        ['2', 70],
        ['3', 30],
      ]),
    )!
    // Sums: material 300, labor 150, energy 50, other 20 = 520.
    expect(v.split.material).toBeCloseTo((300 / 520) * 100, 10)
    expect(v.split.labor).toBeCloseTo((150 / 520) * 100, 10)
    expect(v.split.energy).toBeCloseTo((50 / 520) * 100, 10)
    expect(v.split.other).toBeCloseTo((20 / 520) * 100, 10)
    // A step's own cost is its raw column sum (a negative column counts);
    // steps with neither cost nor impact drop out; sorted by impact share.
    expect(v.steps.map((s) => s.id)).toEqual(['2', '3', '1'])
    expect(v.steps[0].costPct).toBeCloseTo((50 / 520) * 100, 10)
    expect(v.steps[0].impactPct).toBe(70)
    expect(v.steps[1]).toEqual({ id: '3', name: 'Paint', costPct: 0, impactPct: 30 })
    expect(v.steps[2].costPct).toBeCloseTo((450 / 520) * 100, 10)
    expect(v.steps[2].impactPct).toBe(0)
  })
})

describe('exampleQuestions', () => {
  it('asks about the footprint overall, and what drives it without materials', () => {
    expect(exampleQuestions(OVERALL_KEY, OVERALL_LABEL, [])).toEqual([
      'Can we cut the footprint by 30%?',
      'What drives this result?',
    ])
  })

  it('names the category and the top material', () => {
    expect(exampleQuestions('Global Warming', 'Global Warming', [{ name: 'Recycled PET', pct: 50, steps: 2 }])).toEqual([
      'Can we cut Global Warming by 30%?',
      'What if the recycled pet were recycled?',
    ])
  })
})

describe('buildInsightFacts', () => {
  const input: InsightFactsInput = {
    caseName: 'Bike',
    method: 'TRACI 2.1',
    activeLabel: 'Global Warming',
    activeUnit: 'kg CO2 eq',
    activeTotal: 120,
    totalCost: 500,
    contributors: [
      { id: '1', name: 'Frame', pct: 75, value: 90 },
      { id: '2', name: 'Wheels', pct: 25, value: 30 },
    ],
    materials: Array.from({ length: 7 }, (_, i) => ({ name: `M${i}`, pct: 10 - i, value: 7 - i, steps: 1 })),
    consultant: [{ title: 'T', why: 'W', moves: ['a', 'b'] }],
    costView: {
      split: { material: 60, labor: 40, energy: 0, other: 0 },
      steps: Array.from({ length: 8 }, (_, i) => ({ id: String(i), name: `S${i}`, costPct: i, impactPct: 8 - i })),
    },
    activeChip: 'summary',
    reducePct: 20,
    submittedPrompt: 'ignored outside custom',
    impacts: { 'Global Warming': { value: 120, unit: 'kg CO2 eq' }, Acidification: { value: 1, unit: 'kg SO2 eq' } },
  }

  it('builds the request body in a fixed key order', () => {
    const f = buildInsightFacts(input)
    expect(Object.keys(f)).toEqual([
      'caseName',
      'method',
      'categoryLabel',
      'total',
      'totalCost',
      'contributors',
      'materials',
      'levers',
      'costSplit',
      'stepCosts',
      'mode',
      'reducePct',
      'question',
      'allCategories',
    ])
    expect(f.total).toEqual({ value: 120, unit: 'kg CO2 eq' })
    expect(f.contributors).toEqual([
      { name: 'Frame', pct: 75, value: 90 },
      { name: 'Wheels', pct: 25, value: 30 },
    ])
    expect(f.materials).toHaveLength(5)
    expect(f.materials![0]).toEqual({ name: 'M0', pct: 10, value: 7 })
    expect(f.levers).toEqual([{ title: 'T', why: 'W', moves: ['a', 'b'] }])
    // Zero cost kinds are left out.
    expect(f.costSplit).toEqual([
      { name: 'Purchased material', pct: 60 },
      { name: 'Labor', pct: 40 },
    ])
    expect(f.stepCosts).toHaveLength(6)
    expect(f.stepCosts![0]).toEqual({ name: 'S0', costPct: 0, impactPct: 8 })
    expect(f.mode).toBe('summary')
    expect(f.reducePct).toBeUndefined()
    expect(f.question).toBeUndefined()
    expect(f.allCategories).toEqual([
      { name: 'Global Warming', value: 120, unit: 'kg CO2 eq' },
      { name: 'Acidification', value: 1, unit: 'kg SO2 eq' },
    ])
  })

  it('sends the reduce target only in reduce mode, the question only in custom mode', () => {
    expect(buildInsightFacts({ ...input, activeChip: 'reduce' }).reducePct).toBe(20)
    expect(buildInsightFacts({ ...input, activeChip: 'reduce' }).question).toBeUndefined()
    expect(buildInsightFacts({ ...input, activeChip: 'custom' }).question).toBe('ignored outside custom')
    expect(buildInsightFacts({ ...input, activeChip: 'custom' }).reducePct).toBeUndefined()
  })

  it('leaves out the total and cost facts it does not have', () => {
    const f = buildInsightFacts({ ...input, activeTotal: undefined, totalCost: undefined, costView: null, impacts: undefined })
    expect(f.total).toBeUndefined()
    expect(f.costSplit).toBeUndefined()
    expect(f.stepCosts).toBeUndefined()
    expect(f.allCategories).toEqual([])
    const sent = JSON.parse(JSON.stringify(f))
    expect('total' in sent).toBe(false)
    expect('totalCost' in sent).toBe(false)
    expect('costSplit' in sent).toBe(false)
  })
})

describe('narrationView', () => {
  const base = { aiText: 'AI says', streamed: 'Computed', done: true }

  it('shows the computed insight while AI mode is off', () => {
    expect(narrationView({ ...base, aiMode: false, aiStatus: 'done' })).toEqual({
      usingAI: false,
      bodyText: 'Computed',
      showCursor: false,
    })
    expect(narrationView({ ...base, done: false, aiMode: false, aiStatus: 'idle' }).showCursor).toBe(true)
  })

  it('shows the AI text while it streams and once it is done', () => {
    expect(narrationView({ ...base, aiMode: true, aiStatus: 'streaming' })).toEqual({
      usingAI: true,
      bodyText: 'AI says',
      showCursor: true,
    })
    expect(narrationView({ ...base, aiMode: true, aiStatus: 'done' })).toEqual({
      usingAI: true,
      bodyText: 'AI says',
      showCursor: false,
    })
  })

  it('falls back to the computed insight when idle, limited or failed', () => {
    for (const aiStatus of ['idle', 'limited', 'fallback'] as const) {
      expect(narrationView({ ...base, done: false, aiMode: true, aiStatus })).toEqual({
        usingAI: false,
        bodyText: 'Computed',
        showCursor: true,
      })
    }
  })
})
