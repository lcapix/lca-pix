import { describe, expect, it } from 'vitest'

import { structureEquipment } from '@/lib/ingest/equipment'
import { validateProcessModel } from '@/lib/ingest/schema'

const steps = [
  { id: 1, name: '10. Cut & miter frame tubes', workCenter: 'SAW1', hoursPerUnit: 0.3 },
  { id: 2, name: '20. TIG weld main triangle', workCenter: 'WLD1', hoursPerUnit: 0.8 },
  { id: 3, name: '30. Weld dropouts & bosses', workCenter: 'WLD1', hoursPerUnit: 0.5 },
  { id: 4, name: '60. Build & true wheels', workCenter: 'WHL1', hoursPerUnit: 0.6 },
]
const rows = [
  { 'Asset ID': 'EQ-1', Description: 'Cold saw', 'Work Center': 'SAW1', 'Rated power': 2, 'Typical load': 50 },
  { 'Asset ID': 'EQ-2', Description: 'TIG welder', 'Work Center': 'WLD1', 'Rated power': 6, 'Typical load': '40%' },
  { 'Asset ID': 'EQ-3', Description: 'Air compressor', 'Work Center': 'PLANT', 'Rated power': 5, 'Typical load': 60 },
]

describe('structureEquipment', () => {
  const pm = structureEquipment(rows, 'eq.csv', { productName: 'Bike', steps, powerHints: { 'Rated power': 'kw' } })

  it('adds kWh = rated kW × load × the step hours, one line per machine per step', () => {
    expect(validateProcessModel(pm)).toEqual([])
    expect(pm.flows.map((f) => [f.attach_component_id, f.quantity])).toEqual([
      [1, 0.3],
      [2, 1.92],
      [3, 1.2],
    ])
    expect(pm.flows.every((f) => f.substance_text === 'Electricity' && f.unit === 'kWh')).toBe(true)
    expect(pm.costs.map((c) => c.category)).toEqual(['energy', 'energy', 'energy'])
  })

  it('reports plant-wide equipment and steps with no machine instead of guessing', () => {
    const n = pm.notes.join(' ')
    expect(n).toMatch(/Air compressor .* not counted/)
    expect(n).toMatch(/No machine on the list for: 60\. Build & true wheels/)
  })

  it('converts horsepower to kW', () => {
    const hp = structureEquipment([{ 'Work Center': 'SAW1', HP: 2, Load: 1 }], 'eq.csv', { productName: 'Bike', steps })
    expect(hp.flows[0].quantity).toBeCloseTo(2 * 0.7457 * 0.3, 4)
  })
})
