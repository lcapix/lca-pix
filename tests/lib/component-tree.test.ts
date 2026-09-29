import { describe, it, expect } from 'vitest'
import {
  planPlacement,
  depthOf,
  parentFirstOrder,
  descendantsOf,
  type TreeRow,
} from '@/lib/component-tree'

// 1 product
// ├─ 2 line
// │  └─ 3 op
// │     └─ 4 task
// └─ 5 op
const rows: TreeRow[] = [
  { component_id: 1, parent_component_id: null, hierarchy_level: 1 },
  { component_id: 2, parent_component_id: 1, hierarchy_level: 2 },
  { component_id: 3, parent_component_id: 2, hierarchy_level: 3 },
  { component_id: 4, parent_component_id: 3, hierarchy_level: 4 },
  { component_id: 5, parent_component_id: 1, hierarchy_level: 2 },
]

describe('depthOf', () => {
  it('counts the root as 1', () => {
    expect(depthOf(rows, 1)).toBe(1)
    expect(depthOf(rows, 4)).toBe(4)
  })

  it('stops on a cycle instead of looping', () => {
    const loop: TreeRow[] = [
      { component_id: 1, parent_component_id: 2, hierarchy_level: 1 },
      { component_id: 2, parent_component_id: 1, hierarchy_level: 2 },
    ]
    expect(depthOf(loop, 1)).toBeLessThanOrEqual(2)
  })
})

describe('descendantsOf', () => {
  it('returns every node below, not the node itself', () => {
    expect([...descendantsOf(rows, 2)].sort()).toEqual([3, 4])
  })
})

describe('planPlacement', () => {
  it('rejects a parent that is not in this case (M1)', () => {
    const r = planPlacement(rows, 5, 999)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/same case/i)
  })

  it('rejects a node as its own parent', () => {
    const r = planPlacement(rows, 3, 3)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/own parent/i)
  })

  it('rejects a parent that sits below the node (cycle)', () => {
    const r = planPlacement(rows, 2, 4)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/loop/i)
  })

  it('re-levels the moved node and its whole subtree (EDIT-9)', () => {
    // Move 3 (with child 4) from under 2 (depth 2) to under 5 (depth 2): unchanged depth.
    // Move 3 under the product instead: 3 → 2, 4 → 3.
    const r = planPlacement(rows, 3, 1)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.levels.get(3)).toBe(2)
      expect(r.levels.get(4)).toBe(3)
    }
  })

  it('detaching (parent null) makes the node a root at level 1', () => {
    const r = planPlacement(rows, 2, null)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.levels.get(2)).toBe(1)
      expect(r.levels.get(3)).toBe(2)
      expect(r.levels.get(4)).toBe(3)
    }
  })

  it('recomputes levels from the real depth, not a stale stored level', () => {
    const stale = rows.map((r) => (r.component_id === 5 ? { ...r, hierarchy_level: 4 } : r))
    const r = planPlacement(stale, 3, 5)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.levels.get(3)).toBe(3)
  })

  it('refuses a placement deeper than the 5 levels the schema allows', () => {
    const deep: TreeRow[] = [
      ...rows,
      { component_id: 6, parent_component_id: 4, hierarchy_level: 5 },
      { component_id: 7, parent_component_id: null, hierarchy_level: 1 },
      { component_id: 8, parent_component_id: 7, hierarchy_level: 2 },
    ]
    // 7 (with child 8) under 6 (depth 5) → 7 at 6, 8 at 7.
    const r = planPlacement(deep, 7, 6)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/5 levels/)
  })

  it('placing a new node (no id yet) only checks the parent', () => {
    const r = planPlacement(rows, null, 4)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.level).toBe(5)
  })
})

describe('parentFirstOrder', () => {
  it('orders parents before children even when stored levels are wrong (CMP-3)', () => {
    // 9 was re-parented under 10 before EDIT-9, so its stored level is stale (1)
    // and a hierarchy_level sort would copy it before its parent.
    const moved: TreeRow[] = [
      { component_id: 10, parent_component_id: 1, hierarchy_level: 2 },
      { component_id: 9, parent_component_id: 10, hierarchy_level: 1 },
      { component_id: 1, parent_component_id: null, hierarchy_level: 1 },
    ]
    const order = parentFirstOrder(moved).map((r) => r.component_id)
    expect(order.indexOf(1)).toBeLessThan(order.indexOf(10))
    expect(order.indexOf(10)).toBeLessThan(order.indexOf(9))
    expect(order).toHaveLength(3)
  })

  it('still returns every row when the data holds a cycle', () => {
    const loop: TreeRow[] = [
      { component_id: 1, parent_component_id: 2, hierarchy_level: 1 },
      { component_id: 2, parent_component_id: 1, hierarchy_level: 2 },
    ]
    expect(parentFirstOrder(loop)).toHaveLength(2)
  })
})
