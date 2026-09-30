// @vitest-environment jsdom
/**
 * Integration item 17: the import review printed quantities with
 * toLocaleString(), which keeps 3 decimals, so 0.0004 kg showed as "0 kg"
 * and a reviewer could not see the amount they were about to apply.
 */
import { Suspense } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock('@/components/auth-guard', () => ({ AuthGuard: ({ children }: any) => <>{children}</> }))

import ImportPage from '@/app/project/[projectId]/import/page'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const PLAN = {
  case_name: 'Touring bike',
  nodes: [
    { name: 'Touring bike', tier: 'product', quantity: 1, unit: 'unit' },
    { name: 'Coat frame', tier: 'operation', quantity: 0.0004, unit: 'h' },
  ],
  flows: [
    {
      node: 'Coat frame',
      substance_text: 'Powder coat pigment',
      substance_id: 12,
      substance_name: 'Titanium dioxide',
      match_score: 0.95,
      candidates: [],
      direction: 'input',
      quantity: 0.0004,
      unit: 'kg',
      conversion_note: '',
      provenance: 'bom.csv row 4',
      unit_compatible: true,
    },
    {
      node: 'Coat frame',
      substance_text: 'Solvent vapour',
      substance_id: 13,
      substance_name: 'Xylene',
      match_score: 0.95,
      candidates: [],
      direction: 'output',
      quantity: 4.2e-7,
      unit: 'kg',
      conversion_note: '',
      provenance: 'bom.csv row 5',
      unit_compatible: true,
    },
    {
      node: 'Coat frame',
      substance_text: 'Steel tube',
      substance_id: 14,
      substance_name: 'Steel',
      match_score: 0.95,
      candidates: [],
      direction: 'input',
      quantity: 12500.5,
      unit: 'kg',
      conversion_note: '',
      provenance: 'bom.csv row 6',
      unit_compatible: true,
    },
  ],
  costs: [],
  review: [],
  notes: [],
}

beforeEach(() => {
  localStorage.setItem('auth_token', 'token-abc')
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const path = String(url).split('?')[0]
      if (path === '/api/ingest/preview') return json(200, { success: true, plan: PLAN })
      if (path === '/api/projects/1/cases') return json(200, { success: true, cases: [] })
      return json(200, { success: true })
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('import review quantities', () => {
  it('prints small and large quantities in significant figures, never as 0', async () => {
    const params = Promise.resolve({ projectId: '1' })
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <ImportPage params={params} />
        </Suspense>,
      )
    })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['part,qty\n'], 'bom.csv', { type: 'text/csv' })
    fireEvent.change(fileInput, { target: { files: [file] } })
    fireEvent.change(screen.getByPlaceholderText('WV0661'), { target: { value: 'WV0661' } })
    fireEvent.click(screen.getByRole('button', { name: 'Preview extraction' }))

    expect(await screen.findByText('Powder coat pigment')).toBeInTheDocument()
    const text = document.body.textContent ?? ''
    // Flow quantities.
    expect(text).toContain('4e-4 kg')
    expect(text).toContain('4.2e-7 kg')
    expect(text).toContain('12,501 kg')
    // The hierarchy's step quantity.
    expect(text).toContain('4e-4 h')
    expect(text).not.toMatch(/(^|[^\d.e-])0 kg/)
    expect(text).not.toMatch(/(^|[^\d.e-])0 h/)
  })
})
