/**
 * `api.post('/api/projects/12/cases', { token, json })`: find the route file
 * for a concrete URL (as the App Router would), pull the path params out of
 * it, and call the exported handler for the method.
 */
import { call, type ApiResponse, type CallOptions } from './http';
import { listRoutes, loadHandler } from './routes';

interface Compiled {
  template: string;
  re: RegExp;
  names: string[];
  dynamic: number;
}

let compiled: Compiled[] | null = null;

function routeTable(): Compiled[] {
  if (compiled) return compiled;
  compiled = listRoutes()
    .map(({ template }) => {
      const names: string[] = [];
      const re = new RegExp(
        `^${template.replace(/\{(\w+)\}/g, (_m, n) => {
          names.push(n);
          return '([^/]+)';
        })}/?$`,
      );
      return { template, re, names, dynamic: names.length };
    })
    .sort((a, b) => a.dynamic - b.dynamic);
  return compiled;
}

/** The route template and path params for a concrete URL. */
export function matchRoute(url: string): { template: string; params: Record<string, string> } {
  const pathname = new URL(url, 'http://localhost').pathname;
  for (const r of routeTable()) {
    const m = r.re.exec(pathname);
    if (m) {
      const params: Record<string, string> = {};
      r.names.forEach((n, i) => (params[n] = decodeURIComponent(m[i + 1])));
      return { template: r.template, params };
    }
  }
  throw new Error(`No route matches ${pathname}`);
}

export async function request(method: string, url: string, opts: CallOptions = {}): Promise<ApiResponse> {
  const { template, params } = matchRoute(url);
  const handler = await loadHandler(template, method);
  return call(handler, method, url, { ...opts, params: { ...params, ...(opts.params ?? {}) } });
}

export const api = {
  get: (url: string, opts?: CallOptions) => request('GET', url, opts),
  post: (url: string, opts?: CallOptions) => request('POST', url, opts),
  put: (url: string, opts?: CallOptions) => request('PUT', url, opts),
  delete: (url: string, opts?: CallOptions) => request('DELETE', url, opts),
};

/** Throws with the response body when the status is not the one expected. */
export function expectStatus(res: ApiResponse, status: number, what = 'request'): ApiResponse {
  if (res.status !== status) {
    throw new Error(`${what}: expected ${status}, got ${res.status}: ${res.text.slice(0, 400)}`);
  }
  return res;
}
