import { describe, expect, it } from 'vitest'

import { isBlankQuantity, parseOptionalFlowQuantity } from '@/lib/flow-fields'
import { isMissingAmount, summarizeDataQuality } from '@/lib/lca-engine'

describe('a flow with no amount yet (migration 033)', () => {
  it('is blank when absent, null or empty text, and only then', () => {
    for (const v of [null, undefined, '', '   ']) {
      expect(isBlankQuantity(v)).toBe(true)
      expect(isMissingAmount(v)).toBe(true)
    }
    for (const v of [0, '0', 0.0013, 'abc', NaN]) {
      expect(isBlankQuantity(v)).toBe(false)
      expect(isMissingAmount(v)).toBe(false)
    }
  })

  it('parses a blank as "no amount", a number as itself, and refuses the rest', () => {
    expect(parseOptionalFlowQuantity('')).toEqual({ ok: true, value: null })
    expect(parseOptionalFlowQuantity(null)).toEqual({ ok: true, value: null })
    expect(parseOptionalFlowQuantity('0.0013')).toEqual({ ok: true, value: 0.0013 })
    expect(parseOptionalFlowQuantity(0)).toEqual({ ok: true, value: 0 })
    for (const bad of ['abc', -1, true, NaN, '1e999']) expect(parseOptionalFlowQuantity(bad)).toEqual({ ok: false })
  })

  it('is named in the data-quality statement, before the totals are read', () => {
    const dq = summarizeDataQuality([], {
      missingAmounts: [
        { substance_name: 'Electricity', component_name: 'Deburr edges' },
        { substance_name: 'Packaging tape', component_name: 'Fold and tape' },
      ],
    })
    expect(dq.missing_amount_flows).toBe(2)
    expect(dq.missing_amount_examples).toEqual(['Electricity at Deburr edges', 'Packaging tape at Fold and tape'])
    expect(dq.statement[1]).toBe(
      '2 flows have no amount yet and are left out of this run: Electricity at Deburr edges, Packaging tape at Fold and tape.',
    )
    expect(summarizeDataQuality([], { missingAmounts: [] }).statement.join(' ')).not.toContain('no amount')
  })
})
