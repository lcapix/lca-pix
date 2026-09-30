/**
 * API Client - Centralized API request handler with automatic authentication
 *
 * apiRequest adds the JWT from localStorage and returns the raw Response (the
 * caller checks res.ok). apiGet / apiPost / apiPut / apiDelete parse the JSON
 * and throw an ApiError when the server answers with a non-2xx status, so an
 * error body is never handed back as data (X-API-1).
 *
 * A 401 on an authenticated request ends the session on this browser: the
 * token, the auth store, the cached projects and the activity feed are
 * cleared, and the page goes to /auth/login?error=session_expired once.
 */
import { clearClientSession } from "./store"

interface ApiRequestOptions extends RequestInit {
  requireAuth?: boolean // Default: true
}

/** A non-2xx answer from one of our API routes. */
export class ApiError extends Error {
  readonly status: number
  /** The route's `details` field, when it sends one. */
  readonly details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    if (details !== undefined) this.details = details
  }
}

const SESSION_EXPIRED_MESSAGE = "Your session has expired. Please log in again."
const LOGIN_REDIRECT = "/auth/login?error=session_expired"

// Module-level guard: once we've decided to redirect for auth failure,
// ignore subsequent 401s and swallow TypeError from fetches that were
// cancelled by the navigation (otherwise the user sees a confusing
// "TypeError: Failed to fetch" overlay mid-redirect).
let redirectingForAuth = false

function endSessionAndRedirect(): void {
  if (typeof window === "undefined" || redirectingForAuth) return
  redirectingForAuth = true
  clearClientSession()
  // Already on the login page: clearing is enough, and navigating again
  // would reload it in a loop.
  if (window.location.pathname.startsWith("/auth/login")) return
  window.location.href = LOGIN_REDIRECT
}

/**
 * Make an authenticated API request
 *
 * @param url - API endpoint path (e.g., "/api/projects")
 * @param options - Fetch options (method, body, headers, etc.)
 * @returns Response object (check res.ok; only a 401 throws)
 */
export async function apiRequest(
  url: string,
  options: ApiRequestOptions = {}
): Promise<Response> {
  const { requireAuth = true, ...fetchOptions } = options

  // Get token from localStorage
  const token = typeof window !== 'undefined' ? localStorage.getItem("auth_token") : null

  // Build headers. A FormData body must set its own Content-Type: the browser
  // adds the multipart boundary, and forcing application/json here makes the
  // server unable to parse the upload at all.
  const isFormData =
    typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(fetchOptions.headers as Record<string, string> | undefined),
  }

  // Add Authorization header if token exists and auth is required
  if (requireAuth && token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // If a redirect is already in flight, do not start another fetch.
  if (redirectingForAuth) {
    throw new ApiError(401, SESSION_EXPIRED_MESSAGE)
  }

  // Append a cache-busting query param to defeat browsers that have
  // stale 308 redirects cached from a previous server config. The
  // HTTP-cache layer treats `?_t=<ts>` as a new resource so the cached
  // 308 never matches. cache: 'no-store' alone is not enough for 308s
  // in Chromium — 308 is "permanent" and persists across cache modes.
  const bustedUrl = url.includes('?')
    ? `${url}&_t=${Date.now()}`
    : `${url}?_t=${Date.now()}`

  // Make the request — wrap to coerce network-level aborts (caused by
  // window.location.href navigation) into our standard auth error.
  let response: Response
  try {
    response = await fetch(bustedUrl, { cache: 'no-store', ...fetchOptions, headers })
  } catch (err) {
    if (redirectingForAuth) {
      // fetch was aborted by our own navigation — silent.
      throw new ApiError(401, SESSION_EXPIRED_MESSAGE)
    }
    throw err
  }

  // Handle 401 Unauthorized - end the session and redirect to login
  if (response.status === 401 && requireAuth) {
    endSessionAndRedirect()
    throw new ApiError(401, SESSION_EXPIRED_MESSAGE)
  }

  return response
}

/** Parse a JSON response, or throw ApiError with the server's error text. */
async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  let body: any = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      if (response.ok) throw new ApiError(response.status, "The server sent a response that is not JSON")
    }
  }
  if (!response.ok) {
    const message =
      (typeof body?.error === "string" && body.error) ||
      (typeof body?.message === "string" && body.message) ||
      `Request failed (${response.status})`
    throw new ApiError(response.status, message, body?.details)
  }
  return body as T
}

/**
 * Make a GET request with authentication
 */
export async function apiGet<T = any>(url: string): Promise<T> {
  const response = await apiRequest(url, { method: "GET" })
  return readJson<T>(response)
}

/**
 * Make a POST request with authentication
 */
export async function apiPost<T = any>(url: string, data: any): Promise<T> {
  const response = await apiRequest(url, {
    method: "POST",
    body: JSON.stringify(data),
  })
  return readJson<T>(response)
}

/**
 * Make a PUT request with authentication
 */
export async function apiPut<T = any>(url: string, data: any): Promise<T> {
  const response = await apiRequest(url, {
    method: "PUT",
    body: JSON.stringify(data),
  })
  return readJson<T>(response)
}

/**
 * Make a DELETE request with authentication
 */
export async function apiDelete<T = any>(url: string): Promise<T> {
  const response = await apiRequest(url, { method: "DELETE" })
  return readJson<T>(response)
}
