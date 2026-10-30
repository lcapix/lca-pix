// The old "two ways in" address: New case does it now, opened on building by hand.

import { redirect } from 'next/navigation'

export default async function StartPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  redirect(`/project/${encodeURIComponent(projectId)}/case/new?kind=hand`)
}
