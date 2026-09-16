import { describe, expect, it } from 'vitest'

import { analyzeCaseLayers, assessCompleteness } from '@/lib/ingest/completeness'

describe('analyzeCaseLayers', () => {
  it('detects every layer present in a comprehensive case', () => {
    const present = analyzeCaseLayers(
      [
        { tier: 'product' },
        { tier: 'operation', energy_cost: 100 },
      ],
      [
        { substance_name: 'Steel, hot-rolled', direction: 'input', unit: 'kg' },
        { substance_name: 'Electricity', direction: 'input', unit: 'kWh' },
        { substance_name: 'Carbon Dioxide', direction: 'output', unit: 'kg' },
        { substance_name: 'Transport, truck, long-haul', direction: 'input', unit: 'tkm' },
      ],
    )
    expect(present.has('skeleton')).toBe(true)
    expect(present.has('materials')).toBe(true)
    expect(present.has('energy')).toBe(true)
    expect(present.has('emissions')).toBe(true)
    expect(present.has('transport')).toBe(true)
    expect(present.has('costs')).toBe(true)
  })
})

describe('assessCompleteness', () => {
  it('flags missing layers and names the document that fills each', () => {
    const report = assessCompleteness(
      [{ tier: 'operation' }],
      [{ substance_name: 'Steel', direction: 'input', unit: 'kg' }],
    )
    // Present: skeleton + materials. Missing: energy, emissions, transport, costs.
    const missingLayers = report.missing.map((m) => m.layer)
    expect(missingLayers).toContain('energy')
    expect(missingLayers).toContain('transport')
    expect(report.present).toContain('materials')
    expect(report.score).toBeLessThan(1)
    // The energy gap should suggest a real document.
    const energy = report.missing.find((m) => m.layer === 'energy')
    expect(energy?.suggestedDocs.length).toBeGreaterThan(0)
  })
})
