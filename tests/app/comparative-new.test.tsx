// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, back: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ projectId: '7' }),
}))
vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock('@/components/lcapix', () => ({
  Breadcrumb: () => null,
  Icon: () => null,
}))

import CreateComparativeCasePage from '@/app/project/[projectId]/case/comparative/new/page'
import { apiRequest } from '@/lib/api-client'
import { toast } from 'sonner'

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) }) as any

function routeApi(opts: { cloneStatus?: number } = {}) {
  vi.mocked(apiRequest).mockImplementation(async (url: string, init?: any) => {
    if (url === '/api/projects/7/cases' && (!init || !init.method)) {
      return json({
        success: true,
        cases: [{ case_id: 5, project_id: 7, case_name: 'Base', case_type: 'base' }],
      })
    }
    if (url === '/api/projects/7/cases' && init?.method === 'POST') {
      return json({ success: true, case: { case_id: 9 } }, 201)
    }
    if (url === '/api/cases/9/clone-from') {
      return json(opts.cloneStatus && opts.cloneStatus >= 400 ? { error: 'boom' } : { success: true, cloned: 4 }, opts.cloneStatus ?? 200)
    }
    return json({})
  })
}

async function fillAndSubmit() {
  render(<CreateComparativeCasePage />)
  await waitFor(() => expect(screen.getByRole('option', { name: 'Base' })).toBeInTheDocument())
  fireEvent.change(screen.getByPlaceholderText(/Bio-Based Polymer/i), { target: { value: 'Recycled steel' } })
  fireEvent.click(screen.getByRole('button', { name: /Create Comparative Case/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Create comparative case (CMP-2)', () => {
  it('copies the chosen reference case into the new case before opening it', async () => {
    routeApi()
    await fillAndSubmit()
    await waitFor(() => expect(push).toHaveBeenCalledWith('/project/7/case/9'))
    const clone = vi.mocked(apiRequest).mock.calls.find(([u]) => u === '/api/cases/9/clone-from')
    expect(clone).toBeTruthy()
    expect(JSON.parse(clone![1]!.body as string)).toEqual({ sourceCaseId: 5 })
  })

  it('creates an empty case when the user opts out of the copy', async () => {
    routeApi()
    render(<CreateComparativeCasePage />)
    await waitFor(() => expect(screen.getByRole('option', { name: 'Base' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('checkbox', { name: /copy of the reference case/i }))
    fireEvent.change(screen.getByPlaceholderText(/Bio-Based Polymer/i), { target: { value: 'Blank' } })
    fireEvent.click(screen.getByRole('button', { name: /Create Comparative Case/i }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/project/7/case/9'))
    expect(vi.mocked(apiRequest).mock.calls.some(([u]) => u === '/api/cases/9/clone-from')).toBe(false)
  })

  it('says so when the copy fails, and still opens the (empty) case', async () => {
    routeApi({ cloneStatus: 500 })
    await fillAndSubmit()
    await waitFor(() => expect(push).toHaveBeenCalledWith('/project/7/case/9'))
    expect(vi.mocked(toast.error)).toHaveBeenCalled()
  })
})
