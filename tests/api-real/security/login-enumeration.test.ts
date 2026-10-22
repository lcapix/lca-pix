/**
 * Account enumeration through login (L2, AUTH-6): an unknown email, a wrong
 * password, a Google-only account and a deactivated account with a wrong
 * password all get the same status and the same body. Only the right
 * password on a deactivated account learns that it is inactive. Timing is
 * not asserted here (the route burns one bcrypt compare in every case).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { freshIp } from '../support/http';
import { deactivate, createUser, uniqueEmail, type TestUser } from '../support/users';
import { googleCallback } from '../support/google';

const login = (email: string, password: string) => api.post('/api/auth/login', { json: { email, password }, ip: freshIp() });

let active: TestUser;
let inactive: TestUser;
let googleEmail: string;
beforeAll(async () => {
  active = await createUser('enum');
  inactive = await createUser('enumdee');
  await deactivate(inactive);
  googleEmail = uniqueEmail('enumgoogle');
  await googleCallback({ email: googleEmail });
});

describe('login enumeration', () => {
  it('unknown email, wrong password, Google-only account, inactive + wrong password: identical 401', async () => {
    const responses = [
      await login(uniqueEmail('nobody'), 'Wrong-password-1'),
      await login(active.email, 'Wrong-password-1'),
      await login(googleEmail, 'Wrong-password-1'),
      await login(googleEmail, '!oauth-only'),
      await login(inactive.email, 'Wrong-password-1'),
      await login(active.email.toUpperCase(), active.password + 'x'),
    ];
    for (const r of responses) {
      expect(r.status).toBe(401);
      expect(r.text).toBe('{"error":"Invalid email or password"}');
      expect(r.headers.get('set-cookie')).toBeNull();
    }
  });

  it('only the right password on an inactive account says it is inactive (403)', async () => {
    const r = await login(inactive.email, inactive.password);
    expect(r.status).toBe(403);
    expect(r.json).toEqual({ error: 'Account is inactive. Please contact support.' });
    expect(r.json.token).toBeUndefined();
  });

  it('signup does not confirm a registered address either', async () => {
    const taken = await api.post('/api/auth/signup', { json: { email: active.email, password: 'Another-pass-9' }, ip: freshIp() });
    const takenGoogle = await api.post('/api/auth/signup', { json: { email: googleEmail, password: 'Another-pass-9' }, ip: freshIp() });
    expect(taken.status).toBe(409);
    expect(takenGoogle.text).toBe(taken.text);
  });
});
