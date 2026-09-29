// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StagePanel } from '@/components/lcapix/results/stage-panel'

// RES-1 / STAGE-4: stage totals in the thousands printed 10-1000x too small.
describe('<StagePanel> number formatting', () => {
  it('prints 1000 as "1,000" and 2500.3 as "2,500"', () => {
    render(
      <StagePanel
        categoryName="Global Warming"
        unit="kg CO2 eq"
        rows={[
          { component_name: 'Frame', life_cycle_stage: 'materials', value: 1000, flows: 1 },
          { component_name: 'Assembly', life_cycle_stage: 'production', value: 2500.3, flows: 1 },
        ]}
        boundary="cradle-to-gate"
      />,
    )
    expect(screen.getByText(/^1,000 \(/)).toBeInTheDocument()
    expect(screen.getByText(/^2,500 \(/)).toBeInTheDocument()
  })

  it('prints a tiny stage total in scientific notation, not 0', () => {
    render(
      <StagePanel
        categoryName="Ozone Depletion"
        unit="kg CFC-11 eq"
        rows={[{ component_name: 'Chiller', life_cycle_stage: 'production', value: 4.2e-7, flows: 1 }]}
        boundary="gate-to-gate"
      />,
    )
    expect(screen.getByText(/^4\.2e-7 \(/)).toBeInTheDocument()
  })
})
