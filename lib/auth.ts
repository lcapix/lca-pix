/**
 * Authentication Utilities
 * JWT token generation, verification, and password hashing
 */

import bcrypt from 'bcrypt';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';
import { exists, queryOne } from './db-helpers';

// A guessable signing secret turns every account into a forgeable token; the
// app refuses to start without a real one (tests may inject their own).
const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET && process.env.NODE_ENV !== 'test') {
  throw new Error('JWT_SECRET is not set — configure it in .env.local / Vercel env');
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface UserPayload {
  id: number;
  email: string;
  account_type?: 'user' | 'admin';
  /** Fingerprint of the password hash the token was issued against. */
  pv?: string;
}

export type ProjectPermission = 'owner' | 'admin' | 'editor' | 'viewer';

/**
 * Why a request is not authenticated: no token, a bad or expired token, a
 * revoked token (the password hash changed), or an unknown or deactivated
 * account. Always a 401. Routes map it with `isAuthError` from
 * lib/route-guard; the messages are the ones routes used to match on.
 */
export class AuthError extends Error {
  readonly status = 401;
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface User {
  id: number;
  username: string;
  email: string;
  account_type: 'user' | 'admin';
  is_active: boolean;
  created_at: Date;
}

/**
 * `password_hash` value for an account created through Google sign-in: it has
 * no password. It is not a bcrypt hash, so no password can ever match it, and
 * it is how the Google flow tells its own accounts from password accounts
 * (the `account` table has no provider column).
 */
export const OAUTH_ONLY_PASSWORD_HASH = '!oauth-only';

// A bcrypt hash (cost 10) of a random value nobody knows. Compared against when
// there is no real hash to check, so an unknown email or an OAuth-only account
// costs the same time as a wrong password (no timing oracle).
const DUMMY_BCRYPT_HASH = '$2b$10$PRwZjBrwQEOAtk7Fp.OD.OrybgIheEo68NjzQuhFyByJ8NVJ2UTxi';
const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

/**
 * Hash a plain text password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/** True when the stored hash is a real password (not the OAuth-only marker). */
export function isPasswordLogin(passwordHash: string | null | undefined): boolean {
  return !!passwordHash && passwordHash !== OAUTH_ONLY_PASSWORD_HASH;
}

/** Burn one bcrypt compare's worth of time; always false. */
export async function dummyPasswordCheck(password: string): Promise<false> {
  await bcrypt.compare(String(password ?? ''), DUMMY_BCRYPT_HASH);
  return false;
}

/**
 * Compare a plain text password with a hash. Anything that is not a bcrypt
 * hash (the OAuth-only marker, an empty column) never matches, after the same
 * amount of work as a real compare.
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  if (typeof hashedPassword !== 'string' || !BCRYPT_HASH.test(hashedPassword)) {
    return dummyPasswordCheck(password);
  }
  return bcrypt.compare(String(password ?? ''), hashedPassword);
}

/**
 * `pv` claim: the first 16 hex chars of HMAC-SHA256(JWT_SECRET, password_hash).
 * Keyed, so a copy of the account table does not let anyone mint it, and short,
 * since it only has to change when the hash does.
 */
export function passwordFingerprint(passwordHash: string): string {
  return createHmac('sha256', JWT_SECRET).update(String(passwordHash ?? '')).digest('hex').slice(0, 16);
}

/**
 * True when the token was issued against the account's current password hash.
 * A token without `pv` (issued before revocation existed) never matches.
 */
export function tokenMatchesPassword(payload: { pv?: unknown }, passwordHash: string): boolean {
  if (typeof payload?.pv !== 'string') return false;
  const expected = Buffer.from(passwordFingerprint(passwordHash));
  const got = Buffer.from(payload.pv);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/**
 * Create a JWT for a user. `passwordHash` is the account's stored
 * password_hash (or the OAuth-only marker): the token carries its fingerprint,
 * and stops working as soon as the stored hash changes.
 */
export function createToken(payload: UserPayload, passwordHash: string): string {
  return jwt.sign({ ...payload, pv: passwordFingerprint(passwordHash) }, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Verify a JWT token and return the payload. Only HS256 is accepted: the
 * algorithm is ours to choose, never the token's.
 */
export function verifyToken(token: string): UserPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as UserPayload;
  } catch (error) {
    return null;
  }
}

/**
 * A username handle from an email address (or any seed): the local part
 * without a +tag, lower-cased, letters/digits/._- only, at most 40 chars.
 */
export function usernameBase(seed: string): string {
  const local = String(seed ?? '').split('@')[0].split('+')[0].toLowerCase();
  const clean = local
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 40)
    .replace(/[._-]+$/g, '');
  return clean.length >= 2 ? clean : 'user';
}

/**
 * A username nobody has yet, derived server-side (the `username` column is
 * UNIQUE, VARCHAR(50)). Collisions get a random suffix: jsmith, jsmith-3f9a1c.
 * Callers still retry on a duplicate-key error, since two sign-ups can race.
 */
export async function generateUniqueUsername(seed: string): Promise<string> {
  const base = usernameBase(seed);
  if (!(await exists('SELECT 1 FROM account WHERE username = ?', [base]))) return base;
  for (let i = 0; i < 8; i++) {
    const candidate = `${base}-${randomBytes(3).toString('hex')}`;
    if (!(await exists('SELECT 1 FROM account WHERE username = ?', [candidate]))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}${randomBytes(2).toString('hex')}`.slice(0, 50);
}

/** A MySQL duplicate-key error, optionally on a named unique key. */
export function isDuplicateKeyError(err: any, key?: string): boolean {
  if (err?.code !== 'ER_DUP_ENTRY') return false;
  if (!key) return true;
  return new RegExp(`for key '(?:[\\w]+\\.)?${key}'`).test(String(err?.message ?? err?.sqlMessage ?? ''));
}

/**
 * Extract JWT token from Authorization header
 */
export function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Verify authentication and return the user id. Throws an AuthError (401) when
 * there is no token, the token is bad or expired, the account is unknown or
 * inactive, or the account's password hash changed since the token was issued
 * (`pv` mismatch: password change, Google takeover).
 */
export async function requireAuth(request: Request): Promise<number> {
  const token = extractToken(request);
  if (!token) {
    throw new AuthError('No authentication token provided');
  }

  const payload = verifyToken(token);
  if (!payload) {
    throw new AuthError('Invalid or expired token');
  }

  // Verify user still exists and is active
  const user = await queryOne<any>(
    'SELECT id, is_active, password_hash FROM account WHERE id = ?',
    [payload.id]
  );

  if (!user || !user.is_active) {
    throw new AuthError('User account not found or inactive');
  }

  // Revoked: issued against another password hash, or before pv existed.
  if (!tokenMatchesPassword(payload, user.password_hash)) {
    throw new AuthError('Invalid or expired token');
  }

  return payload.id;
}

/**
 * Get current user from request
 */
export async function getCurrentUser(request: Request): Promise<User | null> {
  try {
    const userId = await requireAuth(request);
    const user = await queryOne<any>(
      `SELECT id, username, email, account_type, is_active, created_at
       FROM account WHERE id = ?`,
      [userId]
    );
    return user;
  } catch (error) {
    return null;
  }
}

/**
 * Check if user has admin privileges
 */
export async function requireAdmin(request: Request): Promise<number> {
  const userId = await requireAuth(request);
  const user = await queryOne<any>(
    'SELECT account_type FROM account WHERE id = ?',
    [userId]
  );

  if (!user || user.account_type !== 'admin') {
    throw new Error('Admin privileges required');
  }

  return userId;
}

/**
 * Check if user has permission to access a project
 */
export async function checkProjectAccess(
  userId: number,
  projectId: number,
  requiredPermission?: ProjectPermission
): Promise<boolean> {
  // First check if user is the project owner (direct ownership via owner_id)
  const project = await queryOne<any>(
    `SELECT owner_id FROM project WHERE project_id = ?`,
    [projectId]
  );

  if (project && project.owner_id === userId) {
    // Project owner always has full access
    return true;
  }

  // If not the owner, check project_members table for delegated permissions
  const result = await queryOne<any>(
    `SELECT p.permission_name
     FROM project_members pm
     JOIN permissions p ON pm.permission_id = p.permission_id
     WHERE pm.project_id = ? AND pm.user_id = ?`,
    [projectId, userId]
  );

  if (!result) {
    return false;
  }

  if (!requiredPermission) {
    return true;
  }

  // Permission hierarchy: owner > admin > editor > viewer
  const permissionLevel: Record<string, number> = {
    owner: 4,
    admin: 3,
    editor: 2,
    viewer: 1,
  };

  return permissionLevel[result.permission_name] >= permissionLevel[requiredPermission];
}

/**
 * Require project access with specific permission
 */
export async function requireProjectAccess(
  request: Request,
  projectId: number,
  requiredPermission?: 'owner' | 'admin' | 'editor' | 'viewer'
): Promise<number> {
  const userId = await requireAuth(request);
  const hasAccess = await checkProjectAccess(userId, projectId, requiredPermission);

  if (!hasAccess) {
    throw new Error('Insufficient permissions to access this project');
  }

  return userId;
}
