import { Num } from '@/components/ui/num';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface KpiCard {
  label: string;
  value: number | string;
  delta?: string;
  trend?: 'up' | 'down' | 'flat';
  unit?: string;
}

export function KpiCardRow({ kpis }: { kpis: KpiCard[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((k) => (
        <div
          key={k.label}
          className="bg-surface-container-lowest border border-outline-variant/15 rounded-lg p-5 shadow-sm hover:shadow-botanical transition-shadow"
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-on-surface-variant mb-3">
            {k.label}
          </div>
          <div className="text-3xl font-bold text-on-surface">
            <Num value={k.value} unit={k.unit} />
          </div>
          {k.delta ? (
            <div
              className={`mt-2 flex items-center gap-1 text-xs ${
                k.trend === 'down' ? 'text-error' : 'text-primary'
              }`}
            >
              {k.trend === 'down' ? (
                <TrendingDown className="w-3 h-3" />
              ) : (
                <TrendingUp className="w-3 h-3" />
              )}
              {k.delta}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
