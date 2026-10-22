import { describe, it, expect } from 'vitest'
import { buildBreadcrumbPath } from '@/lib/hierarchy'

const n = (id: string, name: string, parentId: string | null) => ({ id, name, parentId }) as any

describe('buildBreadcrumbPath', () => {
  it('lists the ancestors from the root down', () => {
    const nodes = [n('1', 'Bracket', null), n('2', 'Line', '1'), n('3', 'Cut', '2')]
    expect(buildBreadcrumbPath(nodes[2], nodes)).toBe('Bracket / Line')
  })

  it('terminates on a parent cycle instead of looping forever', () => {
    const nodes = [n('1', 'A', '2'), n('2', 'B', '1'), n('3', 'C', '1')]
    const path = buildBreadcrumbPath(nodes[2], nodes)
    expect(path.split(' / ').length).toBeLessThanOrEqual(nodes.length)
  })
})
