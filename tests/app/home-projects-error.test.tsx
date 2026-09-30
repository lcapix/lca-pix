// @vitest-environment jsdom
/**
 * X-API-1 on /home: when /api/projects fails the page must say so, not show
 * the "Start your first assessment" empty state as if the account had no
 * projects. The real api-client runs against a stubbed fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

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
  MetricBlock: () => null,
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

import HomePage from '@/app/home/page'
import { useAuthStore, useProjectStore } from '@/lib/store'
import { toast } from 'sonner'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let projectsStatus = 500

beforeEach(() => {
  vi.clearAllMocks()
  projectsStatus = 500
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

describe('/home when /api/projects fails', () => {
  it('shows an error state with the server message, not the empty "no projects" state', async () => {
    render(<HomePage />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("Couldn't load your projects")
    expect(alert).toHaveTextContent('Failed to fetch projects')
    expect(screen.queryByText('Start your first assessment.')).not.toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledWith(
      "Couldn't load your projects",
      expect.objectContaining({ description: 'Failed to fetch projects' }),
    )
  })

  it('loads the projects on Retry once the server recovers', async () => {
    render(<HomePage />)
    await screen.findByRole('alert')

    projectsStatus = 200
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('Bike frame study')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })
})
