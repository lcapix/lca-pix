'use client'

const ENDPOINTS: { method: string; path: string; desc: string }[] = [
  {
    method: 'GET',
    path: '/api/projects',
    desc: 'List projects the current user has access to.',
  },
  {
    method: 'GET',
    path: '/api/projects/{projectId}',
    desc: 'Fetch a single project including members.',
  },
  {
    method: 'GET',
    path: '/api/projects/{projectId}/cases',
    desc: 'List all cases in a project with component / driver counts.',
  },
  {
    method: 'POST',
    path: '/api/projects/{projectId}/cases',
    desc: 'Create a new case. Body: { case_name, case_type, parent_case_id?, description? }.',
  },
  {
    method: 'GET',
    path: '/api/cases/{caseId}/components',
    desc: 'Fetch the component tree (flat list with parent_component_id).',
  },
  {
    method: 'POST',
    path: '/api/cases/{caseId}/components',
    desc: 'Create a component. Body must include component_name and component_type.',
  },
  {
    method: 'POST',
    path: '/api/cases/{caseId}/clone-from',
    desc: 'Copy every step and flow from another case in the same project. Runs are not copied.',
  },
  {
    method: 'GET',
    path: '/api/cases/{caseId}/assessments',
    desc: 'List assessment runs for a case (most recent first).',
  },
  {
    method: 'POST',
    path: '/api/cases/{caseId}/assessments',
    desc: 'Trigger a new assessment run with the current tree + flows.',
  },
  {
    method: 'GET',
    path: '/api/assessments/{runId}',
    desc: 'Fetch results for a single run, including per-component impacts.',
  },
  {
    method: 'GET',
    path: '/api/integrations/status',
    desc: 'Health check for connected data sources (openLCA, PubChem, BLS, EIA, etc).',
  },
]

const METHOD_COLOR: Record<string, string> = {
  GET: '#2d6a4f',
  POST: '#2f6db5',
  PUT: '#a8472b',
  DELETE: '#b91c1c',
}

export default function ApiReferencePage() {
  return (
    <>
      <div className="ds-section-label" style={{ marginBottom: 12 }}>
        GUIDE
      </div>
      <h1
        className="display display-lg"
        style={{ margin: 0, marginBottom: 16, color: 'var(--ds-text)' }}
      >
        API reference
      </h1>
      <p
        className="body"
        style={{
          fontSize: 15,
          color: 'var(--ds-text-2)',
          lineHeight: 1.7,
        }}
      >
        Every endpoint requires a bearer token in{' '}
        <code
          className="ds-mono"
          style={{
            padding: '1px 6px',
            background: 'var(--surface-overlay)',
            borderRadius: 3,
            fontSize: 12,
          }}
        >
          Authorization
        </code>
        . Tokens are issued by{' '}
        <code
          className="ds-mono"
          style={{
            padding: '1px 6px',
            background: 'var(--surface-overlay)',
            borderRadius: 3,
            fontSize: 12,
          }}
        >
          POST /api/auth/login
        </code>{' '}
        and stored in localStorage under{' '}
        <code
          className="ds-mono"
          style={{
            padding: '1px 6px',
            background: 'var(--surface-overlay)',
            borderRadius: 3,
            fontSize: 12,
          }}
        >
          auth_token
        </code>
        .
      </p>

      <div
        style={{
          marginTop: 32,
          border: '1px solid var(--ds-line)',
          borderRadius: 10,
          overflow: 'hidden',
          background: 'var(--ds-card)',
        }}
      >
        {ENDPOINTS.map((e, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '70px 1fr',
              gap: 14,
              padding: '12px 16px',
              borderTop: i === 0 ? 'none' : '1px solid var(--ds-line)',
              alignItems: 'baseline',
            }}
          >
            <span
              className="ds-mono"
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: METHOD_COLOR[e.method] ?? 'var(--ds-text-2)',
                letterSpacing: '0.05em',
              }}
            >
              {e.method}
            </span>
            <div>
              <code
                className="ds-mono"
                style={{
                  fontSize: 12,
                  color: 'var(--ds-text)',
                }}
              >
                {e.path}
              </code>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--ds-text-3)',
                  marginTop: 3,
                  lineHeight: 1.5,
                }}
              >
                {e.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
