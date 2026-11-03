/**
 * A run read per functional unit (per-fu.ts): an import that covers 5,200
 * frames gives every screen the answer for 1, with amount × factor = impact
 * still true on each flow; a run already per unit is untouched.
 */
import { describe, expect, it } from 'vitest'
import { dataBasisLine, perFunctionalUnit } from '@/lib/workspace/per-fu'

const run = (scale: number, modeled = 5200): any => ({
  run_id: 1,
  impacts: { 'Global Warming': { value: 5200, unit: 'kg CO2 eq' } },
  costs: { operational: 104000, capital: 0, total: 104000 },
  componentBreakdown: [{ component_id: 7, impacts: [{ category_name: 'Global Warming', impact_value: 2600 }] }],
  flowDetail: [{ flow_id: 1, amount: 13000, unit: 'kWh', factor: 0.4, impact: 5200, category_name: 'Global Warming' }],
  run_steps: [{ component_id: 7, name: 'Weld', parent_id: null, type: 'operation', cost: 52000, kinds: { energy: 52000, labor: null } }],
  goalScope: { per_fu_scale: scale, modeled_output: modeled, reference_flow: 1, reference_flow_unit: 'frame' },
})

describe('perFunctionalUnit', () => {
  it('divides every number by the data basis, and keeps amount × factor = impact', () => {
    const r = perFunctionalUnit(run(1 / 5200))
    expect(r.impacts['Global Warming'].value).toBeCloseTo(1, 12)
    expect((r.componentBreakdown[0] as any).impacts[0].impact_value).toBeCloseTo(0.5, 12)
    expect(r.costs.total).toBeCloseTo(20, 9)
    expect(r.run_steps![0].cost).toBeCloseTo(10, 9)
    expect(r.run_steps![0].kinds).toEqual({ energy: expect.closeTo(10, 9), labor: null })
    const f = r.flowDetail[0]
    expect(f.amount).toBeCloseTo(2.5, 12)
    expect(f.amount * f.factor).toBeCloseTo(f.impact, 12)
    expect(r.dataBasis).toEqual({ scale: 1 / 5200, modeledOutput: 5200, referenceFlow: 1, unit: 'frame' })
  })

  it('a run already per unit, or one with no goal and scope, comes back as it is', () => {
    const one = run(1, 1)
    expect(perFunctionalUnit(one)).toBe(one)
    const old = { ...run(1), goalScope: null }
    expect(perFunctionalUnit(old)).toBe(old)
  })

  it('says the data basis once, only when it is not the reference flow', () => {
    expect(dataBasisLine({ modeledOutput: 5200, referenceFlow: 1 }, 'frame')).toBe(
      'The inventory covers 5,200 units, as the documents give it; every answer here is per 1 frame.',
    )
    expect(dataBasisLine({ modeledOutput: 1, referenceFlow: 1 }, 'frame')).toBeNull()
    expect(dataBasisLine(null, 'frame')).toBeNull()
  })
})
