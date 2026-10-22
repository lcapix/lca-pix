import { describe, expect, it } from 'vitest'
import { LANE_H, LANE_TOP, NODE_W, PITCH, ZOOM_FLOOR, elbow, fitScale, layoutOnLanes, moveFrom, tierOf } from '@/lib/workspace/tier-layout'

// The sample's 17 steps (lib/sample/sample-study.ts), ids in tree order.
const T = (id: number, parentId: number | null, type: string) => ({ id, parentId, type })
const sample = [
  T(1, null, 'product'),
  T(2, 1, 'machine_line'), T(3, 1, 'machine_line'), T(4, 1, 'machine_line'),
  T(5, 2, 'subprocess'), T(6, 2, 'subprocess'), T(7, 3, 'subprocess'), T(8, 4, 'subprocess'),
  T(9, 5, 'operation'), T(10, 6, 'operation'), T(11, 7, 'operation'), T(12, 8, 'operation'),
  T(13, 9, 'elemental_task'), T(14, 9, 'elemental_task'), T(15, 11, 'elemental_task'), T(16, 11, 'elemental_task'), T(17, 12, 'elemental_task'),
]

describe('layoutOnLanes', () => {
  const L = layoutOnLanes(sample)
  const at = (id: number) => L.steps.find((s) => s.id === id)!

  it('one lane per tier; a step sits in its tier lane, whatever its depth', () => {
    expect(L.lanes.map((l) => l.tier)).toEqual(['product', 'machine_line', 'subprocess', 'operation', 'elemental_task'])
    expect([1, 2, 5, 9, 13].map((id) => at(id).lane)).toEqual([0, 1, 2, 3, 4])
    expect(at(13).y).toBe(LANE_TOP + 4 * LANE_H + 30)
    // 20. Weld tab (10) has no tasks; it still sits in the Operation lane.
    expect(at(10).lane).toBe(3)
  })

  it('leaves on a 140px pitch; parents centred over their children', () => {
    const leaves = [13, 14, 10, 15, 16, 17].map((id) => at(id).x)
    for (let i = 1; i < leaves.length; i++) expect(leaves[i] - leaves[i - 1]).toBe(PITCH)
    const mid = (a: number, b: number) => (at(a).x + at(b).x) / 2
    expect(at(9).x).toBe(mid(13, 14))
    expect(at(1).x).toBe(mid(2, 4))
    expect(L.width).toBe(at(17).x + NODE_W + 40)
  })

  it('connectors are elbows (vertical, a bus, vertical), never diagonal', () => {
    expect(L.edges).toHaveLength(16)
    for (const e of L.edges) {
      expect(e.path).toMatch(/^M[\d.]+,[\d.]+ V/)
      expect(e.path).not.toMatch(/ L/)
    }
    expect(elbow({ x: 0, y: 0, w: 128, h: 72 }, { x: 0, y: 150, w: 128 })).toBe('M64,72 V150')
  })

  it("a child whose tier is not below its parent's goes one lane down", () => {
    const odd = layoutOnLanes([T(1, null, 'product'), T(2, 1, 'product'), T(3, 2, 'operation')])
    expect(odd.steps.map((s) => s.lane)).toEqual([0, 1, 3])
    expect(tierOf({ type: null, level: 3 })).toBe('subprocess')
  })

  it('fits within the free space but never below the 86% floor (it pans instead)', () => {
    expect(fitScale({ width: 1000, height: 640 }, { width: 2000, height: 1000 })).toBe(1)
    expect(fitScale({ width: 1000, height: 640 }, { width: 920, height: 1000 })).toBe(0.92)
    expect(fitScale({ width: 2000, height: 640 }, { width: 800, height: 1000 })).toBe(ZOOM_FLOOR)
  })

  it('arrow keys: up the parent, down the first child, along the lane', () => {
    expect(moveFrom(L, 10, 'ArrowUp')).toBe(6)
    expect(moveFrom(L, 9, 'ArrowDown')).toBe(13)
    expect(moveFrom(L, 9, 'ArrowRight')).toBe(10)
    expect(moveFrom(L, 9, 'ArrowLeft')).toBeNull()
    expect(moveFrom(L, 10, 'ArrowDown')).toBeNull()
    expect(moveFrom(L, null, 'ArrowDown')).toBe(1)
    expect(moveFrom(L, 14, 'Home')).toBe(1)
    expect(moveFrom(L, 1, 'End')).toBe(17)
    expect(moveFrom(L, 1, 'x')).toBeNull()
  })
})
