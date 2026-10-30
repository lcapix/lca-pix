// The old "new comparative case" address: New case does it now, opened on a what-if copy.

import { redirect } from 'next/navigation'

export default async function NewComparativeCasePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  redirect(`/project/${encodeURIComponent(projectId)}/case/new?kind=whatif`)
}
