'use client';

/** Shown instead of the dashboard while the admin check runs, or to a non-admin. */
export function AccessNotice({ checking }: { checking: boolean }) {
  return (
    <div style={{ padding: '32px 32px 80px', maxWidth: 720, margin: '0 auto' }}>
      {checking ? (
        <div
          className="body"
          style={{ color: 'var(--text-tertiary)', padding: '48px 0', textAlign: 'center' }}
        >
          Checking access…
        </div>
      ) : (
        <div className="card" style={{ padding: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Admins only</h1>
          <p
            className="body"
            style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '8px 0 0' }}
          >
            The integrations dashboard changes the shared factor library and
            cost rates for every account, so it is limited to administrators.
            Ask an administrator if a data source needs refreshing.
          </p>
        </div>
      )}
    </div>
  );
}
