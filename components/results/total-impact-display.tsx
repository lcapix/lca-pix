'use client';

import { TrendingUp, TrendingDown, Check } from 'lucide-react';
import { Num } from '@/components/ui/num';

export interface TotalImpactDisplayProps {
  /** Raw value in the given `unit`. Component auto-scales to metric tons if unit looks like kg. */
  value: number;
  unit: string;
  /** Optional headline label, e.g. "Global warming" */
  categoryLabel?: string;
  /** Optional % delta vs. previous run */
  deltaPct?: number | null;
  /** Optional "Equivalent to…" explanation sentence */
  equivalentText?: string;
  /** Optional benchmark indicator */
  targetMet?: boolean;
}

/**
 * Huge emerald total impact display — hero of the Veridian Flow results page.
 *
 * Visual-only component. Data is passed in by the parent; no fetching or
 * transforming logic lives here so the existing results/page handlers are
 * untouched.
 */
export function TotalImpactDisplay({
  value,
  unit,
  categoryLabel = 'Total Carbon Footprint',
  deltaPct,
  equivalentText,
  targetMet,
}: TotalImpactDisplayProps) {
  // Auto-scale kg-ish units to metric tons for display comfort
  const isKgUnit = /kg/i.test(unit);
  const displayValue = isKgUnit && Math.abs(value) >= 1000 ? value / 1000 : value;
  const displayUnit = isKgUnit && Math.abs(value) >= 1000 ? 'Metric Tons' : unit;
  const precision = Math.abs(displayValue) >= 100 ? 1 : 2;

  const deltaPositive = typeof deltaPct === 'number' && deltaPct > 0;
  const deltaNegative = typeof deltaPct === 'number' && deltaPct < 0;

  return (
    <div className="bg-surface-container-lowest p-6 sm:p-8 rounded-2xl relative overflow-hidden flex flex-col justify-between min-h-[450px]">
      <div className="relative z-10">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold uppercase tracking-wider mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          {categoryLabel}
        </span>

        <div className="flex items-baseline gap-4 flex-wrap">
          <h2 className="text-[3.5rem] sm:text-[4.5rem] md:text-[6rem] lg:text-[7.5rem] font-bold leading-none tracking-tighter text-primary break-all">
            <Num value={displayValue} precision={precision} />
            <span className="text-xl sm:text-2xl md:text-3xl font-medium text-on-surface-variant ml-3 tracking-normal uppercase">
              {displayUnit}
            </span>
          </h2>
        </div>

        {equivalentText && (
          <p className="text-on-surface-variant max-w-md mt-4">{equivalentText}</p>
        )}
      </div>

      <div className="relative z-10 flex flex-col sm:flex-row gap-4 mt-8">
        <div className="flex-1 p-4 bg-surface-container rounded-xl">
          <p className="text-[10px] font-mono uppercase text-on-surface-variant">Change</p>
          {typeof deltaPct === 'number' ? (
            <p
              className={`text-lg font-bold flex items-center gap-1 ${
                deltaPositive ? 'text-error' : deltaNegative ? 'text-primary' : 'text-on-surface'
              }`}
            >
              {deltaPositive ? (
                <TrendingUp className="h-4 w-4" />
              ) : deltaNegative ? (
                <TrendingDown className="h-4 w-4" />
              ) : null}
              {deltaPct > 0 ? '+' : ''}
              <Num value={deltaPct} precision={1} />%
            </p>
          ) : (
            <p className="text-lg font-bold text-on-surface-variant">—</p>
          )}
        </div>
        <div className="flex-1 p-4 bg-surface-container rounded-xl">
          <p className="text-[10px] font-mono uppercase text-on-surface-variant">Benchmark</p>
          <p className="text-lg font-bold text-on-surface flex items-center gap-1">
            {targetMet ? (
              <>
                <Check className="h-4 w-4 text-primary" />
                Target Met
              </>
            ) : (
              'Pending'
            )}
          </p>
        </div>
      </div>

      <div
        className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full opacity-50 blur-3xl pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at center, rgba(123, 250, 187, 0.25) 0%, transparent 70%)',
        }}
      />
    </div>
  );
}
