'use client';

import { Num } from '@/components/ui/num';

export interface HistoricalRun {
  runId: number;
  runDate: string;
  /** Primary impact value (typically global warming, in kg CO2 eq or similar) */
  value: number;
  unit: string;
}

export interface HistoricalComparisonProps {
  runs: HistoricalRun[];
  /** runId of the currently-selected run (rendered bigger + in primary gradient) */
  currentRunId?: number;
  onSelect?: (runId: number) => void;
}

/**
 * Horizontal strip of past assessment runs. Renders nothing if < 2 runs
 * (YAGNI — no point comparing a single point to itself).
 */
export function HistoricalComparison({ runs, currentRunId, onSelect }: HistoricalComparisonProps) {
  if (!runs || runs.length < 2) return null;

  // Sort oldest → newest left to right
  const sorted = [...runs].sort(
    (a, b) => new Date(a.runDate).getTime() - new Date(b.runDate).getTime(),
  );
  const current = sorted.find((r) => r.runId === currentRunId) ?? sorted[sorted.length - 1];
  const previous = sorted.filter((r) => r.runId !== current.runId).slice(-1)[0];
  const deltaPct =
    previous && previous.value !== 0 ? ((current.value - previous.value) / previous.value) * 100 : null;

  // Auto-scale to metric tons when values look large + kg-like
  const scale = /kg/i.test(sorted[0]?.unit ?? '') && sorted.some((r) => Math.abs(r.value) >= 1000);
  const displayUnit = scale ? 'T' : sorted[0]?.unit ?? '';
  const toDisplay = (v: number) => (scale ? v / 1000 : v);

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-8">
        <h3 className="text-2xl font-bold tracking-tight text-on-surface">Historical Comparison</h3>
        {deltaPct !== null && (
          <span
            className={`text-xs font-mono font-bold px-3 py-1 rounded-full ${
              deltaPct < 0
                ? 'bg-secondary-container text-primary'
                : deltaPct > 0
                  ? 'bg-error-container text-error'
                  : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            DELTA: {deltaPct > 0 ? '+' : ''}
            {deltaPct.toFixed(1)}%
          </span>
        )}
      </div>

      <div className="relative bg-surface-container-lowest rounded-2xl p-8">
        <div className="absolute top-1/2 left-10 right-10 h-px bg-outline-variant/30 -translate-y-1/2" />
        <div className="relative flex justify-between items-center">
          {sorted.map((run) => {
            const isCurrent = run.runId === current.runId;
            return (
              <button
                key={run.runId}
                type="button"
                onClick={() => onSelect?.(run.runId)}
                className="bg-surface-container-lowest px-3 py-2 flex flex-col items-center gap-3 group transition-transform hover:scale-105"
              >
                <span
                  className={
                    isCurrent
                      ? 'w-5 h-5 rounded-full veridian-gradient ring-4 ring-primary/20 scale-125'
                      : 'w-3 h-3 rounded-full bg-outline-variant group-hover:scale-150 transition-transform'
                  }
                />
                <div className="text-center">
                  <p
                    className={`font-mono text-[10px] ${
                      isCurrent ? 'text-primary font-bold' : 'text-on-surface-variant'
                    }`}
                  >
                    {isCurrent
                      ? 'CURRENT'
                      : new Date(run.runDate)
                          .toLocaleDateString(undefined, { month: 'short', day: '2-digit' })
                          .toUpperCase()}
                  </p>
                  <p className="font-bold text-sm text-on-surface">
                    <Num value={toDisplay(run.value)} precision={2} /> {displayUnit}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
