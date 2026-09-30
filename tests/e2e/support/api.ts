/**
 * A thin client for the app's own HTTP API, used to seed data and to set up
 * per-test fixtures. Everything goes through http://localhost:<port>; nothing
 * is written to the database directly.
 */
import { randomBytes } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import { BASE_URL } from './paths';

export type ApiUser = {
  id: number;
  email: string;
  username: string;
  /** Full name as saved through onboarding (null when not onboarded). */
  name: string | null;
  password: string;
  token: string;
};

export class ApiError extends Error {
  constructor(
    readonly method: string,
    readonly path: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(`${method} ${path} → ${status}: ${body.slice(0, 400)}`);
  }
}

/** A throwaway password: random, long, with a digit (the signup form wants one). */
export function newPassword(): string {
  return `e2e-${randomBytes(12).toString('base64url')}-7`;
}

/**
 * Signup is limited to 3 per hour per client IP, and the limiter keys on the
 * first x-forwarded-for hop. Each API-created account gets its own made-up
 * address so fixtures never eat the budget of the one signup a test drives
 * through the real form.
 */
function fakeIp(): string {
  const b = randomBytes(3);
  return `10.${b[0]}.${b[1]}.${(b[2] % 250) + 1}`;
}

export class Api {
  constructor(
    readonly request: APIRequestContext,
    readonly token?: string,
    readonly baseURL: string = BASE_URL,
  ) {}

  as(token: string): Api {
    return new Api(this.request, token, this.baseURL);
  }

  async call<T = any>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
    const send = () =>
      this.request.fetch(`${this.baseURL}${path}`, {
        method,
        headers: {
          // A fresh connection per call: next dev closes idle keep-alive
          // sockets, and a request sent on one as it closes dies with ECONNRESET.
          Connection: 'close',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        data: body === undefined ? undefined : JSON.stringify(body),
        timeout: 120_000,
      });
    let res;
    try {
      res = await send();
    } catch (e) {
      // Reset before any response (a socket the server was closing): retry
      // once. createUser copes with a signup that did land the first time.
      if (!/ECONNRESET|socket hang up|EPIPE/.test(String(e))) throw e;
      res = await send();
    }
    const text = await res.text();
    if (!res.ok()) throw new ApiError(method, path, res.status(), text);
    return (text ? JSON.parse(text) : null) as T;
  }

  get<T = any>(path: string) {
    return this.call<T>('GET', path);
  }
  post<T = any>(path: string, body?: unknown, headers?: Record<string, string>) {
    return this.call<T>('POST', path, body ?? {}, headers);
  }
  put<T = any>(path: string, body: unknown) {
    return this.call<T>('PUT', path, body);
  }
  del<T = any>(path: string) {
    return this.call<T>('DELETE', path);
  }

  /** Sign up through POST /api/auth/signup and, unless told not to, finish onboarding. */
  async createUser(opts: {
    email: string;
    fullName: string;
    company?: string;
    onboard?: boolean;
    password?: string;
  }): Promise<ApiUser> {
    const password = opts.password ?? newPassword();
    type Session = { user: { id: number; username: string; email: string }; token: string };
    let res: Session;
    try {
      res = await this.post<Session>(
        '/api/auth/signup',
        { email: opts.email, password, full_name: opts.onboard === false ? undefined : opts.fullName },
        { 'x-forwarded-for': fakeIp() },
      );
    } catch (e) {
      // A retried signup whose first attempt did land: the account is ours.
      if (!(e instanceof ApiError) || e.status !== 409) throw e;
      res = await this.post<Session>('/api/auth/login', { email: opts.email, password }, { 'x-forwarded-for': fakeIp() });
    }
    const user: ApiUser = {
      id: res.user.id,
      email: res.user.email,
      username: res.user.username,
      name: null,
      password,
      token: res.token,
    };
    if (opts.onboard !== false) {
      await this.as(user.token).put('/api/auth/profile', {
        fullName: opts.fullName,
        company: opts.company ?? 'E2E Test Co',
        role: 'Sustainability analyst',
        useCase: 'product',
        country: 'United States',
      });
      user.name = opts.fullName;
    }
    return user;
  }
}

/** A unique address for a per-test account. */
export function uniqueEmail(label: string): string {
  return `${label}-${Date.now().toString(36)}${randomBytes(2).toString('hex')}@e2e.lcapix.test`;
}

/**
 * Playwright storage state that signs `user` in the way the login page does:
 * the bearer token and user in localStorage plus the persisted Zustand auth
 * store that AuthGuard reads.
 */
export function storageStateFor(user: ApiUser, baseURL: string = BASE_URL) {
  const apiUser = { id: user.id, username: user.username, email: user.email, account_type: 'user' };
  const storeUser = {
    id: String(user.id),
    name: user.name ?? user.username,
    email: user.email,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  return {
    cookies: [] as any[],
    origins: [
      {
        origin: new URL(baseURL).origin,
        localStorage: [
          { name: 'auth_token', value: user.token },
          { name: 'user', value: JSON.stringify(apiUser) },
          { name: 'lcapix-auth', value: JSON.stringify({ state: { user: storeUser, isAuthenticated: true }, version: 0 }) },
        ],
      },
    ],
  };
}
