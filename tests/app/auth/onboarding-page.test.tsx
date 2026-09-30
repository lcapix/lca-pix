// @vitest-environment jsdom
/**
 * /auth/onboarding: save errors and the welcome message go through sonner
 * (the only mounted Toaster), so the user actually sees them.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { toast } = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}))
const replace = vi.fn()
vi.mock('sonner', () => ({ toast }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace }) }))
vi.mock('@/components/auth-guard', () => ({ AuthGuard: ({ children }: any) => <>{children}</> }))

import OnboardingPage from '@/app/auth/onboarding/page'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let putStatus = 200

beforeEach(() => {
  vi.clearAllMocks()
  putStatus = 200
  localStorage.setItem('auth_token', 'token-abc')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        return putStatus >= 400
          ? json(putStatus, { error: 'Failed to update profile' })
          : json(200, { success: true })
      }
      return json(200, { success: true, profile: { needsOnboarding: true } })
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

async function fillAndSubmit() {
  render(<OnboardingPage />)
  fireEvent.change(await screen.findByPlaceholderText('Jane Doe'), { target: { value: 'Ada Lovelace' } })
  fireEvent.change(screen.getByPlaceholderText('Acme Sustainability'), {
    target: { value: 'Analytical Engines' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Continue to dashboard' }))
}

describe('/auth/onboarding', () => {
  it('shows the server error in a toast when the save fails', async () => {
    putStatus = 500
    await fillAndSubmit()
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Save failed', {
        description: 'Failed to update profile',
      }),
    )
    expect(replace).not.toHaveBeenCalledWith('/home')
  })

  it('welcomes the user in a toast and goes home on success', async () => {
    await fillAndSubmit()
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/home'))
    expect(toast.success).toHaveBeenCalledWith("You're all set", {
      description: 'Welcome to LCAPIX.',
    })
  })
})
