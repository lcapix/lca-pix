/**
 * Test accounts, made through the real signup and login routes so their
 * tokens carry `pv` exactly as production tokens do. Passwords are generated
 * per run and never printed.
 *
 * What no API does is done in SQL on the throwaway database: making a
 * platform admin, deactivating an account, changing a password hash.
 */
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { api, expectStatus } from './api';
import { freshIp } from './http';
import { sql } from './db';

export interface TestUser {
  label: string;
  id: number;
  email: string;
  password: string;
  username: string;
  token: string;
}

export const RUN = Date.now().toString(36);
let seq = 0;

export function uniqueEmail(label: string): string {
  seq++;
  return `${label.toLowerCase().replace(/[^a-z0-9]/g, '')}+${RUN}${seq}@lcapix.test`;
}

export function newPassword(): string {
  return `Pw${randomBytes(12).toString('base64url')}7`;
}

export async function createUser(
  label: string,
  opts: { fullName?: string; company?: string; onboard?: boolean; email?: string } = {},
): Promise<TestUser> {
  const email = opts.email ?? uniqueEmail(label);
  const password = newPassword();
  const res = expectStatus(
    await api.post('/api/auth/signup', { json: { email, password, full_name: opts.fullName ?? label }, ip: freshIp() }),
    201,
    `signup ${label}`,
  );
  const user: TestUser = {
    label,
    id: Number(res.json.user.id),
    email,
    password,
    username: res.json.user.username,
    token: res.json.token,
  };
  if (opts.onboard !== false) {
    expectStatus(
      await api.put('/api/auth/profile', {
        token: user.token,
        json: { fullName: opts.fullName ?? `${label} Tester`, company: opts.company ?? 'LCAPIX Test', useCase: 'product' },
      }),
      200,
      `profile ${label}`,
    );
  }
  return user;
}

/** POST /api/auth/login; returns the new token (and stores it on the user). */
export async function login(user: TestUser): Promise<string> {
  const res = expectStatus(
    await api.post('/api/auth/login', { json: { email: user.email, password: user.password }, ip: freshIp() }),
    200,
    `login ${user.label}`,
  );
  user.token = res.json.token;
  return user.token;
}

export async function makePlatformAdmin(user: TestUser): Promise<void> {
  await sql(`UPDATE account SET account_type = 'admin' WHERE id = ?`, [user.id]);
}

export async function deactivate(user: TestUser): Promise<void> {
  await sql('UPDATE account SET is_active = 0 WHERE id = ?', [user.id]);
}

/**
 * Change the account's password hash behind its back (as a password change
 * would). Every token issued before carries the old `pv`, so it is revoked.
 * The user object keeps the old token; `password` becomes the new one.
 */
export async function changePasswordHash(user: TestUser): Promise<void> {
  user.password = newPassword();
  await sql('UPDATE account SET password_hash = ? WHERE id = ?', [await bcrypt.hash(user.password, 4), user.id]);
}

/** A token for `user` signed with a secret that is not the app's. */
export function wrongSecretToken(user: TestUser): string {
  const pv = (jwt.decode(user.token) as any)?.pv;
  return jwt.sign({ id: user.id, email: user.email, account_type: 'user', pv }, 'not-the-app-secret', {
    algorithm: 'HS256',
    expiresIn: '1h',
  });
}

/** The payload of a user's real token (id, email, pv, …). */
export function tokenPayload(user: TestUser): Record<string, any> {
  return jwt.decode(user.token) as Record<string, any>;
}
