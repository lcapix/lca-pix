/**
 * Route handlers by URL. The file for a URL is derived the way the App Router
 * does it: `/api/cases/{caseId}/components` → app/api/cases/[caseId]/components/route.ts.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RouteHandler } from './http';

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const API_DIR = path.join(ROOT, 'app', 'api');

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

/** '/api/cases/{caseId}/components?x=1' → absolute path of its route.ts. */
export function routeFile(template: string): string {
  const pathname = template.split('?')[0];
  const rel = pathname
    .replace(/^\/api\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((seg) => seg.replace(/^\{(\w+)\}$/, '[$1]'));
  return path.join(API_DIR, ...rel, 'route.ts');
}

/** Names of the path parameters in a template (query placeholders excluded). */
export function pathParams(template: string): string[] {
  return [...template.split('?')[0].matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
}

const cache = new Map<string, Record<string, unknown>>();

export async function loadHandler(template: string, method: string): Promise<RouteHandler> {
  const file = routeFile(template);
  if (!existsSync(file)) throw new Error(`No route file for ${template} (${file})`);
  let mod = cache.get(file);
  if (!mod) {
    mod = (await import(/* @vite-ignore */ file)) as Record<string, unknown>;
    cache.set(file, mod);
  }
  const handler = mod[method.toUpperCase()];
  if (typeof handler !== 'function') throw new Error(`${file} exports no ${method}`);
  return handler as RouteHandler;
}

/** Every app/api route file with the HTTP methods it exports, as URL templates. */
export function listRoutes(): Array<{ template: string; methods: string[]; file: string }> {
  const out: Array<{ template: string; methods: string[]; file: string }> = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name === 'route.ts') {
        const src = readFileSync(full, 'utf8');
        const methods = HTTP_METHODS.filter((m) =>
          new RegExp(`export\\s+(?:async\\s+)?function\\s+${m}\\b|export\\s+const\\s+${m}\\b`).test(src),
        );
        const rel = path.relative(API_DIR, path.dirname(full)).split(path.sep).filter(Boolean);
        const template = `/api/${rel.map((s) => s.replace(/^\[(\w+)\]$/, '{$1}')).join('/')}`.replace(/\/$/, '');
        out.push({ template, methods: [...methods], file: full });
      }
    }
  };
  walk(API_DIR);
  return out.sort((a, b) => a.template.localeCompare(b.template));
}
