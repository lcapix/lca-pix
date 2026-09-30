import { redirect } from 'next/navigation'

// The legacy Saved comparisons page folds into Compare Cases (UX spec): its
// list lives on /project/[id]/comparison under "Saved comparisons".
export default async function ComparisonsRedirectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  redirect(`/project/${encodeURIComponent(projectId)}/comparison?tab=saved`)
}
