// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

import { authHeaders, useFlowRowEdit, useFlows, useSubstanceCatalog } from '@/lib/case-editor/use-flows'
import { useAddFlowForm, useAddSubstance } from '@/lib/case-editor/use-add-flow-form'
import { toast } from 'sonner'

const ok = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body })
const flow = (id: number, name: string, substanceId = 30) => ({
  flow_id: id,
  substance_id: substanceId,
  substance_name: name,
  flow_type: 'input',
  quantity: '1.000000',
  unit: 'kg',
})
const SUBSTANCES = [
  { substance_id: 20, substance_name: 'Transport, truck', unit: 'tkm', factor_count: 1 },
  { substance_id: 30, substance_name: 'Steel', unit: 'kg', category: 'material', factor_count: 1 },
  { substance_id: 31, substance_name: 'Aluminium', unit: 'kg', category: 'material', factor_count: 1 },
]

let fetchMock: ReturnType<typeof vi.fn>
const calls = (method: string) => fetchMock.mock.calls.filter(([, i]) => ((i as any)?.method ?? 'GET') === method)

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.setItem('auth_token', 'tok')
  fetchMock = vi.fn(async (url: string, init?: any) => {
    if (/\/api\/components\/\w+\/flows/.test(url) && !init?.method) return ok({ success: true, flows: [flow(1, 'Steel')] })
    if (url.startsWith('/api/substances') && !init?.method) return ok({ success: true, substances: SUBSTANCES })
    if (url === '/api/impact-categories') return ok({ categories: [{ category_name: 'Global Warming', unit: 'kg CO2 eq' }] })
    return ok({ success: true })
  })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('authHeaders', () => {
  it('sends JSON with the stored bearer token', () => {
    expect(authHeaders()).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer tok' })
    localStorage.clear()
    expect(authHeaders()).toEqual({ 'Content-Type': 'application/json' })
  })
})

describe('useFlows (FLOW-6)', () => {
  it('loads the step’s flows with the token and reports them', async () => {
    const seen = vi.fn()
    const { result } = renderHook(() => useFlows('4', seen))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.flows.map((f) => f.substance_name)).toEqual(['Steel'])
    expect(fetchMock).toHaveBeenCalledWith('/api/components/4/flows', { headers: authHeaders() })
    expect(seen).toHaveBeenLastCalledWith(result.current.flows)
  })

  it('a failed load says so', async () => {
    fetchMock.mockImplementation(async () => ok({ error: 'Failed to fetch flows' }, 500))
    const { result } = renderHook(() => useFlows('4'))
    await waitFor(() => expect(result.current.loadError).toBe("Could not load this step's flows (Failed to fetch flows)."))
    fetchMock.mockImplementation(async () => {
      throw new TypeError('offline')
    })
    await act(async () => result.current.loadFlows())
    expect(result.current.loadError).toBe("Could not load this step's flows (network error).")
  })

  it('ignores the response for a step it no longer shows', async () => {
    const resolvers: Record<string, (v: any) => void> = {}
    fetchMock.mockImplementation((url: string) => new Promise((r) => (resolvers[url.split('/')[3]] = r)))
    const { result, rerender } = renderHook(({ id }) => useFlows(id), { initialProps: { id: '1' } })
    await waitFor(() => expect(resolvers['1']).toBeTruthy())
    rerender({ id: '2' })
    await waitFor(() => expect(resolvers['2']).toBeTruthy())
    await act(async () => resolvers['2'](ok({ flows: [flow(2, 'Weld wire')] })))
    await act(async () => resolvers['1'](ok({ flows: [flow(1, 'Paint primer')] })))
    expect(result.current.flows.map((f) => f.substance_name)).toEqual(['Weld wire'])
  })

  it('reloads on lcapix:flows-changed', async () => {
    const { result } = renderHook(() => useFlows('4'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const before = calls('GET').length
    act(() => {
      window.dispatchEvent(new Event('lcapix:flows-changed'))
    })
    await waitFor(() => expect(calls('GET').length).toBe(before + 1))
  })

  it('deletes a flow after asking, then reloads and announces', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const announced = vi.fn()
    window.addEventListener('lcapix:components-changed', announced)
    const { result } = renderHook(() => useFlows('4'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => result.current.deleteFlow(1))
    window.removeEventListener('lcapix:components-changed', announced)
    expect(window.confirm).toHaveBeenCalledWith('Delete the Steel line from this step?')
    expect(calls('DELETE')[0][0]).toBe('/api/flows/1')
    expect(toast.success).toHaveBeenCalledWith('Flow deleted')
    expect(announced).toHaveBeenCalled()
  })

  it('cancelling the question deletes nothing', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { result } = renderHook(() => useFlows('4'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => result.current.deleteFlow(1))
    expect(calls('DELETE')).toHaveLength(0)
  })
})

describe('useFlowRowEdit', () => {
  const setup = () => {
    const loadFlows = vi.fn(async () => {})
    const hook = renderHook(() => useFlowRowEdit({ flows: [flow(1, 'Steel', 30)] as any, substances: SUBSTANCES as any, loadFlows }))
    return { ...hook, loadFlows }
  }

  it('saves a new quantity and unit', async () => {
    const { result, loadFlows } = setup()
    act(() => result.current.startEdit(flow(1, 'Steel', 30) as any))
    act(() => result.current.setEditing({ ...result.current.editing!, qty: '0.6', unit: ' kg ' }))
    await act(async () => result.current.saveEdit())
    const [url, init] = calls('PUT')[0] as any
    expect(url).toBe('/api/flows/1')
    expect(JSON.parse(init.body)).toEqual({ quantity: 0.6, unit: 'kg' })
    expect(toast.success).toHaveBeenCalledWith('Flow updated')
    expect(loadFlows).toHaveBeenCalled()
    expect(result.current.editing).toBeNull()
  })

  it('swaps the material', async () => {
    const { result } = setup()
    act(() => result.current.startEdit(flow(1, 'Steel', 30) as any))
    act(() => result.current.setEditing({ ...result.current.editing!, substanceId: 31 }))
    await act(async () => result.current.saveEdit())
    expect(JSON.parse((calls('PUT')[0][1] as any).body)).toEqual({ quantity: 1, unit: 'kg', substance_id: 31 })
    expect(toast.success).toHaveBeenCalledWith('Swapped to Aluminium')
  })

  it('refuses a quantity that is not a number, and shows a server refusal', async () => {
    const { result } = setup()
    act(() => result.current.startEdit(flow(1, 'Steel', 30) as any))
    act(() => result.current.setEditing({ ...result.current.editing!, qty: '' }))
    await act(async () => result.current.saveEdit())
    expect(toast.error).toHaveBeenCalledWith('Quantity must be a number')
    expect(calls('PUT')).toHaveLength(0)

    fetchMock.mockImplementation(async () => ok({ error: 'Unit kWh cannot be converted to kg' }, 400))
    act(() => result.current.setEditing({ ...result.current.editing!, qty: '2', unit: 'kWh' }))
    await act(async () => result.current.saveEdit())
    expect(toast.error).toHaveBeenCalledWith('Unit kWh cannot be converted to kg')
    expect(result.current.editing).not.toBeNull()
  })
})

describe('useAddFlowForm', () => {
  const setup = () => {
    const loadFlows = vi.fn(async () => {})
    const hook = renderHook(() => useAddFlowForm({ componentId: '4', substances: SUBSTANCES as any, loadFlows }))
    return { ...hook, loadFlows }
  }

  it('posts a flow and resets the form', async () => {
    const { result, loadFlows } = setup()
    act(() => result.current.setAdding(true))
    act(() => result.current.pickSubstance(SUBSTANCES[1] as any))
    act(() => result.current.setQty('3'))
    await act(async () => result.current.saveFlow())
    const [url, init] = calls('POST')[0] as any
    expect(url).toBe('/api/components/4/flows')
    expect(init.headers).toEqual(authHeaders())
    expect(JSON.parse(init.body)).toEqual({ substance_id: 30, flow_type: 'input', quantity: 3, unit: 'kg' })
    expect(toast.success).toHaveBeenCalledWith('Flow added')
    expect(loadFlows).toHaveBeenCalled()
    expect(result.current.adding).toBe(false)
    expect(result.current.substanceId).toBeNull()
  })

  it('a transport leg sets tonne-km and is saved with its mass and distance', async () => {
    const { result } = setup()
    act(() => result.current.pickSubstance(SUBSTANCES[0] as any))
    expect(result.current.isTransportLeg).toBe(true)
    act(() => result.current.setLeg('0.85', '450'))
    expect(result.current.qty).toBe('382.5')
    expect(result.current.unit).toBe('tkm')
    expect(result.current.legInUse).toBe(true)
    await act(async () => result.current.saveFlow())
    expect(JSON.parse((calls('POST')[0][1] as any).body)).toEqual({
      substance_id: 20,
      flow_type: 'input',
      quantity: 382.5,
      unit: 'tkm',
      transport_mass_kg: 850,
      transport_distance_km: 450,
    })
  })

  it('switching substance clears the leg and its tonne-km (TKM-4)', () => {
    const { result } = setup()
    act(() => result.current.pickSubstance(SUBSTANCES[0] as any))
    act(() => result.current.setLeg('2', '100'))
    act(() => result.current.pickSubstance(SUBSTANCES[1] as any))
    expect(result.current.qty).toBe('')
    expect(result.current.legMassT).toBe('')
    expect(result.current.unit).toBe('kg')
  })

  it('a suggestion opens the form pre-filled, quantity blank', () => {
    const { result } = setup()
    act(() => result.current.applySuggestion({ sub: SUBSTANCES[1] as any, dir: 'output', unit: 'g' }))
    expect(result.current.adding).toBe(true)
    expect(result.current.substanceId).toBe(30)
    expect(result.current.search).toBe('Steel')
    expect(result.current.dir).toBe('output')
    expect(result.current.unit).toBe('g')
    expect(result.current.qty).toBe('')
  })

  it('a network error says nothing was saved', async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError('Failed to fetch')
    })
    const { result } = setup()
    act(() => result.current.pickSubstance(SUBSTANCES[1] as any))
    act(() => result.current.setQty('1'))
    await act(async () => result.current.saveFlow())
    expect(toast.error).toHaveBeenCalledWith('Could not add flow (network error). Nothing was saved.')
  })
})

describe('useAddSubstance', () => {
  it('starts from the search, loads categories, posts and hands back the substance', async () => {
    fetchMock.mockImplementation(async (url: string, init?: any) => {
      if (url === '/api/impact-categories') return ok({ categories: [{ category_name: 'Global Warming', unit: 'kg CO2 eq' }] })
      if (url === '/api/substances' && init?.method === 'POST') return ok({ substance: { substance_id: 99, substance_name: 'Cork', unit: 'kg' } }, 201)
      return ok({})
    })
    const onCreated = vi.fn()
    const { result } = renderHook(() => useAddSubstance({ studyMethod: 'CML 2001', onCreated }))
    expect(result.current.newSub.method).toBe('CML 2001')
    act(() => result.current.openAddSubstance('  Cork  '))
    expect(result.current.newSub.name).toBe('Cork')
    await waitFor(() => expect(result.current.impactCategories).toHaveLength(1))
    act(() => result.current.setNewSub({ ...result.current.newSub, factorValue: '1.6', source: 'EPD' }))
    await act(async () => result.current.submitSubstance())
    const post = calls('POST')[0] as any
    expect(JSON.parse(post[1].body)).toEqual({
      name: 'Cork',
      kind: 'input',
      unit: 'kg',
      method: 'CML 2001',
      impactCategory: 'Global Warming',
      factorValue: '1.6',
      source: 'EPD',
      factorUnit: 'kg CO2 eq / kg',
    })
    expect(onCreated).toHaveBeenCalledWith({ substance_id: 99, substance_name: 'Cork', unit: 'kg' }, 'kg')
    expect(result.current.addingSubstance).toBe(false)
    expect(result.current.newSub.name).toBe('')
    expect(result.current.newSub.method).toBe('CML 2001')
  })

  it('keeps the form open with the server error', async () => {
    fetchMock.mockImplementation(async () => ok({ error: 'A substance with that name exists' }, 409))
    const { result } = renderHook(() => useAddSubstance({ onCreated: vi.fn() }))
    act(() => result.current.openAddSubstance('Steel'))
    await act(async () => result.current.submitSubstance())
    expect(result.current.subError).toBe('A substance with that name exists')
    expect(result.current.addingSubstance).toBe(true)
    act(() => result.current.cancelAddSubstance())
    expect(result.current.subError).toBeNull()
  })
})

describe('useSubstanceCatalog', () => {
  it('loads the catalog once and takes new substances', async () => {
    const { result } = renderHook(() => useSubstanceCatalog())
    await waitFor(() => expect(result.current.substances).toHaveLength(3))
    expect(fetchMock).toHaveBeenCalledWith('/api/substances?limit=500', { headers: authHeaders() })
    act(() => result.current.addToCatalog({ substance_id: 99, substance_name: 'Cork' }))
    expect(result.current.substances).toHaveLength(4)
  })
})
