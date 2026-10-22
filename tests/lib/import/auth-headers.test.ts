import { describe, it, expect, vi, afterEach } from 'vitest'

import { authHeaders } from '@/lib/import/auth-headers'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('authHeaders', () => {
  it('sends JSON content type, or nothing for multipart, when there is no window', () => {
    expect(authHeaders()).toEqual({ 'Content-Type': 'application/json' })
    expect(authHeaders(false)).toEqual({})
  })

  it('adds the stored token as a Bearer header', () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('localStorage', { getItem: (k: string) => (k === 'auth_token' ? 'tok' : null) })
    expect(authHeaders()).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer tok' })
    expect(authHeaders(false)).toEqual({ Authorization: 'Bearer tok' })
  })

  it('adds no Authorization without a token', () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('localStorage', { getItem: () => null })
    expect(authHeaders(false)).toEqual({})
  })
})
