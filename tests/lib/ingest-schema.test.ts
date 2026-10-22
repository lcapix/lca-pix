import { describe, expect, it } from 'vitest'

import { nodeDepths, processModelWarnings, validateProcessModel, type ProcessModel } from '@/lib/ingest/schema'

const pm = (nodes: ProcessModel['nodes'], flows: ProcessModel['flows'] = []): ProcessModel => ({
  product_name: 'P',
  case_name: 'c',
  nodes,
  flows,
  costs: [],
  source_docs: [],
  notes: [],
})

describe('validateProcessModel: tiers are labels, not a ladder', () => {
  it('allows skipping levels (an operation straight under the product)', () => {
    expect(
      validateProcessModel(
        pm([
          { name: 'P', tier: 'product', parent: null },
          { name: 'Op', tier: 'operation', parent: 'P' },
        ]),
      ),
    ).toEqual([])
  })

  it('rejects a child that is not finer than its parent, and a second root', () => {
    const errs = validateProcessModel(
      pm([
        { name: 'P', tier: 'product', parent: null },
        { name: 'A', tier: 'operation', parent: 'P' },
        { name: 'B', tier: 'operation', parent: 'A' },
        { name: 'Q', tier: 'product', parent: null },
      ]),
    )
    expect(errs.join(' ')).toMatch(/'B' \(operation\) must be finer/)
    expect(errs.join(' ')).toMatch(/exactly one product root/)
  })

  it('flags a flow on a node with steps below it as a warning, not an error', () => {
    const model = pm(
      [
        { name: 'P', tier: 'product', parent: null },
        { name: 'Op', tier: 'operation', parent: 'P' },
      ],
      [{ node: 'P', substance_text: 'Steel', direction: 'input', quantity: 1, unit: 'kg' }],
    )
    expect(validateProcessModel(model)).toEqual([])
    expect(processModelWarnings(model)[0]).toMatch(/has steps below it/)
  })

  it('computes depth from the tree, not from the tier label', () => {
    const d = nodeDepths([
      { name: 'P', tier: 'product', parent: null },
      { name: 'Op', tier: 'operation', parent: 'P' },
    ])
    expect(d.get('Op')).toBe(2)
  })
})

describe('validateProcessModel: a tier must be one of the table own keys', () => {
  it.each(['toString', 'constructor', 'hasOwnProperty', '__proto__'])(
    "rejects the inherited name '%s' as an unknown tier",
    (tier) => {
      const errors = validateProcessModel(
        pm([
          { name: 'P', tier: 'product', parent: null },
          { name: 'X', tier: tier as any, parent: 'P' },
        ]),
      )
      expect(errors).toContain(`node 'X' has unknown tier '${tier}'`)
    },
  )
})
