import { describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { generateAssessmentPDF, type ReportData } from '@/lib/pdf-generator'

// A run shaped like the touring bike: a few steps, two categories, one of them
// covering only part of the inputs, and the author's own write-up.
const data: ReportData = {
  project: {
    project_id: 1,
    project_name: 'Touring bike, aluminum frame',
    description: 'Which change cuts the footprint most: the frame material or the grid?',
    owner_username: 'student',
    created_at: '2026-09-20T10:00:00Z',
  },
  case_info: { case_id: 2, case_name: 'Touring bike', case_type: 'base', case_description: null },
  assessment: {
    run_id: 133,
    run_name: 'Assessment',
    run_at: '2026-09-21T09:00:00Z',
    calculation_method: 'TRACI 2.1',
    executed_by_username: 'student',
  },
  components: [
    { component_id: 1, component_name: 'Touring bike', component_type: 'product', hierarchy_level: 1, quantity: 1, unit: 'unit', opex: null, capex: null },
    { component_id: 2, component_name: '10. Cut & miter frame tubes', component_type: 'operation', hierarchy_level: 4, quantity: 1, unit: 'unit', opex: 91.31, capex: null, life_cycle_stage: 'materials' },
    { component_id: 3, component_name: '70. Final assembly', component_type: 'operation', hierarchy_level: 4, quantity: 1, unit: 'unit', opex: 425.6, capex: null, life_cycle_stage: 'production' },
  ],
  results: [
    { component_name: '70. Final assembly', category_name: 'Global Warming', impact_value: 41.58, unit: 'kg CO2 eq' },
    { component_name: '10. Cut & miter frame tubes', category_name: 'Global Warming', impact_value: 19.29, unit: 'kg CO2 eq' },
    { component_name: '10. Cut & miter frame tubes', category_name: 'Acidification', impact_value: 0.0007, unit: 'kg SO2 eq' },
  ],
  total_impacts: [
    { category_name: 'Global Warming', total_value: 88.73, unit: 'kg CO2 eq' },
    { category_name: 'Acidification', total_value: 0.007334, unit: 'kg SO2 eq' },
  ],
  flows: [
    { component_name: '10. Cut & miter frame tubes', substance_name: 'Aluminum', direction: 'input', amount: 2.2, unit: 'kg' },
    { component_name: '10. Cut & miter frame tubes', substance_name: 'Electricity', direction: 'input', amount: 0.165, unit: 'kWh' },
  ],
  dataSources: {
    valuation_method: 'TRACI 2.1',
    region_code: 'US',
    impact_factor_sources: ['International Aluminium Institute 2019', 'EPA eGRID 2023'],
    cost_rate_sources: ['BLS OEWS 2025', 'EIA Electric Power Monthly'],
  },
  goal_scope: {
    goal_statement: 'Which change cuts the footprint most: the frame material or the grid?',
    functional_unit: '1 touring bicycle, at the factory gate',
    system_boundary: 'cradle-to-gate',
    boundary_notes: null,
    reference_flow: 1,
    reference_flow_unit: 'bicycle',
    modeled_output: 1,
    per_fu_scale: 1,
  },
  data_quality: {
    contributions: 31,
    by_tier: { authoritative: 6, industry_average: 25, unverified: 0, unknown: 0 },
    gw_share_by_tier: { authoritative: 0.06, industry_average: 0.94, unverified: 0, unknown: 0 },
    regional_fallbacks: 26,
    unit_conversions: 0,
    excluded_flows: 0,
    allocated_components: 0,
    uncharacterized_flows: 2,
    uncharacterized_examples: ['Argon'],
    category_coverage: [
      { category: 'Acidification', covered: 5, total: 31, missing_examples: ['Aluminum', 'Steel', 'Rubber'] },
      { category: 'Global Warming', covered: 31, total: 31, missing_examples: [] },
    ],
    statement: [
      'Quantities are case data. Every factor is secondary data; the flow table lists its source per row.',
      'The Global Warming result rests 6% on authoritative sources, 94% on industry-average factors.',
      'Acidification covers 5 of 31 inputs: Aluminum, Steel and Rubber have no acidification factor, so that total is incomplete.',
    ],
  },
  interpretation: 'Aluminum drives the result: 8.2 kg of it at 8.6 kg CO2 eq/kg is most of the 88.73. Shop electricity is about 1%, so the lever is what we buy, not how we run the machines.',
  assumptions: 'Parts we did not weigh were estimated by difference from the published bike weight. The saddle is modelled as plastic because the library has no leather factor.',
}

const render = async () => {
  const doc = generateAssessmentPDF(data)
  const chunks: Buffer[] = []
  return await new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}

describe('assessment report (PDF)', () => {
  it('renders every ISO section, numbers its pages, and keeps the author write-up', async () => {
    const pdf = await render()
    const raw = pdf.toString('latin1')

    expect(raw.startsWith('%PDF')).toBe(true)
    // /Count on the page tree = the real page count: cover, contents and the
    // nine sections. Exact, because the footer used to overflow the bottom
    // margin and PDFKit answered by appending a page per footer line (11 -> 44).
    const pageCount = Number(raw.match(/\/Type \/Pages[\s\S]*?\/Count (\d+)/)?.[1] ?? 0)
    expect(pageCount).toBe(11)

    // Written to disk so the layout can be eyeballed after a change.
    const out = join(tmpdir(), 'lcapix-report-fixture')
    mkdirSync(out, { recursive: true })
    writeFileSync(join(out, 'report.pdf'), pdf)
    expect(pdf.length).toBeGreaterThan(8000)
  })
})
