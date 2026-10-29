import { describe, expect, it } from 'vitest'
import { americanize } from '@/lib/substances/spelling'

describe('americanize', () => {
  it('reads the British pairs as American, whole words only, on both sides of a match', () => {
    expect(americanize('Aluminium sulphate')).toBe('Aluminum sulfate')
    expect(americanize('sulphur sulphide sulphuric fibre caesium')).toBe('sulfur sulfide sulfuric fiber cesium')
    expect(americanize('tonne')).toBe('tonne')
    expect(americanize('aluminum')).toBe('aluminum')
    const q = americanize('aluminium'.toLowerCase())
    const name = americanize('Aluminum ingot'.toLowerCase())
    expect(name.includes(q)).toBe(true)
  })
})