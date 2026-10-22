'use client'

// Life-cycle stage: which stage of the product's life this step belongs to.
// The results and the report split by it.

import { STAGES, stageOf } from '@/lib/life-cycle'
import type { InspectorEditFormData } from '@/lib/case-editor/types'
import { InspectorSection } from './inspector-section'

export function LifeCycleSection({
  editFormData,
  onChange,
}: {
  editFormData: InspectorEditFormData
  onChange: (patch: Partial<InspectorEditFormData>) => void
}) {
  return (
    <InspectorSection title="Life-cycle stage" defaultOpen={false}>
      <div style={{ padding: '4px 0 8px' }}>
        <select
          className="input"
          style={{ height: 30, fontSize: 12, width: '100%' }}
          value={stageOf(editFormData.lifeCycleStage)}
          onChange={(e) => onChange({ lifeCycleStage: e.target.value })}
          title="Which stage of the product's life this step belongs to. The results and the report split by this, and the boundary in Goal & scope says which stages a reader should expect."
        >
          {STAGES.map((st) => (
            <option key={st.id} value={st.id}>
              {st.label}
            </option>
          ))}
        </select>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.5 }}>
          {STAGES.find((st) => st.id === stageOf(editFormData.lifeCycleStage))?.hint}
        </div>
      </div>
    </InspectorSection>
  )
}
