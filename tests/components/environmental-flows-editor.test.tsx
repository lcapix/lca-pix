// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }))

import { EnvironmentalFlowsEditor } from '@/components/lcapix/case/environmental-flows-editor'
import { toast } from 'sonner'

const SUBSTANCES = [
  { substance_id: 20, substance_name: 'Transport, truck', unit: 'tkm', category: 'resource', factor_count: 1, methods_with_factors: 'TRACI 2.1' },
  { substance_id: 21, substance_name: 'Transport, rail', unit: 'tkm', category: 'resource', factor_count: 1, methods_with_factors: 'TRACI 2.1' },
  { substance_id: 30, substance_name: 'Steel', unit: 'kg', category: 'resource', factor_count: 1, methods_with_factors: 'TRACI 2.1' },
]

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body })

type FlowsHandler = (componentId: string) => Promise<any>
let flowsHandler: FlowsHandler
let postHandler: (() => Promise<any>) | null

beforeEach(() => {
  vi.clearAllMocks()
  flowsHandler = async () => ok({ success: true, flows: [] })
  postHandler = null
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: any) => {
      const m = /\/api\/components\/(\w+)\/flows/.exec(url)
      if (m && init?.method === 'POST') return postHandler ? postHandler() : ok({ success: true })
      if (m) return flowsHandler(m[1])
      if (url.startsWith('/api/substances')) return ok({ success: true, substances: SUBSTANCES })
      return ok({ success: true })
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

const flow = (id: number, name: string) => ({
  flow_id: id,
  substance_id: 30,
  substance_name: name,
  flow_type: 'input',
  quantity: '1.000000',
  unit: 'kg',
})

describe('EnvironmentalFlowsEditor loading (FLOW-6)', () => {
  it('ignores a slower response for the step it was showing before', async () => {
    const resolvers: Record<string, (v: any) => void> = {}
    flowsHandler = (id) => new Promise((r) => (resolvers[id] = r))
    const { rerender } = render(<EnvironmentalFlowsEditor componentId="1" />)
    await waitFor(() => expect(resolvers['1']).toBeTruthy())
    rerender(<EnvironmentalFlowsEditor componentId="2" />)
    await waitFor(() => expect(resolvers['2']).toBeTruthy())
    await act(async () => resolvers['2'](ok({ success: true, flows: [flow(2, 'Weld wire')] })))
    await act(async () => resolvers['1'](ok({ success: true, flows: [flow(1, 'Paint primer')] })))
    expect(screen.getByText('Weld wire')).toBeInTheDocument()
    expect(screen.queryByText('Paint primer')).toBeNull()
  })

  it('says the load failed instead of "No flows yet"', async () => {
    flowsHandler = async () => ({ ok: false, status: 500, json: async () => ({ error: 'Failed to fetch flows' }) })
    render(<EnvironmentalFlowsEditor componentId="1" />)
    expect(await screen.findByText(/Could not load/i)).toBeInTheDocument()
    expect(screen.queryByText(/No flows yet/)).toBeNull()
  })

  it('a network error while adding a flow shows an error toast (FLOW-10)', async () => {
    postHandler = async () => {
      throw new TypeError('Failed to fetch')
    }
    render(<EnvironmentalFlowsEditor componentId="1" />)
    await screen.findByText(/No flows yet/)
    fireEvent.click(screen.getByRole('button', { name: /Add flow/ }))
    fireEvent.change(screen.getByPlaceholderText('Search substances…'), { target: { value: 'Steel' } })
    fireEvent.click(await screen.findByText('Steel'))
    fireEvent.change(screen.getByPlaceholderText('0.0'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save flow' }))
    await waitFor(() => expect(vi.mocked(toast.error)).toHaveBeenCalled())
  })
})

describe('EnvironmentalFlowsEditor transport leg (TKM-1 / TKM-2 / TKM-4)', () => {
  async function pickTransport(name = 'Transport, truck') {
    fireEvent.change(screen.getByPlaceholderText('Search substances…'), { target: { value: name.split(',')[1].trim() } })
    fireEvent.click(await screen.findByText(name))
  }
  const mass = () => screen.getByPlaceholderText('e.g. 1.2') as HTMLInputElement
  const km = () => screen.getByPlaceholderText('e.g. 450') as HTMLInputElement
  const qty = () => screen.getByPlaceholderText('0.0') as HTMLInputElement

  beforeEach(async () => {
    render(<EnvironmentalFlowsEditor componentId="1" />)
    await screen.findByText(/No flows yet/)
    fireEvent.click(screen.getByRole('button', { name: /Add flow/ }))
    await pickTransport()
  })

  it('derives tonne-km from mass and distance, read-only while the leg is used', () => {
    fireEvent.change(mass(), { target: { value: '0.85' } })
    fireEvent.change(km(), { target: { value: '450' } })
    expect(qty().value).toBe('382.5')
    expect(qty().readOnly).toBe(true)
  })

  it('clears the quantity when mass or distance is cleared, 0 or negative', () => {
    fireEvent.change(mass(), { target: { value: '2' } })
    fireEvent.change(km(), { target: { value: '100' } })
    expect(qty().value).toBe('200')
    fireEvent.change(km(), { target: { value: '' } })
    expect(qty().value).toBe('')
    fireEvent.change(km(), { target: { value: '-5' } })
    expect(qty().value).toBe('')
    expect(screen.getByRole('button', { name: 'Save flow' })).toBeDisabled()
    fireEvent.change(km(), { target: { value: '100' } })
    fireEvent.change(mass(), { target: { value: '0' } })
    expect(qty().value).toBe('')
  })

  it('does not print float noise (0.1 t × 3 km)', () => {
    fireEvent.change(mass(), { target: { value: '0.1' } })
    fireEvent.change(km(), { target: { value: '3' } })
    expect(qty().value).toBe('0.3')
  })

  it('switching substance resets the leg and its tonne-km', async () => {
    fireEvent.change(mass(), { target: { value: '2' } })
    fireEvent.change(km(), { target: { value: '100' } })
    expect(qty().value).toBe('200')
    fireEvent.change(screen.getByPlaceholderText('Search substances…'), { target: { value: 'Steel' } })
    fireEvent.click(await screen.findByText('Steel'))
    expect(qty().value).toBe('')
    // And back to a transport substance: the leg starts empty.
    await pickTransport('Transport, rail')
    expect(mass().value).toBe('')
    expect(km().value).toBe('')
  })
})
