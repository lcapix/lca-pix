import { NextRequest, NextResponse } from 'next/server'
import { createToken, hashPassword, isPasswordLogin, requireAuth, verifyPassword } from '@/lib/auth'
import { queryOne, execute } from '@/lib/db-helpers'
import { readJson, internalError } from '@/lib/http'
import { isAuthError } from '@/lib/route-guard'
import { passwordProblem } from '@/lib/password-rules'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/rate-limit'

/**
 * PUT /api/auth/password { current_password, new_password } — change the
 * caller's password (Profile). The new hash revokes every token signed against
 * the old one, so other browsers are signed out; this one gets a fresh token.
 * An account that signs in only with Google has no password to change.
 */
export async function PUT(request: NextRequest) {
  try {
    const userId = await requireAuth(request)
    const limited = await enforceRateLimit(RATE_LIMITS.passwordChange, [userId])
    if (limited) return limited
    const json = await readJson(request)
    if (!json.ok) return json.response
    const { current_password, new_password } = json.body as Record<string, unknown>
    const user = await queryOne<any>('SELECT id, email, account_type, password_hash FROM account WHERE id = ? AND is_active = 1', [userId])
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!isPasswordLogin(user.password_hash)) {
      return NextResponse.json({ error: 'This account signs in with Google, so it has no password to change.' }, { status: 400 })
    }
    if (typeof current_password !== 'string' || !(await verifyPassword(current_password, user.password_hash))) {
      return NextResponse.json({ error: 'The current password is not right.' }, { status: 400 })
    }
    const problem = passwordProblem(new_password)
    if (problem) return NextResponse.json({ error: problem }, { status: 400 })
    const hash = await hashPassword(new_password as string)
    await execute('UPDATE account SET password_hash = ? WHERE id = ?', [hash, userId])
    const token = createToken({ id: Number(user.id), email: user.email, account_type: user.account_type === 'admin' ? 'admin' : 'user' }, hash)
    return NextResponse.json({ success: true, token }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (isAuthError(err)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return internalError('password change', 'Could not change the password', err)
  }
}
