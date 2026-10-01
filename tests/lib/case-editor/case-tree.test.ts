import { describe, it, expect } from 'vitest'
import {
  descendantIdsOf,
  filterFlatByLabel,
  lessonStepNames,
  newComponentQuery,
  parentOptionsFor,
  pickInitialComponent,
  toComponentLikes,
} from '@/lib/case-editor/case-tree'

const c = (id: string, type: string, parentId: string | null, name = `n${id}`) =>
  ({ id, caseId: '10', type, parentId, name }) as any

// 1 product ─ 2 machine ─ 3 subprocess ─ 4 operation ─ 5 elemental
//          └ 6 operation
const TREE = [
  c('1', 'product', null, 'Bracket'),
  c('2', 'machine_line', '1', 'Line'),
  c('3', 'subprocess', '2', 'Cell'),
  c('4', 'operation', '3', 'Cut'),
  c('5', 'elemental_task', '4', 'Deburr'),
  c('6', 'operation', '1', 'Paint'),
]

describe('descendantIdsOf', () => {
  it('finds every step below, at any depth', () => {
    expect([...descendantIdsOf(TREE, '2')].sort()).toEqual(['3', '4', '5'])
    expect([...descendantIdsOf(TREE, '1')].sort()).toEqual(['2', '3', '4', '5', '6'])
    expect(descendantIdsOf(TREE, '5').size).toBe(0)
  })
})

describe('parentOptionsFor', () => {
  it('offers only coarser nodes outside the subtree, labelled with their tier', () => {
    expect(parentOptionsFor(TREE, TREE[3])).toEqual([
      { id: '1', label: 'Bracket (Product)' },
      { id: '2', label: 'Line (Machine/Line)' },
      { id: '3', label: 'Cell (Subprocess)' },
    ])
    // A subprocess cannot go under its own descendants or a finer tier.
    expect(parentOptionsFor(TREE, TREE[2]).map((o) => o.id)).toEqual(['1', '2'])
  })
  it('the product and nothing-selected have none', () => {
    expect(parentOptionsFor(TREE, TREE[0])).toEqual([])
    expect(parentOptionsFor(TREE, null)).toEqual([])
  })
})

describe('newComponentQuery', () => {
  it('defaults to a child of the selected node', () => {
    expect(newComponentQuery(TREE[0])).toBe('?parent=1&type=machine_line')
    expect(newComponentQuery(TREE[3])).toBe('?parent=4&type=elemental_task')
  })
  it('a selected leaf suggests a sibling; nothing selected suggests nothing', () => {
    expect(newComponentQuery(TREE[4])).toBe('?parent=4&type=elemental_task')
    expect(newComponentQuery(c('9', 'elemental_task', null))).toBe('')
    expect(newComponentQuery(null)).toBe('')
  })
})

describe('pickInitialComponent', () => {
  it('prefers ?componentId, then ?component=<name>, then the first root', () => {
    expect(pickInitialComponent(TREE, { id: '4', name: 'Paint' })?.id).toBe('4')
    expect(pickInitialComponent(TREE, { id: '99', name: 'Paint' })?.id).toBe('6')
    expect(pickInitialComponent(TREE, {})?.id).toBe('1')
    expect(pickInitialComponent([c('7', 'operation', '1')], {})?.id).toBe('7')
    expect(pickInitialComponent([], {})).toBeUndefined()
  })
})

describe('filterFlatByLabel', () => {
  const flat = [
    { id: '1', label: 'Bracket', type: 'Product', flows: 0, cost: 0, depth: 0 },
    { id: '4', label: 'Cut blank', type: 'Operation', flows: 0, cost: 0, depth: 1 },
  ] as any
  it('matches case-insensitively and returns everything for a blank query', () => {
    expect(filterFlatByLabel(flat, 'CUT').map((n: any) => n.id)).toEqual(['4'])
    expect(filterFlatByLabel(flat, '   ')).toBe(flat)
  })
})

describe('toComponentLikes / lessonStepNames', () => {
  it('passes costs and flow counts through, null when unknown', () => {
    const [like] = toComponentLikes([{ ...TREE[3], laborCost: 5, flowCount: 2 }])
    expect(like).toMatchObject({ id: '4', parentId: '3', laborCost: 5, flowCount: 2, energyCost: null, drivers: null })
  })
  it('lists operations and subprocesses for the lessons', () => {
    expect(lessonStepNames(TREE)).toEqual(['Cell', 'Cut', 'Paint'])
  })
})
