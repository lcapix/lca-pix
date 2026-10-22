import { describe, expect, it } from 'vitest'
import { comparability } from '@/lib/compare/comparability'
import {
  cellValue,
  changeCell,
  changeSummary,
  checkAction,
  headerLine,
  perNoun,
  stepLine,
  stepParts,
  stepRows,
  totalChip,
  verdict,
  whatChanged,
} from '@/lib/compare/compare-view'
import type { CaseDiff } from '@/lib/compare/diff'

const GW = 'Global Warming'
const run = (region: string) => ({ runId: 1, method: 'TRACI 2.1', region, functionalUnit: '1 painted steel bracket' })
const flowsA = [
  { step: '10. Cut blank', substance: 'Steel', dir: 'input' as const, quantity: 0.8, unit: 'kg' },
  { step: '10. Cut blank', substance: 'Electricity', dir: 'input' as const, quantity: 0.05, unit: 'kWh' },
  { step: '30. Powder coat and cure', substance: 'Electricity', dir: 'input' as const, quantity: 0.4, unit: 'kWh' },
  { step: '40. Pack and ship', substance: 'Scrap steel', dir: 'output' as const, quantity: 0.12, unit: 'kg' },
]
const A = {
  byStep: [
    { step: '10. Cut blank', category: GW, value: 1.538 },
    { step: '30. Powder coat and cure', category: GW, value: 0.14 },
  ],
  stepFlows: flowsA,
}
const B = {
  byStep: [
    { step: '10. Cut blank', category: GW, value: 1.538 },
    { step: '30. Powder coat and cure', category: GW, value: 0.0875 },
  ],
  stepFlows: flowsA.map((f) => (f.step.startsWith('30') ? { ...f, quantity: 0.25 } : f)),
}
const diff: CaseDiff = {
  steps: [],
  flows: [
    {
      kind: 'changed',
      step: '30. Powder coat and cure',
      from: { substance: 'Electricity', dir: 'input', quantity: 0.4, unit: 'kWh' },
      to: { substance: 'Electricity', dir: 'input', quantity: 0.25, unit: 'kWh' },
    },
  ],
  costs: [],
  hours: [],
  costUnchanged: [],
  identical: false,
}

describe('compare view', () => {
  it('reads the four checks into the verdict and the header', () => {
    const fair = comparability([
      { caseId: '1', run: run('US') },
      { caseId: '2', run: run('US') },
    ])
    expect(verdict(fair, 2)).toEqual({ ok: true, title: 'Fair to compare', sub: 'All four checks pass' })
    expect(headerLine(['Base case', 'Shorter cure cycle'], fair)).toBe('Base case vs Shorter cure cycle · TRACI 2.1 · US')
    const failed = comparability([
      { caseId: '1', run: run('US') },
      { caseId: '2', name: 'Lighter blank', run: run('Global'), editedSinceRun: true },
    ])
    expect(verdict(failed, 2)).toMatchObject({ ok: false, title: 'Not comparable yet', sub: '2 of 4 checks fail' })
    expect(headerLine(['Base case', 'Lighter blank'], failed)).toBe('Base case vs Lighter blank · TRACI 2.1')
    expect(verdict(comparability([{ caseId: '1', run: run('US') }, { caseId: '2', run: null }]), 2).sub).toBe('1 of 4 checks fails')
    const name = () => 'Lighter blank'
    const scope = { method: 'TRACI 2.1', region: 'US' }
    expect(failed.checks.map((k) => checkAction(k, name, scope)?.label ?? null)).toEqual([
      null,
      'Run Lighter blank in US',
      null,
      'Run Lighter blank again',
    ])
  })

  it('lays out change by step with each step\'s flows and the changed row', () => {
    const rows = stepRows([A, B], GW, diff, true)
    expect(rows.map((r) => [r.num, r.label, r.changed])).toEqual([
      ['10', 'Cut blank', false],
      ['30', 'Powder coat and cure', true],
      ['40', 'Pack and ship', false],
    ])
    expect(rows[0].line).toBe('Steel 0.80 kg · Electricity 0.05 kWh')
    expect(rows[1].line).toBe('Electricity 0.40 → 0.25 kWh')
    expect(rows[2].line).toBe('Scrap steel 0.12 kg out')
    expect(cellValue(rows[1].values[1], 'kg CO₂-eq')).toBe('0.088 kg CO₂-eq')
    expect(changeCell(rows[1].delta, 'kg CO₂-eq', true)).toBe('−0.053 kg CO₂-eq')
    expect(changeCell(0, 'kg CO₂-eq', false)).toBe('unchanged')
    expect(changeSummary(rows, 'kg CO₂-eq')).toBe('0.053 kg less, all from 30. Powder coat and cure.')
    expect(stepLine(flowsA.slice(0, 2), false)).toBe('Steel · Electricity')
  })

  it('says what changed, with the factor the run used', () => {
    const w = whatChanged(diff, { flows: [{ step: '30. Powder coat and cure', substance: 'Electricity', category: GW, value: 0.0875, scope: 'US', tier: 'authoritative' }] }, GW, 'kg CO₂-eq')
    expect(w.main).toEqual({ from: '0.40', to: '0.25', unit: 'kWh', where: '30. Powder coat and cure', substance: 'Electricity' })
    expect(w.factor?.value).toBeCloseTo(0.35, 12)
    expect(w.factor?.unit).toBe('kg CO₂-eq/kWh')
    expect(w.nothingElse).toBe(true)
  })

  it('words totals and units the way the screens show them', () => {
    expect(totalChip(1.667455, 1.719955)).toBe('▼ 3.1% lower')
    expect(totalChip(1.72, 1.72)).toBe('Same as A')
    expect(perNoun('1 painted steel bracket')).toBe('painted steel bracket')
    expect(perNoun('2 mugs')).toBe('2 mugs')
    expect(stepParts('Deburr edges')).toEqual({ num: null, label: 'Deburr edges' })
  })
})
