// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
const store = { projects: [] as any[], addComponentNode: vi.fn(), updateComponentNode: vi.fn() }
vi.mock('@/lib/store', async (orig) => ({ ...(await orig<any>()), useProjectStore: () => store }))

import { useComponentForm } from '@/lib/case-editor/use-component-form'
import { fetchIntegrationSuggestion, useIntegrationSuggest } from '@/lib/case-editor/integration-suggest'
import { apiRequest } from '@/lib/api-client'
import { toast } from 'sonner'

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as any
const router = { push: vi.fn() }
const ROWS = [
  { component_id: 1, component_name: 'Bracket', component_type: 'product', parent_component_id: null },
  { component_id: 3, component_name: 'Cell', component_type: 'subprocess', parent_component_id: 1 },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(apiRequest).mockImplementation(async (url: string, init?: any) => {
    if (url === '/api/cases/10/components' && !init?.method) return json({ success: true, components: ROWS })
    if (init?.method === 'POST') return json({ success: true, component: { component_id: 9 } }, 201)
    if (init?.method === 'PUT') return json({ success: true })
    return json({ success: true })
  })
})
afterEach(() => vi.unstubAllGlobals())

const render = (over: Record<string, unknown> = {}) =>
  renderHook(() => useComponentForm({ projectId: '7', caseId: '10', mode: 'create', router, ...over } as any))

describe('useComponentForm', () => {
  it('loads the case’s nodes and auto-attaches the only possible parent', async () => {
    const { result } = render()
    await waitFor(() => expect(result.current.processNodes).toHaveLength(2))
    act(() => result.current.handleTypeChange('operation'))
    expect(result.current.formData.parentId).toBe('3')
    expect(result.current.eligibleParents.map((n) => n.id)).toEqual(['1', '3'])
    expect(result.current.disabledTypes).toEqual(['product'])
  })

  it('a parent the user picked is kept', async () => {
    const { result } = render()
    act(() => result.current.handleParentChange('1'))
    act(() => result.current.patchForm({ processType: 'operation' }))
    await waitFor(() => expect(result.current.processNodes).toHaveLength(2))
    expect(result.current.formData.parentId).toBe('1')
  })

  it('shows field errors instead of submitting', async () => {
    const { result } = render()
    await act(async () => result.current.handleSubmit())
    expect(result.current.errors.processType).toBe('Select a process type')
    expect(apiRequest).toHaveBeenCalledTimes(1) // only the component list
    act(() => result.current.handleNameChange('Paint'))
    expect(result.current.errors.processName).toBe('')
  })

  it('creates the component, updates the store and calls onSuccess', async () => {
    const onSuccess = vi.fn()
    const { result } = render({ suggestedParentId: '3', suggestedType: 'operation', onSuccess })
    await waitFor(() => expect(result.current.processNodes).toHaveLength(2))
    expect(result.current.isAddChildMode).toBe(true)
    act(() => result.current.handleNameChange('Paint'))
    await act(async () => result.current.handleSubmit())
    const post = vi.mocked(apiRequest).mock.calls.find(([, i]) => (i as any)?.method === 'POST') as any
    expect(post[0]).toBe('/api/cases/10/components')
    expect(JSON.parse(post[1].body)).toMatchObject({ component_name: 'Paint', component_type: 'operation', parent_component_id: 3 })
    expect(store.addComponentNode).toHaveBeenCalledWith('10', expect.objectContaining({ id: '9', name: 'Paint' }))
    expect(toast.success).toHaveBeenCalledWith('Component created', { description: 'Paint saved to database' })
    expect(onSuccess).toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
  })

  it('edits through PUT and goes back to the case without onSuccess', async () => {
    const { result } = render({ mode: 'edit', initial: { id: '1', type: 'product', name: 'Bracket' } })
    await waitFor(() => expect(result.current.processNodes).toHaveLength(2))
    await act(async () => result.current.handleSubmit())
    const put = vi.mocked(apiRequest).mock.calls.find(([, i]) => (i as any)?.method === 'PUT') as any
    expect(put[0]).toBe('/api/components/1')
    expect(store.updateComponentNode).toHaveBeenCalledWith('1', expect.objectContaining({ name: 'Bracket' }))
    expect(router.push).toHaveBeenCalledWith('/project/7/case/10')
  })

  it('a failed save says so', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(apiRequest).mockImplementation(async (url: string, init?: any) =>
      init?.method === 'POST' ? json({ error: 'nope' }, 400) : json({ success: true, components: [] }),
    )
    const { result } = render({ suggestedType: 'product' })
    act(() => result.current.handleNameChange('Bracket'))
    await act(async () => result.current.handleSubmit())
    expect(toast.error).toHaveBeenCalledWith('Save failed', { description: 'POST /api/cases/10/components → 400' })
    expect(result.current.isSubmitting).toBe(false)
  })
})

describe('integration suggest', () => {
  it('asks BLS and EIA for an operation, with the token, scaled by quantity', async () => {
    localStorage.setItem('auth_token', 'tok')
    const fetchMock = vi.fn(async (url: string) =>
      url.includes('bls') ? json({ rate: { rateValue: 30 } }) : json({ rate: { rateValue: 0.1 } }),
    )
    const r = await fetchIntegrationSuggestion(
      { wants: { labor: true, energy: true, material: false }, nodeName: 'Weld', quantity: 2, region: 'US' },
      fetchMock as any,
    )
    expect(fetchMock.mock.calls[0]).toEqual([
      '/api/integrations/bls/fetch-wage',
      { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' }, body: '{"occupation":"51-4121","state":"US"}' },
    ])
    expect(r.payload).toEqual({ labor: 30, energy: 0.4 })
    expect(r.sources).toEqual(['BLS $30.00/hr × 0.5h × 2', 'EIA $0.100/kWh × 2 kWh × 2'])
    localStorage.clear()
  })

  it('prices the named metal, and falls back offline when nothing answers', async () => {
    const metals = vi.fn(async () => json({ rate: { rateValue: 2.5 } }))
    const r = await fetchIntegrationSuggestion({ wants: { labor: false, energy: false, material: true }, nodeName: 'Copper wire', quantity: 1, region: 'US' }, metals as any)
    expect(JSON.parse((metals.mock.calls[0] as any)[1].body)).toEqual({ symbol: 'XCU' })
    expect(r.payload.material).toBe(2.5)

    const down = vi.fn(async () => json({}, 503))
    const off = await fetchIntegrationSuggestion({ wants: { labor: true, energy: true, material: false }, quantity: 1, region: 'US' }, down as any)
    expect(off.payload).toEqual({ labor: 12, energy: 0.26 })
    expect(off.sources).toEqual(['BLS fallback $24.00/hr × 0.5h × 1', 'EIA fallback $0.130/kWh × 2 kWh × 1'])
  })

  it('the hook shows a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('Failed to fetch')
    }))
    const { result } = renderHook(() => useIntegrationSuggest({ componentType: 'operation', quantity: 1, region: 'US' }))
    await act(async () => result.current.suggest())
    expect(result.current.error).toBe('Failed to fetch')
    expect(result.current.loading).toBe(false)
  })
})
