'use client';

// Section 3: Structural Drivers (elemental tasks only) — a driver category,
// then the drivers in it.

import { Icon } from '@/components/lcapix';
import { DRIVER_CATEGORIES, DRIVERS_BY_CATEGORY } from '@/lib/case-editor/component-form-model';
import type { ComponentFormState } from '@/lib/case-editor/use-component-form';

export function DriversSection({
  form: { formData, setFormData },
}: {
  form: ComponentFormState;
}) {
  const availableDrivers = formData.driverCategory
    ? DRIVERS_BY_CATEGORY[formData.driverCategory] || []
    : [];
  return (
    <section className="card-section" style={{ padding: 24 }}>
      <div className="title" style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
        Structural Drivers
      </div>

      <label className="label">Driver category</label>
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <select
          className="input"
          style={{ appearance: 'none', paddingRight: 32 }}
          value={formData.driverCategory}
          onChange={(e) =>
            setFormData((p) => ({ ...p, driverCategory: e.target.value, drivers: [] }))
          }
        >
          <option value="">Select a driver category</option>
          {DRIVER_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <Icon
          name="chevron-down"
          size={14}
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-tertiary)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {formData.driverCategory && (
        <>
          <label className="label">Drivers</label>
          <div
            style={{
              background: 'var(--surface-overlay)',
              borderRadius: 6,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            {availableDrivers.map((driver) => {
              const checked = formData.drivers.includes(driver);
              return (
                <label
                  key={driver}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 4px',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  <span>{driver}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData((p) => ({ ...p, drivers: [...p.drivers, driver] }));
                      } else {
                        setFormData((p) => ({
                          ...p,
                          drivers: p.drivers.filter((d) => d !== driver),
                        }));
                      }
                    }}
                  />
                </label>
              );
            })}
          </div>
          {formData.drivers.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {formData.drivers.map((d) => (
                <span key={d} className="chip" style={{ fontSize: 11 }}>
                  {d}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
