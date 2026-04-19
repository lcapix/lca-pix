/**
 * API Client - Centralized API request handler with automatic authentication
 *
 * This helper automatically adds the JWT token from localStorage to all API requests
 * and handles common error scenarios like 401 unauthorized responses.
 */

interface ApiRequestOptions extends RequestInit {
  requireAuth?: boolean // Default: true
}

/**
 * Make an authenticated API request
 *
 * @param url - API endpoint path (e.g., "/api/projects")
 * @param options - Fetch options (method, body, headers, etc.)
 * @returns Response object
 *
 * @example
 * // GET request
 * const response = await apiRequest("/api/projects")
 * const data = await response.json()
 *
 * @example
 * // POST request
 * const response = await apiRequest("/api/projects", {
 *   method: "POST",
 *   body: JSON.stringify({ name: "New Project" })
 * })
 */
// Module-level guard: once we've decided to redirect for auth failure,
// ignore subsequent 401s and swallow TypeError from fetches that were
// cancelled by the navigation (otherwise the user sees a confusing
// "TypeError: Failed to fetch" overlay mid-redirect).
let redirectingForAuth = false

export async function apiRequest(
  url: string,
  options: ApiRequestOptions = {}
): Promise<Response> {
  const { requireAuth = true, ...fetchOptions } = options

  // Get token from localStorage
  const token = typeof window !== 'undefined' ? localStorage.getItem("auth_token") : null

  // Build headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  }

  // Add Authorization header if token exists and auth is required
  if (requireAuth && token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // If a redirect is already in flight, do not start another fetch.
  if (redirectingForAuth) {
    throw new Error("Authentication required")
  }

  // Make the request — wrap to coerce network-level aborts (caused by
  // window.location.href navigation) into our standard auth error.
  let response: Response
  try {
    response = await fetch(url, { ...fetchOptions, headers })
  } catch (err) {
    if (redirectingForAuth) {
      // fetch was aborted by our own navigation — silent.
      throw new Error("Authentication required")
    }
    throw err
  }

  // Handle 401 Unauthorized - redirect to login
  if (response.status === 401 && requireAuth) {
    if (typeof window !== 'undefined' && !redirectingForAuth) {
      redirectingForAuth = true
      localStorage.removeItem("auth_token")
      localStorage.removeItem("user")
      window.location.href = "/auth/login?error=session_expired"
    }
    throw new Error("Authentication required")
  }

  return response
}

/**
 * Make a GET request with authentication
 */
export async function apiGet<T = any>(url: string): Promise<T> {
  const response = await apiRequest(url, { method: "GET" })
  return response.json()
}

/**
 * Make a POST request with authentication
 */
export async function apiPost<T = any>(url: string, data: any): Promise<T> {
  const response = await apiRequest(url, {
    method: "POST",
    body: JSON.stringify(data),
  })
  return response.json()
}

/**
 * Make a PUT request with authentication
 */
export async function apiPut<T = any>(url: string, data: any): Promise<T> {
  const response = await apiRequest(url, {
    method: "PUT",
    body: JSON.stringify(data),
  })
  return response.json()
}

/**
 * Make a DELETE request with authentication
 */
export async function apiDelete<T = any>(url: string): Promise<T> {
  const response = await apiRequest(url, { method: "DELETE" })
  return response.json()
}
