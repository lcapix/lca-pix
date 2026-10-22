/**
 * The status of a line on Check what we read (F2.6), in the design's words:
 * Counted, Counted no climate factor, Check the match (a match below 90% that
 * is not ticked), Pick a match (nothing matched). And the filter counts: All
 * lines, Need a step, Need a match. Pure.
 */

import type { MappedFlow } from '@/lib/ingest/maplca'
import type { FlowEdit } from '@/lib/import/review'

export type LineStatus = 'counted' | 'no_factor' | 'check_match' | 'pick_match'

export const LINE_STATUS_WORD: Record<LineStatus, string> = {
  counted: 'Counted',
  no_factor: 'Counted, no climate factor',
  check_match: 'Check the match',
  pick_match: 'Pick a match',
}

export function lineStatus(f: Pick<MappedFlow, 'candidates'>, e: FlowEdit): LineStatus {
  if (e.substance_id === null) return 'pick_match'
  if (!e.include) return 'check_match'
  const chosen = f.candidates.find((c) => c.substance_id === e.substance_id)
  return chosen && chosen.factor_count === 0 ? 'no_factor' : 'counted'
}

export type LineFilter = 'all' | 'need_step' | 'need_match'

/** Whether a line shows under a filter; `placed` says whether it has a step (appending). */
export function lineShows(filter: LineFilter, status: LineStatus, placed: boolean): boolean {
  if (filter === 'need_step') return !placed
  if (filter === 'need_match') return status === 'check_match' || status === 'pick_match'
  return true
}
