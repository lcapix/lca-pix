'use client';

import { fmtInt } from '@/components/lcapix';
import { SCHEMA_TABLES, tableCountLabel } from '@/lib/admin/integrations-schema';

/** Summary row — how many records each table holds across sources. */
export function SchemaTableSummary({
  tableTotals,
}: {
  tableTotals: Record<string, number>;
}) {
  return (
    <div className="ds-card" style={{ padding: 18, marginBottom: 16 }}>
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
          color: 'var(--ds-text-3)',
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
                        ? 'var(--ds-green)'
                        : 'var(--ds-text-3)',
                    opacity: n > 0 ? 1 : 0.4,
                  }}
                />
                <div
                  className="ds-mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--ds-text-3)',
                    letterSpacing: '0.04em',
                  }}
                >
                  {t}
                </div>
              </div>
              <div
                className="ds-mono"
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  color:
                    n > 0
                      ? 'var(--ds-text)'
                      : 'var(--ds-text-3)',
                  letterSpacing: '-0.02em',
                }}
              >
                {fmtInt(n)}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--ds-text-3)',
                  marginTop: 2,
                }}
              >
                {tableCountLabel(n)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
