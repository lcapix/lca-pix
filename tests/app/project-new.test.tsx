// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const router = { push: vi.fn(), back: vi.fn(), replace: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

import NewProjectPage from '@/app/project/new/page'
import { apiRequest } from '@/lib/api-client'
import { toast } from 'sonner'

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as any

function submit() {
  render(<NewProjectPage />)
  fireEvent.change(screen.getByPlaceholderText(/Vertical Forest/), { target: { value: 'Bike frames' } })
  fireEvent.change(screen.getByPlaceholderText(/1 touring bicycle/), { target: { value: '1 bike' } })
  fireEvent.submit(screen.getByPlaceholderText(/Vertical Forest/).closest('form')!)
}

beforeEach(() => vi.clearAllMocks())

describe('New project settings save (PROJ-3)', () => {
  it('surfaces a failed settings save instead of silently running as CML/Global', async () => {
    vi.mocked(apiRequest).mockImplementation(async (_url: string, init?: any) =>
      init?.method === 'POST'
        ? json({ success: true, project: { project_id: 31 } }, 201)
        : json({ error: 'Only the project owner can change the study goal & scope.' }, 403),
    )
    submit()
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/project/31/start'))
    expect(vi.mocked(toast.error)).toHaveBeenCalled()
    const [title, opts] = vi.mocked(toast.error).mock.calls[0] as any
    expect(`${title} ${opts?.description ?? ''}`).toMatch(/method|region|functional unit|settings/i)
  })

  it('a network error on the settings save is surfaced too', async () => {
    vi.mocked(apiRequest).mockImplementation(async (_url: string, init?: any) => {
      if (init?.method === 'POST') return json({ success: true, project: { project_id: 31 } }, 201)
      throw new TypeError('Failed to fetch')
    })
    submit()
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/project/31/start'))
    expect(vi.mocked(toast.error)).toHaveBeenCalled()
  })

  it('says the project was created when everything saved', async () => {
    vi.mocked(apiRequest).mockImplementation(async (_url: string, init?: any) =>
      init?.method === 'POST' ? json({ success: true, project: { project_id: 31 } }, 201) : json({ success: true }),
    )
    submit()
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/project/31/start'))
    expect(vi.mocked(toast.success)).toHaveBeenCalled()
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled()
  })
})
