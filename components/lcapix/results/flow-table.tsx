'use client'

// Flow-level detail: the run's per-flow rows for the active category
// (Amount × Factor = Impact, as the engine computed it), with the input /
// output filter, each factor's source on hover and the Global fallback flag.

import { Icon } from '@/components/lcapix'
import { HelpTip } from '@/components/lcapix/help-tip'
import { ISO_HELP } from '@/components/lcapix/iso-help'
import { fmtSig } from '@/components/lcapix/formatters'
import type { CategoryBarChartItem } from '@/components/lcapix'
import {
  factorTitle,
  isGlobalFallback,
  isWeakFactorSource,
  type AssessmentResult,
  type FilterDir,
  type FlowTableRow,
} from '@/lib/results/results-view'

export interface FlowTableProps {
  flowRows: FlowTableRow[]
  flowFilter: FilterDir
  setFlowFilter: (filter: FilterDir) => void
  router: { push: (href: string) => void }
  projectId: string
  caseId: string
  /** The region the displayed run was computed with. */
  runRegion: string
  mostRecentAssessment: AssessmentResult | null
  activeCat: CategoryBarChartItem | undefined
}

export function FlowTable({
  flowRows,
  flowFilter,
  setFlowFilter,
  router,
  projectId,
  caseId,
  runRegion,
  mostRecentAssessment,
  activeCat,
}: FlowTableProps) {
  return (
    <div
      className="card"
      style={{ padding: 0, marginBottom: 20, overflow: 'hidden' }}
    >
      <div
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600 }}>Flow-level detail</span>
        <HelpTip label="How do I read this table?" width={320}>
          {ISO_HELP.flowTable}
        </HelpTip>
        <span
          style={{
            marginLeft: 8,
            fontSize: 12,
            color: 'var(--text-tertiary)',
          }}
        >
          <span className="mono">{flowRows.length}</span> flows
        </span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'in', label: 'Inputs' },
              { id: 'out', label: 'Outputs' },
            ] as Array<{ id: FilterDir; label: string }>
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setFlowFilter(f.id)}
              className={
                'chip ' + (flowFilter === f.id ? 'chip-active' : '')
              }
              style={{
                fontSize: 11,
                cursor: 'pointer',
                border: 'none',
              }}
            >
              {f.id === 'all' && <Icon name="filter" size={10} />} {f.label}
            </button>
          ))}
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.5fr 2fr 70px 100px 90px 90px 70px 100px',
          padding: '10px 20px',
          background: 'var(--surface-overlay)',
          fontSize: 10,
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight: 600,
        }}
      >
        <div>Component</div>
        <div>Substance</div>
        <div>Dir</div>
        <div style={{ textAlign: 'right' }}>Amount</div>
        <div>Unit</div>
        <div style={{ textAlign: 'right' }}>Factor</div>
        <div>Scope</div>
        <div style={{ textAlign: 'right' }}>Impact</div>
      </div>
      {flowRows.map((f) => (
        <div
          key={f.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '1.5fr 2fr 70px 100px 90px 90px 70px 100px',
            padding: '10px 20px',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: 12,
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={() =>
              router.push(
                `/project/${projectId}/case/${caseId}?component=${encodeURIComponent(f.component)}`,
              )
            }
            title="Edit this component's flows (e.g. remove the CO₂ output to clear the double-count)"
            style={{
              color: 'var(--brand-primary)',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
              font: 'inherit',
              textDecoration: 'underline',
              textDecorationStyle: 'dotted',
              textUnderlineOffset: 2,
            }}
          >
            {f.component}
          </button>
          <div style={{ color: 'var(--text-primary)' }}>{f.substance}</div>
          <div>
            <span
              style={{
                fontSize: 9,
                padding: '2px 6px',
                borderRadius: 3,
                background:
                  f.dir === 'IN'
                    ? 'oklch(from var(--signal-info) l c h / 0.18)'
                    : 'oklch(from var(--signal-warn) l c h / 0.18)',
                color:
                  f.dir === 'IN' ? 'var(--signal-info)' : 'var(--signal-warn)',
                fontWeight: 600,
              }}
            >
              {f.dir}
            </span>
          </div>
          <div className="mono" style={{ textAlign: 'right' }}>
            {fmtSig(f.amount)}
          </div>
          <div style={{ color: 'var(--text-tertiary)' }} title={f.conversion || undefined}>
            {f.unit}
            {f.conversion ? ' *' : ''}
          </div>
          <div
            className="mono"
            style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}
            title={factorTitle(f.source, f.sourceTier)}
          >
            {fmtSig(f.factor)}
            {isWeakFactorSource(f.sourceTier) && (
              <span style={{ color: 'var(--signal-warn)' }}> !</span>
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            {f.scope ? (
              isGlobalFallback(f.scope, runRegion) ? (
                <span title="No region-specific factor on file for this substance — the engine fell back to the Global factor. Your region choice was applied where a regional factor exists (e.g. electricity).">
                  Global{' '}
                  <span style={{ color: 'var(--signal-warn)' }}>(fallback)</span>
                </span>
              ) : (
                f.scope
              )
            ) : (
              '—'
            )}
          </div>
          <div
            className="mono"
            style={{
              textAlign: 'right',
              color: 'var(--brand-primary)',
              fontWeight: 500,
            }}
          >
            {fmtSig(f.impact)}
            {f.allocation != null && f.allocation < 1 && (
              <span
                title={`Allocated: ${Math.round(f.allocation * 100)}% of this process's burden is assigned to the product (ISO 14044 4.3.4)`}
                style={{ color: 'var(--text-tertiary)', fontSize: 10 }}
              >
                {' '}
                ×{Math.round(f.allocation * 100)}%
              </span>
            )}
          </div>
        </div>
      ))}
      {flowRows.length === 0 && (
        <div
          style={{
            padding: '28px 20px',
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--text-tertiary)',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          {mostRecentAssessment
            ? `No driver flows contribute to ${activeCat?.label ?? 'this category'}. Add input/output flows on an operation and re-run.`
            : 'Run an assessment to see flow-level detail.'}
        </div>
      )}
    </div>
  )
}
