'use client';
import { Plus } from 'lucide-react';

export interface CaseTabPillsProps {
  cases: { id: string | number; name: string; type: string }[];
  activeCaseId: string | number | null;
  onSelect: (id: string | number) => void;
  onAdd?: () => void;
}

export function CaseTabPills({ cases, activeCaseId, onSelect, onAdd }: CaseTabPillsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {cases.map((c) => {
        const active = c.id === activeCaseId;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            className={
              active
                ? 'px-4 py-2 rounded-md veridian-gradient text-on-primary text-sm font-semibold whitespace-nowrap shadow-sm'
                : 'px-4 py-2 rounded-md border border-outline-variant/30 text-on-surface/80 text-sm hover:bg-surface-container-low transition-colors whitespace-nowrap'
            }
          >
            {c.name}
            <span className="ml-2 font-mono text-[10px] uppercase tracking-wider opacity-70">
              {c.type}
            </span>
          </button>
        );
      })}
      {onAdd ? (
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add case"
          className="px-3 py-2 rounded-md border border-dashed border-outline-variant/40 text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      ) : null}
    </div>
  );
}
