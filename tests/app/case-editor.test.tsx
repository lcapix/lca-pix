// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'

const push = vi.fn()
// Stable, like Next's router (the page lists it as an effect dependency).
const router = { push, back: vi.fn(), replace: vi.fn() }
let search = ''
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useParams: () => ({ projectId: '7', caseId: '10' }),
  useSearchParams: () => new URLSearchParams(search),
}))
vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock('@/components/lcapix/case', async (orig) => ({
  ...(await orig<any>()),
  TreeCanvas: () => null,
  NodeDetailsStrip: () => null,
}))
vi.mock('@/components/lcapix/case/environmental-flows-editor', () => ({
  EnvironmentalFlowsEditor: () => null,
}))
vi.mock('@/components/lcapix/case/reference-pane', () => ({ ReferencePane: () => null }))
vi.mock('@/components/lcapix/case/lesson-rail', () => ({ LessonRail: () => null }))
// Goal & scope: report a set functional unit, and expose the save callback.
vi.mock('@/components/lcapix/case/goal-scope-card', () => ({
  GoalScopeCard: ({ onChange, onSaved }: any) => {
    const React = require('react')
    React.useEffect(() => {
      onChange?.({ functionalUnit: '1 bracket', systemBoundary: 'cradle-to-gate', referenceFlow: 1, referenceFlowUnit: 'bracket', modeledOutput: 1 })
    }, [])
    return React.createElement('button', { type: 'button', onClick: () => onSaved?.() }, 'stub: save data basis')
  },
}))

import CaseViewPage from '@/app/project/[projectId]/case/[caseId]/page'
import { apiRequest } from '@/lib/api-client'
import { toast } from 'sonner'

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) }) as any

type Comp = Record<string, any>
const base = (): Comp[] => [
  { component_id: 1, case_id: 10, parent_component_id: null, component_type: 'product', component_name: 'Bracket', quantity: '1.000000', unit: 'unit' },
  { component_id: 2, case_id: 10, parent_component_id: 1, component_type: 'operation', component_name: 'Cut', quantity: '1.000000', unit: 'unit', life_cycle_stage: 'use', labor_cost: '5.00' },
  { component_id: 3, case_id: 10, parent_component_id: 2, component_type: 'elemental_task', component_name: 'Deburr', quantity: '1.000000', unit: 'unit' },
  { component_id: 4, case_id: 10, parent_component_id: 1, component_type: 'operation', component_name: 'Paint', quantity: '1.000000', unit: 'unit', labor_cost: '2.00' },
]

let components: Comp[]
let componentsGets: number
let componentsHandler: ((init: any) => Promise<any>) | null
let deleteStatus: number
let blsResolve: ((v: any) => void) | null

function routeApi() {
  vi.mocked(apiRequest).mockImplementation(async (url: string, init?: any) => {
    const method = init?.method ?? 'GET'
    if (url === '/api/cases/10' && method === 'GET') {
      return json({ success: true, case: { case_id: 10, project_id: 7, case_name: 'Base', case_type: 'base', interpretation: '' } })
    }
    if (url === '/api/cases/10/components' && method === 'GET') {
      componentsGets++
      if (componentsHandler) return componentsHandler(init)
      return json({ success: true, components: components.map((c) => ({ ...c })) })
    }
    if (url.startsWith('/api/components/') && method === 'DELETE') {
      if (deleteStatus >= 400) return json({ error: 'Failed to delete component' }, deleteStatus)
      const id = Number(url.split('/')[3].split('?')[0])
      const mode = new URL('http://x' + url).searchParams.get('children')
      if (mode === 'reparent') {
        const gone = components.find((c) => c.component_id === id)!
        components = components
          .filter((c) => c.component_id !== id)
          .map((c) => (c.parent_component_id === id ? { ...c, parent_component_id: gone.parent_component_id } : c))
      } else {
        const drop = new Set([id])
        let grew = true
        while (grew) {
          grew = false
          for (const c of components) if (drop.has(c.parent_component_id) && !drop.has(c.component_id)) { drop.add(c.component_id); grew = true }
        }
        components = components.filter((c) => !drop.has(c.component_id))
      }
      return json({ success: true })
    }
    if (url.startsWith('/api/components/') && method === 'PUT') {
      return json({ success: true, component: {} })
    }
    if (url === '/api/integrations/bls/fetch-wage') {
      return new Promise((resolve) => {
        blsResolve = (v) => resolve(json(v))
      })
    }
    if (url === '/api/projects/7') return json({ success: true, project: { project_name: 'P', lcia_method: 'TRACI 2.1' } })
    if (url === '/api/cases/10/completeness') return json({ success: true, report: { present: ['materials'], missing: [], score: 1 } })
    return json({ success: true })
  })
}

async function renderEditor() {
  render(<CaseViewPage />)
  // The product is auto-selected once the case loads.
  await screen.findByDisplayValue('Bracket')
}

const selectNode = (name: string) => {
  const aside = document.querySelector('.case-sidebar') as HTMLElement
  fireEvent.click(within(aside).getByRole('button', { name: new RegExp(name) }))
}

const deletes = () =>
  vi.mocked(apiRequest).mock.calls.filter(([, init]) => (init as any)?.method === 'DELETE').map(([u]) => u)

beforeEach(() => {
  vi.clearAllMocks()
  search = ''
  components = base()
  componentsGets = 0
  componentsHandler = null
  deleteStatus = 200
  blsResolve = null
  routeApi()
})
afterEach(() => vi.restoreAllMocks())

describe('Case editor delete (EDIT-1)', () => {
  it('deletes a leaf on the server and refetches', async () => {
    await renderEditor()
    selectNode('Paint')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const before = componentsGets
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(deletes()).toEqual(['/api/components/4?children=delete']))
    await waitFor(() => expect(componentsGets).toBeGreaterThan(before))
    await waitFor(() => {
      const aside = document.querySelector('.case-sidebar') as HTMLElement
      expect(within(aside).queryByRole('button', { name: /Paint/ })).toBeNull()
    })
  })

  it('does nothing when the only prompt is cancelled', async () => {
    await renderEditor()
    selectNode('Paint')
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await new Promise((r) => setTimeout(r, 20))
    expect(deletes()).toEqual([])
  })

  it('OK on the first prompt deletes the step and everything under it', async () => {
    await renderEditor()
    selectNode('Cut')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(true)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(deletes()).toEqual(['/api/components/2?children=delete']))
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('Cancel then OK keeps the children by moving them up', async () => {
    await renderEditor()
    selectNode('Cut')
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(deletes()).toEqual(['/api/components/2?children=reparent']))
    await waitFor(() => {
      const aside = document.querySelector('.case-sidebar') as HTMLElement
      expect(within(aside).getByRole('button', { name: /Deburr/ })).toBeInTheDocument()
      expect(within(aside).queryByRole('button', { name: /Cut/ })).toBeNull()
    })
  })

  it('Cancel on both prompts performs no action', async () => {
    await renderEditor()
    selectNode('Cut')
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await new Promise((r) => setTimeout(r, 20))
    expect(deletes()).toEqual([])
  })

  it('on a server error shows an error toast and keeps the node', async () => {
    deleteStatus = 500
    await renderEditor()
    selectNode('Paint')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(vi.mocked(toast.error)).toHaveBeenCalled())
    expect(vi.mocked(toast.success)).not.toHaveBeenCalledWith(expect.stringMatching(/deleted/i))
    const aside = document.querySelector('.case-sidebar') as HTMLElement
    expect(within(aside).getByRole('button', { name: /Paint/ })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Paint')).toBeInTheDocument()
  })
})

describe('Case editor life-cycle stage (EDIT-2)', () => {
  it('loads the saved stage and sends the chosen one on Save', async () => {
    await renderEditor()
    selectNode('Cut')
    fireEvent.click(screen.getByRole('button', { name: /Life-cycle stage/ }))
    const select = screen.getByTitle(/Which stage of the product's life/) as HTMLSelectElement
    expect(select.value).toBe('use')
    fireEvent.change(select, { target: { value: 'distribution' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      const put = vi.mocked(apiRequest).mock.calls.find(([u, i]) => u === '/api/components/2' && (i as any)?.method === 'PUT')
      expect(put).toBeTruthy()
      expect(JSON.parse((put![1] as any).body).life_cycle_stage).toBe('distribution')
    })
  })
})

describe('Case editor refetch (EDIT-6)', () => {
  it('keeps the editor mounted during a background refetch', async () => {
    await renderEditor()
    let release!: () => void
    componentsHandler = () =>
      new Promise((resolve) => {
        release = () => resolve(json({ success: true, components: components.map((c) => ({ ...c })) }))
      })
    act(() => {
      window.dispatchEvent(new Event('lcapix:components-changed'))
    })
    await waitFor(() => expect(componentsGets).toBeGreaterThan(1))
    expect(screen.queryByText(/Loading case/)).toBeNull()
    expect(screen.getByDisplayValue('Bracket')).toBeInTheDocument()
    await act(async () => release())
  })

  it('a slower, older response never overwrites a newer one', async () => {
    await renderEditor()
    const pending: Array<(names: string) => void> = []
    componentsHandler = (init) =>
      new Promise((resolve, reject) => {
        init?.signal?.addEventListener?.('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
        pending.push((name) =>
          resolve(json({ success: true, components: components.map((c) => (c.component_id === 4 ? { ...c, component_name: name } : { ...c })) })),
        )
      })
    act(() => {
      window.dispatchEvent(new Event('lcapix:components-changed'))
    })
    await waitFor(() => expect(pending.length).toBe(1))
    act(() => {
      window.dispatchEvent(new Event('lcapix:components-changed'))
    })
    await waitFor(() => expect(pending.length).toBe(2))
    await act(async () => pending[1]('Paint (new)'))
    await act(async () => pending[0]('Paint (old)'))
    const aside = document.querySelector('.case-sidebar') as HTMLElement
    await waitFor(() => expect(within(aside).getByRole('button', { name: /Paint \(new\)/ })).toBeInTheDocument())
    expect(within(aside).queryByRole('button', { name: /Paint \(old\)/ })).toBeNull()
  })
})

describe('Case editor async edits (EDIT-7)', () => {
  it('a wage lookup that lands late does not undo edits typed meanwhile', async () => {
    await renderEditor()
    selectNode('Paint')
    fireEvent.change(screen.getByLabelText('Wage location'), { target: { value: 'CA' } })
    await waitFor(() => expect(blsResolve).toBeTruthy())
    fireEvent.change(screen.getByDisplayValue('Paint'), { target: { value: 'Powder coat' } })
    await act(async () => blsResolve!({ success: true, rate: { rateValue: 30, source: 'BLS' } }))
    expect(screen.getByDisplayValue('Powder coat')).toBeInTheDocument()
  })
})

describe('Case editor data basis (EDIT-8)', () => {
  it('after Goal & scope saves the data basis, a product Save sends the new quantity', async () => {
    await renderEditor()
    // The server now holds 4 (the case PUT synced the product quantity).
    components = components.map((c) => (c.component_id === 1 ? { ...c, quantity: '4.000000' } : c))
    fireEvent.click(screen.getByRole('button', { name: 'stub: save data basis' }))
    await waitFor(() => expect(screen.getByDisplayValue('4')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      const put = vi.mocked(apiRequest).mock.calls.find(([u, i]) => u === '/api/components/1' && (i as any)?.method === 'PUT')
      expect(put).toBeTruthy()
      expect(JSON.parse((put![1] as any).body).quantity).toBe(4)
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('Case editor deep link by id (FLOW-8)', () => {
  it('?componentId=<id> selects that step on load', async () => {
    search = 'componentId=4'
    render(<CaseViewPage />)
    expect(await screen.findByDisplayValue('Paint')).toBeInTheDocument()
  })
})

describe('Case editor ?duplicate=1 (RES-6)', () => {
  it('opens the Duplicate dialog once the case loads and drops the param from the URL', async () => {
    search = 'duplicate=1&componentId=4'
    render(<CaseViewPage />)
    const dialog = await screen.findByRole('dialog', { name: 'Duplicate this case' })
    expect(within(dialog).getByDisplayValue('Base (copy)')).toBeInTheDocument()
    // Other params survive; a reload or Back does not reopen the dialog.
    expect(router.replace).toHaveBeenCalledWith('/project/7/case/10?componentId=4', { scroll: false })
  })

  it('opens it only once even if the case is refetched', async () => {
    search = 'duplicate=1'
    render(<CaseViewPage />)
    const dialog = await screen.findByRole('dialog', { name: 'Duplicate this case' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Duplicate this case' })).not.toBeInTheDocument())
    act(() => {
      window.dispatchEvent(new Event('lcapix:components-changed'))
    })
    await waitFor(() => expect(componentsGets).toBeGreaterThan(1))
    expect(screen.queryByRole('dialog', { name: 'Duplicate this case' })).not.toBeInTheDocument()
    expect(router.replace).toHaveBeenCalledTimes(1)
  })

  it('does not open the dialog without the param', async () => {
    await renderEditor()
    expect(screen.queryByRole('dialog', { name: 'Duplicate this case' })).not.toBeInTheDocument()
    expect(router.replace).not.toHaveBeenCalled()
  })
})
