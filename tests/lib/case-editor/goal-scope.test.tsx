// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

import { fmtScale, goalScopeFromApi, goalScopeSave, positiveString, toGoalScopeSummary } from '@/lib/case-editor/goal-scope'
import { useGoalScope } from '@/lib/case-editor/use-goal-scope'
import { apiRequest } from '@/lib/api-client'
import { toast } from 'sonner'

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as any
const PROJECT = { functional_unit: '1 bracket', system_boundary: 'gate-to-gate', goal_statement: 'Compare blanks', boundary_notes: '' }
const CASE = { reference_flow: '1.000000', reference_flow_unit: 'bracket', modeled_output: '0' }

describe('goal & scope data', () => {
  it('reads the project and case fields, defaulting bad numbers to 1', () => {
    expect(goalScopeFromApi(PROJECT, CASE)).toEqual({
      goalStatement: 'Compare blanks',
      functionalUnit: '1 bracket',
      systemBoundary: 'gate-to-gate',
      boundaryNotes: '',
      referenceFlow: '1',
      referenceFlowUnit: 'bracket',
      modeledOutput: '1',
    })
    expect(goalScopeFromApi({}, CASE)).toBeNull()
    expect(goalScopeFromApi(PROJECT, {})).toBeNull()
    expect(positiveString('-3')).toBe('1')
    expect(positiveString('2.50')).toBe('2.5')
  })

  it('summarises for the run gate and formats the scale', () => {
    expect(toGoalScopeSummary({ ...goalScopeFromApi(PROJECT, CASE)!, functionalUnit: ' 1 bracket ', referenceFlow: '' })).toMatchObject({
      functionalUnit: '1 bracket',
      referenceFlow: 1,
    })
    expect(fmtScale(1)).toBe('1')
    expect(fmtScale(1 / 15)).toBe('0.0667')
    expect(fmtScale(Infinity)).toBe('?')
  })

  it('refuses a reference flow or data basis that is not above 0, and trims what it sends', () => {
    const f = goalScopeFromApi(PROJECT, CASE)!
    expect(goalScopeSave({ ...f, modeledOutput: '0' })).toEqual({ ok: false, error: 'Reference flow and data basis must be numbers above 0.' })
    const plan = goalScopeSave({ ...f, functionalUnit: ' 1 bracket ', referenceFlow: '2', modeledOutput: '4' })
    expect(plan.ok && plan.project).toEqual({ functional_unit: '1 bracket', system_boundary: 'gate-to-gate', goal_statement: 'Compare blanks', boundary_notes: '' })
    expect(plan.ok && plan.case).toEqual({ reference_flow: 2, reference_flow_unit: 'bracket', modeled_output: 4 })
  })
})

describe('useGoalScope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(apiRequest).mockImplementation(async (url: string, init?: any) => {
      if (init?.method === 'PUT') return json({ success: true })
      if (url === '/api/projects/7') return json({ project: PROJECT })
      return json({ case: CASE })
    })
  })

  it('loads, reports the summary, and saves both records', async () => {
    const onChange = vi.fn()
    const onSaved = vi.fn()
    const { result } = renderHook(() => useGoalScope({ projectId: '7', caseId: '10', onChange, onSaved }))
    await waitFor(() => expect(result.current.saved).not.toBeNull())
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ functionalUnit: '1 bracket' }))
    act(() => result.current.toggle())
    expect(result.current.open).toBe(true)
    act(() => result.current.set({ modeledOutput: '4' }))
    await act(async () => result.current.save())
    const puts = vi.mocked(apiRequest).mock.calls.filter(([, i]) => (i as any)?.method === 'PUT').map(([u]) => u)
    expect(puts).toEqual(['/api/projects/7', '/api/cases/10'])
    expect(result.current.open).toBe(false)
    expect(result.current.saved?.modeledOutput).toBe('4')
    expect(onSaved).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('Goal & scope saved')
  })

  it('a viewer is told only the owner can change it; Cancel drops edits', async () => {
    vi.mocked(apiRequest).mockImplementation(async (url: string, init?: any) => {
      if (init?.method === 'PUT') return json({ error: 'Forbidden' }, 403)
      if (url === '/api/projects/7') return json({ project: PROJECT })
      return json({ case: CASE })
    })
    const { result } = renderHook(() => useGoalScope({ projectId: '7', caseId: '10' }))
    await waitFor(() => expect(result.current.saved).not.toBeNull())
    act(() => result.current.set({ functionalUnit: 'x' }))
    await act(async () => result.current.save())
    expect(toast.error).toHaveBeenCalledWith('Only the project owner can change the study goal & scope.')
    act(() => result.current.cancel())
    expect(result.current.form?.functionalUnit).toBe('1 bracket')
  })

  it('a database without goal & scope reports null and shows nothing', async () => {
    vi.mocked(apiRequest).mockImplementation(async () => json({ project: {}, case: {} }))
    const onChange = vi.fn()
    const { result } = renderHook(() => useGoalScope({ projectId: '7', caseId: '10', onChange }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null))
    expect(result.current.saved).toBeNull()
  })

  it('openSignal opens the editor', async () => {
    const { result, rerender } = renderHook(({ s }) => useGoalScope({ projectId: '7', caseId: '10', openSignal: s }), {
      initialProps: { s: 0 },
    })
    expect(result.current.open).toBe(false)
    rerender({ s: 1 })
    expect(result.current.open).toBe(true)
  })
})
