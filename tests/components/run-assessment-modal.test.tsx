// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as api from '@/lib/api-client'
import { RunAssessmentModal } from '@/components/assessments/run-assessment-modal'

vi.mock('@/lib/api-client')

// Radix's dialog measures itself; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// RUN-4: apiPost hands a 403/500 body back as data, so the modal treated a
// failed run as a success: it closed, saved prefs and the page crashed on
// data.assessment.run_id.
describe('<RunAssessmentModal> run outcome', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    localStorage.clear()
  })

  function setup(response: Response) {
    const errorBody = { error: 'Failed to run assessment', details: 'engine exploded' }
    // What the shared helpers do today: the body comes back whatever the status.
    vi.mocked(api.apiPost).mockResolvedValue(errorBody)
    vi.mocked(api.apiRequest).mockResolvedValue(response)
    const onCompleted = vi.fn()
    const onClose = vi.fn()
    render(
      <RunAssessmentModal
        open
        caseId={3}
        onClose={onClose}
        onCompleted={onCompleted}
        initialMethod="TRACI 2.1"
        initialRegion="US Grid"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Run assessment' }))
    return { onCompleted, onClose }
  }

  it('stays open, shows the error and saves nothing when the server answers 500', async () => {
    const { onCompleted, onClose } = setup(
      json(500, { error: 'Failed to run assessment', details: 'engine exploded' }),
    )
    expect(await screen.findByText(/engine exploded/)).toBeInTheDocument()
    expect(onCompleted).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(localStorage.getItem('lcapix-run-prefs:3')).toBeNull()
  })

  it('treats a 403 as a failure too', async () => {
    const { onCompleted, onClose } = setup(json(403, { error: 'Access denied' }))
    expect(await screen.findByText(/Access denied/)).toBeInTheDocument()
    expect(onCompleted).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('hands the result on, closes and remembers the choice on success', async () => {
    const data = { success: true, run_id: 12, assessment: { run_id: 12 } }
    const { onCompleted, onClose } = setup(json(201, data))
    await waitFor(() => expect(onCompleted).toHaveBeenCalledWith(data))
    expect(onClose).toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem('lcapix-run-prefs:3')!)).toEqual({ method: 'TRACI 2.1', region: 'US Grid' })
  })
})
