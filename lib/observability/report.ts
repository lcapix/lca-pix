/**
 * The error-monitoring hook. Every server error worth a person's attention
 * comes through reportError: the 500s routes answer (lib/http.ts
 * internalError), uncaught errors Next sees (instrumentation.ts
 * onRequestError) and, in production, every console.error.
 *
 * Today it writes one structured line marked "alert": true. Monitoring is off
 * until an account exists; turning it on is one of:
 *   - a Vercel log drain to the provider, filtered on "alert":true (no code), or
 *   - the provider's SDK, registered in instrumentation.ts register():
 *       setErrorSink((err, ctx) => Sentry.captureException(err, { extra: ctx }))
 */
import { log } from './log';

type Sink = (err: unknown, context: Record<string, unknown>) => void;
let sink: Sink | null = null;

export function setErrorSink(next: Sink | null): void {
  sink = next;
}

export function reportError(err: unknown, context: Record<string, unknown> = {}): void {
  log('error', String(context.event ?? 'error'), { ...context, event: undefined, alert: true, err });
  if (!sink) return;
  try {
    sink(err, context);
  } catch {
    // A failing monitor must never turn into a failing request.
  }
}
