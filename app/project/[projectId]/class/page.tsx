// P31: the old Class page's address. Class progress lives on Cases now, so the
// address answers with a redirect before anything renders.

import { redirect } from 'next/navigation'

export default async function ClassPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  redirect(`/project/${encodeURIComponent(projectId)}/cases`)
}
