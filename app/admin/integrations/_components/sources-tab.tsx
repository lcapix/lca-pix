'use client';

import { Icon, StatusDot, fmtInt } from '@/components/lcapix';
import { apiKeyLabel, uiSources, type Status } from '@/lib/admin/integrations';

/** Data Sources tab: one card per integration. */
export function SourcesTab({ status }: { status: Status | null }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 16,
      }}
    >
      {uiSources(status).map((src) => (
        <div key={src.id} className="card" style={{ padding: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 10,
            }}
          >
            <StatusDot status={src.status} />
            <div style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>
              {src.name}
            </div>
            <button type="button" className="btn btn-ghost btn-sm">
              <Icon name="settings" size={13} />
            </button>
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              marginBottom: 14,
            }}
          >
            {src.description}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              fontSize: 12,
            }}
          >
            <div>
              <div style={{ color: 'var(--text-tertiary)' }}>Status</div>
              <div className="mono" style={{ color: 'var(--text-primary)' }}>
                {src.statusLabel}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-tertiary)' }}>Last sync</div>
              <div className="mono" style={{ color: 'var(--text-primary)' }}>
                {src.lastRun}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-tertiary)' }}>API key</div>
              <div className="mono" style={{ color: 'var(--text-primary)' }}>
                {apiKeyLabel(src)}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-tertiary)' }}>Records synced</div>
              <div className="mono" style={{ color: 'var(--text-primary)' }}>
                {fmtInt(src.records)}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
