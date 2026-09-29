import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import * as db from '@/lib/db-helpers';
import {
  createToken,
  verifyToken,
  verifyPassword,
  dummyPasswordCheck,
  isPasswordLogin,
  OAUTH_ONLY_PASSWORD_HASH,
  usernameBase,
  generateUniqueUsername,
} from '@/lib/auth';

vi.mock('@/lib/db-helpers');

const SECRET = process.env.JWT_SECRET as string;

describe('verifyToken (I4: algorithm pinned to HS256)', () => {
  it('accepts a token the app signed', () => {
    const t = createToken({ id: 7, email: 'a@b.co' });
    expect(verifyToken(t)?.id).toBe(7);
    expect(jwt.decode(t, { complete: true })?.header.alg).toBe('HS256');
  });

  it('rejects a token signed with another HMAC algorithm, even with the right secret', () => {
    const t = jwt.sign({ id: 7, email: 'a@b.co' }, SECRET, { algorithm: 'HS512' });
    expect(verifyToken(t)).toBeNull();
  });
});

describe('password checks', () => {
  it('verifies a real bcrypt hash', async () => {
    const h = await bcrypt.hash('correct horse 1', 4);
    expect(await verifyPassword('correct horse 1', h)).toBe(true);
    expect(await verifyPassword('wrong', h)).toBe(false);
  });

  it('never matches the OAuth-only marker, and does not throw on it', async () => {
    expect(await verifyPassword('anything', OAUTH_ONLY_PASSWORD_HASH)).toBe(false);
    expect(await verifyPassword('', OAUTH_ONLY_PASSWORD_HASH)).toBe(false);
  });

  it('runs a real (slow) bcrypt compare on the non-bcrypt path so timing does not reveal it', async () => {
    const spy = vi.spyOn(bcrypt, 'compare');
    await verifyPassword('x', OAUTH_ONLY_PASSWORD_HASH);
    await dummyPasswordCheck('x');
    expect(spy).toHaveBeenCalledTimes(2);
    for (const call of spy.mock.calls) expect(String(call[1])).toMatch(/^\$2[aby]\$\d{2}\$/);
    spy.mockRestore();
  });

  it('isPasswordLogin is false only for the OAuth-only marker', () => {
    expect(isPasswordLogin(OAUTH_ONLY_PASSWORD_HASH)).toBe(false);
    expect(isPasswordLogin('$2b$10$abcdefghijklmnopqrstuuJ1dW1a6m0x1yqj3n0H0q0q0q0q0q0q')).toBe(true);
  });
});

describe('usernameBase', () => {
  it('derives a clean handle from an email local part', () => {
    expect(usernameBase('J.Smith+lca@corp.com')).toBe('j.smith');
    expect(usernameBase('ÄÖÜ weird!!@x.io')).toBe('weird');
    expect(usernameBase('!!!@x.io')).toBe('user');
    expect(usernameBase('a'.repeat(80) + '@x.io').length).toBeLessThanOrEqual(40);
  });
});

describe('generateUniqueUsername (AUTH-4)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns the base when it is free', async () => {
    vi.mocked(db.exists).mockResolvedValue(false);
    expect(await generateUniqueUsername('jsmith@corp.com')).toBe('jsmith');
  });

  it('adds a suffix on collision and stays within the column width', async () => {
    vi.mocked(db.exists).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const name = await generateUniqueUsername('jsmith@other.org');
    expect(name).toMatch(/^jsmith-[a-z0-9]{4,}$/);
    expect(name.length).toBeLessThanOrEqual(50);
  });
});

describe('isDuplicateKeyError', () => {
  it('matches MySQL duplicate-key errors, optionally by key name', async () => {
    const { isDuplicateKeyError } = await import('@/lib/auth');
    const e = { code: 'ER_DUP_ENTRY', message: "Duplicate entry 'x' for key 'account.username'" };
    expect(isDuplicateKeyError(e)).toBe(true);
    expect(isDuplicateKeyError(e, 'username')).toBe(true);
    expect(isDuplicateKeyError(e, 'email')).toBe(false);
    expect(isDuplicateKeyError({ code: 'ER_DUP_ENTRY', message: "for key 'email'" }, 'email')).toBe(true);
    expect(isDuplicateKeyError(new Error('other'))).toBe(false);
  });
});
