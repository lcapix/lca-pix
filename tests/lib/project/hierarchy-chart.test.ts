import { describe, it, expect } from 'vitest'
import {
  HIERARCHY_TYPE_LABEL,
  childComponents,
  connectorPath,
  countMatches,
  flowChartColors,
  hasMatchingDescendant,
  isVisibleInSearch,
  nameMatches,
  nodeFlowCount,
  rootComponents,
  stepZoom,
  toggleAllCollapsed,
  toggleCollapsed,
} from '@/lib/project/hierarchy-chart'

const rows = [
  { component_id: 1, component_name: 'Bracket', parent_component_id: null, component_type: 'product' },
  { component_id: 2, component_name: 'Cut blank', parent_component_id: 1, component_type: 'operation' },
  { component_id: 3, component_name: 'Paint line', parent_component_id: 1, component_type: 'machine_line' },
  { component_id: 4, component_name: 'Spray coat', parent_component_id: 3, component_type: 'elemental_task' },
  { component_id: 5, component_name: 'Loose step', component_type: 'subprocess' },
]

describe('flowChartColors', () => {
  it('colours by normalized type and falls back to product', () => {
    expect(flowChartColors('operation')).toEqual({ bg: '#7bb5e8', border: '#4f90c9', text: '#0f2238', connectionLine: '#bccabf' })
    expect(flowChartColors('Machine/Line').bg).toBe('#f0a68a')
    expect(flowChartColors('').bg).toBe('#a7d3b8')
    expect(flowChartColors('no-such-type').bg).toBe('#a7d3b8')
  })
  it('labels every tier', () => {
    expect(Object.values(HIERARCHY_TYPE_LABEL)).toEqual(['PRODUCT', 'MACHINE/LINE', 'SUBPROCESS', 'OPERATION', 'ELEMENTAL TASK'])
  })
})

describe('tree walking', () => {
  it('finds roots (no parent) and direct children', () => {
    expect(rootComponents(rows).map((r) => r.component_id)).toEqual([1, 5])
    expect(childComponents(rows, 1).map((r) => r.component_id)).toEqual([2, 3])
    expect(childComponents(rows, 4)).toEqual([])
  })
})

describe('search', () => {
  it('matches names case-insensitively', () => {
    expect(nameMatches(rows[3], 'SPRAY')).toBe(true)
    expect(nameMatches(rows[3], 'weld')).toBe(false)
    expect(countMatches(rows, 'p')).toBe(3)
    expect(countMatches(rows, 'paint')).toBe(1)
  })
  it('keeps an ancestor of a match and drops unrelated branches', () => {
    expect(hasMatchingDescendant(rows, 1, 'spray')).toBe(true)
    expect(hasMatchingDescendant(rows, 2, 'spray')).toBe(false)
    expect(isVisibleInSearch(rows, rows[0], 'spray')).toBe(true)
    expect(isVisibleInSearch(rows, rows[1], 'spray')).toBe(false)
    expect(isVisibleInSearch(rows, rows[3], 'spray')).toBe(true)
    expect(isVisibleInSearch(rows, rows[4], 'spray')).toBe(false)
  })
  it('shows everything without a search', () => {
    expect(rows.every((r) => isVisibleInSearch(rows, r, ''))).toBe(true)
  })
})

describe('nodeFlowCount', () => {
  it('counts the flow list, else flow_count, else 0', () => {
    expect(nodeFlowCount({ flows: [{}, {}], flow_count: 9 })).toBe(2)
    expect(nodeFlowCount({ flow_count: 3 })).toBe(3)
    expect(nodeFlowCount({ flow_count: null })).toBe(0)
    expect(nodeFlowCount({})).toBe(0)
  })
})

describe('connectorPath', () => {
  it('curves from the parent centre to each child centre', () => {
    expect(connectorPath(0, 1)).toBe('M 50 0 C 50 18, 50 18, 50 36')
    expect(connectorPath(0, 2)).toBe('M 50 0 C 50 18, 25 18, 25 36')
    expect(connectorPath(2, 3)).toBe(`M 50 0 C 50 18, ${(2.5 / 3) * 100} 18, ${(2.5 / 3) * 100} 36`)
  })
})

describe('collapsing', () => {
  it('toggles one node without mutating the set', () => {
    const before = new Set([2])
    const after = toggleCollapsed(before, 3)
    expect([...after].sort()).toEqual([2, 3])
    expect([...before]).toEqual([2])
    expect([...toggleCollapsed(after, 2)]).toEqual([3])
  })
  it('collapses every row when nothing is collapsed, else expands all', () => {
    expect([...toggleAllCollapsed(rows, new Set())]).toEqual([1, 2, 3, 4, 5])
    expect(toggleAllCollapsed(rows, new Set([4])).size).toBe(0)
  })
})

describe('stepZoom', () => {
  it('stays within 30–200 %', () => {
    expect(stepZoom(100, 5)).toBe(105)
    expect(stepZoom(35, -5)).toBe(30)
    expect(stepZoom(30, -5)).toBe(30)
    expect(stepZoom(200, 5)).toBe(200)
    expect(stepZoom(198, 5)).toBe(200)
  })
})
