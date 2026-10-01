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
            'linear-gradient(135deg, var(--brand-primary), color-mix(in oklab, var(--brand-primary) 60%, #2d6a4f))',
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
          className="display-md"
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
          className="body"
          style={{
            fontSize: 13,
            color: 'var(--text-tertiary)',
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
          className="btn btn-ghost btn-sm"
        >
          <Icon name="refresh" size={13} /> Refresh
        </button>
        <button type="button" className="btn btn-ghost btn-sm">
          <Icon name="download" size={13} /> Export
        </button>
      </div>
    </div>
  );
}
