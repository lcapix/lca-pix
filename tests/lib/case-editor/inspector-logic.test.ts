import { describe, it, expect } from 'vitest'
import { numberDraftError, parseNumberDraft } from '@/lib/case-editor/number-draft'
import { parseNumberDraft as fromPanel } from '@/components/lcapix/case/inspector-panel'
import {
  allocationMethodPatch,
  allocationSharePatch,
  allocationView,
  isLaborNode,
  laborCostFor,
  laborHoursPatch,
  laborHoursShown,
  machineEnergy,
  machineEnergyDescription,
} from '@/lib/case-editor/cost-calculators'
import { toInspectorFlows } from '@/lib/case-editor/flow-types'
import { hasSuggestedCost, suggestCosts } from '@/lib/case-editor/use-cost-suggestion'

describe('number drafts (EDIT-5)', () => {
  it('parses what can be typed on the way to a number', () => {
    expect(parseNumberDraft('')).toEqual({ ok: true, value: undefined })
    expect(parseNumberDraft(' 12. ')).toEqual({ ok: true, value: 12 })
    expect(parseNumberDraft('.5')).toEqual({ ok: true, value: 0.5 })
    expect(parseNumberDraft('0')).toEqual({ ok: true, value: 0 })
    expect(parseNumberDraft('-1')).toEqual({ ok: false })
    expect(parseNumberDraft('1e3')).toEqual({ ok: false })
    expect(parseNumberDraft('abc')).toEqual({ ok: false })
  })
  it('is still exported from the inspector', () => {
    expect(fromPanel).toBe(parseNumberDraft)
  })
  it('says why a value cannot be saved', () => {
    expect(numberDraftError('laborCost', 'x')).toBe('Not a number of 0 or more.')
    expect(numberDraftError('laborCost', '')).toBeNull()
    expect(numberDraftError('laborCost', '0')).toBeNull()
    expect(numberDraftError('mass', '0')).toBe('Quantity must be above 0: it is how many units your data describe.')
    expect(numberDraftError('mass', '')).toMatch(/above 0/)
    expect(numberDraftError('mass', '2.')).toBeNull()
  })
})

describe('labor = hours × rate', () => {
  it('shows the calculator on operations and tasks (raw or normalized), or wherever labor exists (EDIT-4)', () => {
    expect(isLaborNode('Operation', {})).toBe(true)
    expect(isLaborNode('Task', {})).toBe(true)
    expect(isLaborNode('elemental_task', {})).toBe(true)
    expect(isLaborNode('Product', {})).toBe(false)
    expect(isLaborNode('Product', { laborCost: 0 })).toBe(true)
    expect(isLaborNode('Subprocess', { laborHours: 1 })).toBe(true)
  })
  it('works out cost to the cent and back-derives hours for old rows', () => {
    expect(laborCostFor(1.5, 23.456)).toBe(35.18)
    expect(laborHoursShown(2, 99, 20)).toBe(2)
    expect(laborHoursShown(undefined, 50, 30)).toBe(1.667)
    expect(laborHoursShown(undefined, undefined, 30)).toBeUndefined()
    expect(laborHoursShown(undefined, 50, 0)).toBeUndefined()
  })
  it('typing hours stores hours, the SOC code and the cost; clearing keeps the cost', () => {
    expect(laborHoursPatch('2', 25, '51-4121', 7)).toEqual({ laborHours: 2, laborOccupation: '51-4121', laborCost: 50 })
    expect(laborHoursPatch('', 25, '51-4121', 7)).toEqual({ laborHours: undefined, laborOccupation: '51-4121', laborCost: 7 })
  })
})

describe('machine energy = hours × kW × load', () => {
  it('needs all three above 0, then prices energy and machine time', () => {
    expect(machineEnergy({ hours: '2', kw: '15', loadPct: '', price: '0.1', machineRate: '' }).kwh).toBeNull()
    const r = machineEnergy({ hours: '2', kw: '15', loadPct: '60', price: '0.0912', machineRate: '40' })
    expect(r.kwh).toBe(18)
    expect(r.energyCost).toBe(1.64)
    expect(r.equipmentCost).toBe(80)
    expect(machineEnergy({ hours: '2', kw: '15', loadPct: '60', price: '0', machineRate: '' })).toMatchObject({ energyCost: null, equipmentCost: null })
    expect(machineEnergyDescription(2, 15, 60)).toBe('Machine energy: 2 h × 15 kW × 60% load')
  })
})

describe('allocation (ISO 14044 4.3.4)', () => {
  it('reads system expansion and missing methods as none, and shows the share as a percent', () => {
    expect(allocationView({})).toEqual({ method: 'none', share: undefined, pctValue: 100 })
    expect(allocationView({ allocationMethod: 'system_expansion', allocationFactor: 0.5 }).method).toBe('none')
    expect(allocationView({ allocationMethod: 'physical', allocationFactor: 0.8 })).toEqual({ method: 'physical', share: 0.8, pctValue: 80 })
    expect(allocationView({ allocationMethod: 'economic', allocationFactor: undefined }).pctValue).toBe('')
    expect(allocationView({ allocationMethod: 'economic', allocationFactor: 0.12345 }).pctValue).toBe(12.3)
  })
  it('switching method keeps a split share, and none counts in full', () => {
    expect(allocationMethodPatch('none', 0.4)).toEqual({ allocationMethod: 'none', allocationFactor: 1 })
    expect(allocationMethodPatch('physical', 0.4)).toEqual({ allocationMethod: 'physical', allocationFactor: 0.4 })
    expect(allocationMethodPatch('economic', 1)).toEqual({ allocationMethod: 'economic', allocationFactor: undefined })
  })
  it('the percent is clamped to 0.1–100 % and stored 0..1', () => {
    expect(allocationSharePatch('')).toEqual({ allocationFactor: undefined })
    expect(allocationSharePatch('80')).toEqual({ allocationFactor: 0.8 })
    expect(allocationSharePatch('250')).toEqual({ allocationFactor: 1 })
    expect(allocationSharePatch('0')).toEqual({ allocationFactor: 0.001 })
    expect(allocationSharePatch('abc')).toBeNull()
  })
})

describe('flows for the inspector', () => {
  it('maps API rows to IN/OUT with numeric amounts', () => {
    expect(
      toInspectorFlows([
        { flow_id: 1, substance_id: 3, substance_name: 'Steel', flow_type: 'input', quantity: '0.800000', unit: 'kg' },
        { flow_id: 2, substance_id: 4, flow_type: 'output', quantity: 'x', unit: 'kg' },
      ]),
    ).toEqual([
      { id: '1', substance: 'Steel', dir: 'IN', amount: 0.8, unit: 'kg' },
      { id: '2', substance: '', dir: 'OUT', amount: 0, unit: 'kg' },
    ])
  })
  it('suggests costs from the real flow quantities (EDIT-3)', () => {
    const s = suggestCosts([{ id: '1', substance: 'Electricity', dir: 'IN', amount: 10, unit: 'kWh' }], { nodeName: 'Paint', nodeType: 'Operation' })
    expect(s.lines.join('\n')).toMatch(/^Energy: 10 kWh/)
    expect(hasSuggestedCost(s.payload)).toBe(true)
    expect(hasSuggestedCost({})).toBe(false)
    expect(suggestCosts([], { nodeType: 'Operation', laborHours: 2 }).lines.join('\n')).toMatch(/Labor: 2 h/)
  })
})
