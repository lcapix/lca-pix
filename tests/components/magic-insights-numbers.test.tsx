// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MagicInsightsModal } from '@/components/lcapix/magic-insights-modal'

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any
// The streaming-text hook asks for reduced motion; jsdom has no matchMedia.
// Answering "reduce" makes the insight text appear whole, at once.
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

// INS-5: toFixed(2) printed ozone-depletion-scale results as "0.00".
describe('<MagicInsightsModal> numbers', () => {
  it('prints a tiny total and contributor in significant figures, never 0.00', () => {
    const { container } = render(
      <MagicInsightsModal
        open
        onClose={() => {}}
        caseName="Chiller"
        method="TRACI 2.1"
        impacts={{ 'Ozone Depletion': { value: 4.2e-7, unit: 'kg CFC-11 eq' } }}
        componentBreakdown={[
          {
            component_id: 1,
            component_name: 'Refrigerant charge',
            impacts: [{ category_name: 'Ozone Depletion', impact_value: 4.2e-7, unit: 'kg CFC-11 eq' }],
          },
        ]}
        initialCategory="Ozone Depletion"
        projectId="1"
        caseId="3"
      />,
    )
    const text = document.body.textContent ?? container.textContent ?? ''
    expect(text).toContain('4.2e-7 kg CFC-11 eq')
    expect(text).not.toMatch(/0\.00 kg CFC-11 eq/)
    expect(text).not.toMatch(/(^|\D)0\.00(?!\d)/)
  })

  it('prints a total in the thousands with separators', () => {
    render(
      <MagicInsightsModal
        open
        onClose={() => {}}
        caseName="Bike"
        method="TRACI 2.1"
        impacts={{ 'Global Warming': { value: 1234.5, unit: 'kg CO2 eq' } }}
        componentBreakdown={[
          {
            component_id: 1,
            component_name: 'Frame',
            impacts: [{ category_name: 'Global Warming', impact_value: 1234.5, unit: 'kg CO2 eq' }],
          },
        ]}
        initialCategory="Global Warming"
        projectId="1"
        caseId="3"
      />,
    )
    expect(document.body.textContent).toContain('1,235 kg CO2 eq')
  })
})
