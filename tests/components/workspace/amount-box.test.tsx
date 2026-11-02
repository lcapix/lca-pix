// @vitest-environment jsdom
/**
 * The amount box (Inventory, E04) under her rule (B1, 2026-11-01): Enter,
 * leaving the box and Tab save nothing; only Save stores the amount, and the
 * Saved line says what was stored. A unit change converts the amount in the
 * box (A1: 0.0013 kWh is 1.3 Wh) and Save sends the converted amount with the
 * unit, never the old number relabelled.
 *
 * Earlier this file pinned save-on-Enter and save-on-blur (WebKit stage
 * 11.1); those two tests now check the opposite, by her rule.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { InventoryTab } from '@/components/lcapix/workspace/inventory-tab'
import { resetUnsaved } from '@/lib/workspace/unsaved'

const puts: Array<{ url: string; body: any }> = []
vi.mock('@/lib/api-client', () => ({
  apiRequest: vi.fn(async (url: string, init?: any) => {
    if (init?.method === 'PUT') {
      const body = JSON.parse(init.body)
      puts.push({ url, body })
      return { ok: true, status: 200, json: async () => ({ success: true, flow: { flow_id: 41, substance_name: 'Electricity', quantity: 'quantity' in body ? body.quantity : 0.0013, unit: body.unit ?? 'kWh', flow_type: body.flow_type ?? 'input', component_id: 2 } }) }
    }
    return { ok: true, status: 200, json: async () => ({ lines: [], success: true }) }
  }),
}))
vi.mock('@/lib/case-editor/use-flows', () => ({
  announceComponentsChanged: vi.fn(),
  useSubstanceCatalog: () => ({ substances: [], addToCatalog: vi.fn() }),
  useFlows: () => ({ loadFlows: vi.fn() }),
}))
vi.mock('@/lib/shell/use-shell', () => ({ useGuidedMode: () => [false, vi.fn()] }))

const steps = [
  { id: 1, parentId: null, name: 'Painted steel bracket', tier: 'product', costs: {} },
  { id: 2, parentId: 1, name: 'Deburr edges', tier: 'elemental_task', costs: {} },
] as any

const inventory = {
  method: 'TRACI 2.1',
  region: 'US',
  rows: [
    {
      flow_id: 41, component_id: 2, substance_id: 9, substance: 'Electricity', direction: 'input', amount: 0.0013, unit: 'kWh',
      substance_unit: 'kWh', note: null, status: 'counted',
      climate: { category_id: 1, factor: 0.35, unit: 'kg CO2 eq', impact: 0.000455, conversion: null, scope: 'US', source: 'EPA eGRID 2023', tag: 'regional', per: 'kWh' },
    },
  ],
  counts: { all: 1, counted: 1, no_factor: 0, needs_amount: 0, left_out: 0 },
  climate: { value: 0.000455, unit: 'kg CO2 eq' },
  steps: [{ component_id: 2, climate: 0.000455 }],
  latest_run: null,
} as any

const view = (inv = inventory) => render(<InventoryTab caseId={5} steps={steps} inventory={inv} readOnly={false} onOpenInsights={() => {}} />)
const flowPuts = () => puts.filter((p) => p.url === '/api/flows/41')

describe('the amount box', () => {
  beforeEach(() => {
    puts.length = 0
    resetUnsaved()
  })

  it('Enter, Tab and leaving the box save nothing; Save stores the cleared box (no amount)', async () => {
    view()
    const box = screen.getByRole('textbox', { name: 'Electricity, amount in kWh' }) as HTMLInputElement
    expect(box.value).toBe('0.0013')
    fireEvent.change(box, { target: { value: '' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    fireEvent.keyDown(box, { key: 'Tab' })
    fireEvent.blur(box)
    await new Promise((r) => setTimeout(r, 30))
    expect(flowPuts()).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Save Electricity on Deburr edges' }))
    await waitFor(() => expect(flowPuts()).toEqual([{ url: '/api/flows/41', body: { quantity: null, expected_quantity: 0.0013, expected_unit: 'kWh' } }]))
    expect(await screen.findByText('Saved · Electricity no amount on Deburr edges')).toBeTruthy()
  })

  it('a new amount is saved by Save only, and the Saved line names it', async () => {
    view()
    const box = screen.getByRole('textbox', { name: 'Electricity, amount in kWh' }) as HTMLInputElement
    fireEvent.change(box, { target: { value: '0.002' } })
    fireEvent.blur(box)
    expect(flowPuts()).toEqual([])
    expect(screen.getByText('Not saved yet')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save Electricity on Deburr edges' }))
    await waitFor(() => expect(flowPuts()).toEqual([{ url: '/api/flows/41', body: { quantity: 0.002, expected_quantity: 0.0013, expected_unit: 'kWh' } }]))
    expect(await screen.findByText('Saved · Electricity 0.002 kWh on Deburr edges')).toBeTruthy()
  })

  it('a box left as shown has nothing to save, though it shows a rounded amount', async () => {
    // Review finding: 0.00015 shows as 0.0002; focus and leave must not save 0.0002 (+33%).
    const fine = { ...inventory, rows: inventory.rows.map((r: any) => ({ ...r, amount: 0.00015 })) }
    view(fine)
    const box = screen.getByRole('textbox', { name: 'Electricity, amount in kWh' }) as HTMLInputElement
    fireEvent.focus(box)
    fireEvent.blur(box)
    fireEvent.keyDown(box, { key: 'Enter' })
    await new Promise((r) => setTimeout(r, 30))
    expect(flowPuts()).toEqual([])
    expect(screen.queryByRole('button', { name: 'Save Electricity on Deburr edges' })).toBeNull()
  })

  it('A1 a unit change converts the amount in the box, and Save sends the converted amount with the unit', async () => {
    view()
    fireEvent.change(screen.getByRole('combobox', { name: 'Unit for Electricity' }), { target: { value: 'Wh' } })
    const box = screen.getByRole('textbox', { name: 'Electricity, amount in Wh' }) as HTMLInputElement
    expect(box.value).toBe('1.3')
    expect(screen.getByText('Converted: 0.0013 kWh = 1.3 Wh. Save to keep it.')).toBeTruthy()
    expect(flowPuts()).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Save Electricity on Deburr edges' }))
    await waitFor(() => expect(flowPuts()).toEqual([{ url: '/api/flows/41', body: { quantity: 1.3, unit: 'Wh', expected_quantity: 0.0013, expected_unit: 'kWh' } }]))
    expect(await screen.findByText('Saved · Electricity 1.30 Wh (was 0.0013 kWh) on Deburr edges')).toBeTruthy()
  })

  it('Discard puts the stored amount back and sends nothing', async () => {
    view()
    const box = screen.getByRole('textbox', { name: 'Electricity, amount in kWh' }) as HTMLInputElement
    fireEvent.change(box, { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Discard the changes to Electricity on Deburr edges' }))
    expect(box.value).toBe('0.0013')
    expect(flowPuts()).toEqual([])
  })
})
