'use client';

// Section 5: Advanced (collapsed) — the drivers as a JSON array; only a
// valid array is taken.

import * as React from 'react';
import { Icon } from '@/components/lcapix';
import type { ComponentFormState } from '@/lib/case-editor/use-component-form';

export function AdvancedSection({
  form: { formData, setFormData },
}: {
  form: ComponentFormState;
}) {
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  return (
    <section className="card-section" style={{ padding: 0, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setAdvancedOpen((v) => !v)}
        style={{
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
          background: 'transparent',
          border: 'none',
          width: '100%',
          textAlign: 'left',
          fontFamily: 'var(--font-ui)',
        }}
      >
        <Icon
          name={advancedOpen ? 'chevron-down' : 'chevron-right'}
          size={14}
          style={{ color: 'var(--text-tertiary)' }}
        />
        <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Advanced</span>
        <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
          Drivers JSON · metadata
        </span>
      </button>

      {advancedOpen && (
        <div style={{ padding: '0 24px 24px' }}>
          <label className="label">Drivers (JSON array)</label>
          <textarea
            className="input mono"
            rows={4}
            value={JSON.stringify(formData.drivers ?? [], null, 2)}
            placeholder='["Electricity (kWh)"]'
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                if (Array.isArray(parsed)) {
                  setFormData((p) => ({ ...p, drivers: parsed }));
                }
              } catch {
                /* ignore partial input */
              }
            }}
            style={{ height: 120, padding: 10, resize: 'vertical' }}
          />
          <p
            className="mono"
            style={{
              marginTop: 8,
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--text-tertiary)',
            }}
          >
            Advanced metadata — parsed as JSON on blur-valid input
          </p>
        </div>
      )}
    </section>
  );
}
