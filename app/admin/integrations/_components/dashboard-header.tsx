'use client';

import { Icon } from '@/components/lcapix';

/** Dashboard header: icon, title, subtitle, Refresh and Export buttons. */
export function DashboardHeader({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div
      style={{
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background:
            'linear-gradient(135deg, var(--ds-green), color-mix(in oklab, var(--ds-green) 60%, #2d6a4f))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          flexShrink: 0,
        }}
      >
        <Icon name="settings" size={20} />
      </div>
      <div style={{ flex: 1 }}>
        <h1
          className="ds-title"
          style={{
            fontSize: 26,
            fontWeight: 600,
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          Integrations
        </h1>
        <div
          className="np-sub"
          style={{
            fontSize: 13,
            color: 'var(--ds-text-3)',
            marginTop: 2,
          }}
        >
          Monitor data source health, manage keys, view activity.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={onRefresh}
          className="ds-btn ds-btn--small"
        >
          <Icon name="refresh" size={13} /> Refresh
        </button>
        <button type="button" className="ds-btn ds-btn--small">
          <Icon name="download" size={13} /> Export
        </button>
      </div>
    </div>
  );
}
