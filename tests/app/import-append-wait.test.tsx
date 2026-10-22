// @vitest-environment jsdom
/**
 * Stage-0 gate: appending a document to a case before the case's steps were
 * read made every step of the document look new, so a quick Apply duplicated
 * the whole routing (E1 caught 12 duplicate steps). Apply now waits for the
 * case's steps (and the flows on them), and a failed read says so and blocks.
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
  case_name: 'r',
  nodes: [
    { name: 'r', tier: 'product', parent: null, quantity: 1, unit: 'unit' },
    { name: '10. Cut tube', tier: 'operation', parent: 'r' },
  ],
  flows: [],
  costs: [{ node: '10. Cut tube', category: 'labor', amount: 6.3, provenance: { doc: 'r.csv', locator: 'row 2' } }],
  review: [],
  notes: [],
}
const STEPS = {
  success: true,
  components: [
    { component_id: 1, component_name: 'Tube frame', component_type: 'product', parent_component_id: null },
    { component_id: 2, component_name: '10. Cut tube', component_type: 'operation', parent_component_id: 1, labor_cost: '6.30' },
  ],
}

let releaseSteps: (r: Response) => void
let stepsReply: () => Promise<Response>

beforeEach(() => {
  localStorage.setItem('auth_token', 'token-abc')
  stepsReply = () => new Promise<Response>((res) => (releaseSteps = res))
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const path = String(url).split('?')[0]
      if (path === '/api/projects/1/cases') return json(200, { success: true, cases: [{ case_id: 7, case_name: 'Tube frame' }] })
      if (path === '/api/cases/7/components') return stepsReply()
      if (path === '/api/cases/7/completeness') return json(200, { success: true })
      if (path === '/api/ingest/preview') return json(200, { success: true, plan: PLAN })
      return json(200, { success: true })
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

async function reviewIntoCase7() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <ImportPage params={Promise.resolve({ projectId: '1' })} />
      </Suspense>,
    )
  })
  // The kind is a chip (Routing is the start); "Into" is the first select.
  await screen.findByRole('radio', { name: /Routing/ })
  await act(async () => {
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '7' } })
  })
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(fileInput, { target: { files: [new File(['a'], 'r.csv', { type: 'text/csv' })] } })
  fireEvent.click(screen.getByRole('button', { name: /Check what we read/ }))
  return screen.findByRole('button', { name: /^✓ Save/ })
}

describe('appending waits for the case', () => {
  it('keeps Apply disabled until the case\'s steps are read, then matches them', async () => {
    const apply = await reviewIntoCase7()
    expect(apply).toBeDisabled()
    expect(screen.getByText('Reading the steps of this case first')).toBeInTheDocument()

    await act(async () => {
      releaseSteps(json(200, STEPS))
    })
    expect(await screen.findByRole('button', { name: /^✓ Save/ })).toBeEnabled()
    expect((screen.getByLabelText('What happens to 10. Cut tube') as HTMLSelectElement).value).toBe('attach:2')
    // And the step's existing labour is shown, set to Keep.
    expect((screen.getByLabelText('What to do with the labor cost of 10. Cut tube') as HTMLSelectElement).value).toBe('keep')
  })

  it('says when the case\'s steps could not be read, and keeps Apply blocked', async () => {
    const apply = await reviewIntoCase7()
    await act(async () => {
      releaseSteps(json(500, { error: 'database unavailable' }))
    })
    expect(await screen.findByText(/The steps of this case could not be read \(database unavailable\)/)).toBeInTheDocument()
    expect(apply).toBeDisabled()
  })
})
