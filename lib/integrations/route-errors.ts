// lib/integrations/route-errors.ts
// Integration routes log the real failure (console + integration_log, which
// is admin-only) and answer the client with a fixed message. Raw error text
// can carry DB host names, schema details or upstream API responses.
import { logIntegration, type LogParams } from './log';

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Write an integration_log row without letting a logging failure escape. */
export async function logSafely(params: LogParams, context: string): Promise<void> {
  try {
    await logIntegration(params);
  } catch (logErr) {
    console.error(`${context}: could not write integration_log:`, logErr);
  }
}

/** Log a failed integration call server-side (console + integration_log). */
export async function logFailure(
  params: Omit<LogParams, 'status' | 'recordsAffected'>,
  err: unknown,
  context: string,
): Promise<void> {
  console.error(`${context}:`, err);
  await logSafely(
    {
      ...params,
      recordsAffected: 0,
      status: 'failed',
      details: { ...(params.details ?? {}), error: errorText(err) },
    },
    context,
  );
}
