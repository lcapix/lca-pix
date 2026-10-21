// @vitest-environment jsdom
/**
 * The Cost panel (E14) from the costs route's answer: "$0.55 USD per bracket",
 * "4 of 6 set", labor as hours × rate with its Reference tag, an amount alone
 * with its source once, and a kind not set yet. A "Can read" member gets no
 * editor; someone who can change opens the labor lookup with its five
 * reference occupations. The material cost offers the flows' number (the
 * steel the step uses) with one click; the looked-up energy price is left be.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { CostPanel } from '@/components/lcapix/workspace/cost-panel'

const COSTS = {
  currency: 'USD',
  set: 4,
  of: 6,
  costs: [
    { kind: 'labor', amount: 0.39, basis: { kind: 'labor', amount: 0.39, driver_quantity: 0.015, driver_unit: 'h', rate: 25.83, rate_unit: '$/h', rate_label: 'Welders/cutters', rate_code: '51-4121', region: 'US', source_kind: 'reference', source_name: 'Reference', vintage: '2026-06', lines: null } },
    { kind: 'energy', amount: 0.01, basis: { kind: 'energy', amount: 0.01, driver_quantity: 0.12, driver_unit: 'kWh', rate: 0.0862, rate_unit: '$/kWh', rate_label: 'Electricity', rate_code: 'electricity', region: 'US', source_kind: 'reference', source_name: 'Reference', vintage: '2026-06', lines: null } },
    { kind: 'material', amount: 0.03, basis: null },
    { kind: 'transportation', amount: null, basis: null },
    { kind: 'equipment', amount: null, basis: null },
    { kind: 'overhead', amount: 0.12, basis: { kind: 'overhead', amount: 0.12, driver_quantity: null, driver_unit: null, rate: null, rate_unit: null, rate_label: null, rate_code: null, region: null, source_kind: 'entered', source_name: 'Shop overhead', vintage: null, lines: null } },
  ],
  from_flows: {
    material: {
      kind: 'material',
      amount: 0.76,
      lines: [{ label: 'Steel', quantity: 0.8, unit: 'kg', rate: 0.95, rate_unit: '$/kg', source_kind: 'reference', source_name: 'Steel, hot-rolled', vintage: '2026-06' }],
      noPrice: ['Argon'],
    },
    energy: {
      kind: 'energy',
      amount: 0.2155,
      lines: [{ label: 'Electricity', quantity: 2.5, unit: 'kWh', rate: 0.0862, rate_unit: '$/kWh', source_kind: 'reference', source_name: 'Electricity', vintage: '2026-06' }],
      noPrice: [],
    },
  },
}

const puts: any[] = []
vi.mock('@/lib/api-client', () => ({
  apiRequest: vi.fn(async (_url: string, init?: any) => {
    if (init?.method === 'PUT') puts.push(JSON.parse(init.body))
    return { ok: true, status: 200, json: async () => COSTS }
  }),
}))

const step = { id: 20, parentId: 2, name: '20. Weld tab', type: 'operation', tier: 'operation', level: 4, quantity: null, unit: null, description: null, costs: {}, updated_at: null } as any
const kase = { case_id: 1, project_id: 1, case_name: 'Base case', reference_flow_unit: 'bracket' } as any

describe('Cost panel (E14)', () => {
  beforeEach(() => {
    localStorage.clear()
    puts.length = 0
  })

  it('reads the six kinds the way the design does', async () => {
    render(<CostPanel step={step} kase={kase} readOnly />)
    expect(await screen.findByText('$0.55')).toBeTruthy()
    expect(screen.getByText('USD per bracket')).toBeTruthy()
    expect(screen.getByText('4 of 6 set')).toBeTruthy()
    expect(screen.getByText('0.015 h × $25.83/h · Welders/cutters')).toBeTruthy()
    expect(screen.getAllByText('Reference 2026-06')).toHaveLength(2)
    expect(screen.getByText('0.12 kWh × $0.0862/kWh · Electricity')).toBeTruthy()
    // The source reads once, on its line; the tag says how it was entered.
    expect(screen.getAllByText('Shop overhead')).toHaveLength(1)
    expect(screen.getByText('Entered by hand')).toBeTruthy()
    expect(screen.getAllByText('Not set')).toHaveLength(2)
    // A "Can read" member opens nothing.
    fireEvent.click(screen.getByText('Labor').closest('button')!)
    expect(screen.queryByText('Look up a labor rate')).toBeNull()
  })

  it('someone who can change opens the labor lookup: five reference occupations, welders in use', async () => {
    render(<CostPanel step={step} kase={kase} readOnly={false} />)
    fireEvent.click((await screen.findByText('Labor')).closest('button')!)
    const list = screen.getByRole('list', { name: 'Occupations' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(5)
    expect(within(list).getByText('Welders/cutters · US').closest('li')!.textContent).toContain('In use')
    expect(within(list).getByText('Production worker, average · US')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Find an occupation'), { target: { value: 'weld' } })
    expect(within(list).getAllByRole('listitem')).toHaveLength(1)
  })

  it('a "Can read" member is offered nothing from the flows', async () => {
    render(<CostPanel step={step} kase={kase} readOnly />)
    await screen.findByText('$0.55')
    expect(screen.queryByText(/cost from these flows/)).toBeNull()
  })

  it('material offers the flows\' number with Use it; energy, looked up, is left be; Use it sends mode "flows" only', async () => {
    render(<CostPanel step={step} kase={kase} readOnly={false} />)
    expect(await screen.findByText('Material cost from these flows: $0.76 (now $0.03)')).toBeTruthy()
    expect(screen.queryByText(/Energy cost from these flows/)).toBeNull()
    // A material amount with no basis is not "from the flows": the unpriced argon is taken as in it.
    expect(screen.queryByText(/No price for Argon/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Use the material cost from these flows' }))
    await waitFor(() => expect(puts).toEqual([{ kind: 'material', mode: 'flows' }]))
    expect(await screen.findByText('Saved · material from the flows on 20. Weld tab')).toBeTruthy()
  })

  it('the material sheet shows the flows line by line and names the one with no price', async () => {
    render(<CostPanel step={step} kase={kase} readOnly={false} />)
    fireEvent.click((await screen.findByText('Material')).closest('button')!)
    expect(screen.getByText("From this step's flows")).toBeTruthy()
    expect(screen.getByText('Steel 0.8 kg × $0.95/kg = $0.76')).toBeTruthy()
    expect(screen.getByText('No price for Argon. To count it, enter the whole cost below.')).toBeTruthy()
    // The row's own offer steps aside while the sheet is open.
    expect(screen.queryByText('Material cost from these flows: $0.76 (now $0.03)')).toBeNull()
  })

  it('opens on the kind it is sent to ("add its cost" from the step panel)', async () => {
    render(<CostPanel step={step} kase={kase} readOnly={false} initialOpen="material" />)
    expect(await screen.findByText('Set the material cost')).toBeTruthy()
  })
})
