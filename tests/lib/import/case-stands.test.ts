import { describe, expect, it } from 'vitest'
import { caseStands, nextFile } from '@/lib/import/case-stands'

describe('Where this case stands (F2.4)', () => {
  const routingSaved = caseStands({
    project: { functional_unit: '1 enclosure', system_boundary: 'cradle-to-gate', lcia_method: 'TRACI 2.1', region_code: 'US' },
    steps: [
      { name: 'Aluminium enclosure', type: 'product', labor_hours: null },
      { name: 'Sheet line', type: 'machine_line', labor_hours: null },
      ...['10. Laser cut', '20. Bend', '30. Powder coat', '40. Assemble', '50. Pack'].map((n) => ({ name: n, type: 'operation', labor_hours: 0.01 })),
    ],
    layers: ['skeleton', 'costs'],
    latestRunId: null,
  })
  it('after a routing: scope done, 7 steps, 5 of 5 hours, no materials, energy or run', () => {
    expect(routingSaved.map((r) => [r.label, r.value, r.done])).toEqual([
      ['Goal and scope', 'Done', true],
      ['Tree', '7 steps', true],
      ['Labour hours', '5 of 5', true],
      ['Materials', 'Not yet', false],
      ['Energy', 'Not yet', false],
      ['Run', 'Not yet', false],
    ])
    expect(routingSaved[0].detail).toBe('1 enclosure · Cradle-to-gate · TRACI 2.1 · US')
    expect(routingSaved[1].detail).toBe('Aluminium enclosure · Sheet line')
  })
  it('the next file: the bill of materials, then the equipment list, then none', () => {
    expect(nextFile(routingSaved)).toEqual({ connector: 'bom', label: 'Add the bill of materials' })
    const withBom = routingSaved.map((r) => (r.key === 'materials' ? { ...r, done: true } : r))
    expect(nextFile(withBom)?.connector).toBe('equipment')
    expect(nextFile(withBom.map((r) => ({ ...r, done: true })))).toBeNull()
  })
})
