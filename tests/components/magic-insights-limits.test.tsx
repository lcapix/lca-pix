// @vitest-environment jsdom
/**
 * INS-2 / integration item 14: the AI narration is rate-limited per user per
 * hour. A 429 must say so (not look like "no model key"), and typing a
 * reduce target must not send one narration request per keystroke.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MagicInsightsModal } from '@/components/lcapix/magic-insights-modal'

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any
// Reduced motion makes the computed insight appear whole, at once.
window.matchMedia ??= ((query: string) => ({
  matches: /reduce/.test(query),
  media: query,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => false,
})) as any

const IMPACTS = { 'Global Warming': { value: 120, unit: 'kg CO2 eq' } }
const BREAKDOWN = [
  {
    component_id: 1,
    component_name: 'Frame',
    impacts: [{ category_name: 'Global Warming', impact_value: 90, unit: 'kg CO2 eq' }],
  },
  {
    component_id: 2,
    component_name: 'Wheels',
    impacts: [{ category_name: 'Global Warming', impact_value: 30, unit: 'kg CO2 eq' }],
  },
]

const jsonRes = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let fetchMock: ReturnType<typeof vi.fn>

function insightBodies() {
  return fetchMock.mock.calls
    .filter(([url]) => String(url).startsWith('/api/insights'))
    .map(([, init]) => JSON.parse((init as RequestInit).body as string))
}

function renderModal() {
  render(
    <MagicInsightsModal
      open
      onClose={() => {}}
      caseName="Touring bike"
      method="TRACI 2.1"
      impacts={IMPACTS}
      componentBreakdown={BREAKDOWN}
      initialCategory="Global Warming"
      projectId="1"
      caseId="3"
    />,
  )
}

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('<MagicInsightsModal> AI limits', () => {
  it("says the hour's insights are used up on a 429 and shows the computed summary", async () => {
    fetchMock.mockImplementation(async () =>
      jsonRes(429, { fallback: true, error: 'Too many requests. Try again later.' }),
    )
    renderModal()

    fireEvent.click(screen.getByRole('button', { name: 'AI' }))

    expect(
      await screen.findByText("You've used this hour's insights — showing the computed summary"),
    ).toBeInTheDocument()
    expect(screen.queryByText(/no model key configured/)).not.toBeInTheDocument()
    // The computed insight is what is on screen.
    expect(document.body.textContent).toContain('Frame')
  })

  it('still blames a missing key only when the server answers with a plain fallback', async () => {
    fetchMock.mockImplementation(async () =>
      jsonRes(200, { fallback: true, reason: 'HF_TOKEN not configured' }),
    )
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'AI' }))
    expect(await screen.findByText(/AI narration unavailable/)).toBeInTheDocument()
    expect(screen.queryByText(/used this hour's insights/)).not.toBeInTheDocument()
  })

  it('sends one narration request for a typed reduce target, not one per keystroke', async () => {
    fetchMock.mockImplementation(async () =>
      jsonRes(200, { fallback: true, reason: 'HF_TOKEN not configured' }),
    )
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'AI' }))
    fireEvent.click(screen.getByRole('button', { name: /Reduce environmental load by 20%/ }))
    await waitFor(() =>
      expect(insightBodies().filter((b) => b.mode === 'reduce').map((b) => b.reducePct)).toEqual([20]),
    )

    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '3' } })
    fireEvent.change(input, { target: { value: '35' } })
    // The typed value shows at once; the request waits for typing to stop.
    expect(input).toHaveValue(35)
    await new Promise((r) => setTimeout(r, 700))

    expect(insightBodies().filter((b) => b.mode === 'reduce').map((b) => b.reducePct)).toEqual([
      20, 35,
    ])
    expect(
      screen.getByRole('button', { name: /Reduce environmental load by 35%/ }),
    ).toBeInTheDocument()
  })
})
