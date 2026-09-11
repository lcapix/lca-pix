import { describe, expect, it } from 'vitest'

import { buildInsightMessages, type InsightFacts } from '@/lib/insights/prompt'

const BASE: InsightFacts = {
  caseName: 'Painted bracket',
  method: 'CML 2001',
  categoryLabel: 'Global Warming',
  total: { value: 1763.83, unit: 'kg CO2 eq' },
  totalCost: 92500,
  contributors: [
    { name: 'Spray coat + fabrication', pct: 86.8, value: 1530 },
    { name: 'Paint line', pct: 13.2, value: 233 },
  ],
  mode: 'summary',
}

describe('buildInsightMessages', () => {
  it('puts every computed figure into the FACTS block verbatim', () => {
    const { user } = buildInsightMessages(BASE)
    expect(user).toContain('Category total: 1763.83 kg CO2 eq')
    expect(user).toContain('Total activity-based cost: $92,500')
    expect(user).toContain('Spray coat + fabrication: 86.8% (1530 kg CO2 eq)')
    expect(user).toContain('Paint line: 13.2% (233 kg CO2 eq)')
  })

  it('hard-codes the "never invent a number" discipline in the system prompt', () => {
    const { system } = buildInsightMessages(BASE)
    expect(system).toMatch(/never invent/i)
    expect(system).toMatch(/only the figures provided/i)
  })

  it('includes the reduction target only in reduce mode', () => {
    expect(buildInsightMessages({ ...BASE, mode: 'reduce', reducePct: 30 }).user).toContain(
      'Requested reduction target: 30%'
    )
    expect(buildInsightMessages(BASE).user).not.toContain('Requested reduction target')
  })

  it('carries the free-text question through in custom mode', () => {
    const { user } = buildInsightMessages({
      ...BASE,
      mode: 'custom',
      question: 'What if we swap coal for natural gas?',
    })
    expect(user).toContain('USER QUESTION: What if we swap coal for natural gas?')
  })

  it('states plainly when no contributors are available', () => {
    const { user } = buildInsightMessages({ ...BASE, contributors: [] })
    expect(user).toContain('Contributors: none available')
  })

  it('each mode carries a distinct task instruction', () => {
    const modes: InsightFacts['mode'][] = ['summary', 'reduce', 'tradeoff', 'base', 'custom']
    const tasks = modes.map((mode) => buildInsightMessages({ ...BASE, mode }).user.split('TASK:')[1])
    expect(new Set(tasks).size).toBe(modes.length)
  })
})
