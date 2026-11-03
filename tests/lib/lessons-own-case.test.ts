/**
 * Guided mode's questions about the student's own case (journey review): the
 * functional-unit and inventory questions name the case's unit, material and
 * steps; a case with too little in it keeps the written question.
 */
import { describe, expect, it } from 'vitest'
import { LESSONS, questionContext, questionFor } from '@/lib/lessons'

const steps = [
  { id: 1, name: 'Touring bike', tier: 'product' },
  { id: 2, name: 'Fabrication', tier: 'machine_line' },
  { id: 3, name: '10. Cut & miter frame tubes', tier: 'operation' },
  { id: 4, name: '80. QA & pack', tier: 'operation' },
]
const rows = [
  { substance: 'Electricity, grid', amount: 0.165, unit: 'kWh', direction: 'input', component_id: 3 },
  { substance: 'Aluminum', amount: 2, unit: 'kg', direction: 'input', component_id: 3 },
]
const lesson = (id: string) => LESSONS.find((l) => l.id === id)!

describe('questions about the student\'s own case', () => {
  const c = questionContext({ functionalUnit: '1 bike frame', steps, rows })

  it('reads the unit, a material flow and its step, the product, a line and another step', () => {
    expect(c).toEqual({
      functionalUnit: '1 bike frame',
      material: { name: 'Aluminum', amount: 2, unit: 'kg', step: '10. Cut & miter frame tubes' },
      product: 'Touring bike',
      line: 'Fabrication',
      otherStep: '80. QA & pack',
    })
  })

  it('the functional unit question offers this case\'s unit, flow and line; b is right', () => {
    const q = questionFor(lesson('scope'), c)!
    expect(q.kind === 'choice' && q.options.map((o) => o.text)).toEqual(['2 kg of aluminum', '1 bike frame', 'Fabrication'])
    expect(q.kind === 'choice' && q.correct).toBe('b')
    expect(JSON.stringify(q)).not.toMatch(/bracket|steel/i)
  })

  it('the inventory question names this case\'s material and the step that uses it', () => {
    const q = questionFor(lesson('inventory'), c)!
    expect(q.prompt).toBe('Your inventory has 2 kg of aluminum. Which step should carry that flow?')
    expect(q.kind === 'choice' && q.options[1].text).toBe('The step that first uses it: 10. Cut & miter frame tubes')
  })

  it('an empty case keeps the written question, and no question names a sample step', () => {
    const empty = questionContext({ functionalUnit: '1 bike frame', steps: [], rows: [] })
    expect(questionFor(lesson('scope'), empty)).toBe(lesson('scope').question)
    expect(lesson('energy').question!.prompt).not.toMatch(/Deburr/)
  })
})
