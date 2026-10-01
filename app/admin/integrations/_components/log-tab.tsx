'use client';

import { useState } from 'react';
import { Icon } from '@/components/lcapix';
import { LogViewer } from '@/components/integrations/log-viewer';
import { logFilterChipClass, type LogFilter } from '@/lib/admin/integrations';

/** Activity Log tab: filter chips (local state) over the live LogViewer. */
export function LogTab({ logRefresh }: { logRefresh: number }) {
  const [filter, setFilter] = useState<LogFilter>('all');

  return (
    <div className="card" style={{ padding: 0 }}>
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={logFilterChipClass(filter, 'all')}
          style={{ cursor: 'pointer', border: 'none' }}
        >
          All sources
        </button>
        <button
          type="button"
          onClick={() => setFilter('success')}
          className={logFilterChipClass(filter, 'success')}
          style={{ cursor: 'pointer', border: 'none' }}
        >
          Success
        </button>
        <button
          type="button"
          onClick={() => setFilter('errors')}
          className={logFilterChipClass(filter, 'errors')}
          style={{ cursor: 'pointer', border: 'none' }}
        >
          Errors
        </button>
        <div style={{ flex: 1 }} />
        <button type="button" className="btn btn-ghost btn-sm">
          <Icon name="download" size={13} /> CSV
        </button>
      </div>
      {/* Preserved live LogViewer */}
      <LogViewer refreshKey={logRefresh} />
    </div>
  );
}
