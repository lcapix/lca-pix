'use client'

// Whole-page views of the analytics page other than the loaded view. These are
// plain functions returning JSX, not components: the page returns their
// fragment in place of the loaded view's, and React must keep reconciling the
// Breadcrumb and the root div of each in place (a component boundary would
// remount them).

import { Loader2, AlertCircle } from 'lucide-react'
import { Breadcrumb } from '@/components/lcapix'

/** Breadcrumb of every analytics view: Projects › project › Analytics. */
export function analyticsBreadcrumb(projectName: string, onProjectClick: () => void) {
  return (
    <Breadcrumb
      items={[
        { label: 'Projects', page: 'home' },
        { label: projectName || 'Project', onClick: onProjectClick },
        { label: 'Analytics' },
      ]}
    />
  )
}

/** Loading view: breadcrumb and a centred spinner. */
export function analyticsLoadingView({
  projectName,
  onProjectClick,
}: {
  projectName: string
  onProjectClick: () => void
}) {
  return (
    <>
      {analyticsBreadcrumb(projectName, onProjectClick)}
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
        <Loader2
          className="h-8 w-8 animate-spin"
          style={{ color: 'var(--brand-primary)' }}
        />
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
          Loading analytics…
        </p>
      </div>
    </>
  )
}

/** Auth-error view: breadcrumb, the error message and a "Log in again" button. */
export function analyticsAuthErrorView({
  projectName,
  onProjectClick,
  errorMessage,
  onLogin,
}: {
  projectName: string
  onProjectClick: () => void
  errorMessage: string
  onLogin: () => void
}) {
  return (
    <>
      {analyticsBreadcrumb(projectName, onProjectClick)}
      <div
        style={{
          padding: '80px 32px',
          maxWidth: 560,
          margin: '0 auto',
          textAlign: 'center',
        }}
      >
        <AlertCircle
          className="h-10 w-10"
          style={{ color: 'var(--signal-error)', margin: '0 auto 16px' }}
        />
        <h2
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 8,
          }}
        >
          Authentication required
        </h2>
        <p
          style={{
            fontSize: 13,
            color: 'var(--text-tertiary)',
            marginBottom: 20,
          }}
        >
          {errorMessage}
        </p>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onLogin()}
        >
          Log in again
        </button>
      </div>
    </>
  )
}
