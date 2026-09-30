// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ projectId: '7' }),
}))
vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }))

import ComparisonPage from '@/app/project/[projectId]/comparison/page'
import { apiRequest } from '@/lib/api-client'

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) }) as any

const run = (id: number, over: Record<string, unknown> = {}) => ({
  runId: id,
  method: 'TRACI 2.1',
  region: 'US',
  runDate: '2026-09-29T10:00:00Z',
  reason: 'latest',
  stale: false,
  perFuScale: 1,
  functionalUnit: '1 bike',
  hasSnapshot: true,
  resultsSource: 'snapshot',
  costsSource: 'run',
  ...over,
})

const gw = (value: number, flowCount = 3) => [{ category: 'Global Warming', unit: 'kg CO2 eq', value, flowCount }]

const kase = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  caseId: id,
  name,
  type: id === '1' ? 'base' : 'comparative',
  isBase: id === '1',
  run: run(Number(id) * 100),
  runs: [{ runId: Number(id) * 100, method: 'TRACI 2.1', region: 'US', runDate: '2026-09-29T10:00:00Z' }],
  status: 'ok',
  statusReason: null,
  totals: gw(100),
  byStep: [],
  flows: [],
  dataQuality: null,
  warnings: [],
  costs: [],
  inventory: { steps: 3, flows: 3 },
  ...over,
})

const emptyInventory = { steps: [], flows: [], costs: [], hours: [], costUnchanged: [], identical: true }

function routeApi(compareCases: any[], saved: any[] = []) {
  const caseRows = compareCases.map((c) => ({
    case_id: Number(c.caseId),
    project_id: 7,
    case_name: c.name,
    case_type: c.type,
  }))
  vi.mocked(apiRequest).mockImplementation(async (url: string) => {
    if (url === '/api/projects/7') return json({ success: true, project: { project_name: 'Bike study' } })
    if (url === '/api/projects/7/cases') return json({ success: true, cases: caseRows })
    if (url.startsWith('/api/projects/7/compare')) {
      return json({
        success: true,
        project: { name: 'Bike study', goal: null, functionalUnit: '1 bike', boundary: null, method: 'TRACI 2.1', region: 'US' },
        baseCaseId: '1',
        cases: compareCases,
        diffs: compareCases.filter((c) => c.caseId !== '1').map((c) => ({ caseId: c.caseId, scope: [], inventory: emptyInventory })),
      })
    }
    if (url.startsWith('/api/comparisons')) return json({ success: true, comparisons: saved })
    return json({})
  })
}

const card = async (name: string) => {
  const title = await screen.findByTitle(name)
  return title.closest('.card') as HTMLElement
}

// recharts' ResponsiveContainer needs it; jsdom has none.
;(globalThis as any).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState(null, '', '/project/7/comparison')
})

describe('Compare page: a case that cannot be ranked is never called a winner', () => {
  it('marks a 0-flow copy "Incomplete — not ranked" and names the real lowest copy', async () => {
    routeApi([
      kase('1', 'Base'),
      kase('2', 'Empty copy', { status: 'incomplete', statusReason: 'No flows yet', totals: gw(0, 0), inventory: { steps: 3, flows: 0 } }),
      kase('3', 'Steel frame', { totals: gw(90) }),
    ])
    render(<ComparisonPage />)

    const empty = await card('Empty copy')
    expect(within(empty).getByText(/Incomplete — not ranked/)).toBeInTheDocument()
    expect(within(empty).getByText(/No flows yet/)).toBeInTheDocument()
    // No value or change pill on the empty card.
    expect(within(empty).queryByText(/%/)).toBeNull()

    const verdict = await screen.findByTestId('compare-verdict')
    expect(verdict.textContent).toMatch(/Lowest Global Warming: Steel frame/)
    expect(verdict.textContent).not.toMatch(/Lowest Global Warming: Empty copy/)
    expect(verdict.textContent).toMatch(/Not ranked: Empty copy/)
  })

  it('names no winner when the only copy is incomplete', async () => {
    routeApi([
      kase('1', 'Base'),
      kase('2', 'Empty copy', { status: 'incomplete', statusReason: 'No flows yet', totals: gw(0, 0) }),
    ])
    render(<ComparisonPage />)
    const verdict = await screen.findByTestId('compare-verdict')
    expect(verdict.textContent).not.toMatch(/Lowest/)
    expect(verdict.textContent).toMatch(/Not ranked: Empty copy/)
  })

  it('says "Incomplete — not ranked" for a copy that has never been run', async () => {
    routeApi([
      kase('1', 'Base'),
      kase('2', 'New copy', { run: null, runs: [], status: 'incomplete', statusReason: 'Not run yet', totals: [] }),
    ])
    render(<ComparisonPage />)
    const c = await card('New copy')
    expect(within(c).getByText(/Incomplete — not ranked/)).toBeInTheDocument()
    expect(within(c).getByText(/Not run yet/)).toBeInTheDocument()
  })

  it('flags a copy edited after its run "Re-run to compare" and leaves it out of the ranking', async () => {
    routeApi([
      kase('1', 'Base'),
      kase('2', 'Edited copy', { status: 'stale', statusReason: 'Edited after this run', run: run(200, { stale: true }), totals: gw(10) }),
    ])
    render(<ComparisonPage />)
    const c = await card('Edited copy')
    expect(within(c).getByText('Re-run to compare')).toBeInTheDocument()
    const verdict = await screen.findByTestId('compare-verdict')
    expect(verdict.textContent).not.toMatch(/Lowest/)
    expect(verdict.textContent).toMatch(/Edited copy \(re-run to compare\)/)
  })

  it('keeps the sign right against a negative base', async () => {
    routeApi([kase('1', 'Base', { totals: gw(-10) }), kase('2', 'More timber', { totals: gw(-20) })])
    render(<ComparisonPage />)
    const c = await card('More timber')
    expect(within(c).getByText('−100.00%')).toBeInTheDocument()
    const verdict = await screen.findByTestId('compare-verdict')
    expect(verdict.textContent).toMatch(/Lowest Global Warming: More timber/)
    expect(verdict.textContent).toMatch(/−100\.0%/)
  })

  it('labels a legacy run whose results were not frozen', async () => {
    routeApi([
      kase('1', 'Base', { run: run(100, { resultsSource: 'recomputed from current data', costsSource: 'current', hasSnapshot: false }) }),
      kase('2', 'Copy', { totals: gw(95) }),
    ])
    render(<ComparisonPage />)
    const c = await card('Base')
    expect(within(c).getByText(/Older run/)).toBeInTheDocument()
  })
})

describe('Compare page: the analysis views never read an incomplete case as an improvement', () => {
  const cases = () => [
    kase('1', 'Base', {
      costs: [{ step: 'Weld', material: 0, labor: 20, energy: 0, transportation: 0, equipment: 0, overhead: 0, opex: 0, capex: 0 }],
      byStep: [{ step: 'Weld', category: 'Global Warming', value: 100 }],
    }),
    kase('2', 'Empty copy', {
      status: 'incomplete',
      statusReason: 'No flows yet',
      totals: gw(0, 0),
      costs: [{ step: 'Weld', material: 0, labor: 5, energy: 0, transportation: 0, equipment: 0, overhead: 0, opex: 0, capex: 0 }],
    }),
  ]

  it('What differs: says the copy is incomplete instead of showing a -100% change', async () => {
    routeApi(cases())
    render(<ComparisonPage />)
    await screen.findByTestId('compare-verdict')
    expect(await screen.findByText(/Empty copy is incomplete/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/−100/)
  })

  it('Where the change comes from: no breakdown for an incomplete copy', async () => {
    routeApi(cases())
    render(<ComparisonPage />)
    await screen.findByTestId('compare-verdict')
    fireEvent.click(screen.getByRole('tab', { name: 'Where the change comes from' }))
    expect(await screen.findByText(/Empty copy is incomplete/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/−100/)
  })

  it('Cost: no impact change or cost per unit avoided for an incomplete copy', async () => {
    routeApi(cases())
    render(<ComparisonPage />)
    await screen.findByTestId('compare-verdict')
    fireEvent.click(screen.getByRole('tab', { name: 'Cost' }))
    // The copy's row in the cost-against-impact table (not a column header).
    const row = (await screen.findAllByText('Empty copy'))
      .map((el) => el.closest('tr'))
      .find((tr) => tr?.parentElement?.tagName === 'TBODY') as HTMLElement
    expect(within(row).getByText('incomplete')).toBeInTheDocument()
    expect(row.textContent).not.toMatch(/−100/)
  })

  it('Results: the incomplete column shows no values', async () => {
    routeApi(cases())
    render(<ComparisonPage />)
    await screen.findByTestId('compare-verdict')
    fireEvent.click(screen.getByRole('tab', { name: 'Results' }))
    const header = await screen.findByRole('columnheader', { name: /Empty copy/ })
    expect(header.textContent).toMatch(/not ranked/)
    expect(document.body.textContent).not.toMatch(/−100/)
  })
})
