// @vitest-environment jsdom
/**
 * Phase 1 on /home: when /api/integrations/status fails, the library tiles
 * say so instead of showing a library of 0 factors. The real api-client runs
 * against a stubbed fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
vi.mock('@/components/auth-guard', () => ({ AuthGuard: ({ children }: any) => <>{children}</> }))
vi.mock('@/components/global/guided-tour', () => ({ GuidedTour: () => null }))
vi.mock('@/components/lcapix', () => ({
  AppTopBar: () => null,
  Icon: () => null,
  Sparkline: () => null,
  StatusDot: () => null,
  MetricBlock: ({ label, value, display, sub }: any) => <div data-testid={`kpi-${label}`}>{display ?? value} {sub}</div>,
  NumberedRail: () => null,
  TrustStrip: () => null,
  fmtNum: (n: number) => String(n),
  fmtInt: (n: number) => String(n),
  SectionHeader: ({ eyebrow, title, sub, actions }: any) => (
    <div>
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{sub}</p>
      {actions}
    </div>
  ),
}))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

import HomePage from '@/app/home/_components/classic-home'
import { useAuthStore, useProjectStore } from '@/lib/store'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let projectsStatus = 200
let statusCode = 500

beforeEach(() => {
  vi.clearAllMocks()
  projectsStatus = 200
  statusCode = 500
  localStorage.setItem('auth_token', 'token-abc')
  useAuthStore.setState({
    user: { id: '1', name: 'Ada Lovelace', email: 'ada@example.com', createdAt: new Date() } as any,
    isAuthenticated: true,
  })
  useProjectStore.setState({ projects: [] })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const path = String(url).split('?')[0]
      if (path === '/api/projects') {
        return projectsStatus >= 400
          ? json(projectsStatus, { error: 'Failed to fetch projects' })
          : json(200, {
              success: true,
              projects: [
                {
                  project_id: 3,
                  project_name: 'Bike frame study',
                  description: 'Steel vs aluminium',
                  owner_id: 1,
                  created_at: '2026-09-01T00:00:00Z',
                  updated_at: '2026-09-02T00:00:00Z',
                },
              ],
            })
      }
      if (path === '/api/integrations/status') {
        return statusCode >= 400
          ? json(statusCode, { error: 'Could not read the integrations status' })
          : json(200, { success: true, factorsByMethod: [{ factors: 120 }], substances: { total: 77 } })
      }
      if (path === '/api/auth/profile') {
        return json(200, { success: true, profile: { needsOnboarding: false } })
      }
      return json(200, { success: true })
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('/home when the library status fails', () => {
  it('shows a dash and says the library could not be read, not 0 factors', async () => {
    render(<HomePage />)
    const factors = await screen.findByTestId('kpi-FACTORS')
    await waitFor(() => expect(factors).toHaveTextContent('– Could not read the library'))
    expect(screen.getByTestId('kpi-SUBSTANCES')).toHaveTextContent('– Could not read the library')
    expect(factors).not.toHaveTextContent('Awaiting sync')
  })

  it('shows the counts when the status read works', async () => {
    statusCode = 200
    render(<HomePage />)
    await waitFor(() => expect(screen.getByTestId('kpi-FACTORS')).toHaveTextContent('120 In factor library'))
    expect(screen.getByTestId('kpi-SUBSTANCES')).toHaveTextContent('77 In substance catalog')
  })
})
