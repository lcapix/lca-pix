import { describe, expect, it } from 'vitest'
import { flowStage } from '@/lib/life-cycle'

// Substances and units as the library holds them (substances.unit, .category).
const steel = { substanceUnit: 'kg', unit: 'kg', substanceCategory: 'resource', direction: 'input' }

describe('flowStage: the stage a flow belongs to', () => {
  it('a material going in is Materials, whatever the step does with it', () => {
    expect(flowStage({ ...steel, stepStage: 'production' })).toBe('materials')
    expect(flowStage({ ...steel, stepStage: 'distribution' })).toBe('materials')
    expect(flowStage({ ...steel, stepStage: null })).toBe('materials')
    // Typed in g, still a mass; a part counted in pieces is a material too.
    expect(flowStage({ ...steel, unit: 'g' })).toBe('materials')
    expect(flowStage({ direction: 'input', unit: 'pcs', substanceUnit: null, substanceCategory: '' })).toBe('materials')
  })
  it('energy, volumes and transport follow the step', () => {
    expect(flowStage({ direction: 'input', substanceUnit: 'kWh', unit: 'kWh', substanceCategory: 'resource', stepStage: 'production' })).toBe('production')
    expect(flowStage({ direction: 'input', substanceUnit: 'm3', unit: 'm3', substanceCategory: 'resource', stepStage: 'use' })).toBe('use')
    expect(flowStage({ direction: 'input', substanceUnit: 'MMBtu', unit: 'MMBtu', substanceCategory: 'resource', stepStage: 'production' })).toBe('production')
    expect(flowStage({ direction: 'input', substanceUnit: 'tkm', unit: 'tkm', substanceCategory: '', stepStage: 'distribution' })).toBe('distribution')
  })
  it('every output follows the step; an emission is never a material', () => {
    expect(flowStage({ ...steel, direction: 'output', stepStage: 'end_of_life' })).toBe('end_of_life')
    expect(flowStage({ direction: 'input', substanceUnit: 'kg', substanceCategory: 'emission_air', stepStage: 'production' })).toBe('production')
  })
  it('a step with no stage reads as production', () => {
    expect(flowStage({ direction: 'input', substanceUnit: 'kWh', stepStage: null })).toBe('production')
  })
  it("a person's own setting wins over the rule", () => {
    expect(flowStage({ ...steel, explicit: 'production', stepStage: 'production' })).toBe('production')
    expect(flowStage({ direction: 'input', substanceUnit: 'kWh', explicit: 'use', stepStage: 'production' })).toBe('use')
    // An unknown value is ignored, not trusted.
    expect(flowStage({ ...steel, explicit: 'shipping', stepStage: 'production' })).toBe('materials')
  })
})
