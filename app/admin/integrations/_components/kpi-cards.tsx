'use client';

import { StatusDot, MiniBar, fmtInt } from '@/components/lcapix';
import { buildKpis, type Status } from '@/lib/admin/integrations';

/** The overview's four KPI cards. */
export function KpiCards({ status }: { status: Status }) {
  const kpis = buildKpis(status, fmtInt);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        marginBottom: 24,
      }}
    >
      {kpis.map((k) => (
        <div key={k.l} className="card" style={{ padding: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <div className="eyebrow">{k.l}</div>
            <div style={{ marginLeft: 'auto' }}>
              <StatusDot status={k.status} />
            </div>
          </div>
          <div
            className="mono"
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 4,
              letterSpacing: '-0.01em',
            }}
          >
            {k.v}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {k.s}
          </div>
          {k.pct !== undefined && (
            <div style={{ marginTop: 10 }}>
              <MiniBar value={k.pct} height={4} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
