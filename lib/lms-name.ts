/**
 * The course's learning system, named on the hand-in line ("grades stay in
 * Canvas", D9). Unset: the line names none.
 */
export const LMS_NAME = (process.env.NEXT_PUBLIC_LCAPIX_LMS_NAME ?? '').trim().slice(0, 40) || null
