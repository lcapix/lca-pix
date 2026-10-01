'use client';

// Section 4: Costs (collapsed) — the running total in the header; inside,
// Suggest from integrations, operational and capital cost, the six
// activity-based costs, and the currency.

import * as React from 'react';
import { Icon } from '@/components/lcapix';
import { formatCostSummary } from '@/lib/case-editor/component-form-model';
import type { ComponentFormState } from '@/lib/case-editor/use-component-form';
import { CostField } from './cost-field';
import { IntegrationSuggestPanel } from './integration-suggest-panel';

export function CostsSection({
  form: { formData, setFormData },
}: {
  form: ComponentFormState;
}) {
  const [costsOpen, setCostsOpen] = React.useState(false);
  return (
    <section className="card-section" style={{ padding: 0, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setCostsOpen((v) => !v)}
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
          name={costsOpen ? 'chevron-down' : 'chevron-right'}
          size={14}
          style={{ color: 'var(--text-tertiary)' }}
        />
        <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Costs</span>
        <span className="mono" style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
          {formData.currency || 'USD'} {formatCostSummary(formData)} estimated
        </span>
      </button>

      {costsOpen && (
        <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <IntegrationSuggestPanel
            componentType={formData.processType}
            nodeName={formData.processName}
            quantity={formData.mass ?? 1}
            region="US"
            onApply={(suggestion) =>
              setFormData((p) => ({
                ...p,
                laborCost: suggestion.labor ?? p.laborCost,
                energyCost: suggestion.energy ?? p.energyCost,
                materialCost: suggestion.material ?? p.materialCost,
              }))
            }
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <CostField
              label="Operational cost"
              value={formData.operationalCostUSD}
              currency={formData.currency}
              onChange={(v) => setFormData((p) => ({ ...p, operationalCostUSD: v }))}
            />
            <CostField
              label="Capital cost"
              value={formData.capitalCostUSD}
              currency={formData.currency}
              onChange={(v) => setFormData((p) => ({ ...p, capitalCostUSD: v }))}
            />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
              paddingTop: 12,
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <CostField
              label="Labor"
              value={formData.laborCost}
              currency={formData.currency}
              onChange={(v) => setFormData((p) => ({ ...p, laborCost: v }))}
            />
            <CostField
              label="Energy"
              value={formData.energyCost}
              currency={formData.currency}
              onChange={(v) => setFormData((p) => ({ ...p, energyCost: v }))}
            />
            <CostField
              label="Material"
              value={formData.materialCost}
              currency={formData.currency}
              onChange={(v) => setFormData((p) => ({ ...p, materialCost: v }))}
            />
            <CostField
              label="Transportation"
              value={formData.transportationCost}
              currency={formData.currency}
              onChange={(v) => setFormData((p) => ({ ...p, transportationCost: v }))}
            />
            <CostField
              label="Equipment"
              value={formData.equipmentCost}
              currency={formData.currency}
              onChange={(v) => setFormData((p) => ({ ...p, equipmentCost: v }))}
            />
            <CostField
              label="Overhead"
              value={formData.overheadCost}
              currency={formData.currency}
              onChange={(v) => setFormData((p) => ({ ...p, overheadCost: v }))}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label">Currency (ISO 4217)</label>
              <input
                className="input mono"
                type="text"
                value={formData.currency}
                maxLength={3}
                placeholder="USD"
                onChange={(e) =>
                  setFormData((p) => ({ ...p, currency: e.target.value.toUpperCase() }))
                }
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
