/**
 * Next.js instrumentation (runs once per server instance, and on every
 * uncaught request error). Server logs are structured in production; see
 * lib/observability/. Edge has no console patch to make, and no route here
 * runs on it.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NODE_ENV !== 'production' && process.env.LOG_FORMAT !== 'json') return;
  const { installJsonConsole } = await import('./lib/observability/console-json');
  installJsonConsole();
}

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routePath: string; routeType: string },
): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { reportError } = await import('./lib/observability/report');
  // The path without its query: a callback's query can carry one-time codes.
  reportError(err, { event: 'uncaught', method: request.method, path: request.path.split('?')[0], route: context.routePath, kind: context.routeType });
}
