'use client';

/** Shown instead of the dashboard while the admin check runs, or to a non-admin. */
export function AccessNotice({ checking }: { checking: boolean }) {
  return (
    <div style={{ padding: '32px 32px 80px', maxWidth: 720, margin: '0 auto' }}>
      {checking ? (
        <div
          className="np-sub"
          style={{ color: 'var(--ds-text-3)', padding: '48px 0', textAlign: 'center' }}
        >
          Checking access…
        </div>
      ) : (
        <div className="ds-card" style={{ padding: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Admins only</h1>
          <p
            className="np-sub"
            style={{ fontSize: 13, color: 'var(--ds-text-3)', margin: '8px 0 0' }}
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
