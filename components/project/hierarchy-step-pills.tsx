const STEPS = ['Product', 'Major Assembly', 'Sub-Process', 'Operation', 'Elemental Task'];

export function HierarchyStepPills({ current }: { current?: number }) {
  return (
    <ol className="flex items-center gap-3 overflow-x-auto pb-1">
      {STEPS.map((label, i) => {
        const active = (current ?? 0) === i + 1;
        return (
          <li key={label} className="flex items-center gap-3">
            <span
              className={
                active
                  ? 'inline-flex items-center gap-2 px-3 py-1 rounded-md bg-primary text-on-primary font-mono text-[11px] uppercase tracking-wider'
                  : 'inline-flex items-center gap-2 px-3 py-1 rounded-md border border-outline-variant/30 text-on-surface-variant font-mono text-[11px] uppercase tracking-wider'
              }
            >
              {label}
            </span>
            {i < STEPS.length - 1 ? <span className="text-on-surface-variant/40">›</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
