import { describe, expect, it } from 'vitest'
import { USE_CASES, isAcceptedUseCase, needsOnboarding } from '@/lib/onboarding'

describe('onboarding rules (F1.3)', () => {
  it('offers teaching, lab and own study; keeps older values; refuses the company workspace and anything else', () => {
    expect(USE_CASES.map((u) => u.id)).toEqual(['teaching', 'lab', 'own_study'])
    for (const v of ['teaching', 'lab', 'own_study', 'research', 'product']) expect(isAcceptedUseCase(v), v).toBe(true)
    for (const v of ['company', 'hacking', '', null, 3]) expect(isAcceptedUseCase(v), String(v)).toBe(false)
  })
  it('is done once saved or skipped, whatever the institution', () => {
    expect(needsOnboarding({ onboarded_at: null })).toBe(true)
    expect(needsOnboarding({})).toBe(true)
    expect(needsOnboarding({ onboarded_at: '2026-10-20T10:00:00Z' })).toBe(false)
    expect(needsOnboarding({ onboarded_at: new Date() })).toBe(false)
  })
})
