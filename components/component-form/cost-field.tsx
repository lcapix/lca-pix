'use client';

// One cost input with its currency prefix. Blank is unknown; 0 is a real cost (FLOW-7).

import * as React from 'react';

export function CostField({
  label, value, currency, onChange,
}: {
  label: string;
  value: number | undefined;
  currency: string;
  onChange: (v: number | undefined) => void;
}) {
  const id = React.useId();
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div style={{ position: 'relative' }}>
        <span
          className="mono"
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 11,
            color: 'var(--text-tertiary)',
            pointerEvents: 'none',
          }}
        >
          {currency || 'USD'}
        </span>
        <input
          id={id}
          className="input mono"
          type="number"
          min="0"
          step="0.01"
          value={value ?? ''}
          placeholder="0.00"
          onChange={(e) => {
            // Blank is unknown; 0 is a real cost (FLOW-7).
            const n = e.target.value === '' ? undefined : parseFloat(e.target.value);
            onChange(n !== undefined && Number.isFinite(n) ? n : undefined);
          }}
          style={{ paddingLeft: 46 }}
        />
      </div>
    </div>
  );
}
