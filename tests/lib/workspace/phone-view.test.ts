import { describe, expect, it } from 'vitest'
import { caseKind, outlineRows, sourceName, sourcesOf, zeroLines } from '@/lib/workspace/phone-view'

const steps = [
  { id: 1, parentId: null, name: 'Painted steel bracket', tier: 'product' as const },
  { id: 2, parentId: 1, name: 'Fabrication line', tier: 'machine_line' as const },
  { id: 3, parentId: 2, name: '10. Cut blank', tier: 'operation' as const },
  { id: 4, parentId: 3, name: 'Deburr edges', tier: 'elemental_task' as const },
  { id: 5, parentId: 1, name: '40. Pack and ship', tier: 'operation' as const },
]
const sums = new Map([
  [1, 1.72],
  [2, 1.538],
  [3, 1.538],
  [4, 0],
  [5, 0],
])
const flow = (component_id: number, amount: number | null, unit: string) => ({ flow_id: component_id * 10, component_id, amount, unit }) as any

describe('a case on a phone', () => {
  it('lays the tree out top down with shares as Results shows them, and a task with its amount', () => {
    const rows = outlineRows(steps, sums, 1.719955, [flow(4, 0.0013, 'kWh')], 'base')
    expect(rows.map((r) => [r.depth, r.name, r.right, r.note])).toEqual([
      [0, 'Painted steel bracket', '100%', null],
      [1, 'Fabrication line', '89.4%', null],
      [2, '10. Cut blank', '89.4%', null],
      [3, 'Deburr edges', '0.0013 kWh', null],
      [1, '40. Pack and ship', '0%', 'No counted climate flow'],
    ])
    expect(outlineRows(steps, null, null, [])[0].right).toBeNull()
    expect(caseKind('comparative')).toBe('Comparative case')
  })

  it('lists the climate factors once each, largest first, with a short source name', () => {
    const rows = sourcesOf([
      { substance: 'Electricity', category_name: 'Global Warming', factor: 0.35, impact: 0.14, unit: 'kWh', scope: 'US', source: 'EPA eGRID 2023 US national average (0.350 kg CO2e/kWh) [EGRID-2023]; added by audit' },
      { substance: 'Steel', category_name: 'Global Warming', factor: 1.9, impact: 1.52, unit: 'kg', scope: 'Global', source: 'worldsteel 2022' },
      { substance: 'Steel', category_name: 'Acidification', factor: 0.01, impact: 0.008, unit: 'kg', scope: 'Global', source: 'worldsteel 2022' },
      { substance: 'Electricity', category_name: 'Global Warming', factor: 0.35, impact: 0.0175, unit: 'kWh', scope: 'US', source: 'EPA eGRID 2023 US national average (0.350 kg CO2e/kWh) [EGRID-2023]; added by audit' },
    ])
    expect(rows.map((r) => [r.substance, r.source, r.tag, r.factor, r.per])).toEqual([
      ['Steel', 'worldsteel 2022', 'global', 1.9, 'per kg'],
      ['Electricity', 'EPA eGRID 2023 US national average', 'regional', 0.35, 'per kWh'],
    ])
    expect(sourceName(null)).toBeNull()
    expect(zeroLines([{ name: '40. Pack and ship', value: 0 }, { name: '10. Cut blank', value: 1.5 }])).toEqual(['40. Pack and ship adds 0. It has no counted climate flow.'])
  })
})
