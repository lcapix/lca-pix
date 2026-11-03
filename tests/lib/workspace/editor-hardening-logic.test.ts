/**
 * Pure rules behind the editor hardening (lane 1, 2026-11-01):
 *   E7  the add-flow list ranks by relevance, and shows common materials, not
 *       ".alpha.-Cypermethrin", before anything is typed;
 *   A2  a hand-entered factor reads "Hand-entered: <source>" in the results
 *       rows, never "source not on record";
 *   E4  a flow's Inventory cost cell: the counted line, the step's own cost,
 *       or the price on file that is not in the cost yet;
 *   B3  unsaved edits hold a move until Save or Discard.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { commonMaterials, searchSubstances } from '@/lib/case-editor/substance-search'
import { factorSourceNote, isWeakFactorSource } from '@/lib/results/results-view'
import { flowCostCell } from '@/lib/workspace/flow-cost-text'
import { clearUnsaved, discardAndGo, guard, hasUnsaved, keepEditing, pendingLeave, registerUnsaved, resetUnsaved, saveAndGo } from '@/lib/workspace/unsaved'

const sub = (substance_id: number, substance_name: string, extra: Record<string, unknown> = {}) => ({ substance_id, substance_name, factor_count: 1, ...extra })
const LIBRARY = [
  sub(1, '.alpha.-Cypermethrin'),
  sub(2, '1,2-Dichloroethane'),
  sub(3, 'Aluminum'),
  sub(4, 'Aluminum, recycled', { variant_of: 3 }),
  sub(5, 'Steel'),
  sub(6, 'Stainless steel'),
  sub(7, 'Electricity'),
  sub(8, 'Natural Gas'),
  sub(9, 'Steel wool', { factor_count: 0 }),
  sub(10, 'Cardboard'),
] as any[]

describe('E7 the add-flow list', () => {
  it('shows the common materials when nothing is typed, never the chemical names first', () => {
    const names = searchSubstances('', LIBRARY).map((s) => s.substance_name)
    expect(names).toEqual(['Steel', 'Aluminum', 'Electricity', 'Natural Gas', 'Cardboard'])
    expect(names).not.toContain('.alpha.-Cypermethrin')
    expect(commonMaterials([])).toEqual([])
  })

  it('ranks the name itself, then names that start with it, then a word that does', () => {
    expect(searchSubstances('steel', LIBRARY).map((s) => s.substance_name)).toEqual(['Steel', 'Steel wool', 'Stainless steel'])
    // British spelling finds the library's American one.
    expect(searchSubstances('aluminium', LIBRARY).map((s) => s.substance_id)).toEqual([3, 4])
    expect(searchSubstances('zzz', LIBRARY)).toEqual([])
  })
})

describe('A2 a hand-entered factor in the results rows', () => {
  it('reads "Hand-entered: <source>", not "source not on record"', () => {
    const src = "Entered by hand: the supplier's EPD, 2024"
    expect(isWeakFactorSource('unverified', src)).toBe(false)
    expect(factorSourceNote('unverified', src)).toBe(" · Hand-entered: the supplier's EPD, 2024")
  })

  it('a library factor with no source still says so; a sourced one says nothing extra', () => {
    expect(factorSourceNote('unknown', null)).toBe(' (source not on record)')
    expect(isWeakFactorSource('unverified')).toBe(true)
    expect(factorSourceNote('authoritative', 'US EPA')).toBe('')
  })
})

describe('E4 a flow cost on its Inventory row', () => {
  const line = { label: 'Cardboard', quantity: 0.2, unit: 'kg', rate: 0.6, rate_unit: '$/kg', source_kind: 'reference', source_name: 'Cardboard', vintage: '2026-06' } as any
  const fromFlows = { material: { kind: 'material', amount: 0.12, lines: [line], noPrice: [] }, energy: { kind: 'energy', amount: null, lines: [], noPrice: [] } } as any
  const flow = { substance: 'Cardboard', direction: 'input' as const }

  it('the counted line when the step cost was built from its flows: amount × price = cost', () => {
    const costs = [{ kind: 'material', amount: 0.12, basis: { rate_code: 'flows', source_kind: 'reference', lines: [line] } }] as any
    expect(flowCostCell(flow, costs, fromFlows)).toEqual({ text: '0.2 kg × $0.60/kg = $0.12', counted: true, kind: 'material' })
  })

  it("the step's own cost when one is entered; the price on file when nothing is stored", () => {
    const entered = [{ kind: 'material', amount: 85, basis: { rate_code: null, source_kind: 'entered' } }] as any
    expect(flowCostCell(flow, entered, fromFlows).text).toBe("In the step's material cost")
    expect(flowCostCell(flow, [], fromFlows)).toEqual({ text: '0.2 kg × $0.60/kg = $0.12 · not in the cost yet', counted: false, kind: 'material' })
    expect(flowCostCell({ substance: 'Argon', direction: 'input' }, [], fromFlows).text).toBe('No price on file')
    expect(flowCostCell({ substance: 'CO2', direction: 'output' }, [], fromFlows).text).toBe('An output: no cost')
  })
})

describe('B3 unsaved edits hold a move', () => {
  beforeEach(() => resetUnsaved())

  it('nothing unsaved: the move happens at once', () => {
    const go = vi.fn()
    expect(guard(go)).toBe(true)
    expect(go).toHaveBeenCalledOnce()
  })

  it('an unsaved edit holds the move; Discard throws the edit away and then moves', async () => {
    const discard = vi.fn()
    registerUnsaved('flow-1', { label: 'Steel on 10. Cut blank', save: async () => true, discard })
    const go = vi.fn()
    expect(guard(go)).toBe(false)
    expect(go).not.toHaveBeenCalled()
    expect(pendingLeave()).toBe(true)
    discardAndGo()
    expect(discard).toHaveBeenCalledOnce()
    expect(hasUnsaved()).toBe(false)
    expect(go).toHaveBeenCalledOnce()
  })

  it('Save saves every edit, then moves; a save that fails keeps you where you are', async () => {
    let ok = false
    registerUnsaved('flow-1', { label: 'Steel', save: async () => ok, discard: () => {} })
    const go = vi.fn()
    guard(go)
    expect(await saveAndGo()).toBe(false)
    expect(go).not.toHaveBeenCalled()
    expect(hasUnsaved()).toBe(true)
    ok = true
    guard(go)
    expect(await saveAndGo()).toBe(true)
    expect(go).toHaveBeenCalledOnce()
    expect(hasUnsaved()).toBe(false)
  })

  it('Keep editing drops the move and keeps the edit', () => {
    registerUnsaved('desc', { label: 'the description', save: async () => true, discard: () => {} })
    const go = vi.fn()
    guard(go)
    keepEditing()
    expect(pendingLeave()).toBe(false)
    expect(go).not.toHaveBeenCalled()
    expect(hasUnsaved()).toBe(true)
    clearUnsaved('desc')
    expect(hasUnsaved()).toBe(false)
  })
})
