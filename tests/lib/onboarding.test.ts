import { describe, expect, it } from 'vitest'
import { PROFILE_USE_CASES, isAcceptedUseCase, needsOnboarding } from '@/lib/onboarding'

describe('onboarding rules (F1.3)', () => {
  it('accepts the profile choices and values saved before; refuses anything else', () => {
    expect([...PROFILE_USE_CASES]).toEqual(['product', 'facility', 'comparative', 'research', 'other'])
    for (const v of ['product', 'facility', 'research', 'teaching', 'lab', 'own_study']) expect(isAcceptedUseCase(v), v).toBe(true)
    for (const v of ['company', 'hacking', '', null, 3]) expect(isAcceptedUseCase(v), String(v)).toBe(false)
  })
  it('is done once saved or skipped, whatever the company', () => {
    expect(needsOnboarding({ onboarded_at: null })).toBe(true)
    expect(needsOnboarding({})).toBe(true)
    expect(needsOnboarding({ onboarded_at: '2026-10-20T10:00:00Z' })).toBe(false)
    expect(needsOnboarding({ onboarded_at: new Date() })).toBe(false)
  })
})
