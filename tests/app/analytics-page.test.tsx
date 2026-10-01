// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const router = { push: vi.fn(), back: vi.fn(), replace: vi.fn() }
const search = { caseId: null as string | null }
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useParams: () => ({ projectId: '7' }),
  useSearchParams: () => ({ get: (k: string) => (k === 'caseId' ? search.caseId : null) }),
}))
vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }))

import AnalyticsPage from '@/app/project/[projectId]/analytics/page'
import { apiRequest } from '@/lib/api-client'

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) }) as any

// recharts' ResponsiveContainer needs it; jsdom has none.
;(globalThis as any).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const routes: Record<string, () => any> = {
  '/api/projects/7': () => json({ success: true, project: { project_id: 7, project_name: 'Bikes' } }),
  '/api/projects/7/cases': () =>
    json({
      success: true,
      cases: [
        { case_id: 5, project_id: 7, case_name: 'Steel frame', case_type: 'comparative' },
        { case_id: 6, project_id: 7, case_name: 'Alu frame', case_type: 'base' },
      ],
    }),
  '/api/cases/6/assessments': () =>
    json({ success: true, assessments: [{ run_id: 91, status: 'running' }, { run_id: 90, status: 'completed' }] }),
  '/api/assessments/90': () =>
    json({
      success: true,
      total_impacts: [
        { category_name: 'Global Warming', impact_value: '12.5', unit: 'kg CO2 eq' },
        { category_name: 'Acidification', impact_value: 0.0073, unit: 'kg SO2 eq' },
      ],
      component_breakdown: [
        { component_name: 'Frame', component_type: 'product', impacts: [{ category_name: 'Global Warming', impact_value: 14.5 }] },
        { component_name: 'Recycling', component_type: 'operation', impacts: [{ category_name: 'Global Warming', impact_value: -2 }] },
      ],
    }),
  '/api/cases/6/components': () =>
    json({ success: true, components: [{ labor_cost: '10.50', energy_cost: '2.25', opex: '100.00' }] }),
}

beforeEach(() => {
  vi.clearAllMocks()
  search.caseId = null
  localStorage.setItem('auth_token', 'tok')
  vi.mocked(apiRequest).mockImplementation(async (url: string) => (routes[url] ?? (() => json({ success: true })))())
})

const urls = () => vi.mocked(apiRequest).mock.calls.map((c) => c[0])

describe('Analytics page', () => {
  it('loads the base case: latest completed run, GWP headline and component costs', async () => {
    render(<AnalyticsPage />)
    expect(await screen.findByText('CLIMATE CHANGE (GWP)')).toBeInTheDocument()
    expect(urls()).toEqual([
      '/api/projects/7/cases',
      '/api/projects/7',
      '/api/cases/6/assessments',
      '/api/assessments/90',
      '/api/cases/6/components',
    ])
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Bikes')
    expect(screen.getByText('1 assessed case · duplicate it and change one thing to compare')).toBeInTheDocument()
    // Case card and cost-vs-impact row.
    expect(screen.getAllByText('Alu frame')).toHaveLength(2)
    expect(screen.getAllByText('12.50')).toHaveLength(2)
    expect(screen.getByText('kg CO2 eq')).toBeInTheDocument()
    // ABC total (labor + energy) wins over opex.
    expect(screen.getByText('TOTAL COST')).toBeInTheDocument()
    expect(screen.getByText('Component-level difference')).toBeInTheDocument()
    // A credit component keeps its sign.
    expect(screen.getByText('-2.0')).toBeInTheDocument()
  })

  it('navigates back to the project', async () => {
    render(<AnalyticsPage />)
    fireEvent.click(await screen.findByLabelText('Back to project'))
    expect(router.push).toHaveBeenCalledWith('/project/7')
  })

  it('reports a ?caseId= that matches no case and retries on "Try again"', async () => {
    search.caseId = '99'
    render(<AnalyticsPage />)
    expect(await screen.findByText('Case not found (ID: 99)')).toBeInTheDocument()
    expect(screen.getByText('No assessments yet · run one to populate analytics')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Try again'))
    await waitFor(() => expect(urls().filter((u) => u === '/api/projects/7/cases')).toHaveLength(2))
  })

  it('asks to log in without a token, without calling the cases API', async () => {
    localStorage.removeItem('auth_token')
    render(<AnalyticsPage />)
    expect(await screen.findByText('Authentication required')).toBeInTheDocument()
    expect(screen.getByText('No authentication token found. Please log in.')).toBeInTheDocument()
    expect(urls()).toEqual(['/api/projects/7'])
    fireEvent.click(screen.getByText('Log in again'))
    expect(router.push).toHaveBeenCalledWith('/auth/login')
  })

  it('treats a 401 from the cases API as an expired session', async () => {
    vi.mocked(apiRequest).mockImplementation(async (url: string) => {
      if (url === '/api/projects/7/cases') throw new Error('Request failed: 401')
      return routes[url]()
    })
    render(<AnalyticsPage />)
    expect(await screen.findByText('Your session has expired. Please log in again.')).toBeInTheDocument()
  })
})
