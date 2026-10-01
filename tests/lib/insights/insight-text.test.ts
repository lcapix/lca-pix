import { describe, it, expect } from 'vitest'
import type { ConsultantItem } from '@/lib/insights/consultant'
import { OVERALL_KEY, OVERALL_LABEL, type Contributor, type CostView } from '@/lib/insights/magic-insights'
import {
  NOT_MATERIAL,
  answerFreeText,
  baseText,
  buildInsightText,
  fmtShare,
  tradeoffText,
  type InsightTextInput,
} from '@/lib/insights/insight-text'

const contrib = (id: string, name: string, pct: number): Contributor => ({ id, name, pct, value: pct })
const FRAME = contrib('1', '10. Frame tubes', 60)
const WELD = contrib('2', '20. Welding', 25)
const PAINT = contrib('3', 'Paint', 15)
const ALU = { name: 'Aluminum', pct: 70, steps: 2, value: 70 }
const CLOSE =
  ' To put a number on a change, the case needs a factor for the new option (from the library or a supplier EPD); then duplicate the case, apply it, and run both.'

const BASE: InsightTextInput = {
  activeChip: 'summary',
  caseName: 'Bike',
  method: 'TRACI 2.1',
  activeLabel: 'Global Warming',
  activeUnit: 'kg CO2 eq',
  activeTotal: 1234.5,
  selectedCategory: 'Global Warming',
  totalCost: 500,
  contributors: [FRAME, WELD, PAINT],
  materials: [ALU],
  consultant: [],
  costView: null,
  reducePct: 20,
  submittedPrompt: '',
  exampleQs: ['Q1?', 'Q2?'],
}

const LEVERS: ConsultantItem[] = [
  { title: 'Aluminum is the biggest lever', why: 'W1', moves: ['a1', 'a2', 'a3'] },
  { title: 'Steel is the next lever', why: 'W2', moves: ['s1'] },
  { title: 'Shop electricity: start with Welding (step 20)', why: 'W3', moves: ['e1', 'e2'] },
  { title: 'Replace averages with supplier data', why: 'W4', moves: ['d1'] },
]

describe('fmtShare / NOT_MATERIAL', () => {
  it('prints a share to one decimal, and a positive sliver as "under 0.1%"', () => {
    expect(fmtShare(12.345)).toBe('12.3%')
    expect(fmtShare(0)).toBe('0.0%')
    expect(fmtShare(0.05)).toBe('under 0.1%')
    expect(fmtShare(0.1)).toBe('0.1%')
    expect(fmtShare(-1)).toBe('-1.0%')
  })

  it('treats energy and freight flows as not a material', () => {
    for (const n of ['Electricity', 'Natural gas', 'Diesel', 'Truck transport', 'Ocean freight', 'Air'])
      expect(NOT_MATERIAL.test(n)).toBe(true)
    for (const n of ['Aluminum', 'Steel', 'Repair kit', 'Chair'])
      expect(NOT_MATERIAL.test(n)).toBe(false)
  })
})

describe('summary', () => {
  it('leads with the total, the top material and the top steps', () => {
    expect(buildInsightText(BASE)).toBe(
      'Your Bike assessment under TRACI 2.1 totals {{1,235 kg CO2 eq}} for {{Global Warming}} at {{$500}}.' +
        ' By material, {{Aluminum}} makes up {{70.0%}} of it, across 2 steps: that is the biggest lever.' +
        ' By step, {{Frame tubes (step 10)}} carries the most ({{60.0%}}), and the top two steps account for {{85.0%}}.',
    )
  })

  it('says "1 step" for a material on one step', () => {
    expect(buildInsightText({ ...BASE, materials: [{ ...ALU, steps: 1 }] })).toContain('across 1 step: that is')
  })

  it('reads overall, with no results and no cost', () => {
    expect(
      buildInsightText({
        ...BASE,
        selectedCategory: OVERALL_KEY,
        activeLabel: OVERALL_LABEL,
        activeUnit: 'normalized share',
        activeTotal: undefined,
        totalCost: undefined,
        contributors: [],
        materials: [],
      }),
    ).toBe(
      'Your Bike assessment under TRACI 2.1 totals {{an indicative overall load}} for {{environmental load}} at {{—}}.' +
        ' By step, {{your top step}} carries the most ({{—%}}), and the top two steps account for {{0.0%}}.',
    )
  })
})

describe('reduce', () => {
  const reduce = (over: Partial<InsightTextInput>) => buildInsightText({ ...BASE, activeChip: 'reduce', ...over })

  it('asks for a run when there are no contributors', () => {
    expect(reduce({ contributors: [] })).toBe(
      'No contributor data yet for {{Global Warming}}. Run an assessment with this category enabled to get reduce-by-20% guidance.',
    )
  })

  it('starts with the material when it carries at least the top step’s share', () => {
    expect(reduce({})).toBe(
      'To cut {{Global Warming}} by {{20%}}, start with {{Aluminum}}: it is {{70.0%}} of the load, across 2 steps.' +
        ' A {{29%}} cut in its footprint gets you there: use less of it, a lower-carbon grade, or another material.' +
        ' Duplicate the case, swap it on the steps that use it, and run both.',
    )
    const one = reduce({ materials: [{ ...ALU, steps: 1 }] })
    expect(one).toContain('across 1 step. A')
    expect(one).toContain('swap it on the step that uses it, and run both.')
    // A tie with the top step still goes to the material.
    expect(reduce({ materials: [{ ...ALU, pct: 60 }] })).toContain('start with {{Aluminum}}')
  })

  it('says a target above the material’s share takes more than one change', () => {
    expect(reduce({ reducePct: 80 })).toBe(
      'Cutting {{Global Warming}} by {{80%}} is more than {{Aluminum}} carries ({{70.0%}}), though it is the biggest share.' +
        ' It takes changes to several materials, or a different design.',
    )
  })

  it('starts with the top step when no material outweighs it', () => {
    expect(reduce({ materials: [{ ...ALU, pct: 40 }] })).toBe(
      'To cut {{Global Warming}} by {{20%}}, start with {{Frame tubes (step 10)}}: it carries {{60.0%}} of the load,' +
        ' so a {{34%}} cut on that step alone reaches the target. Open it to see which material or energy flow drives it,' +
        ' then use less of that flow, a lower-carbon grade or supplier, or a redesigned step.' +
        ' If that step cannot change, {{Welding (step 20)}} is next.',
    )
    const single = reduce({ materials: [], contributors: [contrib('1', 'Frame', 100)] })
    expect(single).toContain('a {{20%}} cut on that step alone')
    expect(single).not.toContain('If that step cannot change')
  })

  it('says a target above the top step’s share takes several steps', () => {
    expect(reduce({ materials: [], reducePct: 70 })).toBe(
      'Cutting {{Global Warming}} by {{70%}} is more than any one step carries: the largest, {{Frame tubes (step 10)}}, is {{60.0%}}.' +
        ' It takes changes on several steps, or a different design. Open each step to see which flow drives it,' +
        ' and test every change on a copy of the case.',
    )
  })

  it('calls the overall load "environmental load"', () => {
    expect(reduce({ selectedCategory: OVERALL_KEY, activeLabel: OVERALL_LABEL, materials: [] })).toContain(
      'To cut {{environmental load}} by {{20%}}',
    )
  })
})

describe('trade-off', () => {
  const costView = (split: CostView['split'], steps: CostView['steps'] = [{ id: '1', name: 'x', costPct: 45.5, impactPct: 60 }]): CostView => ({
    split,
    steps,
  })
  const trade = (over: Partial<Parameters<typeof tradeoffText>[0]>) =>
    tradeoffText({ loadLabel: 'GW', costStr: '$500', top: FRAME, materials: [ALU], costView: null, ...over })

  it('asks for a run, then for costs', () => {
    expect(trade({ top: undefined })).toBe('No results yet for {{GW}}. Run an assessment first.')
    expect(trade({})).toBe(
      'This case has no step costs yet, so there is nothing to set against {{GW}}. Add labor, material or energy costs on the steps, then come back.',
    )
  })

  it('points cost and impact at purchasing when both are mostly material', () => {
    expect(trade({ costView: costView({ material: 60, labor: 30, energy: 10, other: 0 }) })).toBe(
      'Purchased material is {{60.0%}} of the {{$500}} cost, labor {{30.0%}} and energy {{10.0%}}.' +
        ' By step, {{Frame tubes (step 10)}} carries {{60.0%}} of {{GW}} and {{45.5%}} of cost.' +
        ' {{Aluminum}} alone is {{70.0%}} of {{GW}}, and labor carries none of it: an LCA counts materials, energy and emissions, not hours.' +
        ' So cost and {{GW}} point the same way, at what you buy. The lever is a purchasing one: ask the aluminum supplier' +
        ' to price a recycled or lower-carbon grade next to the current one. Cutting shop hours lowers cost but does not move {{GW}}.',
    )
  })

  it('separates labor cost from material impact', () => {
    expect(trade({ costView: costView({ material: 20, labor: 70, energy: 10, other: 0 }) })).toContain(
      ' So cost and {{GW}} sit in different places: most of the cost is labor, most of {{GW}} is material.' +
        ' Cutting hours lowers cost without moving {{GW}}; the {{GW}} lever is the aluminum you buy.',
    )
  })

  it('stops after the material sentence when neither cost kind dominates', () => {
    const t = trade({ costView: costView({ material: 40, labor: 40, energy: 20, other: 0 }) })
    expect(t).toMatch(/not hours\.$/)
  })

  it('lists other costs only when there are some, and prints a sliver as "under 0.1%"', () => {
    expect(trade({ costView: costView({ material: 60, labor: 30, energy: 5, other: 5 }) })).toContain(
      'energy {{5.0%}}, other costs {{5.0%}}.',
    )
    expect(trade({ costView: costView({ material: 99.95, labor: 0.05, energy: 0, other: 0 }) })).toContain(
      'labor {{under 0.1%}} and energy {{0.0%}}.',
    )
  })

  it('skips the step sentence when the top step has no cost row', () => {
    expect(trade({ costView: costView({ material: 60, labor: 40, energy: 0, other: 0 }, []) })).not.toContain('By step')
  })

  it('names no material lever when the top flow is energy, or materials are under half the load', () => {
    const energyFirst = trade({
      materials: [{ name: 'Electricity', pct: 60, steps: 2 }, ALU],
      costView: costView({ material: 60, labor: 40, energy: 0, other: 0 }),
    })
    expect(energyFirst).not.toContain('alone is')
    const minority = trade({
      materials: [{ name: 'Aluminum', pct: 45, steps: 1 }, { name: 'Electricity', pct: 55, steps: 1 }],
      costView: costView({ material: 60, labor: 40, energy: 0, other: 0 }),
    })
    expect(minority).toContain('{{Aluminum}} alone is {{45.0%}}')
    expect(minority).not.toContain('So cost and')
  })

  it('is reached from the trade-off chip with the case’s cost', () => {
    expect(
      buildInsightText({ ...BASE, activeChip: 'tradeoff', costView: costView({ material: 60, labor: 40, energy: 0, other: 0 }) }),
    ).toContain('of the {{$500}} cost')
    expect(buildInsightText({ ...BASE, activeChip: 'tradeoff', totalCost: undefined, costView: costView({ material: 60, labor: 40, energy: 0, other: 0 }) })).toContain(
      'of the {{—}} cost',
    )
  })
})

describe('compare to base', () => {
  const INTRO =
    'Compare Cases sets copies of this case side by side, step by step. Keep the functional unit, LCIA method and region the same on every copy' +
    ' (the page flags a mismatch), change one thing per copy so each difference has one cause, and run each copy after the change. '
  const OUTRO = ' Its What differs tab lists every change, and its Cost tab sets each change\'s cost against its impact.'

  it('asks for a run first', () => {
    expect(baseText({ loadLabel: 'GW', materials: [] })).toBe(
      'No results yet for {{GW}}. Run an assessment first, so copies of this case have something to compare against.',
    )
  })

  it('names the steps a material swap moves', () => {
    expect(baseText({ loadLabel: 'GW', top: FRAME, materials: [ALU] })).toBe(
      INTRO +
        'If you swap {{Aluminum}}, the rows that can move are the 2 steps that use it ({{70.0%}} of {{GW}} in total).' +
        ' The biggest single row is {{Frame tubes (step 10)}} at {{60.0%}}.' +
        OUTRO,
    )
    expect(baseText({ loadLabel: 'GW', top: FRAME, materials: [{ ...ALU, steps: 1 }] })).toContain(
      'the rows that can move are the step that use it',
    )
  })

  it('falls back to the top step without a material, or when the top flow is energy', () => {
    const expected = INTRO + 'The row most likely to move is {{Frame tubes (step 10)}}, at {{60.0%}} of {{GW}}.' + OUTRO
    expect(baseText({ loadLabel: 'GW', top: FRAME, materials: [] })).toBe(expected)
    expect(baseText({ loadLabel: 'GW', top: FRAME, materials: [{ name: 'Electricity', pct: 80, steps: 3 }] })).toBe(expected)
  })

  it('is reached from the base chip', () => {
    expect(buildInsightText({ ...BASE, activeChip: 'base' })).toBe(baseText({ loadLabel: 'Global Warming', top: FRAME, materials: [ALU] }))
  })
})

describe('ask anything', () => {
  const ask = (question: string, over: Partial<Parameters<typeof answerFreeText>[0]> = {}) =>
    answerFreeText({ question, loadLabel: 'GW', top: FRAME, totalStr: '1,235 kg', material: ALU, levers: LEVERS, ...over })

  it('prompts with the example questions until one is asked', () => {
    const expected = 'Type a question in the box, for example "Q1?" or "Q2?". The answer comes from this case\'s result only.'
    expect(buildInsightText({ ...BASE, activeChip: 'custom' })).toBe(expected)
    expect(buildInsightText({ ...BASE, activeChip: 'custom', submittedPrompt: '   ' })).toBe(expected)
  })

  it('answers the submitted question from the case', () => {
    expect(buildInsightText({ ...BASE, activeChip: 'custom', submittedPrompt: 'cut 30%', consultant: LEVERS })).toBe(
      answerFreeText({ question: 'cut 30%', loadLabel: 'Global Warming', top: FRAME, totalStr: '1,235 kg CO2 eq', material: ALU, levers: LEVERS }),
    )
  })

  it('checks a target within the biggest share and starts there', () => {
    expect(ask('Can we cut by 30%?')).toBe(
      'For {{"Can we cut by 30%?"}}: a {{30%}} cut to {{GW}} (now {{1,235 kg}}) is within what {{Aluminum}} carries ({{70.0%}}), so start there. a1 a2' +
        CLOSE,
    )
    expect(ask('cut 30%', { levers: [] })).toBe(
      'For {{"cut 30%"}}: a {{30%}} cut to {{GW}} (now {{1,235 kg}}) is within what {{Aluminum}} carries ({{70.0%}}), so start there.' + CLOSE,
    )
  })

  it('says a target above the biggest share takes more than one change', () => {
    expect(ask('cut 90 %')).toBe(
      'For {{"cut 90 %"}}: a {{90%}} cut to {{GW}} (now {{1,235 kg}}) is more than {{Aluminum}} carries ({{70.0%}}), and that is the biggest share.' +
        ' No single change gets there: it takes several materials or steps, or a different design.',
    )
    expect(ask('cut 150%')).toContain('a {{100%}} cut')
  })

  it('measures a target against the top step without materials, or asks for a run', () => {
    expect(ask('cut 50%', { material: undefined })).toContain('is within what {{Frame tubes (step 10)}} carries ({{60.0%}})')
    expect(ask('cut 50%', { material: undefined, top: undefined })).toBe(
      'For {{"cut 50%"}}: there are no results yet for {{GW}}. Run an assessment first.',
    )
  })

  it('matches a question to the material lever it names', () => {
    expect(ask('What if the aluminium were recycled?')).toBe(
      'For {{"What if the aluminium were recycled?"}}: Aluminum is the biggest lever. W1 What I would do: a1 a2' + CLOSE,
    )
    expect(ask('Swap the STEEL?')).toBe('For {{"Swap the STEEL?"}}: Steel is the next lever. W2 What I would do: s1' + CLOSE)
  })

  it('matches energy and data questions to their levers', () => {
    expect(ask('Would solar help?')).toBe(
      'For {{"Would solar help?"}}: Shop electricity: start with Welding (step 20). W3 What I would do: e1 e2' + CLOSE,
    )
    expect(ask('Is there an EPD?')).toBe(
      'For {{"Is there an EPD?"}}: Replace averages with supplier data. W4 What I would do: d1' + CLOSE,
    )
  })

  it('falls back to the first lever, then the top step, then a run', () => {
    expect(ask('hello')).toBe(
      'For {{"hello"}}: this case\'s result points first to one place. Aluminum is the biggest lever: W1 a1' + CLOSE,
    )
    // An energy question with no electricity lever falls through too.
    expect(ask('energy?', { levers: [LEVERS[0]] })).toContain('points first to one place')
    expect(ask('hello', { levers: [] })).toBe(
      'For {{"hello"}}: the biggest contributor is {{Frame tubes (step 10)}} ({{60.0%}} of {{GW}}). Open that step to see which flow drives it.' +
        CLOSE,
    )
    expect(ask('hello', { levers: [], top: undefined })).toBe(
      'For {{"hello"}}: there are no results yet for {{GW}}. Run an assessment first.',
    )
  })
})
