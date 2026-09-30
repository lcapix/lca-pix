// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as api from '@/lib/api-client'

vi.mock('@/lib/api-client')
vi.mock('next/navigation', () => ({
  useParams: () => ({ projectId: '1', caseId: '3' }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}))
vi.mock('@/components/lcapix/magic-insights-modal', () => ({ MagicInsightsModal: () => null }))
vi.mock('@/components/lcapix/case/write-up-card', () => ({ WriteUpCard: () => null }))
vi.mock('@/components/assessments/run-assessment-modal', () => ({
  RunAssessmentModal: (p: any) => (
    <div
      data-testid="run-modal"
      data-method={p.initialMethod === undefined ? '(unset)' : p.initialMethod}
      data-region={p.initialRegion === undefined ? '(unset)' : p.initialRegion}
    />
  ),
}))

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any

import ResultsPage from '@/app/project/[projectId]/case/[caseId]/results/page'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Routes = Record<string, () => Response>
function serve(routes: Routes) {
  vi.mocked(api.apiRequest).mockImplementation(async (url: string) => {
    const path = url.split('?')[0]
    const hit = routes[path]
    if (!hit) throw new Error(`unexpected fetch ${path}`)
    return hit()
  })
}

const caseOk = (over: Record<string, unknown> = {}) => () =>
  json(200, {
    success: true,
    case: { case_id: 3, project_id: 1, case_type: 'base', case_name: 'Touring bike', region_code: null, project_region_code: null, ...over },
  })
const componentsOk = () => json(200, { success: true, components: [] })
const projectOk = (over: Record<string, unknown> = {}) => () =>
  json(200, { success: true, project: { project_name: 'Bikes', lcia_method: null, region_code: null, ...over } })

const gw = (value: number) => ({ 'Global Warming': { value, unit: 'kg CO2 eq' } })
const run = (id: number, method: string, region: string, impacts: Record<string, any>, extra: Record<string, unknown> = {}) => ({
  run_id: id,
  run_name: `Run ${id}`,
  calculation_method: method,
  region_code: region,
  status: 'completed',
  run_date: `2026-09-${10 + id}T10:00:00Z`,
  executed_by_username: 'u',
  impacts,
  componentBreakdown: [],
  flowDetail: [],
  warnings: [],
  ...extra,
})

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
})

describe('results page: errors are not empty states (RES-5)', () => {
  it('says the assessments could not be loaded instead of "No assessments yet"', async () => {
    serve({
      '/api/cases/3': caseOk(),
      '/api/cases/3/components': componentsOk,
      '/api/projects/1': projectOk(),
      '/api/cases/3/assessments': () => json(500, { error: 'Failed to fetch assessments' }),
    })
    render(<ResultsPage />)
    expect(await screen.findByText(/Could not load this case's assessments/)).toBeInTheDocument()
    expect(screen.queryByText(/No assessments yet/)).not.toBeInTheDocument()
  })

  it('says the case could not be loaded instead of "Case not found" on a server error', async () => {
    serve({
      '/api/cases/3': () => json(500, { error: 'boom' }),
      '/api/cases/3/components': componentsOk,
      '/api/projects/1': projectOk(),
      '/api/cases/3/assessments': () => json(200, { success: true, assessments: [] }),
    })
    render(<ResultsPage />)
    expect(await screen.findByText(/Could not load this case/)).toBeInTheDocument()
    expect(screen.queryByText('Case not found')).not.toBeInTheDocument()
  })

  it('still says "Case not found" for a 404', async () => {
    serve({
      '/api/cases/3': () => json(404, { error: 'Case not found' }),
      '/api/cases/3/components': componentsOk,
      '/api/projects/1': projectOk(),
      '/api/cases/3/assessments': () => json(200, { success: true, assessments: [] }),
    })
    render(<ResultsPage />)
    expect(await screen.findByText('Case not found')).toBeInTheDocument()
  })
})

describe('results page with runs', () => {
  const breakdown = [
    { component_id: 11, component_name: 'Frame', life_cycle_stage: 'materials', flows_processed: 1, impacts: [{ category_id: 1, category_name: 'Global Warming', impact_value: 1000, unit: 'kg CO2 eq' }] },
    { component_id: 12, component_name: 'Recycling credit', life_cycle_stage: 'end_of_life', flows_processed: 1, impacts: [{ category_id: 1, category_name: 'Global Warming', impact_value: -10, unit: 'kg CO2 eq' }] },
    { component_id: 13, component_name: 'Glue', life_cycle_stage: 'production', flows_processed: 1, impacts: [{ category_id: 1, category_name: 'Global Warming', impact_value: 0.004, unit: 'kg CO2 eq' }] },
  ]
  const flowDetail = [
    { flow_id: 1, component: 'Frame', substance: 'Aluminum', category_name: 'Global Warming', dir: 'IN', amount: 1000, unit: 'kg', factor: 0.0001234, impact: 1000, scope: 'US' },
  ]
  const runs = [
    run(9, 'TRACI 2.1', 'US', {}, { status: 'failed' }),
    run(8, 'TRACI 2.1', 'US', { ...gw(990.004), 'Ozone Depletion': { value: 4.2e-7, unit: 'kg CFC-11 eq' } }, { componentBreakdown: breakdown, flowDetail }),
    run(7, 'CML 2001', 'Global', gw(50)),
    run(5, 'TRACI 2.1', 'US', gw(1100.0044)),
  ]

  beforeEach(() =>
    serve({
      '/api/cases/3': caseOk({ region_code: 'EU' }),
      '/api/cases/3/components': componentsOk,
      '/api/projects/1': projectOk({ lcia_method: 'CML 2001', region_code: 'Global' }),
      '/api/cases/3/assessments': () => json(200, { success: true, assessments: runs }),
    }),
  )

  it('shows the latest completed run, not a newer failed one', async () => {
    render(<ResultsPage />)
    expect(await screen.findByText(/Run #8/)).toBeInTheDocument()
  })

  it('shows the delta against the previous run with the same method and region (RES-2)', async () => {
    render(<ResultsPage />)
    expect(await screen.findByText(/↓ 10\.0% vs last run/)).toBeInTheDocument()
  })

  it('lists a credit among the contributors and small values without rounding to 0 (RES-4)', async () => {
    render(<ResultsPage />)
    await screen.findByText(/Run #8/)
    const hero = screen.getByText('Recycling credit').closest('div')!.parentElement!
    expect(within(hero).getByText('-10')).toBeInTheDocument()
    expect(screen.getByText('0.004')).toBeInTheDocument()
    expect(screen.queryByText(/No contributors yet/)).not.toBeInTheDocument()
  })

  it('formats category values with significant figures (RES-1)', async () => {
    render(<ResultsPage />)
    await screen.findByText(/Run #8/)
    expect(screen.getByText('4.2e-7')).toBeInTheDocument()
    expect(screen.getAllByText('990').length).toBeGreaterThan(0)
    // Flow table: amount 1000 and a small factor.
    expect(screen.getAllByText('1,000').length).toBeGreaterThan(0)
    expect(screen.getByText('1.234e-4')).toBeInTheDocument()
  })

  it('has no dead "Compare to last run" chip (RES-6)', async () => {
    render(<ResultsPage />)
    await screen.findByText(/Run #8/)
    expect(screen.queryByText('Compare to last run')).not.toBeInTheDocument()
  })

  it('offers a re-run of the displayed run (RUN-5)', async () => {
    render(<ResultsPage />)
    await screen.findByText(/Run #8/)
    const modal = screen.getByTestId('run-modal')
    expect(modal.dataset.method).toBe('TRACI 2.1')
    expect(modal.dataset.region).toBe('US Grid')
  })
})

describe('results page run scope before the first run (RUN-5)', () => {
  it("starts from the case's region, not a hard-coded US grid", async () => {
    serve({
      '/api/cases/3': caseOk({ region_code: 'EU' }),
      '/api/cases/3/components': componentsOk,
      '/api/projects/1': projectOk({ lcia_method: 'TRACI 2.1', region_code: 'US' }),
      '/api/cases/3/assessments': () => json(200, { success: true, assessments: [] }),
    })
    render(<ResultsPage />)
    await screen.findByText(/No assessments yet/)
    const modal = screen.getByTestId('run-modal')
    expect(modal.dataset.region).toBe('EU Average')
    expect(modal.dataset.method).toBe('TRACI 2.1')
  })

  it('leaves the choice to the modal when neither case nor project has a region', async () => {
    serve({
      '/api/cases/3': caseOk(),
      '/api/cases/3/components': componentsOk,
      '/api/projects/1': projectOk(),
      '/api/cases/3/assessments': () => json(200, { success: true, assessments: [] }),
    })
    render(<ResultsPage />)
    await screen.findByText(/No assessments yet/)
    const modal = screen.getByTestId('run-modal')
    expect(modal.dataset.region).toBe('(unset)')
    expect(modal.dataset.method).toBe('(unset)')
  })

  it('shows "No contributors yet" only when there are no runs', async () => {
    serve({
      '/api/cases/3': caseOk(),
      '/api/cases/3/components': componentsOk,
      '/api/projects/1': projectOk(),
      '/api/cases/3/assessments': () => json(200, { success: true, assessments: [] }),
    })
    render(<ResultsPage />)
    expect(await screen.findByText(/No contributors yet/)).toBeInTheDocument()
  })
})
