import { Suspense } from 'react'
import { ReportsPage } from '@/components/lcapix/reports/reports-page'

// Reports (E11): export a case as a report. ?project= and ?case= pick what to
// export (the sidebar's Reports carries the open project).
export default function Reports() {
  return (
    <Suspense fallback={null}>
      <ReportsPage />
    </Suspense>
  )
}
