'use client';

import { StatusDot, fmtInt } from '@/components/lcapix';
import type { UISource } from '@/lib/admin/integrations';
import {
  SOURCE_PIPELINES,
  pipelineSource,
  pipelineTotalRecords,
  routeRecords,
} from '@/lib/admin/integrations-schema';

/** Per-source pipeline cards — explicit "X feeds Y" with counts. */
export function SchemaPipelines({
  uiSrc,
  tableTotals,
  writersPerTable,
}: {
  uiSrc: UISource[];
  tableTotals: Record<string, number>;
  writersPerTable: Record<string, number>;
}) {
  return (
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
          const src = pipelineSource(uiSrc, p.sourceId);
          // Real per-table share (table total / number of writers), summed
          // across this source's destination tables.
          const totalRecords = pipelineTotalRecords(p, tableTotals, writersPerTable);
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
                {p.routes.map((r, i) => {
                  const n = routeRecords(tableTotals, writersPerTable, r.table);
                  return (
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
                            n > 0
                              ? 'var(--text-primary)'
                              : 'var(--text-tertiary)',
                          padding: '3px 8px',
                          borderRadius: 999,
                          background:
                            n > 0
                              ? 'color-mix(in oklab, var(--brand-primary) 12%, transparent)'
                              : 'var(--surface-raised)',
                          border:
                            '1px solid ' +
                            (n > 0
                              ? 'transparent'
                              : 'var(--border-subtle)'),
                        }}
                      >
                        {fmtInt(n)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
