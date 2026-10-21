// The old results URL. In the workspace, results are the case's Results tab:
// /results?run=7 goes to ?tab=results&run=7. With
// NEXT_PUBLIC_LCAPIX_WORKSPACE=classic the earlier results page stays here.

import { redirect } from 'next/navigation'
import ResultsPage from '@/components/lcapix/results/results-page'
import { EDU_WORKSPACE } from '@/lib/ui-flags'

export default async function ResultsRoute({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; caseId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (!EDU_WORKSPACE) return <ResultsPage />
  const { projectId, caseId } = await params
  const run = (await searchParams).run
  const keep = typeof run === 'string' && /^\d{1,12}$/.test(run) ? `&run=${run}` : ''
  redirect(`/project/${encodeURIComponent(projectId)}/case/${encodeURIComponent(caseId)}?tab=results${keep}`)
}
