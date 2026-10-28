/**
 * The only place a browser run sets account_type. No route will, and it is
 * limited to the throwaway lcapix_t_e2e_* database on this machine.
 */
import pg from 'pg';

const LOCAL = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

export async function promotePlatformAdmin(database: string, userId: number): Promise<void> {
  const host = process.env.DATABASE_HOST || '127.0.0.1';
  if (!LOCAL.has(host.toLowerCase()) || !/^lcapix_t_e2e_[a-z0-9_]+$/.test(database)) {
    throw new Error(`Refusing to set account_type outside the throwaway e2e database (${host}/${database})`);
  }
  const password = process.env.DATABASE_PASSWORD;
  const client = new pg.Client({
    host,
    port: Number(process.env.DATABASE_PORT || 5433),
    user: process.env.DATABASE_USER || 'postgres',
    password: password ? password : undefined,
    database,
  });
  await client.connect();
  try {
    const res = await client.query(
      `UPDATE account SET account_type = 'admin' WHERE id = $1 AND account_type <> 'admin'`,
      [userId],
    );
    if (res.rowCount !== 1) {
      throw new Error(`admin seed: expected to promote one account, updated ${res.rowCount}`);
    }
  } finally {
    await client.end();
  }
}
