/**
 * A thin client for the app's own HTTP API, used to set up each test's data.
 * Everything goes through http://localhost:3150 (the target's app.url); nothing
 * is written to the database directly. Mirrors tests/e2e/support/api.ts.
 */
import { randomBytes } from 'node:crypto';

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

/** A unique address for a per-test account. */
export function uniqueEmail(label: string): string {
  return `${label}-${Date.now().toString(36)}${randomBytes(2).toString('hex')}@e2e-tester.lcapix.test`;
}

/**
 * Signup is limited per client IP, keyed on the first x-forwarded-for hop.
 * Each API-made account gets its own made-up address so fixtures never use up
 * the budget of the one signup a test drives through the real form.
 */
function fakeIp(): string {
  const b = randomBytes(3);
  return `10.${b[0]}.${b[1]}.${(b[2] % 250) + 1}`;
}

export class Api {
  constructor(
    readonly baseUrl: string,
    readonly token?: string,
  ) {}

  as(token: string): Api {
    return new Api(this.baseUrl, token);
  }

  async call<T = any>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
    const send = () =>
      fetch(new URL(path, this.baseUrl), {
        method,
        headers: {
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
    let res: Response;
    try {
      res = await send();
    } catch (e) {
      // next dev closes idle keep-alive sockets; a request sent on one as it
      // closes fails before any response. Retry once (createUser copes with a
      // signup that did land the first time).
      if (!/ECONNRESET|socket|EPIPE|other side closed/i.test(String((e as Error)?.cause ?? e))) throw e;
      res = await send();
    }
    const text = await res.text();
    if (!res.ok) throw new ApiError(method, path, res.status, text);
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
  async createUser(opts: { email: string; fullName: string; onboard?: boolean }): Promise<ApiUser> {
    const password = newPassword();
    type Session = { user: { id: number; username: string; email: string }; token: string };
    let res: Session;
    try {
      res = await this.post<Session>(
        '/api/auth/signup',
        { email: opts.email, password, full_name: opts.onboard === false ? undefined : opts.fullName },
        { 'x-forwarded-for': fakeIp() },
      );
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 409) throw e;
      res = await this.post<Session>('/api/auth/login', { email: opts.email, password }, { 'x-forwarded-for': fakeIp() });
    }
    const user: ApiUser = { id: res.user.id, email: res.user.email, username: res.user.username, name: null, password, token: res.token };
    if (opts.onboard !== false) {
      await this.as(user.token).put('/api/auth/profile', {
        fullName: opts.fullName,
        company: 'E2E Test Co',
        role: 'Sustainability analyst',
        useCase: 'product',
        country: 'United States',
      });
      user.name = opts.fullName;
    }
    return user;
  }
}

export type Component = { component_id: number; component_name: string; parent_component_id: number | null };

/** The worked example in `user`'s account: one base case, TRACI 2.1 / US, functional unit set. */
export async function workedExample(api: Api, user: ApiUser): Promise<{ projectId: number; caseId: number }> {
  const r = await api.as(user.token).post<{ project_id: number; case_id: number }>('/api/example-project');
  return { projectId: r.project_id, caseId: r.case_id };
}

export async function components(api: Api, user: ApiUser, caseId: number): Promise<Component[]> {
  return (await api.as(user.token).get<{ components: Component[] }>(`/api/cases/${caseId}/components`)).components;
}

/**
 * What the login page leaves in localStorage: the bearer token, the API user
 * and the persisted Zustand auth store that AuthGuard reads (key `lcapix-auth`).
 */
export function signedInStorage(user: ApiUser): Record<string, string> {
  return {
    auth_token: user.token,
    user: JSON.stringify({ id: user.id, username: user.username, email: user.email, account_type: 'user' }),
    'lcapix-auth': JSON.stringify({
      state: {
        user: { id: String(user.id), name: user.name ?? user.username, email: user.email, createdAt: '2026-01-01T00:00:00.000Z' },
        isAuthenticated: true,
      },
      version: 0,
    }),
  };
}
