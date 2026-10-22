import { describe, it, expect } from 'vitest'
import { parseId } from '@/lib/ids'

describe('parseId', () => {
  it('accepts plain positive decimal ids', () => {
    expect(parseId('1')).toBe(1)
    expect(parseId('31')).toBe(31)
    expect(parseId('2147483647')).toBe(2147483647)
    expect(parseId(42)).toBe(42)
  })

  it.each([
    '0x1F', '1e1', '31abc', ' 31', '31 ', '+31', '-1', '0', '031', '3.0', '1_000',
    '', '2147483648', '99999999999', 'NaN', 'Infinity', '1 OR 1=1', "1'; DROP TABLE project;--", '３１',
  ])('rejects %j', (raw) => {
    expect(Number.isNaN(parseId(raw))).toBe(true)
  })

  it('rejects non-integer, non-positive and non-string values', () => {
    for (const v of [0, -3, 1.5, NaN, Infinity, null, undefined, {}, [], true]) {
      expect(Number.isNaN(parseId(v))).toBe(true)
    }
  })
})
