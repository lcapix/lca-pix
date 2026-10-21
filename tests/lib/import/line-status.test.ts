import { describe, expect, it } from 'vitest'
import { LINE_STATUS_WORD, lineShows, lineStatus } from '@/lib/import/line-status'

const cands = [
  { substance_id: 1, substance_name: 'Aluminium, primary, sheet', score: 0.97, factor_count: 3 },
  { substance_id: 2, substance_name: 'Corrugated board', score: 0.93, factor_count: 0 },
]
const e = (o: any) => ({ include: true, substance_id: 1, substance_name: 'x', ...o })

describe('line status (F2.6)', () => {
  it('in the design words', () => {
    expect(LINE_STATUS_WORD[lineStatus({ candidates: cands } as any, e({}))]).toBe('Counted')
    expect(LINE_STATUS_WORD[lineStatus({ candidates: cands } as any, e({ substance_id: 2 }))]).toBe('Counted, no climate factor')
    expect(LINE_STATUS_WORD[lineStatus({ candidates: cands } as any, e({ include: false }))]).toBe('Check the match')
    expect(LINE_STATUS_WORD[lineStatus({ candidates: [] } as any, e({ include: false, substance_id: null }))]).toBe('Pick a match')
  })
  it('filters: need a step, need a match', () => {
    expect(lineShows('need_step', 'counted', false)).toBe(true)
    expect(lineShows('need_step', 'counted', true)).toBe(false)
    expect(lineShows('need_match', 'check_match', true)).toBe(true)
    expect(lineShows('need_match', 'counted', false)).toBe(false)
    expect(lineShows('all', 'pick_match', false)).toBe(true)
  })
})
