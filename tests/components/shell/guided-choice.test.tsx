// @vitest-environment jsdom
/**
 * UX 3: Guided mode keeps a choice either way on this device. No choice yet
 * is what lets a student's first case start it on; turning it off is a
 * choice too, so it is never started on again.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { guidedChoiceMade, useGuidedMode } from '@/lib/shell/use-shell'

describe('Guided mode choice', () => {
  beforeEach(() => localStorage.clear())

  it('no choice yet: off, and no choice made', () => {
    const { result } = renderHook(() => useGuidedMode())
    expect(result.current[0]).toBe(false)
    expect(guidedChoiceMade()).toBe(false)
  })

  it('turned on, then off: off is kept as a choice', () => {
    const { result } = renderHook(() => useGuidedMode())
    act(() => result.current[1](true))
    expect(result.current[0]).toBe(true)
    act(() => result.current[1](false))
    expect(result.current[0]).toBe(false)
    expect(guidedChoiceMade()).toBe(true)
  })
})
