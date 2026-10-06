/**
 * The `test` every file imports. On top of e2e's own fixtures (app, screen, browser):
 *
 *   netGuard   set up for every test: the browser may load http://localhost:3150
 *              (and 127.0.0.1 / [::1]) and nothing else; any other request is aborted
 *   api        an Api client for the app's HTTP API (support/api.ts), unauthenticated; .as(token)
 *   newUser()  a fresh account through the API, onboarded unless told otherwise
 *   signIn()   signs the browser in as an account (the localStorage the login page
 *              writes) and opens a path
 *
 * Every test makes its own accounts and data, so tests never share state and
 * can run in any order on any worker.
 */
import { test as base } from '@e2e-dev/web';
import { Api, signedInStorage, uniqueEmail, type ApiUser } from './api.ts';

export { expect } from 'e2e';
export { describe } from '@e2e-dev/web';

/** Any absolute http(s) URL whose host is not this machine. */
const NOT_LOCAL = /^https?:\/\/(?!(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$))/i;

const withApi = base.extend<{ netGuard: void; api: Api }>({
  netGuard: async ({ browser }, use) => {
    await browser.route(NOT_LOCAL, async (route) => {
      await route.abort();
    });
    await use();
  },
  api: async ({ app }, use) => {
    if (!app.baseUrl) throw new Error('the target declares no app.url');
    await use(new Api(app.baseUrl));
  },
});

export const test = withApi.extend<{
  newUser: (label?: string, opts?: { onboard?: boolean; fullName?: string }) => Promise<ApiUser>;
  signIn: (user: ApiUser, path: string) => Promise<void>;
}>({
  newUser: async ({ api }, use) => {
    await use((label = 'journey', opts = {}) =>
      api.createUser({ email: uniqueEmail(label), fullName: opts.fullName ?? 'Jordan Journey', onboard: opts.onboard }),
    );
  },
  signIn: async ({ app, browser }, use) => {
    await use(async (user, path) => {
      // Any same-origin document will do for writing localStorage; a static file skips a page compile.
      await app.open('/placeholder.svg');
      await browser.evaluate((storage: Record<string, string>) => {
        localStorage.clear();
        for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value);
        return null;
      }, signedInStorage(user));
      await app.open(path);
    });
  },
});

/** Escapes a string for use inside a RegExp. */
export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
