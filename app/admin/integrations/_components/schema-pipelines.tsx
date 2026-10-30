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
    <div className="ds-card" style={{ padding: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          marginBottom: 4,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600 }}>Source pipelines</div>
        <div style={{ fontSize: 11, color: 'var(--ds-text-3)' }}>
          ({SOURCE_PIPELINES.length} sources)
        </div>
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--ds-text-3)',
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
                border: '1px solid var(--ds-line)',
                borderRadius: 10,
                background: 'var(--ds-card)',
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
                    color: 'var(--ds-text)',
                  }}
                >
                  {src?.name ?? p.sourceId}
                </span>
                <span
                  className="ds-mono"
                  style={{
                    marginLeft: 'auto',
                    fontSize: 10,
                    color: 'var(--ds-text-3)',
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
                        background: 'var(--ds-card)',
                        borderRadius: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          color: 'var(--ds-text-3)',
                        }}
                      >
                        →
                      </span>
                      <div>
                        <div
                          className="ds-mono"
                          style={{
                            fontSize: 12,
                            color: 'var(--ds-text)',
                            marginBottom: 2,
                          }}
                        >
                          {r.table}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--ds-text-3)',
                            lineHeight: 1.4,
                          }}
                        >
                          {r.note}
                        </div>
                      </div>
                      <span
                        className="ds-mono"
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color:
                            n > 0
                              ? 'var(--ds-text)'
                              : 'var(--ds-text-3)',
                          padding: '3px 8px',
                          borderRadius: 999,
                          background:
                            n > 0
                              ? 'color-mix(in oklab, var(--ds-green) 12%, transparent)'
                              : 'var(--ds-card)',
                          border:
                            '1px solid ' +
                            (n > 0
                              ? 'transparent'
                              : 'var(--ds-line)'),
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
