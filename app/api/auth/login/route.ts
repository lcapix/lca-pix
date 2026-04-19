/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db-helpers';
import { verifyPassword, createToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await queryOne<any>(
      `SELECT id, username, email, password_hash, account_type, is_active
       FROM account WHERE email = ?`,
      [email]
    );

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if account is active
    if (!user.is_active) {
      return NextResponse.json(
        { error: 'Account is inactive. Please contact support.' },
        { status: 401 }
      );
    }

    // Verify password
    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Create JWT token
    const token = createToken({
      id: user.id,
      email: user.email,
      account_type: user.account_type,
    });

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
    return NextResponse.json(
      { error: 'Failed to login', details: error.message },
      { status: 500 }
    );
  }
}
