import { describe, expect, it } from 'vitest'

import { detectBomColumns, structureBom } from '@/lib/ingest/bom'
import { validateProcessModel } from '@/lib/ingest/schema'

const ROWS = [
  { Part: 'Touring Frame', Material: 'Aluminum', Quantity: 2.5, Unit: 'kg', 'Unit Cost': 120 },
  { Part: 'Chain', Material: 'Steel', Quantity: 0.35, Unit: 'kg', 'Unit Cost': 18 },
  { Part: 'Fasteners', Material: 'Steel', Quantity: 8, Unit: 'ea', 'Unit Cost': 6 }, // count, no mass
]

describe('detectBomColumns', () => {
  it('maps headers by keyword regardless of exact naming', () => {
    const cols = detectBomColumns(['Part', 'Material', 'Quantity', 'Unit', 'Unit Cost'])
    expect(cols).toMatchObject({
      part: 'Part',
      material: 'Material',
      quantity: 'Quantity',
      unit: 'Unit',
      unitCost: 'Unit Cost',
    })
  })
})

describe('structureBom', () => {
  it('builds a valid model (product → one materials step) with one flow per mass line', () => {
    const pm = structureBom(ROWS, 'bike-bom.csv', 'Deluxe Touring Bike')
    expect(validateProcessModel(pm)).toEqual([])
    expect(pm.nodes.map((n) => n.tier)).toEqual(['product', 'operation'])
    expect(pm.product_name).toBe('Deluxe Touring Bike')
    // frame + chain are mass lines → flows; fasteners (ea) is not
    expect(pm.flows).toHaveLength(2)
    const frame = pm.flows.find((f) => f.substance_text === 'Aluminum')!
    expect(frame).toMatchObject({ direction: 'input', quantity: 2.5, unit: 'kg' })
  })

  it('does NOT fake a mass for count-only lines — surfaces them in notes', () => {
    const pm = structureBom(ROWS, 'bike-bom.csv')
    expect(pm.flows.some((f) => /Fasteners|8/.test(f.substance_text))).toBe(false)
    expect(pm.notes.join(' ')).toMatch(/Fasteners/)
    expect(pm.notes.join(' ')).toMatch(/no mass/i)
  })

  it('multiplies a unit cost by the quantity (never books it as the line total)', () => {
    const pm = structureBom(ROWS, 'bike-bom.csv')
    const total = pm.costs.reduce((s, c) => s + c.amount, 0)
    expect(total).toBeCloseTo(2.5 * 120 + 0.35 * 18 + 8 * 6, 6)
    expect(pm.costs.every((c) => c.category === 'material')).toBe(true)
  })

  it('reads a count × per-part weight, and an extended cost as the line total', () => {
    const pm = structureBom(
      [
        { Part: 'Bolt', Material: 'Steel', Qty: 8, Unit: 'ea', Weight: 0.01, 'Extended Cost': 4 },
        { Part: 'Plate', Material: 'Steel', Qty: 2, Unit: 'ea', Weight: 1.5, 'Extended Cost': 30 },
      ],
      'bom.csv',
      undefined,
      { massHints: { Weight: 'kg' } },
    )
    expect(pm.flows.map((f) => f.quantity)).toEqual([0.08, 3])
    expect(pm.costs.map((c) => c.amount)).toEqual([4, 30])
  })

  it('does not count an assembly row and its parts twice', () => {
    const pm = structureBom(
      [
        { Level: 1, Part: 'Wheel assembly', Material: 'Aluminum', Quantity: 1.2, Unit: 'kg' },
        { Level: 2, Part: 'Rim', Material: 'Aluminum', Quantity: 0.8, Unit: 'kg' },
        { Level: 2, Part: 'Spokes', Material: 'Steel', Quantity: 0.4, Unit: 'kg' },
      ],
      'bom.csv',
    )
    expect(pm.flows.map((f) => f.label)).toEqual(['Rim', 'Spokes'])
  })

  it('accepts grams / tonnes / lb as mass, not just literal kg (regression)', () => {
    const rows = [
      { Part: 'Bolt pack', Material: 'Steel', Quantity: 500, Unit: 'g', Cost: 4 },
      { Part: 'Tubing', Material: 'Aluminum', Quantity: 0.002, Unit: 't', Cost: 9 },
      { Part: 'Grip', Material: 'Rubber', Quantity: 3, Unit: 'lb', Cost: 2 },
      { Part: 'Washers', Material: 'Steel', Quantity: 12, Unit: 'ea', Cost: 1 }, // count → held
    ]
    const pm = structureBom(rows, 'parts.csv')
    expect(pm.flows).toHaveLength(3) // g, t, lb are masses; ea is not
    expect(pm.flows.find((f) => f.unit === 'g')).toMatchObject({
      substance_text: 'Steel',
      quantity: 500,
      unit: 'g',
    })
    expect(pm.notes.join(' ')).toMatch(/Washers/)
  })
})

describe('detectBomColumns — collisions', () => {
  it('does NOT bind a bare "Amount" column to quantity (it is usually a cost)', () => {
    const cols = detectBomColumns(['Material', 'Amount', 'UOM'])
    expect(cols.quantity).toBeUndefined()
  })
})
