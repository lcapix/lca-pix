// @vitest-environment jsdom
/**
 * The amount box (Inventory, E04) saves what is in it when Enter is pressed,
 * even when React has not re-rendered since the change: a fast typist, an
 * autofill, or WebKit's event timing can send the change and the Enter
 * together. Saving the state then would send the old amount, or nothing
 * (found by the walkthrough journey in WebKit, stage 11.1).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { InventoryTab } from '@/components/lcapix/workspace/inventory-tab'

const puts: Array<{ url: string; body: any }> = []
vi.mock('@/lib/api-client', () => ({
  apiRequest: vi.fn(async (url: string, init?: any) => {
    if (init?.method === 'PUT') puts.push({ url, body: JSON.parse(init.body) })
    return { ok: true, status: 200, json: async () => ({ lines: [], success: true }) }
  }),
}))
vi.mock('@/lib/case-editor/use-flows', () => ({
  announceComponentsChanged: vi.fn(),
  useSubstanceCatalog: () => ({ substances: [], addToCatalog: vi.fn() }),
}))
vi.mock('@/lib/shell/use-shell', () => ({ useGuidedMode: () => [false, vi.fn()] }))

const steps = [
  { id: 1, parentId: null, name: 'Painted steel bracket', tier: 'product' },
  { id: 2, parentId: 1, name: 'Deburr edges', tier: 'elemental_task' },
] as any

const inventory = {
  method: 'TRACI 2.1',
  region: 'US',
  rows: [
    {
      flow_id: 41, component_id: 2, substance_id: 9, substance: 'Electricity', direction: 'input', amount: 0.0013, unit: 'kWh',
      substance_unit: 'kWh', note: null, status: 'counted',
      climate: { category_id: 1, factor: 0.35, unit: 'kg CO2 eq', impact: 0.000455, conversion: null, scope: 'US', source: 'EPA eGRID 2023', tag: 'regional' },
    },
  ],
  counts: { all: 1, counted: 1, no_factor: 0, needs_amount: 0, left_out: 0 },
  climate: { value: 0.000455, unit: 'kg CO2 eq' },
  steps: [{ component_id: 2, climate: 0.000455 }],
  latest_run: null,
} as any

/** Puts text in the box the way a browser does before React handles the input event. */
function typeUnseen(box: HTMLInputElement, text: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(box, text)
}

describe('the amount box', () => {
  beforeEach(() => {
    puts.length = 0
  })

  it('Enter saves the cleared box (no amount), even before React saw the change', async () => {
    render(<InventoryTab caseId={5} steps={steps} inventory={inventory} readOnly={false} onOpenInsights={() => {}} />)
    const box = screen.getByRole('textbox', { name: 'Electricity' }) as HTMLInputElement
    expect(box.value).toBe('0.0013')
    typeUnseen(box, '')
    fireEvent.keyDown(box, { key: 'Enter' })
    await waitFor(() => expect(puts).toEqual([{ url: '/api/flows/41', body: { quantity: null } }]))
  })

  it('blur saves a new amount the same way', async () => {
    render(<InventoryTab caseId={5} steps={steps} inventory={inventory} readOnly={false} onOpenInsights={() => {}} />)
    const box = screen.getByRole('textbox', { name: 'Electricity' }) as HTMLInputElement
    typeUnseen(box, '0.002')
    fireEvent.blur(box)
    await waitFor(() => expect(puts).toEqual([{ url: '/api/flows/41', body: { quantity: 0.002 } }]))
  })
})
