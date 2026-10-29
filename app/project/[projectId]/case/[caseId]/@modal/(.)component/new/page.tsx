import { redirect } from 'next/navigation'

/** The intercepted new-component route opens the same Add step form. */
export default async function NewComponentInterceptedModal({
  params,
}: {
  params: Promise<{ projectId: string; caseId: string }>
}) {
  const { projectId, caseId } = await params
  redirect(`/project/${encodeURIComponent(projectId)}/case/${encodeURIComponent(caseId)}?add=step`)
}
