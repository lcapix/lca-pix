/**
 * X-API-1 / AUTH-5: the shared JSON helpers must not hand an error body back
 * as data, and a 401 must sign this browser out (not just drop the token).
 *
 * Runs in the node environment with a stub `window` and an in-memory
 * localStorage, so the redirect is observable: jsdom cannot navigate and does
 * not let a test replace window.location.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

class MemoryStorage {
  private m = new Map<string, string>()
  get length() {
    return this.m.size
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null
  }
  getItem(k: string) {
    return this.m.has(k) ? (this.m.get(k) as string) : null
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v))
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
  clear() {
    this.m.clear()
  }
}

let storage: MemoryStorage
let redirects: string[]
let pathname: string
let fetchMock: ReturnType<typeof vi.fn>

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function load() {
  vi.resetModules()
  const api = await import('@/lib/api-client')
  const store = await import('@/lib/store')
  const notes = await import('@/lib/notifications-store')
  return { api, store, notes }
}

beforeEach(() => {
  storage = new MemoryStorage()
  redirects = []
  pathname = '/home'
  const location = {
    get pathname() {
      return pathname
    },
    get href() {
      return `http://localhost${pathname}`
    },
    set href(v: string) {
      redirects.push(v)
    },
  }
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('window', { location, localStorage: storage })
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  storage.setItem('auth_token', 'token-abc')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiGet / apiPost / apiPut / apiDelete', () => {
  it('return the parsed body when the server answers 2xx', async () => {
    const { api } = await load()
    fetchMock.mockResolvedValue(json(200, { success: true, projects: [{ id: 1 }] }))
    await expect(api.apiGet('/api/projects')).resolves.toEqual({
      success: true,
      projects: [{ id: 1 }],
    })
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer token-abc')
  })

  it('throw an ApiError with the status, the server error and its details on a 500', async () => {
    const { api } = await load()
    fetchMock.mockResolvedValue(
      json(500, { error: 'Failed to fetch projects', details: 'ER_NO_SUCH_TABLE' }),
    )
    const err = await api.apiGet('/api/projects').catch((e) => e)
    expect(err).toBeInstanceOf(api.ApiError)
    expect(err).toBeInstanceOf(Error)
    expect(err.status).toBe(500)
    expect(err.message).toBe('Failed to fetch projects')
    expect(err.details).toBe('ER_NO_SUCH_TABLE')
  })

  it.each([
    ['apiPost', 403, { error: 'Admin access required' }],
    ['apiPut', 404, { error: 'Case not found' }],
    ['apiDelete', 409, { error: 'Case has runs' }],
  ] as const)('%s rejects on %i instead of returning the error body as data', async (fn, status, body) => {
    const { api } = await load()
    fetchMock.mockResolvedValue(json(status, body))
    const call =
      fn === 'apiDelete' ? api.apiDelete('/api/x') : (api as any)[fn]('/api/x', { a: 1 })
    await expect(call).rejects.toMatchObject({ name: 'ApiError', status, message: body.error })
  })

  it('give a readable message when the error body is not JSON', async () => {
    const { api } = await load()
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }))
    const err = await api.apiGet('/api/projects').catch((e) => e)
    expect(err).toBeInstanceOf(api.ApiError)
    expect(err.status).toBe(502)
    expect(err.message).toBe('Request failed (502)')
    expect(err.details).toBeUndefined()
  })

  it('return null for an empty 2xx body instead of throwing a JSON parse error', async () => {
    const { api } = await load()
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(api.apiDelete('/api/flows/9')).resolves.toBeNull()
  })
})

describe('a 401 ends the session on this browser', () => {
  async function signedInWith401() {
    const loaded = await load()
    const { store, notes } = loaded
    store.useAuthStore.getState().login({
      id: '7',
      name: 'Previous User',
      email: 'prev@example.com',
      createdAt: new Date(),
    } as any)
    store.useProjectStore.setState({
      projects: [{ id: 'p1', name: 'Previous user project' } as any],
    })
    notes.useNotificationsStore.getState().push({
      kind: 'project',
      status: 'info',
      actor: 'Previous User',
      text: 'Created a project',
    })
    storage.setItem('user', JSON.stringify({ id: 7 }))
    expect(storage.getItem('lcapix-projects')).not.toBeNull()
    expect(storage.getItem('lcapix-notifications')).not.toBeNull()
    fetchMock.mockImplementation(async () => json(401, { error: 'Invalid or expired token' }))
    return loaded
  }

  it('clears the token, the auth store and the cached projects and feed, then redirects once', async () => {
    const { api, store, notes } = await signedInWith401()

    const results = await Promise.allSettled([
      api.apiGet('/api/projects'),
      api.apiRequest('/api/integrations/status'),
      api.apiPost('/api/projects', { name: 'x' }),
    ])

    for (const r of results) {
      expect(r.status).toBe('rejected')
      expect((r as PromiseRejectedResult).reason).toMatchObject({ name: 'ApiError', status: 401 })
    }
    expect(redirects).toEqual(['/auth/login?error=session_expired'])

    expect(storage.getItem('auth_token')).toBeNull()
    expect(storage.getItem('user')).toBeNull()
    expect(storage.getItem('lcapix-projects')).toBeNull()
    expect(storage.getItem('lcapix-notifications')).toBeNull()

    expect(store.useAuthStore.getState().isAuthenticated).toBe(false)
    expect(store.useAuthStore.getState().user).toBeNull()
    // AuthGuard reads the persisted copy on the next page load.
    const persistedAuth = JSON.parse(storage.getItem('lcapix-auth') as string)
    expect(persistedAuth.state.isAuthenticated).toBe(false)
    expect(persistedAuth.state.user).toBeNull()

    expect(store.useProjectStore.getState().projects).toEqual([])
    expect(notes.useNotificationsStore.getState().items).toEqual([])
  })

  it('does not start new requests once the redirect is under way', async () => {
    const { api } = await signedInWith401()
    await api.apiGet('/api/projects').catch(() => {})
    const calls = fetchMock.mock.calls.length
    await expect(api.apiGet('/api/cases/1')).rejects.toMatchObject({ status: 401 })
    expect(fetchMock.mock.calls.length).toBe(calls)
    expect(redirects).toHaveLength(1)
  })

  it('does not redirect again when already on the login page', async () => {
    pathname = '/auth/login'
    const { api, store } = await signedInWith401()
    await expect(api.apiGet('/api/auth/profile')).rejects.toMatchObject({ status: 401 })
    expect(redirects).toEqual([])
    expect(store.useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('leaves the session alone for a request made with requireAuth: false', async () => {
    const { api, store } = await signedInWith401()
    const res = await api.apiRequest('/api/public', { requireAuth: false })
    expect(res.status).toBe(401)
    expect(redirects).toEqual([])
    expect(storage.getItem('auth_token')).toBe('token-abc')
    expect(store.useAuthStore.getState().isAuthenticated).toBe(true)
  })
})
