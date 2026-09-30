// @vitest-environment jsdom
/**
 * INS-2: the insights modal keys its narration request on its props. The
 * results page built componentBreakdown / materialBreakdown / stepCosts with
 * inline .map()s, so every parent render (opening the modal, a pulse, a
 * filter click) handed it new arrays and aborted + re-sent the request.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as api from '@/lib/api-client'

const seen: any[] = []
vi.mock('@/lib/api-client')
vi.mock('next/navigation', () => ({
  useParams: () => ({ projectId: '1', caseId: '3' }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}))
vi.mock('@/components/lcapix/magic-insights-modal', () => ({
  MagicInsightsModal: (p: any) => {
    seen.push(p)
    return null
  },
}))
vi.mock('@/components/lcapix/case/write-up-card', () => ({ WriteUpCard: () => null }))
vi.mock('@/components/assessments/run-assessment-modal', () => ({ RunAssessmentModal: () => null }))

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any

import ResultsPage from '@/app/project/[projectId]/case/[caseId]/results/page'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const run = {
  run_id: 8,
  run_name: 'Run 8',
  calculation_method: 'TRACI 2.1',
  region_code: 'US',
  status: 'completed',
  run_date: '2026-09-18T10:00:00Z',
  executed_by_username: 'u',
  impacts: { 'Global Warming': { value: 990, unit: 'kg CO2 eq' } },
  componentBreakdown: [
    {
      component_id: 11,
      component_name: 'Frame',
      life_cycle_stage: 'materials',
      flows_processed: 1,
      impacts: [{ category_id: 1, category_name: 'Global Warming', impact_value: 990, unit: 'kg CO2 eq' }],
    },
  ],
  flowDetail: [
    { flow_id: 1, component: 'Frame', substance: 'Aluminum', category_name: 'Global Warming', dir: 'IN', amount: 10, unit: 'kg', factor: 99, impact: 990, scope: 'US' },
  ],
  warnings: [],
}

beforeEach(() => {
  vi.resetAllMocks()
  seen.length = 0
  localStorage.clear()
  vi.mocked(api.apiRequest).mockImplementation(async (url: string) => {
    const path = url.split('?')[0]
    if (path === '/api/cases/3') {
      return json(200, { success: true, case: { case_id: 3, project_id: 1, case_type: 'base', case_name: 'Touring bike' } })
    }
    if (path === '/api/cases/3/components') {
      return json(200, {
        success: true,
        components: [
          { component_id: 11, case_id: 3, parent_component_id: null, component_type: 'product', component_name: 'Frame', labor_cost: '12.50' },
        ],
      })
    }
    if (path === '/api/projects/1') return json(200, { success: true, project: { project_name: 'Bikes' } })
    if (path === '/api/cases/3/assessments') return json(200, { success: true, assessments: [run] })
    throw new Error(`unexpected fetch ${path}`)
  })
})

describe('results page → MagicInsightsModal props', () => {
  it('keeps the same breakdown, materials and step costs across an unrelated re-render', async () => {
    render(<ResultsPage />)
    expect(await screen.findByText(/Run #8/)).toBeInTheDocument()
    const before = seen[seen.length - 1]
    expect(before.open).toBe(false)
    expect(before.componentBreakdown).toHaveLength(1)
    expect(before.materialBreakdown).toEqual([
      { category_name: 'Global Warming', name: 'Aluminum', value: 990, step: 'Frame', tier: null },
    ])
    expect(before.stepCosts[0]).toMatchObject({ name: 'Frame', labor: 12.5 })

    fireEvent.click(screen.getByRole('button', { name: 'See what drives it' }))
    await waitFor(() => expect(seen[seen.length - 1].open).toBe(true))
    const after = seen[seen.length - 1]

    expect(after.componentBreakdown).toBe(before.componentBreakdown)
    expect(after.materialBreakdown).toBe(before.materialBreakdown)
    expect(after.stepCosts).toBe(before.stepCosts)
    expect(after.impacts).toBe(before.impacts)
  })
})
