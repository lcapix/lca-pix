// @vitest-environment jsdom
/**
 * /profile (PROF-1, X-API-1, toasts): a failed load must not leave a blank
 * form that would save blanks over the real profile, and save errors must
 * reach the user through sonner (the only mounted Toaster).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { toast } = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}))
vi.mock('sonner', () => ({ toast }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
vi.mock('@/components/auth-guard', () => ({ AuthGuard: ({ children }: any) => <>{children}</> }))
vi.mock('@/components/lcapix', () => ({
  AppTopBar: () => null,
  Icon: () => null,
  SectionHeader: ({ title, sub }: any) => (
    <div>
      <h1>{title}</h1>
      <p>{sub}</p>
    </div>
  ),
}))

import ProfilePage from '@/app/profile/page'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const PROFILE = {
  success: true,
  profile: {
    email: 'ada@example.com',
    username: 'ada',
    fullName: 'Ada Lovelace',
    company: 'Analytical Engines',
    role: '',
    useCase: '',
    country: '',
    onboardedAt: '2026-09-01T00:00:00Z',
  },
}

let getStatus = 200
let putStatus = 200
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  getStatus = 200
  putStatus = 200
  localStorage.setItem('auth_token', 'token-abc')
  fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if ((init?.method ?? 'GET') === 'PUT') {
      return putStatus >= 400
        ? json(putStatus, { error: 'Failed to update profile' })
        : json(200, { success: true })
    }
    return getStatus >= 400 ? json(getStatus, { error: 'Database unavailable' }) : json(200, PROFILE)
  })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('/profile', () => {
  it('shows a load error with Retry instead of an empty, savable form', async () => {
    getStatus = 500
    render(<ProfilePage />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("Couldn't load your profile")
    expect(alert).toHaveTextContent('Database unavailable')
    expect(screen.queryByPlaceholderText('Jane Doe')).not.toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledWith(
      "Couldn't load your profile",
      expect.objectContaining({ description: 'Database unavailable' }),
    )

    getStatus = 200
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByDisplayValue('Ada Lovelace')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the server error in a toast when saving fails', async () => {
    putStatus = 500
    render(<ProfilePage />)
    const name = await screen.findByDisplayValue('Ada Lovelace')
    fireEvent.change(name, { target: { value: 'Ada King' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Save failed', {
        description: 'Failed to update profile',
      }),
    )
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('confirms a successful save in a toast', async () => {
    render(<ProfilePage />)
    const name = await screen.findByDisplayValue('Ada Lovelace')
    fireEvent.change(name, { target: { value: 'Ada King' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Profile saved', {
        description: 'Changes are live.',
      }),
    )
  })
})
