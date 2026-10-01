import { describe, expect, it } from 'vitest'

import { structureRouting, detectRoutingColumns } from '@/lib/ingest/routing'
import { validateProcessModel } from '@/lib/ingest/schema'

const ROWS = [
  { 'Op No': 10, Operation: 'Cut tube', 'Work Center': 'Cutting', 'Setup Hrs': 0.5, 'Run Hrs': 0.2, Supplier: 'Acme' },
  { 'Op No': 20, Operation: 'Weld frame', 'Work Center': 'Welding', 'Setup Hrs': 1.0, 'Run Hrs': 0.5, Supplier: 'Acme' },
  { 'Op No': 30, Operation: 'Weld stays', 'Work Center': 'Welding', 'Setup Hrs': 0.3, 'Run Hrs': 0.4, Supplier: 'Acme' },
]

describe('detectRoutingColumns', () => {
  it('reads a time column that names its basis, e.g. "Run Hours Per Unit"', () => {
    // Half the ERP exports qualify these headers. The pattern was anchored, so
    // "Run Hours Per Unit" matched nothing: the run time was read as zero and
    // a step's labour came out ten times too small, or vanished entirely when
    // no lot size was given to spread the setup.
    for (const header of ['Run Hours Per Unit', 'Run Hrs/Unit', 'Cycle Time per piece', 'Labor Hours per ea']) {
      const cols = detectRoutingColumns(['Op No', 'Operation', header])
      expect(cols.runHrs ?? cols.laborHrs, `${header} should be read as a time column`).toBe(header)
    }
    // And a setup column that does the same.
    expect(detectRoutingColumns(['Operation', 'Setup Hours per unit']).setupHrs).toBe(
      'Setup Hours per unit',
    )
  })

  it('detects op/description/work-center/hours by header', () => {
    const cols = detectRoutingColumns(Object.keys(ROWS[0]))
    expect(cols.seq).toBe('Op No')
    expect(cols.description).toBe('Operation')
    expect(cols.workCenter).toBe('Work Center')
    expect(cols.setupHrs).toBe('Setup Hrs')
    expect(cols.runHrs).toBe('Run Hrs')
  })
})

describe('structureRouting: time as written', () => {
  it('keeps setup out of per-unit labor without a lot size, and says so', () => {
    const pm = structureRouting(ROWS, 'r.csv', 'Bike')
    const weld = pm.costs.find((c) => /Weld frame/.test(c.node))
    expect(weld?.basis).toMatch(/^0\.5 h per unit/)
    expect(pm.notes.join(' ')).toMatch(/Setup time .* is per lot/)
  })

  it('reads minutes from the header and divides by the base quantity (SAP style)', () => {
    const pm = structureRouting(
      [{ Operation: '0010', Description: 'Saw', 'Base quantity': 100, Labor: 30, 'Labor unit': 'MIN' }],
      'sap.csv',
      'Part',
    )
    expect(pm.nodes.find((n) => n.tier === 'operation')?.name).toBe('0010. Saw')
    expect(pm.costs[0].basis).toMatch(/^0\.005 h per unit/) // 30 min / 100 / 60
  })

  it('reads text durations ("20 min", "1:30")', () => {
    const pm = structureRouting(
      [
        { Step: 1, Operation: 'Cut', Run: '20 min' },
        { Step: 2, Operation: 'Weld', Run: '1:30' },
      ],
      't.csv',
      'Part',
    )
    expect(pm.costs.map((c) => (c.basis ?? '').split(' h')[0])).toEqual(['0.3333', '1.5'])
  })
})

describe('structureRouting', () => {
  const pm = structureRouting(ROWS, 'bike-routing.csv', 'Touring bike', { lotSize: 1 })

  it('builds a structurally valid skeleton with no invented levels', () => {
    expect(validateProcessModel(pm)).toEqual([])
    expect(pm.product_name).toBe('Touring bike')
    // No "Production" line: the document has no line column.
    expect(pm.nodes.some((n) => n.tier === 'machine_line')).toBe(false)
    expect(pm.nodes.find((n) => n.name === 'Cutting')?.parent).toBe('Touring bike')
  })

  it('puts operations straight under the product when there is no work-center column', () => {
    const flat = structureRouting(
      [
        { Step: 1, Description: 'Cut' },
        { Step: 2, Description: 'Weld' },
      ],
      'flat.csv',
      'Frame',
    )
    expect(validateProcessModel(flat)).toEqual([])
    expect(flat.nodes.map((n) => [n.name, n.tier, n.parent])).toEqual([
      ['Frame', 'product', null],
      ['1. Cut', 'operation', 'Frame'],
      ['2. Weld', 'operation', 'Frame'],
    ])
  })

  it('groups operations by work center (one subprocess per center)', () => {
    const subs = pm.nodes.filter((n) => n.tier === 'subprocess').map((n) => n.name)
    expect(subs).toContain('Cutting')
    expect(subs).toContain('Welding')
    expect(subs).toHaveLength(2)
    // Two operations live under Welding.
    const ops = pm.nodes.filter((n) => n.tier === 'operation')
    expect(ops).toHaveLength(3)
  })

  it('costs labor from the stated hours (real hours × cited wage), never invents them', () => {
    // Weld frame: 1.5 h × $25.83 welder ≈ 38.74
    const labor = pm.costs.filter((c) => c.category === 'labor')
    expect(labor).toHaveLength(3)
    const weld = labor.find((c) => /Weld frame/.test(c.node))
    expect(weld?.amount).toBeCloseTo(38.75, 1)
    expect(weld?.basis).toMatch(/1\.5 h/)
  })

  it('surfaces unmapped columns instead of dropping them', () => {
    expect(pm.notes.join(' ')).toMatch(/Supplier/)
  })
})
