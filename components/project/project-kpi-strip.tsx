import { Num } from '@/components/ui/num';

export interface ProjectKpi {
  label: string;
  value: number | string;
  unit?: string;
  status?: 'ok' | 'warn' | 'critical' | 'stable';
}

export function ProjectKpiStrip({ kpis }: { kpis: ProjectKpi[] }) {
  const statusColor = (s?: string) =>
    s === 'critical'
      ? 'text-error'
      : s === 'warn'
      ? 'text-tertiary'
      : s === 'stable'
      ? 'text-on-surface-variant'
      : 'text-primary';
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((k) => (
        <div
          key={k.label}
          className="bg-surface-container-lowest border border-outline-variant/15 rounded-lg p-5"
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-on-surface-variant mb-2">
            {k.label}
          </div>
          <div className={`text-3xl font-bold ${statusColor(k.status)}`}>
            <Num value={k.value} unit={k.unit} />
          </div>
        </div>
      ))}
    </div>
  );
}
