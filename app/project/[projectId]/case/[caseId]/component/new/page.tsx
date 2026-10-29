import { redirect } from 'next/navigation'

/** The old "new component" page opens the case with the Add step form. */
export default async function NewComponentPage({
  params,
}: {
  params: Promise<{ projectId: string; caseId: string }>
}) {
  const { projectId, caseId } = await params
  redirect(`/project/${encodeURIComponent(projectId)}/case/${encodeURIComponent(caseId)}?add=step`)
}
