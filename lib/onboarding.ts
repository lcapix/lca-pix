/**
 * Onboarding (F1.3 "Tell us a little about you"). Pure rules shared by the
 * profile route, the Google sign-in hand-off and the screen.
 *
 *   - Full name is required to save; company is optional.
 *   - Onboarding asks for no use case. The profile page offers its own list;
 *     values saved before (including the education version's) stay valid so
 *     those accounts can still save their profile.
 *   - "Skip for now" finishes onboarding with nothing saved.
 */

/** The profile page's choices (app/profile). */
export const PROFILE_USE_CASES = ['product', 'facility', 'comparative', 'research', 'other'] as const

/** Saved by the education version's onboarding; accepted, never offered. */
export const LEGACY_USE_CASES = ['teaching', 'lab', 'own_study'] as const

export function isAcceptedUseCase(v: unknown): boolean {
  return (
    typeof v === 'string' &&
    ((PROFILE_USE_CASES as readonly string[]).includes(v) || (LEGACY_USE_CASES as readonly string[]).includes(v))
  )
}

/** Onboarding is done once it was saved or skipped; nothing else re-opens it. */
export function needsOnboarding(account: { onboarded_at?: unknown }): boolean {
  return account.onboarded_at == null || account.onboarded_at === ''
}
