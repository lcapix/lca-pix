// Helpers for the legacy saved-comparison routes (/api/comparisons). The
// comparison_runs / comparison_results / comparison_metadata tables hold JSON
// columns, which mysql2 hands back already parsed (older drivers or a TEXT
// column give a string). Read either way, exactly once.

const AUTH_ERRORS = new Set([
  'Unauthorized',
  'No authentication token provided',
  'Invalid or expired token',
  'User account not found or inactive',
]);

/** requireAuth's own failures: answer 401, not 500. */
export function isAuthError(err: unknown): boolean {
  return AUTH_ERRORS.has((err as any)?.message);
}

/** A JSON column's value, parsed at most once; `fallback` when unreadable. */
export function jsonColumn<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined || raw === '') return fallback;
  if (typeof raw !== 'string') return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** A JSON column that should hold an array; [] otherwise. */
export function jsonArray<T = unknown>(raw: unknown): T[] {
  const v = jsonColumn<unknown>(raw, []);
  return Array.isArray(v) ? (v as T[]) : [];
}
