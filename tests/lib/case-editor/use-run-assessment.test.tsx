// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

import { useRunAssessment, useRunGate } from '@/lib/case-editor/use-run-assessment'
import { apiRequest } from '@/lib/api-client'
import { toast } from 'sonner'

const router = { push: vi.fn() }

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})
afterEach(() => vi.restoreAllMocks())

describe('useRunGate', () => {
  it('blocks on a blank functional unit only once Goal & scope has reported', () => {
    const { result } = renderHook(() => useRunGate({ present: ['materials'], missing: [], score: 1 }))
    expect(result.current.fuMissing).toBe(false)
    expect(result.current.canRun).toBe(true)
    act(() => result.current.setGoalScope({ functionalUnit: '  ' } as any))
    expect(result.current.fuMissing).toBe(true)
    expect(result.current.canRun).toBe(false)
    act(() => result.current.openGoalScope())
    expect(result.current.goalOpenSignal).toBe(1)
  })

  it('blocks an inventory with nothing to characterize', () => {
    const { result } = renderHook(() => useRunGate({ present: ['skeleton'], missing: [], score: 0 }))
    expect(result.current.inventoryReady).toBe(false)
    expect(result.current.canRun).toBe(false)
  })
})

describe('useRunAssessment', () => {
  const render = (over: Partial<{ canRun: boolean; fuMissing: boolean }> = {}) => {
    const openGoalScope = vi.fn()
    const hook = renderHook(() =>
      useRunAssessment({ projectId: '7', caseId: '10', router, canRun: true, fuMissing: false, openGoalScope, ...over }),
    )
    return { ...hook, openGoalScope }
  }

  it('a blocked run explains why and opens Goal & scope', async () => {
    const { result, openGoalScope } = render({ canRun: false, fuMissing: true })
    await act(async () => result.current.handleRunAssessment())
    expect(toast.error).toHaveBeenCalledWith('Set the functional unit first (Goal & scope), so the result is per something.')
    expect(openGoalScope).toHaveBeenCalled()
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it('runs with the remembered method/region, reports the total and opens results', async () => {
    localStorage.setItem('lcapix-run-prefs:10', JSON.stringify({ method: 'TRACI 2.1', region: 'US' }))
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ total_impacts: [{ category_name: 'Global Warming', impact_value: 1.72 }] }),
    } as any)
    const { result } = render()
    await act(async () => result.current.handleRunAssessment())
    const [url, init] = vi.mocked(apiRequest).mock.calls[0] as any
    expect(url).toBe('/api/cases/10/assessments')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ run_name: 'Assessment', calculation_method: 'TRACI 2.1', region_code: 'US' })
    expect(toast.success).toHaveBeenCalledWith('Assessment complete — 1.720 kg CO₂-eq')
    expect(router.push).toHaveBeenCalledWith('/project/7/case/10/results')
    expect(result.current.isRunning).toBe(false)
  })

  it('a failed run shows the server text and stays', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(apiRequest).mockResolvedValue({ ok: false, status: 500, statusText: 'x', text: async () => 'Engine failed' } as any)
    const { result } = render()
    await act(async () => result.current.handleRunAssessment())
    expect(toast.error).toHaveBeenCalledWith('Engine failed')
    expect(router.push).not.toHaveBeenCalled()
  })
})
