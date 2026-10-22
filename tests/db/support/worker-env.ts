/**
 * Runs in every worker before any test file is imported: points
 * DATABASE_* (read by lib/db and by tests/e2e-local) at the throwaway
 * database the global setup built.
 */
import { inject } from 'vitest';
import './context';

const db = inject('testDb');
process.env.DATABASE_HOST = db.host;
process.env.DATABASE_PORT = db.port;
process.env.DATABASE_USER = db.user;
process.env.DATABASE_PASSWORD = db.password;
process.env.DATABASE_NAME = db.database;
if (inject('e2eLocal')) process.env.LOCAL_DB = '1';
