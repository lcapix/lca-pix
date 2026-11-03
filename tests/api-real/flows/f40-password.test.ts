/**
 * F40. Changing a password (Profile) and the one-time password for someone
 * locked out (scripts/admin/reset-password.mjs). A new password signs out every
 * old token; the browser that changed it gets a fresh one.
 */
import { spawnSync } from 'node:child_process';
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { createUser, type TestUser } from '../support/users';

let u: TestUser;
beforeAll(async () => {
  u = await createUser('pw-change');
});

describe('F40 passwords', () => {
  it('a wrong current password, or a short new one, changes nothing', async () => {
    const wrong = await api.put('/api/auth/password', { token: u.token, json: { current_password: 'not-it-at-all', new_password: 'a-good-new-one' } });
    expect([wrong.status, wrong.json.error]).toEqual([400, 'The current password is not right.']);
    const short = await api.put('/api/auth/password', { token: u.token, json: { current_password: u.password, new_password: 'short' } });
    expect([short.status, short.json.error]).toEqual([400, 'Password must be at least 8 characters long']);
    expect((await api.get('/api/auth/me', { token: u.token })).status).toBe(200);
  });

  it('a new password: the old token stops, the fresh one works, and only the new password signs in', async () => {
    const res = await api.put('/api/auth/password', { token: u.token, json: { current_password: u.password, new_password: 'a-good-new-one' } });
    expect(res.status, res.text).toBe(200);
    expect((await api.get('/api/auth/me', { token: u.token })).status).toBe(401);
    expect((await api.get('/api/auth/me', { token: res.json.token })).status).toBe(200);
    expect((await api.post('/api/auth/login', { json: { email: u.email, password: u.password } })).status).toBe(401);
    expect((await api.post('/api/auth/login', { json: { email: u.email, password: 'a-good-new-one' } })).status).toBe(200);
  });

  it('the reset script gives a one-time password that signs in, and refuses an unknown email', async () => {
    const run = (email: string) =>
      spawnSync(process.execPath, ['scripts/admin/reset-password.mjs', email], { env: { ...process.env, DATABASE_URL: '' }, encoding: 'utf8' });
    const missing = run('nobody-at-all@example.test');
    expect(missing.status).toBe(1);
    const done = run(u.email.toUpperCase());
    expect(done.status, done.stderr).toBe(0);
    const password = done.stdout.split('\n')[1]?.trim();
    expect(password).toMatch(/^[a-z2-9]{16}$/);
    expect((await api.post('/api/auth/login', { json: { email: u.email, password: 'a-good-new-one' } })).status).toBe(401);
    expect((await api.post('/api/auth/login', { json: { email: u.email, password } })).status).toBe(200);
  });
});
