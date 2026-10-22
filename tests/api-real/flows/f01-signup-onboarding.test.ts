/**
 * F1. Sign up -> onboarding -> home (USER_FLOWS.md F1), at the API level:
 * POST /api/auth/signup, GET/PUT /api/auth/profile, then what /home loads.
 */
import { describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { freshIp } from '../support/http';
import { sqlOne } from '../support/db';
import { newPassword, uniqueEmail } from '../support/users';

const signup = (json: unknown) => api.post('/api/auth/signup', { json, ip: freshIp() });

describe('F1 sign up -> onboarding -> home', () => {
  it('walks the whole flow and leaves one onboarded account', async () => {
    const email = uniqueEmail('f1');
    const password = newPassword();

    // F1.2 signup: the username is derived on the server from the email.
    const res = await signup({ email, password, full_name: 'Fay First', username: 'ignored-client-name' });
    expect(res.status).toBe(201);
    expect(res.json.success).toBe(true);
    expect(res.json.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(res.json.user).toMatchObject({ email, account_type: 'user' });
    expect(res.json.user.username).toMatch(/^f1(-[0-9a-f]+)?$/);
    expect(res.json.user.username).not.toContain('ignored');
    const token = res.json.token;

    // F1.3 onboarding page: profile needs onboarding (company missing).
    const p1 = await api.get('/api/auth/profile', { token });
    expect(p1.status).toBe(200);
    expect(p1.json.profile).toMatchObject({ email, fullName: 'Fay First', company: null, needsOnboarding: true });

    // F1.4 save the onboarding form.
    const put = await api.put('/api/auth/profile', {
      token,
      json: { fullName: 'Fay First', company: 'Kiln & Co', role: 'Engineer', useCase: 'product', country: 'US' },
    });
    expect(put.status).toBe(200);

    // F1.5 home: profile, projects, integration status.
    const p2 = await api.get('/api/auth/profile', { token });
    expect(p2.json.profile).toMatchObject({ fullName: 'Fay First', company: 'Kiln & Co', useCase: 'product', needsOnboarding: false });
    const projects = await api.get('/api/projects', { token });
    expect(projects.status).toBe(200);
    expect(projects.json.projects).toEqual([]);
    const status = await api.get('/api/integrations/status', { token });
    expect(status.status).toBe(200);
    expect(status.json.substances.total).toBeGreaterThan(1000);

    const row = await sqlOne('SELECT is_active, account_type, full_name, company, onboarded_at, password_hash FROM account WHERE email = ?', [email]);
    expect(row).toMatchObject({ is_active: 1, account_type: 'user', full_name: 'Fay First', company: 'Kiln & Co' });
    expect(row.onboarded_at).not.toBeNull();
    expect(row.password_hash).toMatch(/^\$2[aby]\$10\$/);

    // A second save does not move onboarded_at.
    const firstOnboarded = String(row.onboarded_at);
    await api.put('/api/auth/profile', { token, json: { fullName: 'Fay F.', company: 'Kiln & Co' } });
    const again = await sqlOne('SELECT onboarded_at, full_name FROM account WHERE email = ?', [email]);
    expect(String(again.onboarded_at)).toBe(firstOnboarded);
    expect(again.full_name).toBe('Fay F.');
  });

  it('refuses bad input with 400 and a taken email with a generic 409', async () => {
    const email = uniqueEmail('f1dup');
    expect((await signup({ email, password: newPassword() })).status).toBe(201);

    const cases: Array<[unknown, number, RegExp]> = [
      [{ password: newPassword() }, 400, /Email and password are required/],
      [{ email: uniqueEmail('x') }, 400, /Email and password are required/],
      [{ email: 'not-an-email', password: newPassword() }, 400, /valid email/],
      [{ email: uniqueEmail('x'), password: 'short1' }, 400, /at least 8/],
      [{ email: uniqueEmail('x'), password: 'x'.repeat(73) }, 400, /at most 72 bytes/],
      [{ email: uniqueEmail('x'), password: newPassword(), full_name: { a: 1 } }, 400, /Name must be text/],
      [{ email: { $gt: '' }, password: newPassword() }, 400, /Email and password are required/],
    ];
    for (const [body, status, message] of cases) {
      const r = await signup(body);
      expect(r.status, JSON.stringify(body)).toBe(status);
      expect(r.json.error).toMatch(message);
    }

    const dup = await signup({ email, password: newPassword() });
    expect(dup.status).toBe(409);
    // Generic: it does not confirm the address is registered.
    expect(dup.json.error).toBe(
      'We could not create an account with those details. If you already have an account, log in instead.',
    );
  });

  it('two people with the same email local part get different usernames', async () => {
    const tag = uniqueEmail('twin').split('+')[1].split('@')[0];
    const a = await signup({ email: `jsmith.${tag}@one.test`, password: newPassword() });
    const b = await signup({ email: `jsmith.${tag}@two.test`, password: newPassword() });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.json.user.username).not.toBe(b.json.user.username);
  });
});
