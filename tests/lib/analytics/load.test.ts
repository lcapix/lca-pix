import { describe, it, expect } from 'vitest'
import {
  classifyLoadError,
  filterCompletedRuns,
  noCompletedAssessmentsMessage,
  pickCasesToFetch,
} from '@/lib/analytics/load'

const steel = { id: '5', type: 'comparative', name: 'Steel' }
const alu = { id: '6', type: 'base', name: 'Alu' }
const wood = { id: '7', type: 'base', name: 'Wood' }

describe('pickCasesToFetch', () => {
  it('loads the base case when there is no filter', () => {
    expect(pickCasesToFetch([steel, alu, wood], null)).toEqual({ cases: [alu] })
  })

  it('falls back to the first case without a base case', () => {
    expect(pickCasesToFetch([steel], null)).toEqual({ cases: [steel] })
  })

  it('treats an empty filter as no filter', () => {
    expect(pickCasesToFetch([steel, alu], '')).toEqual({ cases: [alu] })
  })

  it('loads the filtered case, base or not', () => {
    expect(pickCasesToFetch([steel, alu], '5')).toEqual({ cases: [steel] })
  })

  it('compares ids strictly (string filter against string ids)', () => {
    const numeric = { id: 5 as unknown, type: 'base' }
    expect(pickCasesToFetch([numeric], '5')).toEqual({ error: 'Case not found (ID: 5)' })
  })

  it('reports a filtered case that does not exist', () => {
    expect(pickCasesToFetch([steel, alu], '99')).toEqual({ error: 'Case not found (ID: 99)' })
  })

  it('yields [undefined] for no cases without a filter (the caller checks for cases first)', () => {
    expect(pickCasesToFetch([], null)).toEqual({ cases: [undefined] })
  })
})

describe('filterCompletedRuns', () => {
  it('keeps completed runs and runs without a status, in order', () => {
    const runs = [
      { run_id: 1, status: 'running' },
      { run_id: 2, status: 'completed' },
      { run_id: 3 },
      { run_id: 4, status: null },
      { run_id: 5, status: 'failed' },
      { run_id: 6, status: 'Completed' },
      { run_id: 7, status: '' },
    ]
    expect(filterCompletedRuns(runs).map((r) => r.run_id)).toEqual([2, 3, 4])
  })

  it('is empty for no runs', () => {
    expect(filterCompletedRuns([])).toEqual([])
  })
})

describe('noCompletedAssessmentsMessage', () => {
  it('counts the project cases', () => {
    expect(noCompletedAssessmentsMessage(3)).toBe('Found 3 case(s), but no completed assessments.')
    expect(noCompletedAssessmentsMessage(0)).toBe('Found 0 case(s), but no completed assessments.')
  })
})

describe('classifyLoadError', () => {
  it('treats unauthorized / 401 errors as an expired session', () => {
    const expired = { authError: true, message: 'Your session has expired. Please log in again.' }
    expect(classifyLoadError(new Error('Unauthorized'))).toEqual(expired)
    expect(classifyLoadError(new Error('HTTP 401 from server'))).toEqual(expired)
    expect(classifyLoadError(new Error('UNAUTHORIZED access'))).toEqual(expired)
  })

  it('shows any other Error message', () => {
    expect(classifyLoadError(new Error('Network down'))).toEqual({
      authError: false,
      message: 'Error loading data: Network down',
    })
    expect(classifyLoadError(new TypeError('x is not a function'))).toEqual({
      authError: false,
      message: 'Error loading data: x is not a function',
    })
  })

  it('reports non-Error throws as unexpected, even when they mention 401', () => {
    const unexpected = { authError: false, message: 'An unexpected error occurred.' }
    expect(classifyLoadError('401 unauthorized')).toEqual(unexpected)
    expect(classifyLoadError(undefined)).toEqual(unexpected)
    expect(classifyLoadError({ message: 'Unauthorized' })).toEqual(unexpected)
  })
})
