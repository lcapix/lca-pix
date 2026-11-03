/**
 * What a new password must be, at sign-up and when it is changed: at least 8
 * characters, and at most 72 bytes (bcrypt reads only the first 72, so a longer
 * one would be cut short without anyone knowing). Null when it is fine.
 */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string' || !password) return 'Enter a password'
  if (password.length < 8) return 'Password must be at least 8 characters long'
  if (Buffer.byteLength(password, 'utf8') > 72) return 'Password must be at most 72 bytes long'
  return null
}
