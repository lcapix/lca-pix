import { ComingSoon, EmptyState, PageHeader } from '@/components/lcapix/ds'

// Findings (E02, E09, E12): a result pinned with what it means. There is no
// findings store yet, so the page says so once and points to where results are.
export default function FindingsPage() {
  return (
    <>
      <PageHeader title="Findings" />
      <div className="ds-content">
        <ComingSoon>Pin a result as a finding, with what it means, and find it here again.</ComingSoon>
        <div className="ds-card">
          <EmptyState
            line="For now, results live on each case's Results page."
            action={
              <a className="ds-btn" href="/home">
                Go to your projects
              </a>
            }
          />
        </div>
      </div>
    </>
  )
}
