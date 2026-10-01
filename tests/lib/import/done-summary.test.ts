import { describe, it, expect } from 'vitest'

import { LIVE_DOC_TYPES, getDocType } from '@/lib/ingest/doc-types'
import { appliedMessage, doneSummary, doneTitle, missingLayerHint, nextConnector } from '@/lib/import/done-summary'

const label = (id: string) => getDocType(id)!.label

describe('appliedMessage / doneTitle', () => {
  it('reads by append vs create', () => {
    expect(appliedMessage(true, 'X')).toBe('Document added to the case')
    expect(appliedMessage(false, 'My plant')).toBe('Case created: My plant')
    expect(appliedMessage(false, undefined)).toBe('Case created: undefined')
    expect(doneTitle({ appended: true })).toBe('Document added to the case')
    expect(doneTitle({})).toBe('Case created from document')
  })
})

describe('doneSummary', () => {
  it('summarises an append with the steps used and the left-out count', () => {
    expect(
      doneSummary({
        appended: true,
        flows_applied: 3,
        steps_used: ['10 Cut', '70 Final assembly'],
        flows_held_for_review: 1,
        left_out: 2,
        cost_columns_updated: 4,
      }),
    ).toBe('3 flows added across 2 step(s) (10 Cut, 70 Final assembly) · 1 held for review · 2 left out at review · 4 cost entries updated')
  })

  it('drops the step list and the left-out part when there are none', () => {
    expect(
      doneSummary({ appended: true, flows_applied: 0, steps_used: [], flows_held_for_review: 0, left_out: 0, cost_columns_updated: 0 }),
    ).toBe('0 flows added across 0 step(s) · 0 held for review · 0 cost entries updated')
    expect(doneSummary({ appended: true, flows_applied: 1, steps_used: null, flows_held_for_review: 0, cost_columns_updated: 1 })).toBe(
      '1 flows added across 0 step(s) · 0 held for review · 1 cost entries updated',
    )
  })

  it('summarises a new case', () => {
    expect(
      doneSummary({ components_created: 8, flows_applied: 5, flows_held_for_review: 1, left_out: 1, cost_nodes: 6 }),
    ).toBe('8 steps created · 5 inputs and outputs added · 1 held for review · 1 left out at review · costs on 6 steps')
    expect(doneSummary({ components_created: 8, flows_applied: 5, flows_held_for_review: 0, cost_nodes: 0 })).toBe(
      '8 steps created · 5 inputs and outputs added · 0 held for review · costs on 0 steps',
    )
  })

  it('prints missing counts as undefined (the server always sends them)', () => {
    expect(doneSummary({})).toBe('undefined steps created · undefined inputs and outputs added · undefined held for review · costs on undefined steps')
  })
})

describe('missingLayerHint', () => {
  it('names up to two suggested documents, else the by-hand fallback', () => {
    expect(missingLayerHint({ layer: 'energy', label: 'E', suggestedDocs: ['A', 'B', 'C'] })).toBe(' — from a A or B')
    expect(missingLayerHint({ layer: 'energy', label: 'E', suggestedDocs: ['A'] })).toBe(' — from a A')
    const byHand = ' — no document type for this yet; enter it by hand on the step that uses it'
    expect(missingLayerHint({ layer: 'transport', label: 'T', suggestedDocs: [] })).toBe(byHand)
    expect(missingLayerHint({ layer: 'transport', label: 'T' })).toBe(byHand)
  })
})

describe('nextConnector', () => {
  it('prefers BOM, then equipment, then ITAC among the live documents suggested', () => {
    expect(
      nextConnector([
        { layer: 'energy', label: 'E', suggestedDocs: [label('itac'), label('equipment')] },
        { layer: 'materials', label: 'M', suggestedDocs: [label('bom')] },
      ]),
    ).toBe('bom')
    expect(nextConnector([{ layer: 'energy', label: 'E', suggestedDocs: [label('itac'), label('equipment')] }])).toBe(
      'equipment',
    )
    expect(nextConnector([{ layer: 'energy', label: 'E', suggestedDocs: [label('itac')] }])).toBe('itac')
  })

  it('is undefined when nothing suggested maps to one of those three', () => {
    expect(nextConnector([])).toBeUndefined()
    expect(nextConnector([{ layer: 'transport', label: 'T' }])).toBeUndefined()
    expect(nextConnector([{ layer: 'skeleton', label: 'S', suggestedDocs: [label('routing'), 'Not a document'] }])).toBeUndefined()
  })

  it('matches labels against the doc types given (live ones by default)', () => {
    expect(LIVE_DOC_TYPES.some((d) => d.id === 'bom')).toBe(true)
    const custom = [{ ...getDocType('bom')!, label: 'Parts list' }]
    expect(nextConnector([{ layer: 'materials', label: 'M', suggestedDocs: ['Parts list'] }], custom)).toBe('bom')
    expect(nextConnector([{ layer: 'materials', label: 'M', suggestedDocs: [label('bom')] }], custom)).toBeUndefined()
  })
})
