// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

import { useDuplicateCase } from '@/lib/case-editor/use-duplicate-case'
import { toast } from 'sonner'

const router = { push: vi.fn(), replace: vi.fn() }

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.setItem('auth_token', 'tok')
})
afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

const render = (search: string, currentCase: object | null = { id: '10' }) =>
  renderHook(
    ({ c }) =>
      useDuplicateCase({ projectId: '7', caseId: '10', router, currentCase: c, searchParams: new URLSearchParams(search) }),
    { initialProps: { c: currentCase } },
  )

describe('useDuplicateCase', () => {
  it('?duplicate=1 opens the dialog once the case loads and drops the param (RES-6)', () => {
    const { result, rerender } = render('duplicate=1&componentId=4', null)
    expect(result.current.dupOpen).toBe(false)
    rerender({ c: { id: '10' } })
    expect(result.current.dupOpen).toBe(true)
    expect(router.replace).toHaveBeenCalledWith('/project/7/case/10?componentId=4', { scroll: false })
    act(() => result.current.cancelDuplicate())
    rerender({ c: { id: '10', again: true } })
    expect(result.current.dupOpen).toBe(false)
    expect(router.replace).toHaveBeenCalledTimes(1)
  })

  it('copies the case with the auth header and opens the copy', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ case_id: 12, case_name: 'Base (copy)', components_copied: 4, flows_copied: 9 }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const { result } = render('')
    act(() => result.current.openDuplicate())
    await act(async () => result.current.submitDuplicate('Base (copy)'))
    expect(fetchMock).toHaveBeenCalledWith('/api/cases/10/duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: JSON.stringify({ case_name: 'Base (copy)' }),
    })
    expect(toast.success).toHaveBeenCalledWith('Created "Base (copy)": 4 nodes and 9 flows copied')
    expect(router.push).toHaveBeenCalledWith('/project/7/case/12')
    expect(result.current.dupOpen).toBe(false)
    expect(result.current.dupBusy).toBe(false)
  })

  it('keeps the dialog open with the server error, or a plain one on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ error: 'Name taken' }) })))
    const { result } = render('')
    act(() => result.current.openDuplicate())
    await act(async () => result.current.submitDuplicate('Base'))
    expect(result.current.dupError).toBe('Name taken')
    expect(result.current.dupOpen).toBe(true)

    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }))
    await act(async () => result.current.submitDuplicate('Base'))
    expect(result.current.dupError).toBe('Could not duplicate case')
  })
})
