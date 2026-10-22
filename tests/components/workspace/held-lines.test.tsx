// @vitest-environment jsdom
/**
 * Lines held from a file, in the Inventory tab (E12's "Fix"): the line with
 * why it was held; its step picked from the name the file gives; "Put on the
 * step" sends the step and the chosen substance; Dismiss sends dismiss; a
 * "Can read" member sees the lines with no actions.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HeldLines } from '@/components/lcapix/workspace/held-lines'

const calls: Array<{ url: string; init?: any }> = []
let held = [
  { held_id: 7, line_kind: 'flow', reason: 'no_substance', reason_text: 'no confirmed substance match', step_name: '10. Cut tube', substance_text: 'End caps (nylon)', substance_id: null, substance_name: null, direction: 'input', quantity: 0.04, unit: 'kg', cost_category: null, amount: null, provenance: null },
]
vi.mock('@/lib/api-client', () => ({
  apiRequest: vi.fn(async (url: string, init?: any) => {
    calls.push({ url, init })
    if (url.endsWith('/held-lines')) return { ok: true, status: 200, json: async () => ({ lines: held }) }
    held = []
    return { ok: true, status: 200, json: async () => ({ success: true }) }
  }),
}))
vi.mock('@/lib/case-editor/use-flows', () => ({
  announceComponentsChanged: vi.fn(),
  useSubstanceCatalog: () => ({ substances: [{ substance_id: 3, substance_name: 'Nylon 6' }], addToCatalog: vi.fn() }),
}))

const steps = [
  { id: 1, parentId: null, name: 'Bike', tier: 'product' },
  { id: 2, parentId: 1, name: '10. Cut tube', tier: 'operation' },
] as any

describe('held lines', () => {
  beforeEach(() => {
    calls.length = 0
    held = [{ ...held[0] }].filter(Boolean)
  })

  it('puts a held line on the step the file names, with the substance picked', async () => {
    render(<HeldLines caseId={9} steps={steps} readOnly={false} />)
    expect(await screen.findByText('End caps (nylon)')).toBeTruthy()
    expect(screen.getByText(/no confirmed substance match/)).toBeTruthy()
    expect((screen.getByLabelText('Step for End caps (nylon)') as HTMLSelectElement).value).toBe('2')
    fireEvent.change(screen.getByLabelText('Substance for End caps (nylon)'), { target: { value: 'Nylon 6' } })
    fireEvent.click(screen.getByRole('button', { name: 'Put on the step' }))
    await waitFor(() => expect(calls.some((c) => c.url === '/api/held-lines/7')).toBe(true))
    const put = calls.find((c) => c.url === '/api/held-lines/7')!
    expect(JSON.parse(put.init.body)).toEqual({ action: 'resolve', component_id: 2, substance_id: 3 })
  })

  it('a member who can only read sees the line, no actions', async () => {
    held = [{ ...(held[0] ?? {}), held_id: 8, substance_text: 'Gasket' } as any]
    render(<HeldLines caseId={9} steps={steps} readOnly />)
    expect(await screen.findByText('Gasket')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Put on the step' })).toBeNull()
  })
})
