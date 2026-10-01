// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

import { useCaseData } from '@/lib/case-editor/use-case-data'
import { apiRequest } from '@/lib/api-client'
import { toast } from 'sonner'

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) }) as any

const router = { push: vi.fn() }
const comp = (id: number, name: string, parent: number | null = null) => ({
  component_id: id,
  case_id: 10,
  parent_component_id: parent,
  component_type: parent ? 'operation' : 'product',
  component_name: name,
  quantity: '1.000000',
  unit: 'unit',
})

let components: any[]
let caseHandler: () => Promise<any>
let componentsHandler: ((init: any) => Promise<any>) | null

beforeEach(() => {
  vi.clearAllMocks()
  components = [comp(1, 'Bracket'), comp(2, 'Cut', 1)]
  caseHandler = async () =>
    json({ success: true, case: { case_id: 10, project_id: 7, case_name: 'Base', case_type: 'base', interpretation: 'Steel wins', learning_state: { lesson: 2 } } })
  componentsHandler = null
  vi.mocked(apiRequest).mockImplementation(async (url: string, init?: any) => {
    if (url === '/api/cases/10') return caseHandler()
    if (url === '/api/cases/10/components') {
      if (componentsHandler) return componentsHandler(init)
      return json({ success: true, components: components.map((c) => ({ ...c })) })
    }
    if (url === '/api/projects/7') return json({ success: true, project: { project_name: 'Bracket study', lcia_method: 'TRACI 2.1' } })
    if (url === '/api/projects/7/cases') return json({ cases: [{ case_id: 10, run_count: 1 }, { case_id: 11, run_count: 2 }] })
    if (url === '/api/cases/10/completeness') return json({ success: true, report: { present: ['materials'], missing: [], score: 1 } })
    if (url === '/api/cases/10/assessments')
      return json({
        assessments: [
          { status: 'completed', impacts: { 'Global Warming': 3 }, components: [{ component_name: 'Cut', impacts: { 'Global Warming': 3 } }] },
        ],
      })
    return json({ success: true })
  })
})

const render = () => renderHook(() => useCaseData({ projectId: '7', caseId: '10', router }))

describe('useCaseData', () => {
  it('loads the case, its components and the advisory reads', async () => {
    const { result } = render()
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.currentCase?.name).toBe('Base')
    expect(result.current.components.map((c) => c.name)).toEqual(['Bracket', 'Cut'])
    expect(result.current.currentCase?.components).toHaveLength(2)
    expect(result.current.learningState).toEqual({ lesson: 2 })
    expect(result.current.hasWriteUp).toBe(true)
    await waitFor(() => expect(result.current.projectName).toBe('Bracket study'))
    expect(result.current.studyMethod).toBe('TRACI 2.1')
    expect(result.current.completeness?.present).toEqual(['materials'])
    expect(result.current.hasAssessment).toBe(true)
    expect(result.current.topStep).toBe('Cut')
    expect(result.current.hasComparableCase).toBe(true)
  })

  it('sends a case that is not found back to the project', async () => {
    caseHandler = async () => json({ success: false })
    render()
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/project/7'))
    expect(toast.error).toHaveBeenCalledWith('Case not found')
  })

  it('a failed first load says so and leaves', async () => {
    caseHandler = async () => {
      throw new Error('down')
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = render()
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/project/7'))
    expect(toast.error).toHaveBeenCalledWith('Failed to load case details')
    expect(result.current.isLoading).toBe(false)
  })

  it('refetches in the background on refresh and on lcapix:components-changed (EDIT-6)', async () => {
    const { result } = render()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    components = [...components, comp(3, 'Paint', 1)]
    act(() => result.current.refresh())
    expect(result.current.isLoading).toBe(false)
    await waitFor(() => expect(result.current.components).toHaveLength(3))

    components = components.slice(0, 1)
    act(() => {
      window.dispatchEvent(new Event('lcapix:components-changed'))
    })
    expect(result.current.isLoading).toBe(false)
    await waitFor(() => expect(result.current.components).toHaveLength(1))
  })

  it('a failed background refresh keeps what is on screen', async () => {
    const { result } = render()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    caseHandler = async () => {
      throw new Error('down')
    }
    act(() => result.current.refresh())
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Could not refresh the case. What you see may be out of date.'),
    )
    expect(result.current.components).toHaveLength(2)
    expect(router.push).not.toHaveBeenCalled()
  })

  it('an older, slower components response never overwrites a newer one', async () => {
    const { result } = render()
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const pending: Array<(name: string) => void> = []
    componentsHandler = () =>
      new Promise((resolve) =>
        pending.push((name) => resolve(json({ success: true, components: [comp(1, name)] }))),
      )
    let first!: Promise<any>
    let second!: Promise<any>
    act(() => {
      first = result.current.reloadComponents()
      second = result.current.reloadComponents()
    })
    await act(async () => pending[1]('Newer'))
    await act(async () => pending[0]('Older'))
    expect(await second).toHaveLength(1)
    expect(await first).toBeNull()
    expect(result.current.components[0].name).toBe('Newer')
  })

  it('aborts its requests when it unmounts', async () => {
    const signals: AbortSignal[] = []
    componentsHandler = (init) => {
      signals.push(init.signal)
      return new Promise(() => {})
    }
    const { unmount } = render()
    await waitFor(() => expect(signals).toHaveLength(1))
    unmount()
    expect(signals[0].aborted).toBe(true)
  })
})
