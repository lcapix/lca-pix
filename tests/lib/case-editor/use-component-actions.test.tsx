// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useState } from 'react'

vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
const store = { updateComponentNode: vi.fn(), deleteComponentNode: vi.fn() }
vi.mock('@/lib/store', async (orig) => ({ ...(await orig<any>()), useProjectStore: () => store }))

import { useComponentActions } from '@/lib/case-editor/use-component-actions'
import { useEditForm } from '@/lib/case-editor/use-edit-form'
import { transformComponentFromDB } from '@/lib/data-transformers'
import { apiRequest } from '@/lib/api-client'
import { toast } from 'sonner'

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) }) as any

const row = (id: number, type: string, parent: number | null, name: string, quantity = '1.000000') =>
  ({ component_id: id, case_id: 10, parent_component_id: parent, component_type: type, component_name: name, quantity, unit: 'unit' })

let rows: any[]
const router = { push: vi.fn() }
const refresh = vi.fn()

function setup(initialSelected: string | null) {
  const components = rows.map(transformComponentFromDB)
  const reloadComponents = vi.fn(async () => rows.map(transformComponentFromDB))
  const hook = renderHook(() => {
    const form = useEditForm()
    const [selectedNode, setSelectedNode] = useState<string | null>(initialSelected)
    const actions = useComponentActions({
      projectId: '7',
      caseId: '10',
      router,
      components,
      selectedNode,
      setSelectedNode,
      selectedComponent: components.find((c) => c.id === selectedNode) ?? null,
      form,
      reloadComponents,
      refresh,
    })
    return { form, actions, selectedNode }
  })
  const select = (id: string) => act(() => hook.result.current.form.loadFormFor(components.find((c) => c.id === id)!))
  if (initialSelected) select(initialSelected)
  return { ...hook, reloadComponents, select }
}

const calls = (method: string) =>
  vi.mocked(apiRequest).mock.calls.filter(([, i]) => ((i as any)?.method ?? 'GET') === method)

beforeEach(() => {
  vi.clearAllMocks()
  rows = [row(1, 'product', null, 'Bracket'), row(2, 'operation', 1, 'Cut'), row(3, 'elemental_task', 2, 'Deburr'), row(4, 'operation', 1, 'Paint')]
  vi.mocked(apiRequest).mockImplementation(async (url: string, init?: any) => {
    if (init?.method === 'PUT') return json({ success: true, component: {} })
    if (url === '/api/cases/10/scale') return json({ success: true, flows_scaled: 3 })
    if (init?.method === 'DELETE') return json({ success: true })
    return json({ success: true })
  })
})
afterEach(() => vi.restoreAllMocks())

describe('handleSaveComponent', () => {
  it('refuses a step with no parent, with the same message', async () => {
    const { result } = setup('2')
    act(() => result.current.form.patchForm({ parentId: undefined }))
    await act(async () => result.current.actions.handleSaveComponent())
    expect(toast.error).toHaveBeenCalledWith('Every step needs a parent. Pick one under Placement (only the product has none).')
    expect(calls('PUT')).toHaveLength(0)
  })

  it('PUTs the form, reloads the tree and refills the form from what was saved', async () => {
    const { result, reloadComponents } = setup('2')
    act(() => result.current.form.patchForm({ processName: 'Cut blank', laborCost: 0 }))
    rows = rows.map((r) => (r.component_id === 2 ? { ...r, component_name: 'Cut blank', labor_cost: '0.00' } : r))
    await act(async () => result.current.actions.handleSaveComponent())
    const [url, init] = calls('PUT')[0] as any
    expect(url).toBe('/api/components/2')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body)).toMatchObject({ component_name: 'Cut blank', labor_cost: 0, parent_component_id: 1 })
    expect(reloadComponents).toHaveBeenCalled()
    expect(result.current.form.editFormData.processName).toBe('Cut blank')
    expect(toast.success).toHaveBeenCalledWith('Component updated successfully')
  })

  it('a failed PUT shows the server error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(apiRequest).mockImplementation(async () => json({ success: false, error: 'Name too long' }))
    const { result } = setup('2')
    await act(async () => result.current.actions.handleSaveComponent())
    expect(toast.error).toHaveBeenCalledWith('Name too long')
  })

  it('an override is saved without waiting for the form (Apply & save)', async () => {
    const { result } = setup('2')
    await act(async () => result.current.actions.handleApplyCosts({ energyCost: 4.5 }))
    expect(JSON.parse((calls('PUT')[0][1] as any).body).energy_cost).toBe(4.5)
  })
})

describe('rescale (product quantity)', () => {
  it('asks first, then scales and saves the new quantity', async () => {
    const { result } = setup('1')
    act(() => result.current.form.patchForm({ mass: 4 }))
    await act(async () => result.current.actions.handleSaveComponent())
    expect(calls('PUT')).toHaveLength(0)
    expect(result.current.actions.pendingScale).toMatchObject({ from: 1, to: 4 })

    const flowsChanged = vi.fn()
    window.addEventListener('lcapix:flows-changed', flowsChanged)
    await act(async () => result.current.actions.applyScale('scale-inputs'))
    window.removeEventListener('lcapix:flows-changed', flowsChanged)

    const scale = vi.mocked(apiRequest).mock.calls.find(([u]) => u === '/api/cases/10/scale')!
    expect(JSON.parse((scale[1] as any).body)).toEqual({ from: 1, to: 4, mode: 'scale-inputs' })
    expect(toast.success).toHaveBeenCalledWith('Scaled 3 inputs/outputs and every per-unit cost ×4 to 4 units')
    expect(JSON.parse((calls('PUT')[0][1] as any).body).quantity).toBe(4)
    expect(flowsChanged).toHaveBeenCalled()
    expect(refresh).toHaveBeenCalled()
    expect(result.current.actions.pendingScale).toBeNull()
  })

  it('Cancel puts the saved quantity back', async () => {
    const { result } = setup('1')
    act(() => result.current.form.patchForm({ mass: 4 }))
    await act(async () => result.current.actions.handleSaveComponent())
    act(() => result.current.actions.cancelScale())
    expect(result.current.form.editFormData.mass).toBe(1)
    expect(result.current.actions.pendingScale).toBeNull()
  })
})

describe('handleDeleteSelected (EDIT-1)', () => {
  it('deletes a leaf, updates the local cache and clears the selection', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { result } = setup('4')
    await act(async () => result.current.actions.handleDeleteSelected())
    expect(calls('DELETE').map(([u]) => u)).toEqual(['/api/components/4?children=delete'])
    expect(store.deleteComponentNode).toHaveBeenCalledWith('4')
    expect(toast.success).toHaveBeenCalledWith('Deleted "Paint"')
    expect(result.current.selectedNode).toBeNull()
    expect(result.current.form.isEditing).toBe(false)
    expect(result.current.form.editFormData).toEqual({})
    expect(refresh).toHaveBeenCalled()
  })

  it('keeping the children moves them up in the local cache', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    const { result } = setup('2')
    await act(async () => result.current.actions.handleDeleteSelected())
    expect(calls('DELETE').map(([u]) => u)).toEqual(['/api/components/2?children=reparent'])
    expect(store.updateComponentNode).toHaveBeenCalledWith('3', { parentId: '1' })
    expect(store.deleteComponentNode).toHaveBeenCalledWith('2')
  })

  it('a server error keeps the node and says why', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(apiRequest).mockImplementation(async () => json({ error: 'Failed to delete component' }, 500))
    const { result } = setup('4')
    await act(async () => result.current.actions.handleDeleteSelected())
    expect(toast.error).toHaveBeenCalledWith('Failed to delete component')
    expect(store.deleteComponentNode).not.toHaveBeenCalled()
    expect(result.current.selectedNode).toBe('4')
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('create and goal & scope', () => {
  it('Add Component opens /component/new under the selected node', () => {
    const { result } = setup('1')
    act(() => result.current.actions.handleCreateComponent())
    expect(router.push).toHaveBeenCalledWith('/project/7/case/10/component/new?parent=1&type=machine_line')
  })

  it('after Goal & scope saves, an open product form takes the new quantity (EDIT-8)', async () => {
    const { result } = setup('1')
    rows = rows.map((r) => (r.component_id === 1 ? { ...r, quantity: '4.000000' } : r))
    await act(async () => result.current.actions.handleGoalScopeSaved())
    await waitFor(() => expect(result.current.form.editFormData.mass).toBe(4))
  })
})
