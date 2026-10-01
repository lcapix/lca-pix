/**
 * F18. Profile: GET/PUT /api/auth/profile for the signed-in account only.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { sqlOne } from '../support/db';
import { createUser, type TestUser } from '../support/users';

let u: TestUser;
let other: TestUser;
beforeAll(async () => {
  u = await createUser('f18');
  other = await createUser('f18other');
});

describe('F18 profile', () => {
  it('reads and saves the own profile; onboarded_at stays put', async () => {
    const before = await sqlOne('SELECT onboarded_at FROM account WHERE id = ?', [u.id]);
    const got = await api.get('/api/auth/profile', { token: u.token });
    expect(got.status).toBe(200);
    expect(got.json.profile).toMatchObject({ id: u.id, email: u.email, username: u.username, needsOnboarding: false });

    const put = await api.put('/api/auth/profile', {
      token: u.token,
      json: { fullName: '  Pat Profile ', company: 'Glazeworks', role: 'LCA analyst', useCase: 'research', country: 'DE' },
    });
    expect(put.status).toBe(200);
    const row = await sqlOne('SELECT full_name, company, role, use_case, country, onboarded_at FROM account WHERE id = ?', [u.id]);
    expect(row).toMatchObject({ full_name: 'Pat Profile', company: 'Glazeworks', role: 'LCA analyst', use_case: 'research', country: 'DE' });
    expect(String(row.onboarded_at)).toBe(String(before.onboarded_at));

    // Clearing an optional field stores NULL.
    await api.put('/api/auth/profile', { token: u.token, json: { fullName: 'Pat Profile', company: 'Glazeworks', role: '' } });
    expect((await sqlOne('SELECT role FROM account WHERE id = ?', [u.id])).role).toBeNull();
  });

  it('saves only the caller: fields naming another account are ignored', async () => {
    const res = await api.put('/api/auth/profile', {
      token: u.token,
      json: { fullName: 'Mine', company: 'Mine Co', id: other.id, email: other.email, account_type: 'admin', is_active: 0 },
    });
    expect(res.status).toBe(200);
    const mine = await sqlOne('SELECT email, account_type, is_active FROM account WHERE id = ?', [u.id]);
    expect(mine).toEqual({ email: u.email, account_type: 'user', is_active: 1 });
    const theirs = await sqlOne('SELECT full_name FROM account WHERE id = ?', [other.id]);
    expect(theirs.full_name).not.toBe('Mine');
  });

  it('400 for missing required fields and an unknown use case', async () => {
    for (const [json, msg] of [
      [{ company: 'x' }, /Full name is required/],
      [{ fullName: 'x' }, /Company/],
      [{ fullName: '   ', company: 'x' }, /Full name is required/],
      [{ fullName: 'x', company: 'y', useCase: 'hacking' }, /Invalid use case/],
    ] as const) {
      const r = await api.put('/api/auth/profile', { token: u.token, json });
      expect(r.status, JSON.stringify(json)).toBe(400);
      expect(r.json.error).toMatch(msg);
    }
  });

  // PROF-1 (fixed): each field is checked against its column (full_name 120,
  // company 160, role 120, use_case 60, country 80) before the UPDATE, so a
  // value that is too long gets 400 naming the field instead of a 500.
  it('over-long fields get 400, not 500 (PROF-1)', async () => {
    for (const [json, msg] of [
      [{ fullName: 'F'.repeat(121), company: 'ok' }, /full name.*120/i],
      [{ fullName: 'ok', company: 'C'.repeat(161) }, /company.*160/i],
      [{ fullName: 'ok', company: 'ok', role: 'R'.repeat(121) }, /role.*120/i],
      [{ fullName: 'ok', company: 'ok', country: 'Z'.repeat(81) }, /country.*80/i],
    ] as const) {
      const r = await api.put('/api/auth/profile', { token: u.token, json });
      expect(r.status, Object.keys(json).join()).toBe(400);
      expect(r.json.error).toMatch(msg);
    }
    // At the limit is fine.
    const ok = await api.put('/api/auth/profile', { token: u.token, json: { fullName: 'F'.repeat(120), company: 'C'.repeat(160) } });
    expect(ok.status, ok.text).toBe(200);
  });
});
