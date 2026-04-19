import * as React from 'react';
import { cn } from '@/lib/utils';

export interface NumProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number | string | null | undefined;
  precision?: number;
  unit?: string;
  locale?: string;
}

/**
 * <Num> — renders a numeric value in tabular monospace via the `.num`
 * utility class (defined in app/globals.css). Every numeric value in
 * LCAPIX (impacts, costs, percentages, CAS numbers) should flow through
 * this component so tables align and data feels engineering-grade.
 */
export function Num({
  value,
  precision,
  unit,
  locale,
  className,
  ...rest
}: NumProps) {
  const display = React.useMemo(() => {
    if (value === null || value === undefined) return '—';
    const n = typeof value === 'string' ? Number(value) : value;
    if (Number.isNaN(n)) return String(value);
    const opts: Intl.NumberFormatOptions = precision !== undefined
      ? { minimumFractionDigits: precision, maximumFractionDigits: precision }
      : {};
    return new Intl.NumberFormat(locale ?? 'en-US', opts).format(n);
  }, [value, precision, locale]);

  return (
    <span className={cn('num', className)} {...rest}>
      {display}
      {unit ? <span className="ml-1 text-on-surface-variant">{unit}</span> : null}
    </span>
  );
}
