'use client';

// Section 1: Type & Placement — the tier (segmented control) and, for any
// tier but Product, the parent it sits under.

import { Icon } from '@/components/lcapix';
import { getTypeLabel, type NodeType } from '@/lib/hierarchy';
import { toFormType } from '@/lib/case-editor/component-form-model';
import type { ComponentFormState } from '@/lib/case-editor/use-component-form';
import { TypeSegmentedControl, type ComponentTypeValue } from './type-segmented-control';

export function TypePlacementSection({
  form: {
    formData,
    errors,
    handleTypeChange,
    handleParentChange,
    isProcessTypeLocked,
    isAddChildMode,
    disabledTypes,
    eligibleParents,
  },
}: {
  form: ComponentFormState;
}) {
  return (
    <section className="card-section" style={{ padding: 24 }}>
      <div className="title" style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        Type &amp; Placement <span style={{ color: 'var(--signal-error)' }}>*</span>
      </div>
      <div className="body-sm" style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>
        Where does this component fit in the process tree?
      </div>

      <div style={{ marginBottom: 16 }}>
        <TypeSegmentedControl
          value={formData.processType as ComponentTypeValue | ''}
          onChange={handleTypeChange}
          disabled={isProcessTypeLocked}
          // A case can only have one root Product: grey the option out
          // ahead of time instead of erroring after the click
          // (tool-review suggestion #2).
          disabledTypes={disabledTypes as ComponentTypeValue[] | undefined}
        />
        {errors.processType && (
          <p style={{ marginTop: 8, fontSize: 12, color: 'var(--signal-error)' }}>
            {errors.processType}
          </p>
        )}
        {isProcessTypeLocked && (
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
            Locked — {isAddChildMode ? 'add-child mode' : 'component has a parent'}
          </p>
        )}
      </div>

      {formData.processType && formData.processType !== 'product' && (
        <div>
          <label className="label">Parent component</label>
          <p
            style={{
              margin: '0 0 8px',
              fontSize: 11,
              color: 'var(--text-tertiary)',
              lineHeight: 1.45,
            }}
          >
            Every step needs a parent. It can be any higher-level step, so levels
            may be skipped: an operation can sit straight under the product when
            there is no line or subprocess.
          </p>
          <div style={{ position: 'relative' }}>
            <select
              className="input"
              style={{ appearance: 'none', paddingRight: 32 }}
              value={formData.parentId || ''}
              disabled={isAddChildMode}
              onChange={(e) => handleParentChange(e.target.value)}
            >
              <option value="" disabled>
                Choose a parent…
              </option>
              {eligibleParents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.name} ({getTypeLabel(toFormType(parent.type as unknown as string) as unknown as NodeType)})
                </option>
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
          {errors.parentId && (
            <p style={{ marginTop: 6, fontSize: 12, color: 'var(--signal-error)' }}>
              {errors.parentId}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
