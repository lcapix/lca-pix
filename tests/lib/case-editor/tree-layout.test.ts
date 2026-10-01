import { describe, it, expect } from 'vitest'
import {
  COL_W,
  NODE_H,
  NODE_W,
  ROW_GAP,
  edgePath,
  fitTransform,
  layoutTree,
  matchesQuery,
  resyncPositions,
  rollupLine,
  zoomAt,
  zoomIn,
  zoomOut,
} from '@/lib/case-editor/tree-layout'

const n = (id: string, children: any[] = [], over: Record<string, unknown> = {}) =>
  ({ id, type: 'Operation', label: `Node ${id}`, flows: 0, cost: 0, children, ...over }) as any

describe('layoutTree', () => {
  it('puts leaves in columns and centres each parent over its children', () => {
    const { initialPositions: p, nodes, parentOf, bounds } = layoutTree(n('1', [n('2', [n('4'), n('5')]), n('3')]))
    expect(nodes.map((x) => [x.id, x.depth, x.parentId])).toEqual([
      ['1', 0, null],
      ['2', 1, '1'],
      ['4', 2, '2'],
      ['5', 2, '2'],
      ['3', 1, '1'],
    ])
    expect(parentOf['4']).toBe('2')
    expect(p['4']).toEqual({ x: 0, y: 2 * (NODE_H + ROW_GAP) })
    expect(p['5'].x).toBe(COL_W)
    expect(p['2'].x).toBe(COL_W / 2)
    expect(p['3'].x).toBe(2 * COL_W)
    expect(p['1'].x).toBe((COL_W / 2 + 2 * COL_W) / 2)
    expect(bounds).toEqual({ w: 2 * COL_W + NODE_W, h: 2 * (NODE_H + ROW_GAP) + NODE_H })
  })

  it('draws the synthetic __root__ as a forest of top-level nodes', () => {
    const { nodes } = layoutTree(n('__root__', [n('a'), n('b')]))
    expect(nodes.map((x) => [x.id, x.depth, x.parentId])).toEqual([
      ['a', 0, null],
      ['b', 0, null],
    ])
  })

  it('keeps dragged positions when the tree changes shape', () => {
    const first = layoutTree(n('1', [n('2')]))
    const moved = { ...first.initialPositions, '2': { x: 999, y: 999 } }
    const next = layoutTree(n('1', [n('2'), n('3')]))
    const synced = resyncPositions(moved, next.nodes, next.initialPositions)
    expect(synced['2']).toEqual({ x: 999, y: 999 })
    expect(synced['3']).toEqual(next.initialPositions['3'])
    expect(Object.keys(resyncPositions(moved, layoutTree(n('1')).nodes, {}))).toEqual(['1'])
  })
})

describe('fit and zoom (guardrails §5)', () => {
  it('fits within 0.35–1.2 and centres; refuses an unmeasured viewport', () => {
    expect(fitTransform({ width: 40, height: 900 }, { w: 100, h: 100 })).toBeNull()
    const big = fitTransform({ width: 1000, height: 800 }, { w: 100, h: 100 })!
    expect(big.k).toBe(1.2)
    expect(big.x).toBe((1000 - 120) / 2)
    const tiny = fitTransform({ width: 300, height: 300 }, { w: 10000, h: 10000 })!
    expect(tiny.k).toBe(0.35)
  })
  it('zooms around the cursor and clamps to 0.25–3', () => {
    const t = zoomAt({ x: 0, y: 0, k: 1 }, 100, 100, -100)
    expect(t.k).toBeCloseTo(1.15)
    expect(t.x).toBeCloseTo(100 - 100 * 1.15)
    expect(zoomAt({ x: 0, y: 0, k: 2.9 }, 0, 0, -1000).k).toBe(3)
    expect(zoomAt({ x: 0, y: 0, k: 0.3 }, 0, 0, 1000).k).toBe(0.25)
    expect(zoomIn({ x: 1, y: 2, k: 2.9 })).toEqual({ x: 1, y: 2, k: 3 })
    expect(zoomOut({ x: 1, y: 2, k: 0.3 }).k).toBe(0.25)
    expect(zoomOut({ x: 1, y: 2, k: 1 }).k).toBeCloseTo(0.85)
  })
})

describe('cards and edges', () => {
  it('curves from the parent’s bottom centre to the child’s top centre', () => {
    expect(edgePath({ x: 0, y: 0 }, { x: 0, y: 152 })).toBe(
      `M ${NODE_W / 2 + 200} ${NODE_H + 200} C ${NODE_W / 2 + 200} ${(NODE_H + 200 + 352) / 2}, ${NODE_W / 2 + 200} ${(NODE_H + 200 + 352) / 2}, ${NODE_W / 2 + 200} 352`,
    )
  })
  it('writes the roll-up line', () => {
    expect(rollupLine({ cost: 1234.4, flows: 3 }, true)).toBe('Σ $1,234 · 3 flows')
    expect(rollupLine({ cost: 12, flows: 1 }, false)).toBe('$12 · 1 flow')
    expect(rollupLine({ cost: 0, flows: 0 }, false)).toBe('$0')
  })
  it('matches the canvas search by label or id; blank matches nothing', () => {
    expect(matchesQuery({ id: '7', label: 'Cut blank' }, 'cut')).toBe(true)
    expect(matchesQuery({ id: '17', label: 'Paint' }, '17')).toBe(true)
    expect(matchesQuery({ id: '7', label: 'Paint' }, 'cut')).toBe(false)
    expect(matchesQuery({ id: '7', label: 'Paint' }, '')).toBe(false)
  })
})
