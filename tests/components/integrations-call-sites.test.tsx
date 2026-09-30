// @vitest-environment jsdom
/**
 * X-API-1 call sites: the real api-client runs against a stubbed fetch, so
 * these fail if apiGet/apiPost hand an error body back as data again, or if
 * a caller stops handling the thrown ApiError.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ImportButtons } from '@/components/integrations/import-buttons'
import { LogViewer } from '@/components/integrations/log-viewer'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => {
  localStorage.setItem('auth_token', 'token-abc')
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('<ImportButtons>', () => {
  it('reports a 403 as a failure with the server message and does not refresh', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(403, { error: 'Admin access required' })))
    const onRefresh = vi.fn()
    render(<ImportButtons onRefresh={onRefresh} />)

    fireEvent.click(screen.getByRole('button', { name: 'Import openLCA CML 2001' }))

    expect(
      await screen.findByText('Import CML 2001 FAILED: Admin access required'),
    ).toBeInTheDocument()
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('still reports a successful import and refreshes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, { success: true, imported: 12 })))
    const onRefresh = vi.fn()
    render(<ImportButtons onRefresh={onRefresh} />)

    fireEvent.click(screen.getByRole('button', { name: 'Enrich substances from PubChem' }))

    expect(
      await screen.findByText('Enrich substances: {"success":true,"imported":12}'),
    ).toBeInTheDocument()
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })
})

describe('<LogViewer>', () => {
  it('says the log could not be loaded instead of "No integration runs yet"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(500, { error: 'Failed to read the integration log' })),
    )
    render(<LogViewer />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't load the integration log: Failed to read the integration log",
    )
    expect(screen.queryByText('No integration runs yet.')).not.toBeInTheDocument()
  })

  it('lists the runs when the log loads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json(200, {
          success: true,
          logs: [
            {
              log_id: 1,
              source: 'pubchem',
              action: 'enrich',
              records_affected: 4,
              status: 'success',
              executed_at: '2026-09-29T10:00:00Z',
              details: null,
            },
          ],
        }),
      ),
    )
    render(<LogViewer />)

    expect(await screen.findByText('pubchem')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
