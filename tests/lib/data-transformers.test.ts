import { describe, it, expect } from 'vitest'
import { transformComponentFromDB } from '@/lib/data-transformers'

const row = (drivers: unknown) => ({
  component_id: 7,
  case_id: 3,
  parent_component_id: null,
  component_type: 'operation',
  component_name: 'Cut',
  drivers,
})

describe('transformComponentFromDB drivers (EDIT-10)', () => {
  it('parses a JSON string of drivers', () => {
    expect(transformComponentFromDB(row('["Steel (kg)","Electricity (kWh)"]')).drivers).toEqual([
      'Steel (kg)',
      'Electricity (kWh)',
    ])
  })

  it('keeps an array mysql2 already parsed', () => {
    expect(transformComponentFromDB(row(['Steel (kg)'])).drivers).toEqual(['Steel (kg)'])
  })

  it('does not throw on a malformed drivers string (one bad row must not kick the user out of the case)', () => {
    expect(() => transformComponentFromDB(row('Steel (kg), Electricity'))).not.toThrow()
    expect(transformComponentFromDB(row('Steel (kg), Electricity')).drivers).toBeUndefined()
  })

  it('ignores drivers JSON that is not a list', () => {
    expect(transformComponentFromDB(row('{"a":1}')).drivers).toBeUndefined()
  })
})
