'use client';

import { StatusDot } from '@/components/lcapix';
import {
  keyStatusDot,
  keyStatusLabel,
  keyedSources,
  type Status,
} from '@/lib/admin/integrations';

/** API Keys tab: configured/missing state for every keyed source. */
export function KeysTab({ status }: { status: Status | null }) {
  const keyed = keyedSources(status);
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.4fr 1fr 1fr',
          padding: '10px 20px',
          background: 'var(--surface-overlay)',
          fontSize: 10,
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight: 600,
        }}
      >
        <div>Service</div>
        <div>Key status</div>
        <div>Last used</div>
        <div style={{ textAlign: 'right' }}>Health</div>
      </div>
      {keyed.map((src) => (
        <div
          key={src.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.4fr 1fr 1fr',
            padding: '14px 20px',
            borderTop: '1px solid var(--border-subtle)',
            alignItems: 'center',
            fontSize: 13,
          }}
        >
          <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
            {src.name}
          </div>
          {/* Real configured/missing state from the environment — the actual
              secret is never sent to the client, so there is no key value to
              reveal (previously a fabricated "em_live_…" string). */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusDot status={keyStatusDot(src)} />
            <span style={{ color: 'var(--text-secondary)' }}>
              {keyStatusLabel(src)}
            </span>
          </div>
          <div className="mono" style={{ color: 'var(--text-tertiary)' }}>
            {src.lastRun}
          </div>
          <div
            className="mono"
            style={{ color: 'var(--text-tertiary)', textAlign: 'right' }}
          >
            {src.statusLabel}
          </div>
        </div>
      ))}
      <div
        style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: 11,
          color: 'var(--text-tertiary)',
        }}
      >
        Keys are configured via server environment variables and are never
        exposed to the browser. Set or rotate them in your deployment
        environment.
      </div>
    </div>
  );
}
