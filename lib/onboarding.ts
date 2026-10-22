/**
 * Onboarding (F1.3 "Tell us a little about you"). Pure rules shared by the
 * profile route, the Google sign-in hand-off and the screen.
 *
 *   - Full name is required to save; institution is optional.
 *   - The uses are teaching, lab and own study. A company workspace is shown
 *     as "In development" and cannot be chosen. The older values stay valid
 *     for accounts that chose them before.
 *   - "Skip for now" finishes onboarding with nothing saved.
 * The choice is saved with the profile; every account gets the same tools.
 */

export const USE_CASES = [
  { id: 'teaching', label: 'Teaching a class', hint: 'Students copy your base case.' },
  { id: 'lab', label: 'Research in a lab', hint: 'Studies with the people you add.' },
  { id: 'own_study', label: 'My own study', hint: 'Just you, one project at a time.' },
] as const
export type UseCase = (typeof USE_CASES)[number]['id']

/** Shown, not selectable. */
export const USE_CASE_IN_DEVELOPMENT = { id: 'company', label: 'A company workspace' } as const

/** Values saved before the education screens; still accepted and kept. */
export const LEGACY_USE_CASES = ['product', 'facility', 'comparative', 'research', 'other'] as const

export function isAcceptedUseCase(v: unknown): boolean {
  return (
    typeof v === 'string' &&
    (USE_CASES.some((u) => u.id === v) || (LEGACY_USE_CASES as readonly string[]).includes(v))
  )
}

/** Onboarding is done once it was saved or skipped; nothing else re-opens it. */
export function needsOnboarding(account: { onboarded_at?: unknown }): boolean {
  return account.onboarded_at == null || account.onboarded_at === ''
}
