'use client';

import { Icon, StatusDot, fmtInt } from '@/components/lcapix';
import { ImportButtons } from '@/components/integrations/import-buttons';
import { sourceActionLabel, uiSources, type Status } from '@/lib/admin/integrations';
import { KpiCards } from './kpi-cards';

/** Overview tab: KPI cards, import actions and the integration status table. */
export function OverviewTab({
  status,
  onRefresh,
}: {
  status: Status;
  onRefresh: () => void;
}) {
  return (
    <>
      <KpiCards status={status} />

      {/* Import Actions (preserved handler) */}
      <div style={{ marginBottom: 24 }}>
        <ImportButtons onRefresh={onRefresh} />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            Integration status
          </span>
          <button
            type="button"
            onClick={onRefresh}
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: 'auto' }}
          >
            <Icon name="refresh" size={13} /> Refresh all
          </button>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.5fr 1fr 1fr 1fr 120px',
            padding: '10px 20px',
            background: 'var(--surface-overlay)',
            fontSize: 10,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: 600,
          }}
        >
          <div>Source</div>
          <div>Status</div>
          <div>Last run</div>
          <div>Records</div>
          <div style={{ textAlign: 'right' }}>Action</div>
        </div>
        {uiSources(status).map((src) => (
          <div
            key={src.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 1fr 1fr 1fr 120px',
              padding: '14px 20px',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: 13,
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                {src.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {src.description}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusDot status={src.status} />
              <span style={{ color: 'var(--text-secondary)' }}>
                {src.statusLabel}
              </span>
            </div>
            <div className="mono" style={{ color: 'var(--text-tertiary)' }}>
              {src.lastRun}
            </div>
            <div className="mono" style={{ color: 'var(--text-secondary)' }}>
              {fmtInt(src.records)}
            </div>
            <div style={{ textAlign: 'right' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ padding: '4px 10px' }}
              >
                {sourceActionLabel(src)}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
