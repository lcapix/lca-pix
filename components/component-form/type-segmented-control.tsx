'use client';

import * as React from 'react';
import { Box, Factory, Layers3, Wrench, Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The 5 LCAPIX process-node types surfaced by this control. These values mirror
 * the strings used by the existing Zustand store / form state — do NOT rename
 * without co-updating the form handlers, zod schema (when added), and API.
 */
export type ComponentTypeValue =
  | 'product'
  | 'machine'
  | 'subprocess'
  | 'operation'
  | 'elemental';

export interface TypeSegmentedControlProps {
  value: ComponentTypeValue | '';
  onChange: (next: ComponentTypeValue) => void;
  disabled?: boolean;
  /** Optional: hide specific types (e.g. lock while add-child mode). */
  disabledTypes?: ComponentTypeValue[];
  className?: string;
  /** Applied to the aria-label of the control. */
  label?: string;
}

export const TYPE_OPTIONS: Array<{
  value: ComponentTypeValue;
  label: string;
  caption: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: 'product',    label: 'Product',    caption: 'Root', Icon: Box },
  { value: 'machine',    label: 'Machine/Line', caption: 'Line', Icon: Factory },
  { value: 'subprocess', label: 'Subprocess', caption: 'Sub',  Icon: Layers3 },
  { value: 'operation',  label: 'Operation',  caption: 'Op',   Icon: Wrench },
  { value: 'elemental',  label: 'Elemental',  caption: 'Leaf', Icon: Leaf },
];

/**
 * <TypeSegmentedControl> — 5-way segmented toggle for component process type.
 * Visual language: surface-container-low track, surface-container-lowest pill
 * for the active tab, primary accent on active label + icon. Shaped after the
 * Veridian "segmented" pattern (see DESIGN.md Botanical Precision).
 */
export function TypeSegmentedControl({
  value,
  onChange,
  disabled,
  disabledTypes,
  className,
  label = 'Component type',
}: TypeSegmentedControlProps) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'grid grid-cols-2 sm:grid-cols-5 gap-1 bg-surface-container-low p-1.5 rounded-xl',
        disabled && 'opacity-60 pointer-events-none',
        className,
      )}
    >
      {TYPE_OPTIONS.map(({ value: v, label: l, caption, Icon }) => {
        const selected = value === v;
        const itemDisabled = disabled || disabledTypes?.includes(v);
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={l}
            data-value={v}
            data-state={selected ? 'on' : 'off'}
            disabled={itemDisabled}
            onClick={() => onChange(v)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-lg text-xs font-semibold tracking-tight transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              selected
                ? 'bg-surface-container-lowest text-primary shadow-botanical'
                : 'text-on-surface-variant hover:bg-surface-container-high/50',
              itemDisabled && 'cursor-not-allowed',
            )}
          >
            <Icon className={cn('h-4 w-4', selected ? 'text-primary' : 'text-on-surface-variant')} />
            <span className="leading-none">{l}</span>
            <span
              className={cn(
                'font-mono text-[9px] uppercase tracking-[0.18em] leading-none',
                selected ? 'text-primary/70' : 'text-outline',
              )}
            >
              {caption}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default TypeSegmentedControl;
