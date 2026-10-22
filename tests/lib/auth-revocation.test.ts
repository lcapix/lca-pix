/**
 * Token revocation (audit follow-up 9): every JWT carries `pv`, a keyed
 * fingerprint of the account's password_hash when the token was issued.
 * requireAuth compares it with the hash stored now, so changing the hash
 * (a password change, or a Google takeover that sets the OAuth-only marker)
 * ends every session issued before the change.
 *
 * Every requireAuth failure is an AuthError (status 401), so routes can map
 * it to 401 without matching message strings.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import * as db from '@/lib/db-helpers';
import {
  AuthError,
  createToken,
  OAUTH_ONLY_PASSWORD_HASH,
  passwordFingerprint,
  requireAuth,
  verifyToken,
} from '@/lib/auth';

vi.mock('@/lib/db-helpers');

const SECRET = process.env.JWT_SECRET as string;
// Two bcrypt-shaped hashes (the values never reach bcrypt here).
const HASH_A = '$2b$10$aaaaaaaaaaaaaaaaaaaaaOaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const HASH_B = '$2b$10$bbbbbbbbbbbbbbbbbbbbbObbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function withToken(token: string) {
  return new Request('http://t/api/projects', { headers: { Authorization: `Bearer ${token}` } });
}

function accountRow(row: Record<string, unknown> | null) {
  vi.mocked(db.queryOne).mockResolvedValue(row as any);
}

async function authError(p: Promise<unknown>): Promise<AuthError> {
  try {
    await p;
  } catch (e) {
    return e as AuthError;
  }
  throw new Error('expected requireAuth to reject');
}

beforeEach(() => vi.resetAllMocks());

describe('pv: a keyed fingerprint of the password hash in every token', () => {
  it('is 16 hex chars, differs per hash, and is not a plain hash of the stored value', () => {
    const a = passwordFingerprint(HASH_A);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(passwordFingerprint(HASH_A)).toBe(a);
    expect(passwordFingerprint(HASH_B)).not.toBe(a);
    expect(passwordFingerprint(OAUTH_ONLY_PASSWORD_HASH)).not.toBe(a);
    // Keyed with the server secret: someone holding a DB dump cannot mint it.
    expect(a).not.toBe(createHash('sha256').update(HASH_A).digest('hex').slice(0, 16));
  });

  it('createToken puts the fingerprint of the given hash in the token', () => {
    const t = createToken({ id: 5, email: 'a@b.co', account_type: 'user' }, HASH_A);
    const payload = verifyToken(t) as any;
    expect(payload.id).toBe(5);
    expect(payload.pv).toBe(passwordFingerprint(HASH_A));
  });

  it('a caller-supplied pv in the payload cannot override the computed one', () => {
    const t = createToken({ id: 5, email: 'a@b.co', pv: 'deadbeefdeadbeef' } as any, HASH_A);
    expect((verifyToken(t) as any).pv).toBe(passwordFingerprint(HASH_A));
  });
});

describe('requireAuth checks pv against the current password hash', () => {
  it('accepts a token while the hash is unchanged, reading the hash with the account row', async () => {
    const t = createToken({ id: 5, email: 'a@b.co' }, HASH_A);
    accountRow({ id: 5, is_active: 1, password_hash: HASH_A });
    await expect(requireAuth(withToken(t))).resolves.toBe(5);
    const [sql] = vi.mocked(db.queryOne).mock.calls[0];
    expect(sql).toMatch(/password_hash/);
  });

  it('rejects a token after the password hash changes', async () => {
    const t = createToken({ id: 5, email: 'a@b.co' }, HASH_A);
    accountRow({ id: 5, is_active: 1, password_hash: HASH_B });
    const e = await authError(requireAuth(withToken(t)));
    expect(e).toBeInstanceOf(AuthError);
    expect(e.status).toBe(401);
  });

  it('rejects a token issued before the takeover once the hash is the OAuth-only marker', async () => {
    const t = createToken({ id: 5, email: 'a@b.co' }, HASH_A);
    accountRow({ id: 5, is_active: 1, password_hash: OAUTH_ONLY_PASSWORD_HASH });
    expect(await authError(requireAuth(withToken(t)))).toBeInstanceOf(AuthError);
  });

  it('rejects a validly signed token that has no pv (issued before revocation existed)', async () => {
    const legacy = jwt.sign({ id: 5, email: 'a@b.co' }, SECRET, { algorithm: 'HS256', expiresIn: '1h' });
    accountRow({ id: 5, is_active: 1, password_hash: HASH_A });
    expect(await authError(requireAuth(withToken(legacy)))).toBeInstanceOf(AuthError);
  });

  it('rejects a token whose pv is not a string', async () => {
    const odd = jwt.sign({ id: 5, email: 'a@b.co', pv: 12345 }, SECRET, { algorithm: 'HS256', expiresIn: '1h' });
    accountRow({ id: 5, is_active: 1, password_hash: HASH_A });
    expect(await authError(requireAuth(withToken(odd)))).toBeInstanceOf(AuthError);
  });
});

describe('every requireAuth failure is an AuthError (401), never a plain Error', () => {
  it('no token', async () => {
    const e = await authError(requireAuth(new Request('http://t/x')));
    expect(e).toBeInstanceOf(AuthError);
    expect(e.status).toBe(401);
    expect(e.message).toBe('No authentication token provided');
  });

  it('bad signature', async () => {
    const e = await authError(requireAuth(withToken('not.a.jwt')));
    expect(e).toBeInstanceOf(AuthError);
    expect(e.message).toBe('Invalid or expired token');
  });

  it('unknown account', async () => {
    accountRow(null);
    const e = await authError(requireAuth(withToken(createToken({ id: 99, email: 'x@y.co' }, HASH_A))));
    expect(e).toBeInstanceOf(AuthError);
    expect(e.message).toBe('User account not found or inactive');
  });

  it('deactivated account', async () => {
    accountRow({ id: 5, is_active: 0, password_hash: HASH_A });
    const e = await authError(requireAuth(withToken(createToken({ id: 5, email: 'a@b.co' }, HASH_A))));
    expect(e).toBeInstanceOf(AuthError);
    expect(e.status).toBe(401);
    expect(e.message).toBe('User account not found or inactive');
  });
});
