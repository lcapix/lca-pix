/**
 * POST /api/auth/signup
 * Create a new user account
 */

import { NextRequest, NextResponse } from 'next/server';
import { insert, exists } from '@/lib/db-helpers';
import { hashPassword, createToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, email, password } = body;

    // Validation
    if (!username || !email || !password) {
      return NextResponse.json(
        { error: 'Username, email, and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Check if username already exists
    const usernameExists = await exists(
      'SELECT 1 FROM account WHERE username = ?',
      [username]
    );

    if (usernameExists) {
      return NextResponse.json(
        { error: 'Username already taken' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const emailExists = await exists(
      'SELECT 1 FROM account WHERE email = ?',
      [email]
    );

    if (emailExists) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Insert new user
    const userId = await insert(
      `INSERT INTO account (username, email, password_hash, account_type, is_active)
       VALUES (?, ?, ?, 'user', TRUE)`,
      [username, email, password_hash]
    );

    // Create JWT token
    const token = createToken({ id: userId, email });

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        username,
        email,
        account_type: 'user',
      },
      token,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create account', details: error.message },
      { status: 500 }
    );
  }
}
