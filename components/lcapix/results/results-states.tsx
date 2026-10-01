'use client'

// The results screen while its case loads, and when the case cannot be shown.
// Plain functions returning JSX, not components: the page returns them from
// the same spot as the loaded view, and React keeps reusing the shared
// `.app-shell` root across those states exactly as when they were inline.

import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Loading state. */
export function resultsLoadingView() {
  return (
    <div className="app-shell" style={{ minHeight: '100vh' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '120px 24px',
          gap: 16,
        }}
      >
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--brand-primary)' }} />
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Loading case data…</p>
      </div>
    </div>
  )
}

/** Case not found (404 or a body without the case), or could not load it. */
export function caseNotFoundView({
  caseLoadError,
  router,
}: {
  caseLoadError: null | 'notfound' | 'error'
  router: { back: () => void }
}) {
  return (
    <div className="app-shell" style={{ minHeight: '100vh' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '120px 24px',
          gap: 16,
        }}
      >
        <AlertCircle className="h-10 w-10" style={{ color: 'var(--text-tertiary)' }} />
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>
          {caseLoadError === 'error' ? 'Could not load this case' : 'Case not found'}
        </h2>
        {caseLoadError === 'error' && (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, margin: 0 }}>
            The server did not answer as expected. Try again in a moment.
          </p>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
          </Button>
          {caseLoadError === 'error' && (
            <Button onClick={() => window.location.reload()} variant="outline">
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
