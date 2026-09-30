// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const router = { push: vi.fn(), back: vi.fn(), replace: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

import { ComponentForm } from '@/components/component-form/component-form'
import { apiRequest } from '@/lib/api-client'

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as any

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(apiRequest).mockImplementation(async (url: string, init?: any) => {
    if (url === '/api/cases/10/components' && !init?.method) return json({ success: true, components: [] })
    if (init?.method === 'POST') return json({ success: true, component: { component_id: 9 } }, 201)
    if (init?.method === 'PUT') return json({ success: true, component: {} })
    return json({ success: true })
  })
})

const sent = (method: string) => {
  const call = vi.mocked(apiRequest).mock.calls.find(([, i]) => (i as any)?.method === method)
  return call ? JSON.parse((call[1] as any).body) : null
}

describe('ComponentForm costs (FLOW-7)', () => {
  it('saves a cost typed as 0 on create', async () => {
    render(<ComponentForm projectId="7" caseId="10" mode="create" suggestedType="product" onSuccess={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('e.g. Cathode Coating'), { target: { value: 'Bracket' } })
    fireEvent.click(screen.getByRole('button', { name: /Costs/ }))
    fireEvent.change(screen.getByLabelText('Labor'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('Energy'), { target: { value: '4.5' } })
    fireEvent.click(screen.getByRole('button', { name: /Create component/ }))
    await waitFor(() => expect(sent('POST')).toBeTruthy())
    expect(sent('POST').labor_cost).toBe(0)
    expect(sent('POST').energy_cost).toBe(4.5)
    // Left blank: unknown, not 0.
    expect(sent('POST').material_cost ?? null).toBeNull()
  })

  it('edits a cost down to 0, and clears a loaded cost when it is emptied', async () => {
    render(
      <ComponentForm
        projectId="7"
        caseId="10"
        mode="edit"
        initial={{ id: '4', type: 'product', name: 'Bracket', laborCost: 12, energyCost: 3 }}
        onSuccess={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Costs/ }))
    fireEvent.change(screen.getByLabelText('Labor'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('Energy'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }))
    await waitFor(() => expect(sent('PUT')).toBeTruthy())
    expect(sent('PUT').labor_cost).toBe(0)
    expect(sent('PUT').energy_cost).toBeNull()
    // A cost the form never loaded is not sent, so it cannot be wiped.
    expect('material_cost' in sent('PUT')).toBe(false)
  })
})
