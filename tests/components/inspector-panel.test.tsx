// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { useState } from 'react'

vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }))

import { InspectorPanel, type InspectorEditFormData } from '@/components/lcapix/case/inspector-panel'

const node = (over: Partial<{ id: string; type: any; label: string }> = {}) => ({
  id: '4',
  type: 'Operation' as any,
  label: 'Paint',
  flows: 0,
  cost: 0,
  depth: 1,
  ...over,
})

const FLOWS: Record<string, any[]> = {
  '4': [
    { flow_id: 1, substance_id: 11, substance_name: 'Electricity', flow_type: 'input', quantity: '10.000000', unit: 'kWh' },
  ],
  '5': [],
}

function mockFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const m = /\/api\/components\/(\w+)\/flows/.exec(url)
      if (m) return { ok: true, status: 200, json: async () => ({ success: true, flows: FLOWS[m[1]] ?? [] }) }
      return { ok: true, status: 200, json: async () => ({ success: true, substances: [] }) }
    }),
  )
}

/** A controlled inspector, like the case editor page. */
function Harness({
  initial,
  n = node(),
  onChangeSpy,
  onSave,
}: {
  initial: InspectorEditFormData
  n?: ReturnType<typeof node>
  onChangeSpy?: (p: Partial<InspectorEditFormData>) => void
  onSave?: () => void
}) {
  const [fd, setFd] = useState<InspectorEditFormData>(initial)
  return (
    <InspectorPanel
      node={n}
      editFormData={fd}
      onChange={(p) => {
        onChangeSpy?.(p)
        setFd((f) => ({ ...f, ...p }))
      }}
      onSave={onSave ?? (() => {})}
    />
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFetch()
})
afterEach(() => vi.unstubAllGlobals())

describe('InspectorPanel labor calculator (EDIT-4)', () => {
  it.each(['Operation', 'Task'])('shows hours × rate on a %s with no labor yet', (type) => {
    render(<Harness initial={{ processName: 'Paint' }} n={node({ type })} />)
    expect(screen.getByText('Labor = hours × rate')).toBeInTheDocument()
  })
})

describe('InspectorPanel suggest costs (EDIT-3)', () => {
  it('costs the step from its live flows', async () => {
    render(<Harness initial={{ processName: 'Paint' }} />)
    await screen.findByText('Electricity')
    await act(async () => {}) // let the loaded flows reach the strip
    fireEvent.click(screen.getByRole('button', { name: 'Suggest' }))
    expect(await screen.findByText(/^Energy: 10 kWh/)).toBeInTheDocument()
  })

  it('costs labor from the hours entered', async () => {
    render(<Harness initial={{ processName: 'Paint', laborHours: 2 }} />)
    await screen.findByText('Electricity')
    fireEvent.click(screen.getByRole('button', { name: 'Suggest' }))
    expect(await screen.findByText(/^Labor: 2 h/)).toBeInTheDocument()
  })
})

describe('InspectorPanel number inputs (EDIT-5)', () => {
  const laborInput = () => screen.getByLabelText('Labor cost') as HTMLInputElement

  it('keeps "12." while typing and reports 12', () => {
    const spy = vi.fn()
    render(<Harness initial={{ processName: 'Paint' }} onChangeSpy={spy} />)
    fireEvent.change(laborInput(), { target: { value: '12.' } })
    expect(laborInput().value).toBe('12.')
    expect(spy).toHaveBeenLastCalledWith({ laborCost: 12 })
  })

  it('lets 0.5 be typed one character at a time', () => {
    const spy = vi.fn()
    render(<Harness initial={{ processName: 'Paint' }} onChangeSpy={spy} />)
    for (const v of ['0', '0.', '0.5']) fireEvent.change(laborInput(), { target: { value: v } })
    expect(laborInput().value).toBe('0.5')
    expect(spy).toHaveBeenLastCalledWith({ laborCost: 0.5 })
  })

  it('accepts 0 as a real cost, and empty as unknown', () => {
    const spy = vi.fn()
    render(<Harness initial={{ processName: 'Paint', laborCost: 5 }} onChangeSpy={spy} />)
    fireEvent.change(laborInput(), { target: { value: '0' } })
    expect(spy).toHaveBeenLastCalledWith({ laborCost: 0 })
    fireEvent.change(laborInput(), { target: { value: '' } })
    expect(spy).toHaveBeenLastCalledWith({ laborCost: undefined })
  })

  it('shows an inline message for text that is not a number, and blocks Save', () => {
    const onSave = vi.fn()
    render(<Harness initial={{ processName: 'Paint' }} onSave={onSave} />)
    fireEvent.change(laborInput(), { target: { value: 'abc' } })
    expect(laborInput().value).toBe('abc')
    expect(screen.getByText(/not a number/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('the product quantity (data basis) must be above 0', () => {
    const onSave = vi.fn()
    render(
      <Harness
        initial={{ processName: 'Bracket', mass: 1, massUnit: 'unit' }}
        n={node({ id: '1', type: 'Product', label: 'Bracket' })}
        onSave={onSave}
      />,
    )
    const qty = screen.getByLabelText('Product quantity') as HTMLInputElement
    fireEvent.change(qty, { target: { value: '2.' } })
    expect(qty.value).toBe('2.')
    fireEvent.change(qty, { target: { value: '0' } })
    expect(screen.getByText(/above 0/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows a value applied from elsewhere (not a stale draft)', () => {
    const { rerender } = render(<InspectorPanel node={node()} editFormData={{ laborCost: 3 }} onChange={() => {}} onSave={() => {}} />)
    rerender(<InspectorPanel node={node()} editFormData={{ laborCost: 30 }} onChange={() => {}} onSave={() => {}} />)
    expect(laborInput().value).toBe('30')
  })
})

describe('InspectorPanel flows editor per step (FLOW-6)', () => {
  it('a half-filled add form does not carry over to another step', async () => {
    const { rerender } = render(
      <InspectorPanel node={node()} editFormData={{ processName: 'Paint' }} onChange={() => {}} onSave={() => {}} />,
    )
    await screen.findByText('Electricity')
    fireEvent.click(screen.getByRole('button', { name: /Add flow/ }))
    expect(screen.getByPlaceholderText('Search substances…')).toBeInTheDocument()
    rerender(
      <InspectorPanel
        node={node({ id: '5', label: 'Weld' })}
        editFormData={{ processName: 'Weld' }}
        onChange={() => {}}
        onSave={() => {}}
      />,
    )
    await waitFor(() => expect(screen.queryByText('Electricity')).toBeNull())
    expect(screen.queryByPlaceholderText('Search substances…')).toBeNull()
  })
})
