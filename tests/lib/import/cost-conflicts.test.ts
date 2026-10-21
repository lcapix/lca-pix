import { describe, it, expect } from 'vitest'

import type { IngestPlan } from '@/lib/ingest/maplca'
import { costAfter, costConflicts } from '@/lib/import/cost-conflicts'
import type { TargetComponent } from '@/lib/import/placement-suggestions'

// Re-importing a document used to add into a step's cost every time, so a
// routing imported twice doubled its labour unseen (stage-0 gate E1b).

const plan = {
  case_name: 'R',
  nodes: [],
  flows: [],
  costs: [
    { node: '10. Cut tube', category: 'labor', amount: 6.3, provenance: { doc: 'r.csv', locator: 'row 2' } },
    { node: '20. Weld frame', category: 'labor', amount: 20.66, provenance: { doc: 'r.csv', locator: 'row 3' } },
    { node: '25. Paint frame', category: 'labor', amount: 10.5, provenance: { doc: 'r.csv', locator: 'row 4' } },
    { node: '10. Cut tube', category: 'material', amount: 85, provenance: { doc: 'r.csv', locator: 'row 5' } },
    { node: '10. Cut tube', category: 'constructor', amount: 1, provenance: { doc: 'r.csv', locator: 'row 6' } },
  ],
  review: [],
  notes: [],
} as unknown as IngestPlan

const components: TargetComponent[] = [
  { component_id: 1, name: '10. Cut tube', tier: 'operation', costs: { labor_cost: 6.3 } },
  { component_id: 2, name: '20. Weld frame', tier: 'operation' },
]

describe('costConflicts', () => {
  it('lists a step that already has a cost in a column the document writes', () => {
    const out = costConflicts({
      plan,
      placement: { 'r.csv · row 2': 1, 'r.csv · row 3': 2 },
      newStep: { 'r.csv · row 4': '25. Paint frame' },
      attachComponentId: null,
      components,
    })
    expect(out).toEqual([{ key: '1|labor_cost', stepName: '10. Cut tube', label: 'labor', existing: 6.3, incoming: 6.3 }])
  })

  it('resolves a line with no placement by its step name, then the default step, as apply does', () => {
    const byName = costConflicts({ plan, placement: {}, newStep: {}, attachComponentId: null, components })
    expect(byName.map((c) => c.key)).toEqual(['1|labor_cost'])
    const byDefault = costConflicts({
      plan: { ...plan, costs: [{ node: 'Elsewhere', category: 'labor', amount: 4, provenance: { doc: 'r.csv', locator: 'row 9' } }] } as IngestPlan,
      placement: {},
      newStep: {},
      attachComponentId: 1,
      components,
    })
    expect(byDefault).toEqual([{ key: '1|labor_cost', stepName: '10. Cut tube', label: 'labor', existing: 6.3, incoming: 4 }])
  })

  it('sums the document lines for one step and column', () => {
    const two = {
      ...plan,
      costs: [
        { node: 'x', category: 'labor', amount: 1, provenance: { doc: 'b', locator: '1' } },
        { node: 'y', category: 'labor', amount: 2, provenance: { doc: 'b', locator: '2' } },
      ],
    } as unknown as IngestPlan
    const out = costConflicts({ plan: two, placement: { 'b · 1': 1, 'b · 2': 1 }, newStep: {}, attachComponentId: null, components })
    expect(out[0].incoming).toBe(3)
  })

  it('finds nothing for a step with no cost yet, a new step, or an unknown category', () => {
    const out = costConflicts({
      plan,
      placement: { 'r.csv · row 3': 2, 'r.csv · row 5': 2, 'r.csv · row 6': 1 },
      newStep: { 'r.csv · row 2': '10. Cut tube', 'r.csv · row 4': 'x' },
      attachComponentId: null,
      components,
    })
    expect(out).toEqual([])
  })
})

describe('costAfter', () => {
  const c = { key: '1|labor_cost', stepName: 's', label: 'labor', existing: 6.3, incoming: 10.5 }
  it('keeps, replaces or adds', () => {
    expect(costAfter(c, 'keep')).toBe(6.3)
    expect(costAfter(c, 'replace')).toBe(10.5)
    expect(costAfter(c, 'add')).toBeCloseTo(16.8)
  })
})
