// @vitest-environment jsdom
/**
 * Phase 1 (silent failures) in the process library: a failed read is not an
 * empty library, and a dropped connection on one line neither hides the lines
 * already added nor stops the rest.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

import { ProcessLibrary } from '@/components/lcapix/case/process-library'
import { apiRequest } from '@/lib/api-client'
import { toast } from 'sonner'

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) }) as any

const line = (id: number, name: string, amount: number) => ({
  template_flow_id: id,
  substance_id: 100 + id,
  substance_hint: null,
  substance_name: name,
  substance_unit: 'kg',
  flow_type: 'input',
  amount_per_driver: amount,
  unit: 'kg',
  note: null,
})
const TEMPLATE = {
  template_id: 1,
  template_name: 'Laser cutting',
  process_family: 'cutting',
  driver_unit: 'm',
  driver_label: 'cut length',
  description: null,
  source_reference: null,
  lines: [line(1, 'Electricity', 2), line(2, 'Nitrogen', 3), line(3, 'Lens wipes', 1)],
}

beforeEach(() => vi.clearAllMocks())

describe('ProcessLibrary', () => {
  it('a failed read says so, not "the library is empty"', async () => {
    vi.mocked(apiRequest).mockResolvedValue(json({ error: 'Failed to load the process library' }, 500))
    render(<ProcessLibrary componentId="4" onAdded={vi.fn()} onClose={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the process library: Failed to load the process library. Close it and try again.',
    )
    expect(screen.queryByText(/The library is empty/)).toBeNull()
  })

  it('a database without the library still says it is empty', async () => {
    vi.mocked(apiRequest).mockResolvedValue(json({ success: true, templates: [] }))
    render(<ProcessLibrary componentId="4" onAdded={vi.fn()} onClose={vi.fn()} />)
    expect(await screen.findByText(/The library is empty/)).toBeInTheDocument()
  })

  it('a dropped connection on one line names it and still reports the lines added', async () => {
    let posts = 0
    vi.mocked(apiRequest).mockImplementation(async (url: string, init?: any) => {
      if (url === '/api/process-templates') return json({ success: true, templates: [TEMPLATE] })
      if (init?.method === 'POST') {
        posts += 1
        if (posts === 2) throw new TypeError('Failed to fetch')
        return json({ success: true }, 201)
      }
      return json({})
    })
    const onAdded = vi.fn()
    const onClose = vi.fn()
    render(<ProcessLibrary componentId="4" initialTemplateId={1} onAdded={onAdded} onClose={onClose} />)
    fireEvent.change(await screen.findByPlaceholderText('e.g. 12 (m)'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add these flows' }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('2 flows added from Laser cutting'))
    // The line after the dropped one was still sent.
    expect(posts).toBe(3)
    expect(toast.error).toHaveBeenCalledWith('Nitrogen: not sent (Failed to fetch)')
    expect(onAdded).toHaveBeenCalled()
    // Kept open so the one line can be retried.
    expect(onClose).not.toHaveBeenCalled()
  })
})
