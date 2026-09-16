import { describe, expect, it } from 'vitest'

import {
  buildStructurePrompt,
  chunkText,
  countNumberedSteps,
  extractJson,
  toProcessModel,
} from '@/lib/ingest/llm-structure'
import { validateProcessModel } from '@/lib/ingest/schema'

describe('extractJson', () => {
  it('pulls a JSON object out of a noisy model response', () => {
    expect(extractJson('Here you go: {"a":1} thanks')).toEqual({ a: 1 })
    expect(extractJson('no json here')).toBeNull()
  })
})

describe('buildStructurePrompt', () => {
  it('injects the doc-type guidance and forbids inventing numbers', () => {
    const { system } = buildStructurePrompt('text', 'sds', 'x.pdf')
    expect(system).toMatch(/Safety Data Sheet/i)
    expect(system).toMatch(/NEVER invent a number/i)
    expect(system).toMatch(/Materials.*are FLOWS, not nodes/i)
    expect(system).toMatch(/as many or as few levels as the DOCUMENT has/i)
  })
})

describe('toProcessModel', () => {
  it("keeps every operation the model found, in order, with each cost on its own step", () => {
    const json = {
      product_name: 'CEB press',
      nodes: [
        { name: 'CEB press', tier: 'product', parent: null },
        { name: '10. Kit parts', tier: 'operation', parent: 'CEB press' },
        { name: '20. Weld frame', tier: 'operation', parent: 'CEB press' },
        { name: '30. Weld drawer', tier: 'operation', parent: 'CEB press' },
      ],
      costs: [{ node: '30. Weld drawer', category: 'labor', amount: 40, basis: '1.75 h' }],
    }
    const pm = toProcessModel(json, 'traveler.pdf')
    expect(validateProcessModel(pm)).toEqual([])
    expect(pm.nodes.filter((n) => n.tier === 'operation').map((n) => n.name)).toEqual([
      '10. Kit parts',
      '20. Weld frame',
      '30. Weld drawer',
    ])
    expect(pm.costs[0].node).toBe('30. Weld drawer')
  })

  it('repairs instead of replacing: orphans go under the product, tiers are made finer than the parent', () => {
    const json = {
      product_name: 'Bike',
      nodes: [
        { name: 'Welding', tier: 'subprocess', parent: 'Bike' },
        { name: '20. Weld', tier: 'subprocess', parent: 'Welding' }, // not finer → operation
        { name: '40. Paint', tier: 'operation', parent: 'Paint shop' }, // unknown parent → product
      ],
    }
    const pm = toProcessModel(json, 'x.pdf')
    expect(validateProcessModel(pm)).toEqual([])
    expect(pm.nodes.find((n) => n.name === '20. Weld')).toMatchObject({ tier: 'operation', parent: 'Welding' })
    expect(pm.nodes.find((n) => n.name === '40. Paint')?.parent).toBe('Bike')
    expect(pm.notes.join(' ')).toMatch(/Structure repaired/)
  })

  it('attaches a flow by step number when the model abbreviates the step name', () => {
    const json = {
      product_name: 'Bike',
      nodes: [
        { name: '10. Cut tubes', tier: 'operation', parent: 'Bike' },
        { name: '20. Weld frame', tier: 'operation', parent: 'Bike' },
      ],
      flows: [{ node: 'Op 20', substance_text: 'Argon', direction: 'input', quantity: 2, unit: 'kg' }],
    }
    expect(toProcessModel(json, 'x.pdf').flows[0].node).toBe('20. Weld frame')
  })

  it('merges a step repeated by several document parts', () => {
    const json = {
      product_name: 'Bike',
      nodes: [
        { name: '10. Cut', tier: 'operation', parent: 'Bike' },
        { name: 'Bike', tier: 'product', parent: null },
        { name: '10. Cut', tier: 'operation', parent: 'Bike' },
        { name: '20. Weld', tier: 'operation', parent: 'Bike' },
      ],
    }
    expect(toProcessModel(json, 'x.pdf').nodes.map((n) => n.name)).toEqual(['Bike', '10. Cut', '20. Weld'])
  })

  it('salvages materials the model mis-typed as leaf NODES into flows', () => {
    const json = {
      product_name: 'Coating',
      nodes: [
        { name: 'Coating', tier: 'product', parent: null },
        { name: 'Silica', tier: 'elemental_task', parent: 'Coating', quantity: 20, unit: '%' },
        { name: 'Carbon black', tier: 'elemental_task', parent: 'Coating', quantity: 0.5, unit: '%' },
      ],
      flows: [],
    }
    const pm = toProcessModel(json, 'sds.pdf')
    expect(validateProcessModel(pm)).toEqual([])
    expect(pm.flows.map((f) => f.substance_text).sort()).toEqual(['Carbon black', 'Silica'])
    expect(pm.notes.join(' ')).toMatch(/mis-typed as nodes/i)
  })

  it('moves a step the model nested under another step beside it; keeps true sub-steps', () => {
    const json = {
      product_name: 'Press',
      nodes: [
        { name: '30. Drawer', tier: 'subprocess', parent: 'Press' },
        { name: '40. Drawer guides', tier: 'operation', parent: '30. Drawer' },
        { name: '30.1 Tack weld', tier: 'operation', parent: '30. Drawer' },
      ],
    }
    const pm = toProcessModel(json, 'x.pdf')
    expect(validateProcessModel(pm)).toEqual([])
    expect(pm.nodes.find((n) => n.name === '30. Drawer')?.tier).toBe('operation')
    expect(pm.nodes.find((n) => n.name === '40. Drawer guides')?.parent).toBe('Press')
    expect(pm.nodes.find((n) => n.name === '30.1 Tack weld')).toMatchObject({ tier: 'elemental_task', parent: '30. Drawer' })
  })

  it('adds a numbered step the model skipped, word for word from the text', () => {
    const text = '10 Cut tubes\n20 Weld frame\n30 Paint frame\n'
    const json = {
      product_name: 'Bike',
      nodes: [
        { name: '10. Cut tubes', tier: 'operation', parent: 'Bike' },
        { name: '30. Paint frame', tier: 'operation', parent: 'Bike' },
      ],
    }
    const pm = toProcessModel(json, 'x.pdf', { hint: 'routing', text })
    expect(countNumberedSteps(text)).toBe(3)
    expect(pm.nodes.filter((n) => n.tier === 'operation').map((n) => n.name)).toEqual([
      '10. Cut tubes',
      '20. Weld frame',
      '30. Paint frame',
    ])
    expect(pm.notes.join(' ')).toMatch(/Added 1 step\(s\) the model skipped/)
  })

  it('drops zero/absent numbers rather than inventing them', () => {
    const json = {
      product_name: 'X',
      flows: [{ node: 'a', substance_text: 'Steel', direction: 'input', quantity: null, unit: 'kg' }],
      costs: [{ node: 'a', category: 'material', amount: 0, basis: 'z' }],
    }
    const pm = toProcessModel(json, 'x.pdf')
    expect(pm.flows).toHaveLength(0)
    expect(pm.costs).toHaveLength(0)
  })
})

describe('chunkText', () => {
  it('splits long text into parts on line boundaries and loses nothing', () => {
    const text = Array.from({ length: 50 }, (_, i) => `${i} ${'x'.repeat(90)}`).join('\n')
    const parts = chunkText(text, 1000)
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.every((p) => p.length <= 1000)).toBe(true)
    expect(parts.join('\n')).toBe(text)
  })
})
