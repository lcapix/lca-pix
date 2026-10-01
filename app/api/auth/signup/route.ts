/**
 * POST /api/auth/signup
 * Create a new user account
 *
 * Body: { email, password, full_name? }. The username is derived here from the
 * email (unique, suffixed on collision); a client-sent `username` is ignored,
 * since the user never sees that field. A taken email gets a generic message.
 * Limited to RATE_LIMITS.signup per IP.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readJson } from '@/lib/http';
import { insert, exists } from '@/lib/db-helpers';
import {
  hashPassword,
  createToken,
  generateUniqueUsername,
  isDuplicateKeyError,
} from '@/lib/auth';
import { RATE_LIMITS, clientIp, enforceRateLimit } from '@/lib/rate-limit';

// Same shape the account table's chk_email_format constraint enforces.
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const DUPLICATE =
  'We could not create an account with those details. If you already have an account, log in instead.';

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function POST(request: NextRequest) {
  try {
    const json = await readJson(request);
    if (!json.ok) return json.response;
    const body = json.body;
    const { email, password } = body ?? {};
    const fullNameRaw = body?.full_name;

    // Validation
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return bad('Email and password are required');
    }
    if (fullNameRaw !== undefined && fullNameRaw !== null && typeof fullNameRaw !== 'string') {
      return bad('Name must be text');
    }
    const normalizedEmail = email.trim();
    if (normalizedEmail.length > 100 || !EMAIL_RE.test(normalizedEmail)) {
      return bad('Please enter a valid email address');
    }
    if (password.length < 8) {
      return bad('Password must be at least 8 characters long');
    }
    // bcrypt only reads the first 72 bytes; a longer password would be
    // silently truncated, so refuse it instead.
    if (Buffer.byteLength(password, 'utf8') > 72) {
      return bad('Password must be at most 72 bytes long');
    }
    const fullName = typeof fullNameRaw === 'string' ? fullNameRaw.trim().slice(0, 120) || null : null;

    const limited = await enforceRateLimit(RATE_LIMITS.signup, [clientIp(request)]);
    if (limited) return limited;

    if (await exists('SELECT 1 FROM account WHERE email = ?', [normalizedEmail])) {
      return NextResponse.json({ error: DUPLICATE }, { status: 409 });
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Insert, retrying the username if another signup takes it first.
    let userId = 0;
    let username = '';
    for (let attempt = 0; attempt < 3 && !userId; attempt++) {
      username = await generateUniqueUsername(normalizedEmail);
      try {
        userId = await insert(
          `INSERT INTO account (username, full_name, email, password_hash, account_type, is_active)
           VALUES (?, ?, ?, ?, 'user', TRUE)`,
          [username, fullName, normalizedEmail, password_hash]
        );
      } catch (err: any) {
        if (isDuplicateKeyError(err, 'email')) {
          return NextResponse.json({ error: DUPLICATE }, { status: 409 });
        }
        if (isDuplicateKeyError(err, 'username')) continue;
        throw err;
      }
    }
    if (!userId) throw new Error('could not allocate a unique username');

    // Create JWT token (bound to this password hash: a change revokes it)
    const token = createToken({ id: userId, email: normalizedEmail, account_type: 'user' }, password_hash);

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        username,
        email: normalizedEmail,
        account_type: 'user',
      },
      token,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
