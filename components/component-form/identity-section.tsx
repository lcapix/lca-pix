'use client';

// Section 2: Identity — name (required, 100 characters), description,
// quantity and unit.

import type { ComponentFormState } from '@/lib/case-editor/use-component-form';

export function IdentitySection({
  form: { formData, setFormData, errors, handleNameChange },
}: {
  form: ComponentFormState;
}) {
  return (
    <section className="card-section" style={{ padding: 24 }}>
      <div className="title" style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
        Identity
      </div>

      <label className="label">
        Name <span style={{ color: 'var(--signal-error)' }}>*</span>
      </label>
      <input
        className="input"
        type="text"
        value={formData.processName}
        maxLength={100}
        placeholder="e.g. Cathode Coating"
        onChange={(e) => handleNameChange(e.target.value)}
        style={{ marginBottom: 4 }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        {errors.processName ? (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--signal-error)' }}>
            {errors.processName}
          </p>
        ) : <span />}
        <span
          className="mono"
          style={{
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--text-tertiary)',
          }}
        >
          {formData.processName.length} / 100
        </span>
      </div>

      <label className="label">Description</label>
      <textarea
        className="input"
        value={formData.processDescription}
        rows={3}
        placeholder="Process steps, materials, assumptions…"
        onChange={(e) =>
          setFormData((p) => ({ ...p, processDescription: e.target.value }))
        }
        style={{ height: 72, padding: 10, marginBottom: 12, resize: 'vertical' }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <div>
          <label className="label">Quantity</label>
          <input
            className="input mono"
            type="number"
            min="0"
            step="0.01"
            value={formData.mass || ''}
            placeholder="0"
            onChange={(e) =>
              setFormData((p) => ({
                ...p,
                mass: e.target.value === '' ? 0 : parseFloat(e.target.value),
              }))
            }
          />
        </div>
        <div>
          <label className="label">Unit</label>
          <input
            className="input mono"
            type="text"
            value={formData.massUnit}
            placeholder="kg"
            onChange={(e) =>
              setFormData((p) => ({ ...p, massUnit: e.target.value }))
            }
          />
        </div>
      </div>
    </section>
  );
}
