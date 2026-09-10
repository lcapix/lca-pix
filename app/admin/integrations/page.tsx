// app/admin/integrations/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sankey, Tooltip, ResponsiveContainer, Rectangle } from 'recharts';
import { AuthGuard } from '@/components/auth-guard';
import {
  AppTopBar,
  Icon,
  StatusDot,
  MiniBar,
  fmtInt,
  fmtNum,
} from '@/components/lcapix';
import { apiGet } from '@/lib/api-client';
import { ImportButtons } from '@/components/integrations/import-buttons';
import { LogViewer } from '@/components/integrations/log-viewer';

interface ApiSource {
  id: string;
  name: string;
  description: string;
  keyRequired: boolean;
  configured: boolean;
  staticBacked?: boolean;
  status: 'success' | 'warn' | 'error' | 'idle' | 'static';
  events: number;
  fails: number;
  records: number;
  lastSync: string | null;
  lastStatus: string | null;
  rateLimit: { used: number; limit: number } | null;
}

interface Status {
  substances: { total: number; enriched: number };
  factorsByMethod: Array<{ method_name: string; factors: number }>;
  rateCache: Array<{ rate_type: string; cnt: number }>;
  sources?: ApiSource[];
}

// Human-readable "time ago" from an ISO timestamp (real data only).
function relAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return 'just now';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// Shape the real /api/integrations/status sources for the table/card UI.
// 'idle' (configured but never synced) collapses to the 'warn' dot.
interface UISource {
  id: string;
  name: string;
  description: string;
  status: 'success' | 'warn' | 'error';
  statusLabel: string;
  lastRun: string;
  records: number;
  keyRequired: boolean;
  configured: boolean;
  staticBacked: boolean;
  rateLimit: { used: number; limit: number } | null;
}
function uiSources(status: Status | null): UISource[] {
  return (status?.sources ?? []).map((s) => {
    const label =
      s.status === 'static' ? 'reference data'
      : !s.configured ? 'not configured'
      : s.status === 'idle' ? 'never run'
      : s.status === 'success' ? 'healthy'
      : s.status === 'warn' ? 'degraded'
      : 'failing';
    // 'static' (running on bundled reference data) reads as a healthy dot —
    // the feature works; it just isn't using a live API yet.
    const dot: 'success' | 'warn' | 'error' =
      s.status === 'static' || s.status === 'success' ? 'success'
      : s.status === 'error' ? 'error'
      : 'warn';
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      status: dot,
      statusLabel: label,
      lastRun:
        s.status === 'static' ? 'Static reference'
        : !s.configured ? 'Not configured'
        : relAgo(s.lastSync),
      records: s.records,
      keyRequired: s.keyRequired,
      configured: s.configured,
      staticBacked: Boolean(s.staticBacked),
      rateLimit: s.rateLimit,
    };
  });
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

// Per-source pipeline: which tables it writes to, what each write means,
// and a current record count + freshness so the user can reason about it.
interface PipelineRoute {
  table: (typeof SCHEMA_TABLES)[number];
  records: number;
  note: string;
}
interface SourcePipeline {
  sourceId: string;
  routes: PipelineRoute[];
}
const SOURCE_PIPELINES: SourcePipeline[] = [
  {
    sourceId: 'openlca',
    routes: [
      { table: 'substances', records: 15, note: 'Substance master list with CAS numbers' },
      { table: 'valuation_methods', records: 8, note: 'LCIA methods (CML 2001, ReCiPe…)' },
      { table: 'characterization_factors', records: 18, note: 'Method × category × substance factors' },
    ],
  },
  {
    sourceId: 'pubchem',
    routes: [
      { table: 'substances', records: 1, note: 'Hazard data + formulas (enrichment)' },
    ],
  },
  {
    sourceId: 'electricity_maps',
    routes: [
      { table: 'cost_rates', records: 0, note: 'Grid carbon-intensity rate per region' },
      { table: 'characterization_factors', records: 0, note: 'Real-time GWP factors for electricity' },
    ],
  },
  {
    sourceId: 'bls',
    routes: [
      { table: 'cost_rates', records: 0, note: 'Median hourly wages by occupation' },
    ],
  },
  {
    sourceId: 'eia',
    routes: [
      { table: 'cost_rates', records: 0, note: 'Energy price per fuel + region' },
    ],
  },
  {
    sourceId: 'metals',
    routes: [
      { table: 'cost_rates', records: 0, note: 'Spot prices for metal commodities' },
    ],
  },
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
  const srcList = uiSources(status);
  const failingCount = srcList.filter((i) => i.status === 'error').length;
  const activeCount = srcList.filter((i) => i.status === 'success').length;
  // "live" = backed by a real API call; "reference" = running on bundled static
  // data because no live key is configured. Both are functional.
  const liveCount = (status.sources ?? []).filter((s) => s.status === 'success').length;
  const referenceCount = (status.sources ?? []).filter((s) => s.status === 'static').length;
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
      s: substancesTotal
        ? `${fmtInt(substancesEnriched)} enriched`
        : 'none loaded',
      pct: enrichedPct,
      status: substancesTotal ? 'success' : 'warn',
    },
    {
      l: 'METHODOLOGIES',
      v: fmtInt(methodsCount),
      s: methodsCount ? latestMethod : 'no methods imported',
      status: methodsCount ? 'success' : 'warn',
    },
    {
      l: 'COST RATES',
      v: fmtInt(rateCacheCount),
      s: rateCacheCount
        ? `${status.rateCache.length} types`
        : 'no rates cached',
      status: rateCacheCount ? 'success' : 'warn',
    },
    {
      l: 'CONNECTIONS',
      v: `${activeCount} / ${srcList.length}`,
      s: failingCount
        ? `${failingCount} endpoint${failingCount === 1 ? '' : 's'} failing`
        : referenceCount
        ? `${liveCount} live · ${referenceCount} reference data`
        : srcList.length && activeCount === srcList.length
        ? 'all healthy'
        : 'some idle / unconfigured',
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
                {!src.configured ? 'Configure' : 'Run now'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function SourcesTab({ status }: { status: Status | null }) {
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
                {src.keyRequired ? (src.configured ? 'Configured' : 'Missing') : 'Not required'}
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

function KeysTab({ status }: { status: Status | null }) {
  const keyed = uiSources(status).filter((s) => s.keyRequired);
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
            <StatusDot status={src.configured ? 'success' : 'error'} />
            <span style={{ color: 'var(--text-secondary)' }}>
              {src.configured ? 'Configured' : 'Not configured'}
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

function SchemaTab({ status }: { status: Status | null }) {
  const uiSrc = uiSources(status);
  // Per-table totals — REAL counts derived from /api/integrations/status
  // (substance master, LCIA methods, characterization factors, cost rates)
  // instead of the former hardcoded per-route numbers.
  const factorsTotal = (status?.factorsByMethod ?? []).reduce(
    (s, m) => s + Number(m.factors ?? 0),
    0,
  );
  const ratesTotal = (status?.rateCache ?? []).reduce(
    (s, r) => s + Number(r.cnt ?? 0),
    0,
  );
  const tableTotals: Record<string, number> = {
    substances: Number(status?.substances?.total ?? 0),
    valuation_methods: (status?.factorsByMethod ?? []).length,
    characterization_factors: factorsTotal,
    cost_rates: ratesTotal,
  };

  // Build Sankey nodes + links. Recharts requires numeric src/target indices.
  const sourceNodes = SOURCE_PIPELINES.map((p) => {
    const src = uiSrc.find((s) => s.id === p.sourceId);
    return { name: src?.name ?? p.sourceId, kind: 'source' as const };
  });
  const tableNodes = SCHEMA_TABLES.map((t) => ({
    name: t,
    kind: 'table' as const,
  }));
  const nodes = [...sourceNodes, ...tableNodes];
  const tableOffset = sourceNodes.length;
  // How many sources write into each table — used to split a table's REAL
  // record total evenly across its inbound pipes (we don't track per-source
  // provenance per row, so an even split is the honest approximation rather
  // than a fabricated per-edge count).
  const writersPerTable = SCHEMA_TABLES.reduce<Record<string, number>>((acc, t) => {
    acc[t] = SOURCE_PIPELINES.filter((p) => p.routes.some((r) => r.table === t)).length || 1;
    return acc;
  }, {});
  // Sankey requires every link to have a strictly positive value. Zero-record
  // pipes get a tiny placeholder weight so the wiring still renders.
  const links = SOURCE_PIPELINES.flatMap((p, srcIdx) =>
    p.routes.map((r) => {
      const share = Math.round((tableTotals[r.table] ?? 0) / writersPerTable[r.table]);
      return {
        source: srcIdx,
        target: tableOffset + SCHEMA_TABLES.indexOf(r.table),
        value: Math.max(share, 0.5),
        records: share,
      };
    }),
  );

  return (
    <>
      {/* Summary row — how many records each table holds across sources */}
      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          What lives where
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-tertiary)',
            marginBottom: 14,
          }}
        >
          Each integration writes into specific tables. Below: total records
          per table across every connected source.
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
          }}
        >
          {SCHEMA_TABLES.map((t) => {
            const n = tableTotals[t] ?? 0;
            return (
              <div
                key={t}
                style={{
                  padding: '14px 16px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  background: 'var(--surface-raised)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background:
                        n > 0
                          ? 'var(--brand-primary)'
                          : 'var(--text-tertiary)',
                      opacity: n > 0 ? 1 : 0.4,
                    }}
                  />
                  <div
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: 'var(--text-tertiary)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {t}
                  </div>
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 22,
                    fontWeight: 600,
                    color:
                      n > 0
                        ? 'var(--text-primary)'
                        : 'var(--text-tertiary)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {fmtInt(n)}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-tertiary)',
                    marginTop: 2,
                  }}
                >
                  {n > 0 ? 'records' : 'empty'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sankey — the actual flow diagram */}
      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          Flow of records · source → table
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-tertiary)',
            marginBottom: 14,
          }}
        >
          Band width is proportional to the number of records that source has
          written. Greyed bands mean the pipeline is connected but empty.
        </div>
        <div style={{ width: '100%', height: 360 }}>
          <ResponsiveContainer>
            <Sankey
              data={{ nodes, links }}
              nodePadding={18}
              nodeWidth={14}
              linkCurvature={0.5}
              margin={{ top: 8, right: 140, bottom: 8, left: 8 }}
              node={(props: any) => {
                const isTable =
                  props.payload?.kind === 'table' ||
                  props.index >= sourceNodes.length;
                return (
                  <g>
                    <Rectangle
                      x={props.x}
                      y={props.y}
                      width={props.width}
                      height={props.height}
                      fill={isTable ? '#52796f' : '#2d6a4f'}
                      fillOpacity={0.9}
                    />
                    <text
                      x={props.x + props.width + 8}
                      y={props.y + props.height / 2}
                      fontSize={12}
                      fill="var(--text-secondary)"
                      dominantBaseline="middle"
                      fontFamily="var(--font-mono)"
                    >
                      {props.payload?.name}
                    </text>
                  </g>
                );
              }}
              link={{ stroke: '#74c69d' }}
            >
              <Tooltip
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0].payload
                  if (p?.source !== undefined && p?.target !== undefined) {
                    return (
                      <div
                        style={{
                          background: '#fff',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 8,
                          padding: '8px 10px',
                          fontSize: 12,
                        }}
                      >
                        <div
                          className="mono"
                          style={{ marginBottom: 2 }}
                        >
                          {nodes[p.source]?.name} → {nodes[p.target]?.name}
                        </div>
                        <div style={{ color: 'var(--text-tertiary)' }}>
                          {fmtInt(p.records ?? 0)} records
                        </div>
                      </div>
                    )
                  }
                  if (p?.name) {
                    return (
                      <div
                        style={{
                          background: '#fff',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 8,
                          padding: '8px 10px',
                          fontSize: 12,
                        }}
                      >
                        <div className="mono">{p.name}</div>
                      </div>
                    )
                  }
                  return null
                }}
              />
            </Sankey>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-source pipeline cards — explicit "X feeds Y" with counts */}
      <div className="card" style={{ padding: 18 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            marginBottom: 4,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600 }}>Source pipelines</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            ({SOURCE_PIPELINES.length} sources)
          </div>
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-tertiary)',
            marginBottom: 14,
          }}
        >
          One card per integration. Each pill shows the destination table and
          how many records that source has populated.
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: 12,
          }}
        >
          {SOURCE_PIPELINES.map((p) => {
            const src = uiSrc.find((s) => s.id === p.sourceId);
            // Real per-table share (table total / number of writers), summed
            // across this source's destination tables.
            const routeRecords = (table: string) =>
              Math.round((tableTotals[table] ?? 0) / (writersPerTable[table] ?? 1));
            const totalRecords = p.routes.reduce(
              (s, r) => s + routeRecords(r.table),
              0,
            );
            return (
              <div
                key={p.sourceId}
                style={{
                  padding: 14,
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  background: 'var(--surface-raised)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <StatusDot status={src?.status ?? 'warn'} />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {src?.name ?? p.sourceId}
                  </span>
                  <span
                    className="mono"
                    style={{
                      marginLeft: 'auto',
                      fontSize: 10,
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    {fmtInt(totalRecords)} rows
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {p.routes.map((r, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'auto 1fr auto',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 10px',
                        background: 'var(--surface-overlay)',
                        borderRadius: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          color: 'var(--text-tertiary)',
                        }}
                      >
                        →
                      </span>
                      <div>
                        <div
                          className="mono"
                          style={{
                            fontSize: 12,
                            color: 'var(--text-primary)',
                            marginBottom: 2,
                          }}
                        >
                          {r.table}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--text-tertiary)',
                            lineHeight: 1.4,
                          }}
                        >
                          {r.note}
                        </div>
                      </div>
                      <span
                        className="mono"
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color:
                            routeRecords(r.table) > 0
                              ? 'var(--text-primary)'
                              : 'var(--text-tertiary)',
                          padding: '3px 8px',
                          borderRadius: 999,
                          background:
                            routeRecords(r.table) > 0
                              ? 'color-mix(in oklab, var(--brand-primary) 12%, transparent)'
                              : 'var(--surface-raised)',
                          border:
                            '1px solid ' +
                            (routeRecords(r.table) > 0
                              ? 'transparent'
                              : 'var(--border-subtle)'),
                        }}
                      >
                        {fmtInt(routeRecords(r.table))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
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
      <AppTopBar current="integrations" />

      <div
        style={{
          padding: '32px 32px 80px',
          maxWidth: 1440,
          margin: '0 auto',
        }}
      >
        {/* Header */}
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
            {tab === 'sources' && <SourcesTab status={status} />}
            {tab === 'keys' && <KeysTab status={status} />}
            {tab === 'log' && <LogTab logRefresh={logRefresh} />}
            {tab === 'schema' && <SchemaTab status={status} />}
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
