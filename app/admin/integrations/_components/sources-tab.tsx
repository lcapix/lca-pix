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
        <div key={src.id} className="ds-card" style={{ padding: 20 }}>
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
            <button type="button" className="ds-btn ds-btn--small">
              <Icon name="settings" size={13} />
            </button>
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--ds-text-2)',
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
              <div style={{ color: 'var(--ds-text-3)' }}>Status</div>
              <div className="ds-mono" style={{ color: 'var(--ds-text)' }}>
                {src.statusLabel}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--ds-text-3)' }}>Last sync</div>
              <div className="ds-mono" style={{ color: 'var(--ds-text)' }}>
                {src.lastRun}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--ds-text-3)' }}>API key</div>
              <div className="ds-mono" style={{ color: 'var(--ds-text)' }}>
                {apiKeyLabel(src)}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--ds-text-3)' }}>Records synced</div>
              <div className="ds-mono" style={{ color: 'var(--ds-text)' }}>
                {fmtInt(src.records)}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
