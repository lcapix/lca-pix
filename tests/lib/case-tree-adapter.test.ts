import { describe, it, expect } from 'vitest'
import {
  componentsToTree,
  flattenTree,
  normalizeType,
  type ComponentLike,
} from '@/lib/case-tree-adapter'

describe('case-tree-adapter', () => {
  it('returns null for empty input', () => {
    expect(componentsToTree([])).toBeNull()
    expect(flattenTree(null)).toEqual([])
  })

  it('normalizes database type names to prototype tokens', () => {
    expect(normalizeType('product')).toBe('Product')
    expect(normalizeType('machine_line')).toBe('Machine')
    expect(normalizeType('subprocess')).toBe('Subprocess')
    expect(normalizeType('operation')).toBe('Operation')
    expect(normalizeType('elemental_task')).toBe('Task')
    expect(normalizeType('unknown')).toBe('Task')
  })

  it('builds a hierarchy from flat components and flattens it', () => {
    const input: ComponentLike[] = [
      { id: 'p1', name: 'Battery Pack', type: 'product', parentId: null, laborCost: 100 },
      { id: 'm1', name: 'Cell Line', type: 'machine_line', parentId: 'p1' },
      { id: 's1', name: 'Cathode', type: 'subprocess', parentId: 'm1', drivers: ['d1', 'd2'] },
      { id: 's2', name: 'Anode', type: 'subprocess', parentId: 'm1' },
    ]

    const tree = componentsToTree(input)
    expect(tree).not.toBeNull()
    expect(tree!.id).toBe('p1')
    expect(tree!.type).toBe('Product')
    expect(tree!.cost).toBe(100)
    expect(tree!.children).toHaveLength(1)
    expect(tree!.children![0].id).toBe('m1')
    expect(tree!.children![0].children).toHaveLength(2)

    const cathode = tree!.children![0].children!.find((n) => n.id === 's1')!
    expect(cathode.flows).toBe(2)

    const flat = flattenTree(tree)
    expect(flat.map((n) => n.id)).toEqual(['p1', 'm1', 's1', 's2'])
    expect(flat.map((n) => n.depth)).toEqual([0, 1, 2, 2])
  })

  it('wraps multi-root forests with a synthetic root', () => {
    const input: ComponentLike[] = [
      { id: 'a', name: 'A', type: 'product' },
      { id: 'b', name: 'B', type: 'product' },
    ]
    const tree = componentsToTree(input)
    expect(tree).not.toBeNull()
    expect(tree!.id).toBe('__root__')
    expect(tree!.children).toHaveLength(2)

    // The synthetic container is layout-only and never user-visible:
    // flattenTree skips it and surfaces both roots at depth 0 (see the
    // adapter's own contract comment). The old expectation (3 rows with the
    // container included) predates that contract.
    const flat = flattenTree(tree)
    expect(flat).toHaveLength(2)
    expect(flat.map((n) => n.id).sort()).toEqual(['a', 'b'])
    expect(flat.every((n) => n.depth === 0)).toBe(true)
  })
})
