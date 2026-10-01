// Decisions the analytics loader makes between API calls: which cases to load,
// which runs count as completed, and what to tell the user when loading fails.

/** Cases to load, or the message to show when the requested case is missing. */
export type CasesToFetch<T> = { cases: T[] } | { error: string }

/**
 * Analytics is single-case. With a `?caseId=` filter it loads that case (an
 * error message when no case has that id); otherwise the base case, else the
 * first case. An empty filter string counts as no filter.
 */
export function pickCasesToFetch<T extends { id?: unknown; type?: unknown }>(
  cases: T[],
  filterCaseId: string | null,
): CasesToFetch<T> {
  if (filterCaseId) {
    const matching = cases.filter((c) => c.id === filterCaseId)
    if (matching.length === 0) {
      return { error: `Case not found (ID: ${filterCaseId})` }
    }
    return { cases: matching }
  }
  const base = cases.find((c) => c.type === 'base') ?? cases[0]
  return { cases: [base] }
}

/** Runs that count as completed: status "completed", or no status at all (older rows). */
export function filterCompletedRuns<T extends { status?: unknown }>(assessments: T[]): T[] {
  return assessments.filter(
    (a) =>
      a.status === 'completed' ||
      a.status === undefined ||
      a.status === null
  )
}

/** Message when a project has cases but none of the loaded ones has a completed run. */
export function noCompletedAssessmentsMessage(caseCount: number): string {
  return `Found ${caseCount} case(s), but no completed assessments.`
}

/**
 * What a thrown load error means for the page: an Error whose message mentions
 * "unauthorized" or "401" (any case) is an expired session; any other Error is
 * shown with its message; anything else is unexpected.
 */
export function classifyLoadError(error: unknown): { authError: boolean; message: string } {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('unauthorized') || msg.includes('401')) {
      return { authError: true, message: 'Your session has expired. Please log in again.' }
    }
    return { authError: false, message: `Error loading data: ${error.message}` }
  }
  return { authError: false, message: 'An unexpected error occurred.' }
}
