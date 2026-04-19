// app/admin/integrations/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import {
  AppTopBar,
  Breadcrumb,
  Icon,
  StatusDot,
  MiniBar,
  fmtInt,
  fmtNum,
} from '@/components/lcapix';
import { apiGet } from '@/lib/api-client';
import { ImportButtons } from '@/components/integrations/import-buttons';
import { LogViewer } from '@/components/integrations/log-viewer';
import {
  DEMO_INTEGRATIONS,
  DEMO_ACTIVITY,
} from '@/lib/lcapix-demo';

interface Status {
  substances: { total: number; enriched: number };
  factorsByMethod: Array<{ method_name: string; factors: number }>;
  rateCache: Array<{ rate_type: string; cnt: number }>;
}

type TabId = 'overview' | 'sources' | 'keys' | 'log' | 'schema';

const TABS: ReadonlyArray<{ id: TabId; l: string }> = [
  { id: 'overview', l: 'Overview' },
  { id: 'sources', l: 'Data Sources' },
  { id: 'keys', l: 'API Keys' },
  { id: 'log', l: 'Activity Log' },
  { id: 'schema', l: 'Schema' },
];

const SCHEMA_TABLES = [
  'substances',
  'valuation_methods',
  'characterization_factors',
  'cost_rates',
];

function KpiCards({ status }: { status: Status }) {
  const substancesTotal = Number(status.substances.total ?? 0);
  const substancesEnriched = Number(status.substances.enriched ?? 0);
  const methodsCount = status.factorsByMethod.length;
  const rateCacheCount = status.rateCache.reduce(
    (sum, r) => sum + Number(r.cnt ?? 0),
    0
  );
  const enrichedPct = substancesTotal
    ? Math.round((substancesEnriched / substancesTotal) * 100)
    : 0;
  const failingCount = DEMO_INTEGRATIONS.filter(
    (i) => i.status === 'error'
  ).length;
  const activeCount = DEMO_INTEGRATIONS.length - failingCount;
  const latestMethod = status.factorsByMethod[0]?.method_name ?? '—';

  const kpis: Array<{
    l: string;
    v: string;
    s: string;
    pct?: number;
    status: 'success' | 'warn' | 'error';
  }> = [
    {
      l: 'SUBSTANCES',
      v: fmtInt(substancesTotal),
      s: `${fmtInt(substancesEnriched)} enriched`,
      pct: enrichedPct,
      status: 'success',
    },
    {
      l: 'METHODOLOGIES',
      v: fmtInt(methodsCount),
      s: latestMethod,
      status: 'success',
    },
    {
      l: 'COST RATES',
      v: fmtInt(rateCacheCount),
      s: `${status.rateCache.length} types`,
      status: 'success',
    },
    {
      l: 'CONNECTIONS',
      v: `${activeCount} / ${DEMO_INTEGRATIONS.length}`,
      s: failingCount
        ? `${failingCount} endpoint${failingCount === 1 ? '' : 's'} failing`
        : 'all healthy',
      status: failingCount ? 'warn' : 'success',
    },
  ];

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

function OverviewTab({
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
        {DEMO_INTEGRATIONS.map((src) => (
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
              <span
                style={{
                  color: 'var(--text-secondary)',
                  textTransform: 'capitalize',
                }}
              >
                {src.status === 'warn'
                  ? 'degraded'
                  : src.status === 'success'
                  ? 'healthy'
                  : src.status}
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
                {src.status === 'error' ? 'Configure' : 'Run now'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function SourcesTab() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 16,
      }}
    >
      {DEMO_INTEGRATIONS.map((src) => (
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
              <div style={{ color: 'var(--text-tertiary)' }}>Rate limit</div>
              <div className="mono" style={{ color: 'var(--text-primary)' }}>
                842 / 1000
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-tertiary)' }}>Last sync</div>
              <div className="mono" style={{ color: 'var(--text-primary)' }}>
                {src.lastRun}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-tertiary)' }}>TTL</div>
              <div className="mono" style={{ color: 'var(--text-primary)' }}>
                24h
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-tertiary)' }}>Records</div>
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

function KeysTab() {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const toggle = (id: string) =>
    setRevealed((r) => ({ ...r, [id]: !r[id] }));

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 2fr 1fr 120px',
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
        <div>Key</div>
        <div>Last used</div>
        <div style={{ textAlign: 'right' }}>Action</div>
      </div>
      {DEMO_INTEGRATIONS.filter((i) => i.keyRequired).map((src) => {
        const isRevealed = !!revealed[src.id];
        const maskedKey = isRevealed
          ? `em_live_a93kfx2l8c${src.id.slice(0, 4)}`
          : `em_•••••••••••••••••••${src.id.slice(0, 4)}`;
        return (
          <div
            key={src.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 2fr 1fr 120px',
              padding: '14px 20px',
              borderTop: '1px solid var(--border-subtle)',
              alignItems: 'center',
              fontSize: 13,
            }}
          >
            <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
              {src.name}
            </div>
            <div
              className="mono"
              style={{
                color: 'var(--text-tertiary)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>{maskedKey}</span>
              <button
                type="button"
                onClick={() => toggle(src.id)}
                aria-label={isRevealed ? 'Hide key' : 'Reveal key'}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                  padding: 2,
                  display: 'inline-flex',
                }}
              >
                <Icon name="eye" size={12} />
              </button>
            </div>
            <div className="mono" style={{ color: 'var(--text-tertiary)' }}>
              {src.lastRun}
            </div>
            <div style={{ textAlign: 'right' }}>
              <button type="button" className="btn btn-ghost btn-sm">
                Rotate
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LogTab({ logRefresh }: { logRefresh: number }) {
  const [filter, setFilter] = useState<'all' | 'success' | 'errors'>('all');

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
          className={`chip ${filter === 'all' ? 'chip-active' : ''}`}
          style={{ cursor: 'pointer', border: 'none' }}
        >
          All sources
        </button>
        <button
          type="button"
          onClick={() => setFilter('success')}
          className={`chip ${filter === 'success' ? 'chip-active' : ''}`}
          style={{ cursor: 'pointer', border: 'none' }}
        >
          Success
        </button>
        <button
          type="button"
          onClick={() => setFilter('errors')}
          className={`chip ${filter === 'errors' ? 'chip-active' : ''}`}
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

function SchemaTab() {
  return (
    <div className="card" style={{ padding: 32 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>
        Data population map
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '200px 1fr 200px',
          gap: 20,
          alignItems: 'center',
        }}
      >
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          {DEMO_INTEGRATIONS.slice(0, 4).map((s) => (
            <div
              key={s.id}
              style={{
                padding: 12,
                background: 'var(--surface-overlay)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
              }}
            >
              <StatusDot status={s.status} /> {s.name}
            </div>
          ))}
        </div>
        <svg viewBox="0 0 200 300" style={{ height: 260, width: '100%' }}>
          <defs>
            <marker
              id="ar"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="var(--brand-primary)" />
            </marker>
          </defs>
          {[0, 1, 2, 3].map((i) => (
            <path
              key={i}
              d={`M 10 ${30 + i * 66} Q 100 ${30 + i * 66} 190 ${20 + (i % 4) * 70}`}
              stroke="var(--brand-primary)"
              strokeWidth="1.5"
              fill="none"
              opacity="0.6"
              markerEnd="url(#ar)"
            />
          ))}
        </svg>
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          {SCHEMA_TABLES.map((t) => (
            <div
              key={t}
              className="mono"
              style={{
                padding: 12,
                background: 'var(--surface-sunken)',
                borderRadius: 6,
                fontSize: 12,
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function IntegrationsAdminPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logRefresh, setLogRefresh] = useState(0);
  const [tab, setTab] = useState<TabId>('overview');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Status>('/api/integrations/status');
      setStatus(data);
      setLogRefresh((n) => n + 1);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthGuard>
      <AppTopBar current="home" />
      <Breadcrumb
        items={[
          { label: 'Projects', page: 'home' },
          { label: 'Admin' },
          { label: 'Integrations' },
        ]}
      />

      <div
        style={{
          padding: '24px 32px 80px',
          maxWidth: 1440,
          margin: '0 auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            marginBottom: 20,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
          }}
        >
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
                marginTop: 4,
              }}
            >
              Monitor data source health, manage keys, view activity.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={refresh}
              className="btn btn-ghost btn-sm"
            >
              <Icon name="refresh" size={13} /> Refresh
            </button>
            <button type="button" className="btn btn-ghost btn-sm">
              <Icon name="download" size={13} /> Export
            </button>
          </div>
        </div>

        {/* Tab strip */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            marginBottom: 24,
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color:
                  tab === t.id
                    ? 'var(--text-primary)'
                    : 'var(--text-tertiary)',
                fontSize: 13,
                fontWeight: tab === t.id ? 500 : 400,
                fontFamily: 'var(--font-ui)',
                borderBottom:
                  '2px solid ' +
                  (tab === t.id ? 'var(--brand-primary)' : 'transparent'),
                marginBottom: '-1px',
              }}
            >
              {t.l}
            </button>
          ))}
        </div>

        {loading && (
          <div
            className="body"
            style={{
              color: 'var(--text-tertiary)',
              padding: '48px 0',
              textAlign: 'center',
            }}
          >
            Loading…
          </div>
        )}
        {error && (
          <div
            className="mono label-sm"
            style={{
              color: 'var(--signal-error)',
              padding: '12px 0',
              fontSize: 13,
            }}
          >
            Error: {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {tab === 'overview' && status && (
              <OverviewTab status={status} onRefresh={refresh} />
            )}
            {tab === 'sources' && <SourcesTab />}
            {tab === 'keys' && <KeysTab />}
            {tab === 'log' && <LogTab logRefresh={logRefresh} />}
            {tab === 'schema' && <SchemaTab />}
          </>
        )}

        {/* Systems Harmonized banner */}
        <div
          style={{
            marginTop: 32,
            padding: 20,
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            background: 'var(--surface-overlay)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <StatusDot status="success" size={10} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              Systems harmonized
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-tertiary)',
                marginTop: 2,
              }}
            >
              All global data sources verified against LCAPIX standards. Last
              audit: 04:00 UTC.
            </div>
          </div>
          <div
            className="mono"
            style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
          >
            {fmtNum(99.94, 2)}% uptime
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
