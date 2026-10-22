/**
 * The WV0661 worked plant reproduces its ITAC record (Phase 0). Real data
 * only: these are the figures DISCOVERY.md quotes, recomputed from the cells
 * in itac.json.
 */
import { describe, expect, it } from 'vitest'
import { checkWv0661, figures, paybackYears, WV0661 } from './index'

const clone = () => JSON.parse(JSON.stringify(WV0661)) as typeof WV0661

describe('WV0661 worked plant', () => {
  it('reproduces the record: streams, totals, recommendations, to the cent', () => {
    expect(checkWv0661(WV0661)).toEqual([])
  })

  it('electricity is three charges: 62% energy, 27% demand, 11% fees; 38% not per kWh', () => {
    const f = figures(WV0661)
    expect(f.nonKwhShare).toBeCloseTo(0.3825, 4)
  })

  it('payback, which ITAC leaves blank, computed: recommendation 5 at 0.40 years, 4 at 4.63', () => {
    const rec = (n: number) => WV0661.recommendations.find((r) => r.number === n)!
    expect(paybackYears(rec(5))!.toFixed(2)).toBe('0.40')
    expect(paybackYears(rec(4))!.toFixed(2)).toBe('4.63')
    // What the plant skipped paid back faster than what it did (DISCOVERY finding 4).
    const f = figures(WV0661)
    expect(f.notImplemented.costCents / f.notImplemented.savedCents).toBeLessThan(f.implemented.costCents / f.implemented.savedCents)
  })

  it('every value keeps its workbook cell, and a blank stays blank', () => {
    expect(WV0661.plant.salesCents.cell).toBe('ASSESS!G22871')
    for (const s of WV0661.streams) expect(s.costCell).toMatch(/^ASSESS![A-Z]+22871$/)
    for (const r of WV0661.recommendations) expect(r.row).toMatch(/^RECC!\d+$/)
    expect(WV0661.recommendations.find((r) => r.number === 10)!.capitalCents).toBeNull()
  })

  it('the check can fail: one cent off, one kWh off, a status flipped', () => {
    const cent = clone()
    cent.streams.find((s) => s.code === 'EF')!.costCents! += 1
    expect(checkWv0661(cent)).toContain('electricity fees: got 858001, want 858000')

    const kwh = clone()
    kwh.streams.find((s) => s.code === 'EC')!.usage! -= 1
    expect(checkWv0661(kwh).some((m) => m.startsWith('kWh:'))).toBe(true)

    const status = clone()
    status.recommendations[0].implemented = true
    expect(checkWv0661(status).length).toBeGreaterThan(0)
  })
})
