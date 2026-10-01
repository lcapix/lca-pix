// Request headers for the import page's fetch calls. Not pure: in the browser
// it reads the session token from localStorage ('auth_token').

/**
 * JSON content type (unless json is false, for multipart bodies where the
 * browser sets the boundary) plus a Bearer token when one is stored.
 */
export function authHeaders(json = true): Record<string, string> {
  const h: Record<string, string> = json ? { 'Content-Type': 'application/json' } : {}
  const t = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  if (t) h.Authorization = 'Bearer ' + t
  return h
}
