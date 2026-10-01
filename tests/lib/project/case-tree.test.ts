import { describe, it, expect } from 'vitest'
import {
  aggregateSubtree,
  buildCaseTree,
  initialTreeSelection,
  nodeDetailsMetrics,
  nodePathLabel,
} from '@/lib/project/case-tree'
import type { DemoTreeNode } from '@/lib/lcapix-demo'

const row = (over: Record<string, unknown>) => ({ case_id: 5, parent_component_id: null, ...over })

describe('buildCaseTree', () => {
  it('is null without a successful component list', () => {
    expect(buildCaseTree(null)).toBeNull()
    expect(buildCaseTree({ success: false, components: [] })).toBeNull()
    expect(buildCaseTree({ success: true })).toBeNull()
    expect(buildCaseTree({ success: true, components: [] })).toBeNull()
  })

  it('builds one root with its children, costs as numbers', () => {
    const tree = buildCaseTree({
      success: true,
      components: [
        row({ component_id: 1, component_type: 'product', component_name: 'Bracket', labor_cost: '10.50', energy_cost: '2.25' }),
        row({ component_id: 2, component_type: 'operation', component_name: 'Weld', parent_component_id: 1, opex: '7' }),
      ],
    })!
    expect(tree.id).toBe('1')
    expect(tree.label).toBe('Bracket')
    expect(tree.type).toBe('Product')
    expect(tree.cost).toBe(13) // the canvas rounds a node's cost
    expect(tree.children?.map((c) => c.label)).toEqual(['Weld'])
    expect(tree.children?.[0].cost).toBe(7)
  })

  it('wraps several roots in the synthetic __root__ container', () => {
    const tree = buildCaseTree({
      success: true,
      components: [
        row({ component_id: 1, component_type: 'product', component_name: 'A' }),
        row({ component_id: 2, component_type: 'machine_line', component_name: 'B' }),
      ],
    })!
    expect(tree.id).toBe('__root__')
    expect(tree.children).toHaveLength(2)
  })
})

describe('initialTreeSelection', () => {
  const leaf: DemoTreeNode = { id: '2', type: 'Operation', label: 'Weld', flows: 0, cost: 0 }
  it('selects a real root as is', () => {
    const root: DemoTreeNode = { id: '1', type: 'Product', label: 'P', flows: 0, cost: 0, children: [leaf] }
    expect(initialTreeSelection(root)).toBe(root)
  })
  it('never selects the synthetic container: its first child instead', () => {
    const root: DemoTreeNode = { id: '__root__', type: 'Product', label: 'Case Root', flows: 0, cost: 0, children: [leaf] }
    expect(initialTreeSelection(root)).toBe(leaf)
    expect(initialTreeSelection({ ...root, children: [] })).toBeNull()
  })
})

const tree: DemoTreeNode = {
  id: '1',
  type: 'Product',
  label: 'Bracket',
  flows: 1,
  cost: 5,
  children: [
    { id: '2', type: 'Operation', label: 'Cut', flows: 2, cost: 10 },
    {
      id: '3',
      type: 'Machine',
      label: 'Paint line',
      flows: 0,
      cost: -4,
      children: [{ id: '4', type: 'Task', label: 'Spray', flows: 3, cost: 1 }],
    },
  ],
}

describe('aggregateSubtree', () => {
  it('sums impact by label, cost and flows over the whole subtree', () => {
    expect(aggregateSubtree(tree, { Bracket: 1, Cut: 2, Spray: 0.5 })).toEqual({ co2: 3.5, cost: 16, flows: 6 })
  })
  it('only counts positive values', () => {
    expect(aggregateSubtree(tree, { Cut: -2, 'Paint line': 4 })).toEqual({ co2: 4, cost: 16, flows: 6 })
  })
  it('works without an impact map', () => {
    expect(aggregateSubtree(tree.children![1], undefined)).toEqual({ co2: 0, cost: 1, flows: 3 })
  })
})

describe('nodeDetailsMetrics', () => {
  it('reports the share of the case total, capped at 100 %', () => {
    const m = nodeDetailsMetrics(tree.children![0], { totalImpact: 4, impactByComponent: { Cut: 1 } })
    expect(m).toEqual({ co2: 1, cost: 10, flows: 2, childCount: 0, co2Pct: 25 })
    expect(nodeDetailsMetrics(tree, { totalImpact: 1, impactByComponent: { Cut: 3 } }).co2Pct).toBe(100)
  })
  it('has no CO₂ figure until the case has a positive total', () => {
    expect(nodeDetailsMetrics(tree, null)).toEqual({ co2: null, cost: 16, flows: 6, childCount: 2, co2Pct: 0 })
    expect(nodeDetailsMetrics(tree, { totalImpact: 0, impactByComponent: { Cut: 3 } }).co2).toBeNull()
    expect(nodeDetailsMetrics(tree, { totalImpact: -1, impactByComponent: {} }).co2).toBeNull()
  })
})

describe('nodePathLabel', () => {
  const cut = tree.children![0]
  it('prefixes the root for a node below it', () => {
    expect(nodePathLabel(tree, cut)).toBe('Bracket › Cut')
  })
  it('is the node itself for the root, without a tree, or under the synthetic container', () => {
    expect(nodePathLabel(tree, tree)).toBe('Bracket')
    expect(nodePathLabel(null, cut)).toBe('Cut')
    expect(nodePathLabel({ ...tree, id: '__root__' }, cut)).toBe('Cut')
  })
})
