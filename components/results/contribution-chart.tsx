'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export interface ContributionEntry {
  label: string;
  value: number;
  unit?: string;
}

export interface ContributionChartProps {
  data: ContributionEntry[];
  title?: string;
}

// Veridian palette rotation for bars
const BAR_COLORS = ['#006a44', '#008558', '#5ddda1', '#94d3c1', '#2e6d5f', '#afefdd'];

/**
 * Bar chart of lifecycle-stage / component contributions. Pure presentation —
 * parent passes already-aggregated entries.
 */
export function ContributionChart({
  data,
  title = 'Contribution by Component',
}: ContributionChartProps) {
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  const unit = data[0]?.unit;

  return (
    <div className="bg-surface-container-low p-8 rounded-2xl">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-lg text-on-surface">{title}</h3>
        {unit && (
          <span className="font-mono text-[10px] uppercase text-on-surface-variant">{unit}</span>
        )}
      </div>

      {data.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-sm text-on-surface-variant">
          No contribution data available.
        </div>
      ) : (
        <>
          <div className="h-56 w-full">
            <ResponsiveContainer>
              <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono', fill: '#3d4a41' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e1e3e1' }}
                />
                <YAxis
                  tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono', fill: '#3d4a41' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e1e3e1' }}
                  width={52}
                />
                <Tooltip
                  contentStyle={{
                    background: '#ffffff',
                    border: '1px solid #e1e3e1',
                    borderRadius: 8,
                    fontSize: 12,
                    fontFamily: 'IBM Plex Mono',
                  }}
                  cursor={{ fill: 'rgba(0, 106, 68, 0.06)' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {total > 0 && (
            <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
              {data.slice(0, 6).map((d, i) => {
                const pct = total > 0 ? (d.value / total) * 100 : 0;
                return (
                  <div key={d.label} className="flex items-start gap-2">
                    <span
                      className="w-2 h-2 mt-1.5 rounded-full flex-shrink-0"
                      style={{ background: BAR_COLORS[i % BAR_COLORS.length] }}
                    />
                    <div className="min-w-0">
                      <p className="text-[10px] font-mono uppercase text-on-surface-variant truncate">
                        {d.label}
                      </p>
                      <p className="num text-sm font-bold text-on-surface">
                        {pct.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
