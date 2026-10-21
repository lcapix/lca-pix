import { describe, expect, it } from 'vitest'
import { droppedWithChildren, shortLocator, stepsAndHours, tickedHours, withoutSteps } from '@/lib/import/steps-hours'

// The enclosure routing (F2.3): five operations under one line, hours from labour costs.
const node = (name: string, tier: string, parent: string | null, line?: number) => ({
  name,
  tier,
  parent,
  provenance: line ? { doc: 'enclosure-routing.pdf', locator: `page 1, line ${line}` } : undefined,
})
const plan = {
  nodes: [
    node('Aluminium enclosure', 'product', null),
    node('Sheet line', 'machine_line', 'Aluminium enclosure'),
    node('10. Laser cut', 'operation', 'Sheet line', 3),
    node('20. Bend', 'operation', 'Sheet line', 4),
    node('30. Powder coat', 'operation', 'Sheet line', 5),
    node('Mask holes', 'elemental_task', '30. Powder coat'),
  ],
  costs: [
    { node: '10. Laser cut', category: 'labor', amount: 0.3, hours: 0.01 },
    { node: '20. Bend', category: 'labor', amount: 0.2, hours: 0.006 },
    { node: '30. Powder coat', category: 'labor', amount: 0.3, hours: 0.012 },
    { node: '30. Powder coat', category: 'energy', amount: 0.05 },
  ],
} as any

describe('Steps and hours (F2.3)', () => {
  it('lists the operations with their hours and where each was read; totals the ticked ones', () => {
    const rows = stepsAndHours(plan)
    expect(rows.map((r) => [r.name, r.hours, r.where])).toEqual([
      ['10. Laser cut', 0.01, 'p.1 · line 3'],
      ['20. Bend', 0.006, 'p.1 · line 4'],
      ['30. Powder coat', 0.012, 'p.1 · line 5'],
    ])
    expect(tickedHours(rows, new Set()).toFixed(3)).toBe('0.028')
    expect(tickedHours(rows, new Set(['20. Bend'])).toFixed(3)).toBe('0.022')
    expect(shortLocator('Routing sample-routing.csv, row 2')).toBe('row 2')
    expect(shortLocator('sheet ASSESS, cell B4')).toBe('sheet ASSESS, cell B4')
  })

  it('an unticked step leaves with the steps under it, their lines and costs', () => {
    expect([...droppedWithChildren(plan.nodes, new Set(['30. Powder coat']))].sort()).toEqual(['30. Powder coat', 'Mask holes'])
    const body = {
      nodes: plan.nodes,
      flows: [{ node: '10. Laser cut' }, { node: 'Mask holes' }],
      costs: plan.costs,
    }
    const out = withoutSteps(body, new Set(['30. Powder coat']))
    expect(out.nodes.map((n: any) => n.name)).not.toContain('Mask holes')
    expect(out.flows).toEqual([{ node: '10. Laser cut' }])
    expect(out.costs.map((c: any) => c.node)).toEqual(['10. Laser cut', '20. Bend'])
    expect(withoutSteps(body, new Set())).toBe(body)
  })
})
