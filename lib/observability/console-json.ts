/**
 * Production only (instrumentation.ts): free-text console.error / console.warn
 * calls, of which the routes have dozens ("Get substances error:", err), come
 * out as structured lines; console.error ones go through reportError, so they
 * reach the monitor once it is on. Lines lib/observability/log.ts already
 * wrote pass through unchanged.
 */
import { isLogLine, log, redact } from './log';
import { reportError } from './report';

function text(args: unknown[]): string {
  return args
    .filter((a) => !(a instanceof Error))
    .map((a) => {
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ')
    .trim();
}

export function installJsonConsole(): void {
  const original = { error: console.error.bind(console), warn: console.warn.bind(console) };
  let inside = false;
  for (const level of ['error', 'warn'] as const) {
    console[level] = (...args: unknown[]) => {
      if (inside || (args.length === 1 && isLogLine(args[0]))) return original[level](...args);
      inside = true;
      try {
        const err = args.find((a) => a instanceof Error);
        const msg = redact(text(args)).slice(0, 2000) || undefined;
        if (level === 'error') reportError(err ?? msg, { event: 'console', msg });
        else log('warn', 'console', { msg, err });
      } finally {
        inside = false;
      }
    };
  }
}
