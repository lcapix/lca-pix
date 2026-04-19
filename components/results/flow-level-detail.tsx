'use client';

import { Num } from '@/components/ui/num';
import { formatChemicalUnit } from '@/lib/format-utils';

export interface FlowDetailRow {
  id: string | number;
  componentName: string;
  componentType?: string;
  impacts: Array<{ categoryName: string; value: number; unit: string }>;
  flowsProcessed?: number;
}

export interface FlowLevelDetailProps {
  rows: FlowDetailRow[];
  /** Which impact category column to highlight (defaults to first) */
  highlightCategory?: string;
  title?: string;
}

/**
 * Flow-level contribution table. Alternating surface/surface-container-low
 * stripes replace 1px row borders (per Veridian DESIGN.md). Numeric cells
 * render through <Num> so IBM Plex Mono aligns numbers per column.
 */
export function FlowLevelDetail({
  rows,
  highlightCategory,
  title = 'Flow-level detail',
}: FlowLevelDetailProps) {
  // Collect unique category columns across all rows (preserve encounter order)
  const categories: Array<{ name: string; unit: string }> = [];
  const seen = new Set<string>();
  rows.forEach((r) => {
    r.impacts.forEach((imp) => {
      if (!seen.has(imp.categoryName)) {
        seen.add(imp.categoryName);
        categories.push({ name: imp.categoryName, unit: imp.unit });
      }
    });
  });

  const highlight = highlightCategory ?? categories[0]?.name;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-bold tracking-tight text-on-surface">{title}</h3>
        <span className="font-mono text-[10px] uppercase text-on-surface-variant">
          {rows.length} component{rows.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="overflow-hidden bg-surface-container-lowest rounded-2xl shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="px-6 py-4 font-mono text-[10px] uppercase text-on-surface-variant">
                  Component
                </th>
                <th className="px-6 py-4 font-mono text-[10px] uppercase text-on-surface-variant">
                  Type
                </th>
                <th className="px-6 py-4 font-mono text-[10px] uppercase text-on-surface-variant text-right">
                  Flows
                </th>
                {categories.map((c) => (
                  <th
                    key={c.name}
                    className={`px-6 py-4 font-mono text-[10px] uppercase text-on-surface-variant text-right ${
                      c.name === highlight ? 'text-primary' : ''
                    }`}
                  >
                    {c.name}
                    <div className="text-[9px] normal-case mt-0.5 opacity-70">
                      {formatChemicalUnit(c.unit)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={3 + categories.length}
                    className="px-6 py-10 text-center text-sm text-on-surface-variant"
                  >
                    No component-level breakdown available for this run.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => {
                  // Alternating stripes (no 1px borders)
                  const stripe =
                    idx % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface-container-low/40';
                  return (
                    <tr
                      key={row.id}
                      className={`${stripe} hover:bg-surface-container/40 transition-colors`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary text-[10px] font-mono">
                            {(row.componentName || '?').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-on-surface">{row.componentName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-on-surface-variant">
                        {row.componentType || '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Num value={row.flowsProcessed ?? 0} precision={0} />
                      </td>
                      {categories.map((c) => {
                        const match = row.impacts.find((i) => i.categoryName === c.name);
                        const isHot = c.name === highlight;
                        return (
                          <td
                            key={c.name}
                            className={`px-6 py-4 text-right ${
                              isHot ? 'text-primary font-bold' : 'text-on-surface'
                            }`}
                          >
                            {match ? (
                              <Num value={match.value} precision={2} />
                            ) : (
                              <span className="text-on-surface-variant">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
