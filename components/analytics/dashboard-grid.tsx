'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DashboardGridProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

/**
 * DashboardGrid — 12-column responsive grid wrapper for Veridian Flow
 * analytics tiles. Children opt into width via `col-span-N` utilities
 * (e.g. `col-span-12 lg:col-span-6`).
 *
 * Visual-only: no state, no data handling. Sits beneath the existing
 * page shell and simply arranges tiled charts/cards.
 */
export function DashboardGrid({ children, className, ...rest }: DashboardGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-12 gap-6 lg:gap-8',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export default DashboardGrid;
