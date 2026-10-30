// The old "new base case" address: New case does it now, opened on a base case.

import { redirect } from 'next/navigation'

export default async function NewBaseCasePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  redirect(`/project/${encodeURIComponent(projectId)}/case/new?kind=base`)
}
