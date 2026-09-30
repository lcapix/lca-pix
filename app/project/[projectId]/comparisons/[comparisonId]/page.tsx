import { redirect } from 'next/navigation'

// A legacy saved comparison opens from the "Saved comparisons" list on
// Compare Cases, which reads it with GET /api/comparisons.
export default async function ComparisonDetailRedirectPage({
  params,
}: {
  params: Promise<{ projectId: string; comparisonId: string }>
}) {
  const { projectId } = await params
  redirect(`/project/${encodeURIComponent(projectId)}/comparison?tab=saved`)
}
