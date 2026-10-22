import { describe, it, expect } from 'vitest'
import { componentFormFromQuery } from '@/lib/case-editor/component-form-query'

const q = (s: string) => componentFormFromQuery(new URLSearchParams(s))

describe('componentFormFromQuery (/component/new prefill contract)', () => {
  it('?parent=&type= place a new component', () => {
    expect(q('parent=4&type=elemental_task')).toEqual({
      mode: 'create',
      initial: undefined,
      suggestedParentId: '4',
      suggestedType: 'elemental_task',
    })
    expect(q('')).toEqual({ mode: 'create', initial: undefined, suggestedParentId: null, suggestedType: null })
  })

  it('?edit=<id> opens the component with what the URL carries', () => {
    const r = q('edit=7&name=Cut&description=Laser&driverCategory=Energy%20Consumption&drivers=%5B%22Electricity%20(kWh)%22%5D&operationalCostUSD=12.5&capitalCostUSD=0')
    expect(r.mode).toBe('edit')
    expect(r.initial).toEqual({
      id: '7',
      name: 'Cut',
      description: 'Laser',
      driverCategory: 'Energy Consumption',
      drivers: ['Electricity (kWh)'],
      operationalCostUSD: 12.5,
      capitalCostUSD: 0,
    })
  })

  it('ignores drivers that are not JSON and blanks', () => {
    expect(q('edit=7&drivers=oops&name=').initial).toEqual({
      id: '7',
      name: undefined,
      description: undefined,
      driverCategory: undefined,
      drivers: undefined,
      operationalCostUSD: undefined,
      capitalCostUSD: undefined,
    })
  })
})
