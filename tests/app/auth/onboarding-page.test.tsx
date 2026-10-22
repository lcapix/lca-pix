// @vitest-environment jsdom
/**
 * About you (F1.3, F1.4): the answers are saved, then the sample is built and
 * Home opens; a failed save says so on the form; a failed build keeps the
 * answers and offers Try again or an empty project; Skip saves nothing but
 * the skip. Errors are on the screen, never in a toast.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const replace = vi.fn()
const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }))
vi.mock('@/components/auth-guard', () => ({ AuthGuard: ({ children }: any) => <>{children}</> }))

import OnboardingPage from '@/app/auth/onboarding/page'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let putStatus = 200
let buildStatus = 200
let sent: any[] = []

beforeEach(() => {
  vi.clearAllMocks()
  putStatus = 200
  buildStatus = 200
  sent = []
  localStorage.setItem('auth_token', 'token-abc')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        sent.push(JSON.parse(String(init.body)))
        return putStatus >= 400 ? json(putStatus, { error: 'Failed to update profile' }) : json(200, { success: true })
      }
      if (String(url).startsWith('/api/example-project')) {
        return buildStatus >= 400 ? json(buildStatus, { error: 'Could not build the sample study. Nothing was created.' }) : json(200, { project_id: 9 })
      }
      if (String(url).startsWith('/api/projects')) return json(200, { projects: [] })
      return json(200, { success: true, profile: { id: 1, email: 'a@b.c', needsOnboarding: true, fullName: 'Ada Lovelace' } })
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

async function open() {
  render(<OnboardingPage />)
  await waitFor(() => expect((screen.getByLabelText('Full name') as HTMLInputElement).value).toBe('Ada Lovelace'))
}

describe('/auth/onboarding', () => {
  it('saves the answers (institution optional), builds the sample and opens Home', async () => {
    await open()
    fireEvent.click(screen.getByLabelText(/Research in a lab/))
    fireEvent.click(screen.getByRole('button', { name: /Open the sample study/ }))
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/home'))
    expect(sent[0]).toMatchObject({ fullName: 'Ada Lovelace', company: null, useCase: 'lab' })
  })

  it('a failed save says so on the form and builds nothing', async () => {
    putStatus = 500
    await open()
    fireEvent.click(screen.getByRole('button', { name: /Open the sample study/ }))
    await waitFor(() => expect(screen.getByText('Failed to update profile')).toBeTruthy())
    expect(replace).not.toHaveBeenCalledWith('/home')
  })

  it('a failed build keeps the answers: Try again, or an empty project instead', async () => {
    buildStatus = 500
    await open()
    fireEvent.click(screen.getByRole('button', { name: /Open the sample study/ }))
    expect(await screen.findByText(/We couldn.t build the sample study. Nothing was lost./)).toBeTruthy()
    expect(screen.getByText('Your answers are saved. Try again in a moment.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Start with an empty project instead' }))
    expect(push).toHaveBeenCalledWith('/project/new')
  })

  it('Skip for now saves only the skip', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }))
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/home'))
    expect(sent).toEqual([{ skip: true }])
  })

  it('a company workspace is shown, not selectable', async () => {
    await open()
    expect((screen.getByLabelText(/A company workspace/) as HTMLInputElement).disabled).toBe(true)
  })
})
