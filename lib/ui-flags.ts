/**
 * One setting turns the education shell off: NEXT_PUBLIC_LCAPIX_SHELL=classic
 * brings back the old top bar everywhere (a one-line rollback, plan §3).
 */
export const EDU_SHELL = process.env.NEXT_PUBLIC_LCAPIX_SHELL !== 'classic'

/**
 * The new case workspace (stage 4): NEXT_PUBLIC_LCAPIX_WORKSPACE=classic
 * brings back the old case editor and results page, in one line.
 */
export const EDU_WORKSPACE = process.env.NEXT_PUBLIC_LCAPIX_WORKSPACE !== 'classic'

