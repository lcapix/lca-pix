import { describe, expect, it, vi } from 'vitest'
import { enterNeverSubmits } from '@/lib/project/enter-never-submits'

const key = (k: string, tagName: string, type = '') => {
  const preventDefault = vi.fn()
  enterNeverSubmits({ key: k, target: { tagName, type } as any, preventDefault })
  return preventDefault.mock.calls.length > 0
}

describe('Enter never saves (B2)', () => {
  it('stops Enter in a one-line box, never elsewhere', () => {
    expect(key('Enter', 'INPUT', 'text')).toBe(true)
    expect(key('Enter', 'INPUT', 'datetime-local')).toBe(true)
    expect(key('Enter', 'INPUT', 'email')).toBe(true)
    expect(key('Enter', 'TEXTAREA')).toBe(false)
    expect(key('Enter', 'BUTTON', 'submit')).toBe(false)
    expect(key('Enter', 'INPUT', 'checkbox')).toBe(false)
    expect(key('Tab', 'INPUT', 'text')).toBe(false)
  })
})
