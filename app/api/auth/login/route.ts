/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 *
 * Every failure before a correct password looks the same ("Invalid email or
 * password", same bcrypt cost), so the response never says whether an email
 * is registered, uses Google sign-in, or is deactivated. Only a caller who
 * knows the password learns that the account is inactive. Attempts are
 * limited per IP + email (RATE_LIMITS.login).
 */

import { NextRequest, NextResponse } from 'next/server';
import { readJson } from '@/lib/http';
import { queryOne } from '@/lib/db-helpers';
import { verifyPassword, dummyPasswordCheck, createToken } from '@/lib/auth';
import { RATE_LIMITS, clientIp, enforceRateLimit } from '@/lib/rate-limit';

const INVALID = 'Invalid email or password';

export async function POST(request: NextRequest) {
  try {
    const json = await readJson(request);
    if (!json.ok) return json.response;
    const body = json.body;
    const email = body?.email;
    const password = body?.password;

    // Validation: strings only (an object here is never a credential).
    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password ||
      email.length > 254 ||
      password.length > 1024
    ) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }
    const normalizedEmail = email.trim();

    const limited = await enforceRateLimit(RATE_LIMITS.login, [clientIp(request), normalizedEmail]);
    if (limited) return limited;

    // Find user by email
    const user = await queryOne<any>(
      `SELECT id, username, email, password_hash, account_type, is_active
       FROM account WHERE email = ?`,
      [normalizedEmail]
    );

    if (!user) {
      await dummyPasswordCheck(password);
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }

    // Password first: account state is only disclosed to its owner.
    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }

    if (!user.is_active) {
      return NextResponse.json(
        { error: 'Account is inactive. Please contact support.' },
        { status: 403 }
      );
    }

    // Create JWT token (bound to this password hash: a change revokes it)
    const token = createToken(
      { id: user.id, email: user.email, account_type: user.account_type },
      user.password_hash
    );

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        account_type: user.account_type,
      },
      token,
    });

  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Failed to login' }, { status: 500 });
  }
}
