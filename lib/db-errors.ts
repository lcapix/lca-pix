/**
 * Which database errors a route may tolerate. Only one kind: the column or
 * table a newer migration adds is not there yet (Postgres 42703 and 42P01,
 * mapped to the MySQL-era codes by lib/db-dialect.ts). Anything else, a
 * dropped connection, a timeout, a bad query, is a real failure and must
 * reach the person, never read as "no data".
 *
 *   } catch (err) {
 *     if (!isSchemaGap(err)) throw err;
 *     // before migrate-0NN: ...
 *   }
 */
export function isSchemaGap(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return code === 'ER_BAD_FIELD_ERROR' || code === 'ER_NO_SUCH_TABLE';
}
