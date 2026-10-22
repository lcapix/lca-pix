import { describe, expect, it } from 'vitest'

import { duplicateWarnings, findDuplicateFlows, type FlowOnNode } from '@/lib/duplicate-flows'

// product 1 → line 2 → operation 3, and a second line 4 with operation 5
const row = (
  component_id: number,
  component_name: string,
  parent_component_id: number | null,
  substance_id: number,
  substance_name: string,
): FlowOnNode => ({ component_id, component_name, parent_component_id, substance_id, substance_name })

describe('double-count detection', () => {
  it('says nothing when a parent carries flows that do not repeat below it', () => {
    const rows = [
      row(2, 'Frame line', 1, 10, 'Electricity'),
      row(3, 'Weld frame', 2, 20, 'Argon'),
    ]
    expect(findDuplicateFlows(rows)).toEqual([])
  })

  it('finds the same substance on a step and on a step below it', () => {
    const rows = [
      row(2, 'Frame line', 1, 30, 'Steel'),
      row(3, 'Weld frame', 2, 30, 'Steel'),
    ]
    const found = findDuplicateFlows(rows)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ substance_name: 'Steel', ancestor: 'Frame line', descendant: 'Weld frame' })
    expect(duplicateWarnings(rows)[0]).toContain('Possible double count')
    expect(duplicateWarnings(rows)[0]).toContain('Weld frame')
  })

  it('ignores the same substance on two steps that are not on one path', () => {
    // Sibling branches: welding and painting both draw electricity. That is
    // normal modelling, not a double count.
    const rows = [
      row(3, 'Weld frame', 2, 10, 'Electricity'),
      row(5, 'Paint frame', 4, 10, 'Electricity'),
    ]
    expect(findDuplicateFlows(rows)).toEqual([])
  })

  it('finds a repeat across more than one level', () => {
    const rows = [
      row(1, 'Bicycle', null, 30, 'Steel'),
      row(3, 'Weld frame', 2, 30, 'Steel'),
      row(2, 'Frame line', 1, 99, 'Electricity'),
    ]
    const found = findDuplicateFlows(rows)
    expect(found).toHaveLength(1)
    expect(found[0].ancestor).toBe('Bicycle')
    expect(found[0].descendant).toBe('Weld frame')
  })

  it('does not hang on a tree whose parent links form a cycle', () => {
    const rows = [row(2, 'A', 3, 30, 'Steel'), row(3, 'B', 2, 30, 'Steel')]
    expect(() => findDuplicateFlows(rows)).not.toThrow()
  })
})
