import { describe, it, expect } from 'vitest'
import {
  isOlderRun,
  runToShow,
  deltaVsPreviousRun,
  initialRunScope,
  latestCompletedRun,
  rankContributors,
  type RunLike,
} from '@/lib/results/run-math'

const run = (id: number, method: string, region: string, gw: number | null, status = 'completed'): RunLike => ({
  run_id: id,
  status,
  calculation_method: method,
  regionCode: region,
  impacts: gw === null ? {} : { 'Global Warming': { value: gw, unit: 'kg CO2 eq' } },
})

describe('latestCompletedRun', () => {
  it('skips a newer failed run', () => {
    const runs = [run(9, 'TRACI 2.1', 'US', null, 'failed'), run(8, 'TRACI 2.1', 'US', 90)]
    expect(latestCompletedRun(runs)?.run_id).toBe(8)
  })
  it('is null with no completed run', () => {
    expect(latestCompletedRun([run(9, 'TRACI 2.1', 'US', null, 'failed')])).toBeNull()
  })
})

// RES-2: the delta read fields that do not exist, so it never rendered; and a
// delta across methods or regions compares numbers that are not comparable.
describe('deltaVsPreviousRun', () => {
  it('compares the latest run with the previous run of the same method and region', () => {
    const runs = [
      run(9, 'TRACI 2.1', 'US', null, 'failed'),
      run(8, 'TRACI 2.1', 'US', 90),
      run(7, 'CML 2001', 'Global', 50),
      run(6, 'TRACI 2.1', 'EU', 10),
      run(5, 'TRACI 2.1', 'US', 100),
    ]
    expect(deltaVsPreviousRun(runs, 'Global Warming')).toBeCloseTo(-10, 10)
  })
  it('is null when no earlier run shares the scope', () => {
    expect(deltaVsPreviousRun([run(8, 'TRACI 2.1', 'US', 90), run(7, 'CML 2001', 'US', 50)], 'Global Warming')).toBeNull()
  })
  it('is null when the previous value is zero', () => {
    expect(deltaVsPreviousRun([run(8, 'TRACI 2.1', 'US', 90), run(7, 'TRACI 2.1', 'US', 0)], 'Global Warming')).toBeNull()
  })
  it('measures a change against the size of a negative (credit) base', () => {
    expect(deltaVsPreviousRun([run(8, 'CML 2001', 'US', -5), run(7, 'CML 2001', 'US', -10)], 'Global Warming')).toBeCloseTo(50, 10)
  })
})

// RES-4: credits were filtered out and shares used a positive-only sum.
describe('rankContributors', () => {
  const breakdown = [
    { component_id: 1, component_name: 'Frame', impacts: [{ category_name: 'Global Warming', impact_value: 60 }] },
    { component_id: 2, component_name: 'Recycling credit', impacts: [{ category_name: 'Global Warming', impact_value: -30 }] },
    { component_id: 3, component_name: 'Paint', impacts: [{ category_name: 'Global Warming', impact_value: 10 }] },
    { component_id: 4, component_name: 'Idle', impacts: [{ category_name: 'Global Warming', impact_value: 0 }] },
    { component_id: 5, component_name: 'Other category', impacts: [{ category_name: 'Smog', impact_value: 999 }] },
  ]
  it('keeps credits, ranks by size, shares of the absolute sum', () => {
    const top = rankContributors(breakdown, 'Global Warming')
    expect(top.map((c) => [c.name, c.value, Math.round(c.pct * 10) / 10])).toEqual([
      ['Frame', 60, 60],
      ['Recycling credit', -30, 30],
      ['Paint', 10, 10],
    ])
  })
  it('is empty when every step is zero in the category', () => {
    expect(rankContributors(breakdown, 'Acidification')).toEqual([])
  })
})

// RUN-5: the page always passed 'US Grid', so the modal never looked up the
// case's own region.
describe('initialRunScope', () => {
  it('repeats the displayed run', () => {
    expect(
      initialRunScope({ latestRun: { calculation_method: 'TRACI 2.1', regionCode: 'US' }, caseRegion: 'EU', studyMethod: 'CML 2001' }),
    ).toEqual({ method: 'TRACI 2.1', region: 'US Grid' })
  })
  it('uses the case region before the project region when never run', () => {
    expect(initialRunScope({ caseRegion: 'EU', projectRegion: 'US', studyMethod: 'TRACI 2.1' })).toEqual({
      method: 'TRACI 2.1',
      region: 'EU Average',
    })
    expect(initialRunScope({ projectRegion: 'US' })).toEqual({ method: undefined, region: 'US Grid' })
  })
  it('leaves both unset when nothing is known, so the modal decides', () => {
    expect(initialRunScope({})).toEqual({ method: undefined, region: undefined })
  })
})


describe('which run the Results page shows', () => {
  // Newest first, as GET /api/cases/:id/assessments returns them.
  const runs = [
    { run_id: 31, status: 'failed' },
    { run_id: 30, status: 'completed' },
    { run_id: 22, status: 'completed' },
    { run_id: 9 }, // an older row with no status counts as completed
  ]

  it('shows the newest completed run by default', () => {
    expect(runToShow(runs)?.run_id).toBe(30)
    expect(runToShow(runs, null)?.run_id).toBe(30)
  })

  it('shows an older completed run when asked, and says it is older', () => {
    const shown = runToShow(runs, '22')
    expect(shown?.run_id).toBe(22)
    expect(isOlderRun(shown, runs)).toBe(true)
    expect(isOlderRun(runToShow(runs, 9), runs)).toBe(true)
    expect(isOlderRun(runToShow(runs), runs)).toBe(false)
  })

  it('falls back to the newest for a failed, missing or malformed run id', () => {
    for (const asked of [31, 999, 'abc', '2.5', -4, 0, '']) {
      expect(runToShow(runs, asked as never)?.run_id).toBe(30)
    }
  })

  it('shows nothing when no run completed', () => {
    expect(runToShow([{ run_id: 5, status: 'failed' }], 5)).toBeNull()
    expect(isOlderRun(null, [])).toBe(false)
  })
})
