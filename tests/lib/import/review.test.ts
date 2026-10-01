import { describe, it, expect } from 'vitest'

import type { IngestPlan, MappedFlow } from '@/lib/ingest/maplca'
import {
  COLUMN_ROLES,
  costKey,
  countUnplaced,
  flowKey,
  initialEdits,
  parseNote,
  parseNotes,
  remainingNoteCount,
  remainingReviewCount,
  rolesFor,
  type FlowEdit,
} from '@/lib/import/review'

const flow = (over: Partial<MappedFlow> = {}): MappedFlow => ({
  node: 'Cut',
  substance_text: 'Aluminum',
  substance_id: 1,
  substance_name: 'Aluminium',
  match_score: 0.95,
  candidates: [],
  direction: 'input',
  quantity: 1,
  unit: 'kg',
  conversion_note: '',
  provenance: 'bom.csv row 2',
  unit_compatible: true,
  ...over,
})

const plan = (over: Partial<IngestPlan> = {}): IngestPlan => ({
  case_name: 'Bike',
  nodes: [],
  flows: [],
  costs: [],
  review: [],
  notes: [],
  ...over,
})

describe('rolesFor', () => {
  it('offers every role for a BOM', () => {
    expect(rolesFor('bom')).toBe(COLUMN_ROLES)
    expect(rolesFor('bom').map(([v]) => v)).toEqual([
      'ignore', 'note', 'material', 'quantity', 'unit', 'cost', 'subassembly',
    ])
  })

  it('offers only ignore / keep as a note for any other connector', () => {
    expect(rolesFor('routing')).toEqual([
      ['ignore', 'Ignore'],
      ['note', 'Keep as a note'],
    ])
    expect(rolesFor('equipment')).toEqual(rolesFor('routing'))
  })
})

describe('parseNote / parseNotes', () => {
  it('reads an unmapped column with its example value', () => {
    expect(parseNote('Column "Tooling" was read but not mapped (e.g. "Jig A")', 3)).toEqual({
      kind: 'column',
      column: 'Tooling',
      sample: 'Jig A',
      noteIndex: 3,
    })
  })

  it('reads an unmapped column without an example (empty sample), and with an empty one', () => {
    expect(parseNote('Column "Vendor" was read but not mapped', 0)).toEqual({
      kind: 'column', column: 'Vendor', sample: '', noteIndex: 0,
    })
    expect(parseNote('Column "Vendor" was read but not mapped (e.g. "")', 1)).toMatchObject({ sample: '' })
  })

  it('keeps trailing text after the match and anything else as a plain note', () => {
    expect(parseNote('Column "A" was read but not mapped; 3 rows', 0)).toMatchObject({ kind: 'column', column: 'A' })
    expect(parseNote('Parsed 12 rows.', 5)).toEqual({ kind: 'plain', note: 'Parsed 12 rows.', noteIndex: 5 })
    // Must start the note, and the column name cannot be empty.
    expect(parseNote('Note: Column "A" was read but not mapped', 0).kind).toBe('plain')
    expect(parseNote('Column "" was read but not mapped', 0).kind).toBe('plain')
  })

  it('splits notes and keeps each one’s index in the original list', () => {
    const { unmappedColumns, plainNotes } = parseNotes([
      'Parsed 12 rows.',
      'Column "Tooling" was read but not mapped (e.g. "Jig")',
      'Second note',
      'Column "Vendor" was read but not mapped',
    ])
    expect(unmappedColumns.map((c) => [c.column, c.noteIndex])).toEqual([
      ['Tooling', 1],
      ['Vendor', 3],
    ])
    expect(plainNotes.map((n) => [n.note, n.noteIndex])).toEqual([
      ['Parsed 12 rows.', 0],
      ['Second note', 2],
    ])
  })

  it('is empty for no notes', () => {
    expect(parseNotes([])).toEqual({ unmappedColumns: [], plainNotes: [] })
  })
})

describe('flowKey / costKey', () => {
  it('keys a flow by provenance, else by index', () => {
    expect(flowKey(flow({ provenance: 'bom.csv row 4' }), 7)).toBe('bom.csv row 4')
    expect(flowKey(flow({ provenance: '' }), 7)).toBe('flow-7')
  })

  it('keys a cost by "doc · locator", else by index', () => {
    const c = { node: 'Cut', category: 'labor' as const, amount: 1 }
    expect(costKey({ ...c, provenance: { doc: 'bom.csv', locator: 'row 2' } }, 0)).toBe('bom.csv · row 2')
    expect(costKey(c, 4)).toBe('cost-4')
  })
})

describe('initialEdits', () => {
  it('ticks only a matched flow scoring at least 0.9', () => {
    const edits = initialEdits([
      flow({ match_score: 0.9 }),
      flow({ match_score: 0.89, substance_id: 2, substance_name: 'Steel' }),
      flow({ substance_id: null, substance_name: null, match_score: 0.99 }),
      flow({ match_score: undefined as unknown as number }),
    ])
    expect(edits).toEqual({
      0: { include: true, substance_id: 1, substance_name: 'Aluminium' },
      1: { include: false, substance_id: 2, substance_name: 'Steel' },
      2: { include: false, substance_id: null, substance_name: null },
      3: { include: false, substance_id: 1, substance_name: 'Aluminium' },
    })
  })

  it('is empty for no flows', () => {
    expect(initialEdits([])).toEqual({})
  })
})

describe('countUnplaced', () => {
  const p = plan({
    flows: [
      flow({ provenance: 'row 2' }),
      flow({ provenance: 'row 3' }),
      flow({ provenance: 'row 2' }), // shares row 2 with the first flow
      flow({ provenance: 'row 4' }),
    ],
    costs: [
      { node: 'Cut', category: 'material', amount: 85, provenance: { doc: 'bom.csv', locator: 'row 2' } },
      { node: 'Weld', category: 'labor', amount: 3 },
    ],
  })
  const edits: Record<number, FlowEdit> = {
    0: { include: true, substance_id: 1, substance_name: 'A' },
    1: { include: false, substance_id: 1, substance_name: 'A' }, // not applied
    2: { include: true, substance_id: 1, substance_name: 'A' },
    3: { include: true, substance_id: null, substance_name: null }, // no substance: not applied
  }

  it('is 0 without a plan or when creating a new case', () => {
    expect(countUnplaced({ plan: null, appending: true, edits, placement: {}, attachComponentId: null })).toBe(0)
    expect(countUnplaced({ plan: p, appending: false, edits, placement: {}, attachComponentId: null })).toBe(0)
  })

  it('counts applied flows and every cost with no step, a shared key once', () => {
    // row 2 (two flows), bom.csv · row 2, cost-1
    expect(countUnplaced({ plan: p, appending: true, edits, placement: {}, attachComponentId: null })).toBe(3)
  })

  it('treats a placed line, and any line once a default step is set, as placed', () => {
    expect(
      countUnplaced({ plan: p, appending: true, edits, placement: { 'row 2': 5, 'cost-1': 6 }, attachComponentId: null }),
    ).toBe(1)
    expect(countUnplaced({ plan: p, appending: true, edits, placement: {}, attachComponentId: 9 })).toBe(0)
  })

  it('falls back to the default step when a line was cleared to null', () => {
    const placement = { 'row 2': null, 'bom.csv · row 2': null, 'cost-1': null }
    expect(countUnplaced({ plan: p, appending: true, edits, placement, attachComponentId: null })).toBe(3)
    expect(countUnplaced({ plan: p, appending: true, edits, placement, attachComponentId: 9 })).toBe(0)
  })

  it('ignores flows that have no edit yet', () => {
    expect(countUnplaced({ plan: p, appending: true, edits: {}, placement: {}, attachComponentId: null })).toBe(2)
  })
})

describe('remainingReviewCount / remainingNoteCount', () => {
  it('counts what is not dismissed', () => {
    expect(remainingReviewCount(['a', 'b', 'c'], new Set([1]))).toBe(2)
    expect(remainingReviewCount(['a'], new Set([0]))).toBe(0)
    expect(remainingReviewCount([], new Set())).toBe(0)
    expect(remainingNoteCount([{ noteIndex: 2 }, { noteIndex: 5 }], new Set([5]))).toBe(1)
    expect(remainingNoteCount([{ noteIndex: 2 }], new Set([0, 1]))).toBe(1)
  })
})
