// @vitest-environment jsdom
/**
 * About you (F1.3): the answers are saved and Home opens, with nothing built;
 * a failed save says so on the form; the fields this screen does not ask for
 * are sent back as loaded; Skip saves nothing but the skip. Errors are on the
 * screen, never in a toast.
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
let sent: any[] = []
let urls: string[] = []

beforeEach(() => {
  vi.clearAllMocks()
  putStatus = 200
  sent = []
  urls = []
  localStorage.setItem('auth_token', 'token-abc')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      urls.push(String(url))
      if (init?.method === 'PUT') {
        sent.push(JSON.parse(String(init.body)))
        return putStatus >= 400 ? json(putStatus, { error: 'Failed to update profile' }) : json(200, { success: true })
      }
      if (String(url).startsWith('/api/projects')) return json(200, { projects: [] })
      return json(200, {
        success: true,
        profile: { id: 1, email: 'a@b.c', needsOnboarding: true, fullName: 'Ada Lovelace', role: 'Controller', country: 'Canada', useCase: 'facility' },
      })
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
  it('saves name and company, keeps the rest as loaded, and opens Home without building anything', async () => {
    await open()
    fireEvent.change(screen.getByLabelText(/Company/), { target: { value: 'Ridge Plating' } })
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/home'))
    expect(sent[0]).toEqual({ fullName: 'Ada Lovelace', company: 'Ridge Plating', role: 'Controller', useCase: 'facility', country: 'Canada' })
    expect(urls.some((u) => u.startsWith('/api/example-project'))).toBe(false)
  })

  it('company is optional', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/home'))
    expect(sent[0]).toMatchObject({ fullName: 'Ada Lovelace', company: null })
  })

  it('a failed save says so on the form and stays', async () => {
    putStatus = 500
    await open()
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    await waitFor(() => expect(screen.getByText('Failed to update profile')).toBeTruthy())
    expect(replace).not.toHaveBeenCalledWith('/home')
  })

  it('an empty name is refused on its line', async () => {
    await open()
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: '  ' } })
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    expect(await screen.findByText(/Enter your name/)).toBeTruthy()
    expect(sent).toEqual([])
  })

  it('Skip for now saves only the skip', async () => {
    await open()
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }))
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/home'))
    expect(sent).toEqual([{ skip: true }])
  })

  it('asks for no use case and offers no guided mode or sample', async () => {
    await open()
    expect(screen.queryByText(/What will you use LCAPIX for/)).toBeNull()
    expect(screen.queryByText(/Guided mode/)).toBeNull()
    expect(screen.queryByText(/sample/i)).toBeNull()
  })
})
