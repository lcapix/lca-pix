// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const router = { push: vi.fn(), back: vi.fn(), replace: vi.fn() }
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useParams: () => ({ projectId: '7' }),
}))
vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn(), useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/components/lcapix/case/case-journey', () => ({
  CaseJourney: ({ onReadiness }: any) => {
    const React = require('react')
    React.useEffect(() => onReadiness?.({ canRun: true, reason: null }), [])
    return null
  },
}))

import ProjectPage from '@/app/project/[projectId]/page'
import { apiRequest } from '@/lib/api-client'
import { toast } from 'sonner'

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) }) as any

let runStatus = 200

beforeEach(() => {
  vi.clearAllMocks()
  // jsdom has no matchMedia (used by the animated numbers).
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false,
  })) as any
  runStatus = 200
  vi.mocked(apiRequest).mockImplementation(async (url: string, init?: any) => {
    const method = init?.method ?? 'GET'
    if (url === '/api/projects/7') {
      return json({ success: true, project: { project_id: 7, project_name: 'Bikes', owner_id: 1, lcia_method: 'ReCiPe Midpoint (H)' } })
    }
    if (url === '/api/projects/7/cases') {
      return json({
        success: true,
        cases: [
          { case_id: 5, project_id: 7, case_name: 'Steel frame', case_type: 'base' },
          { case_id: 6, project_id: 7, case_name: 'Alu frame', case_type: 'comparative' },
        ],
      })
    }
    if (url === '/api/cases/5/components' || url === '/api/cases/6/components') {
      return json({
        success: true,
        components: [
          { component_id: 1, case_id: 5, parent_component_id: null, component_type: 'product', component_name: 'Frame', labor_cost: '10.50', energy_cost: '2.25', opex: '100.00' },
        ],
      })
    }
    if (url === '/api/cases/5/assessments' && method === 'GET') {
      return json({ success: true, assessments: [{ run_id: 90, status: 'completed', calculation_method: 'TRACI 2.1' }] })
    }
    if (url === '/api/cases/5/assessments' && method === 'POST') {
      return runStatus >= 400 ? json({ error: 'No flows to assess' }, runStatus) : json({ success: true })
    }
    if (url === '/api/assessments/90') {
      return json({ success: true, results: [{ category_name: 'Global Warming', unit: 'kg CO2-eq', impact_value: '12.5', component_name: 'Frame' }] })
    }
    // Case 6's assessments never answer, so any number shown for it is stale.
    if (url === '/api/cases/6/assessments') return new Promise(() => {})
    return json({ success: true })
  })
})

describe('Project page case switch (PROJ-5)', () => {
  it('does not show the previous case’s results under the newly selected case', async () => {
    render(<ProjectPage />)
    expect(await screen.findByText(/GLOBAL WARMING · TRACI 2.1/)).toBeInTheDocument()
    fireEvent.click(document.querySelector('.case-tab[data-kind="comp"]') as HTMLElement)
    await waitFor(() => expect(screen.queryByText(/GLOBAL WARMING · TRACI 2.1/)).toBeNull())
    expect(screen.getByText(/GLOBAL WARMING · ReCiPe/)).toBeInTheDocument()
  })
})

describe('Project page Run Assessment (PROJ-5)', () => {
  const run = async () => {
    render(<ProjectPage />)
    await screen.findByText(/GLOBAL WARMING · TRACI 2.1/)
    const btn = await screen.findByRole('button', { name: /Run Assessment/ })
    await waitFor(() => expect(btn).not.toBeDisabled())
    fireEvent.click(btn)
  }

  it('opens the results only when the run succeeded', async () => {
    await run()
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/project/7/case/5/results'))
  })

  it('stays on the page and says why when the run failed', async () => {
    runStatus = 400
    await run()
    await waitFor(() => expect(vi.mocked(toast.error)).toHaveBeenCalled())
    expect(router.push).not.toHaveBeenCalledWith('/project/7/case/5/results')
  })
})

describe('Project page cost summary (PROJ-4)', () => {
  it('adds DECIMAL strings as numbers and counts opex only when nothing is itemized', async () => {
    render(<ProjectPage />)
    // labor 10.50 + energy 2.25 = 12.75; opex 100 is the direct-entry total and
    // must not be added on top of the itemized costs.
    const summary = (await screen.findByText('Cost summary')).parentElement as HTMLElement
    await waitFor(() => {
      const total = [...summary.querySelectorAll('div')].find((d) => d.textContent === 'Total')
      expect(total?.nextElementSibling?.textContent).toBe('$12.75')
    })
  })
})
