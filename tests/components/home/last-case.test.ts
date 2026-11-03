// @vitest-environment jsdom
/**
 * Home's Continue card on a shared computer (journey review): the case opened
 * last is read back only for the person who opened it, and sign-out forgets it.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { readLastCase, rememberCase } from '@/lib/home/last-case'
import { SIGNED_IN_KEYS } from '@/lib/auth/sign-out'

const sams = { project_id: 3, case_id: 7, project_name: 'Touring bike frame', case_name: 'Week 3: lighter frame · Sam Student' }

describe('the last case on a shared computer', () => {
  beforeEach(() => localStorage.clear())

  it('reads back for the person who opened it, never for the next one', () => {
    rememberCase(sams, 3)
    expect(readLastCase(3)).toMatchObject({ case_id: 7, user_id: 3 })
    expect(readLastCase(2)).toBeNull()
    expect(readLastCase(null)).toBeNull()
  })

  it('a case remembered before this change (no person on it) is not shown to anyone', () => {
    localStorage.setItem('lcapix-last-case', JSON.stringify({ ...sams, at: new Date().toISOString() }))
    expect(readLastCase(3)).toBeNull()
  })

  it('nothing is remembered without a person, and sign-out clears it', () => {
    rememberCase(sams, undefined)
    expect(localStorage.getItem('lcapix-last-case')).toBeNull()
    expect(SIGNED_IN_KEYS).toContain('lcapix-last-case')
  })
})
