'use client'

// Node details — shown under the MiniCanvas when a node is selected: tier,
// path, and the subtree's CO₂ share, cost, flows and children.

import Link from 'next/link'
import { Icon } from '@/components/lcapix'
import type { DemoTreeNode } from '@/lib/lcapix-demo'
import { pastelFor } from '@/lib/hierarchy-pastels'
import { nodeDetailsMetrics, nodePathLabel } from '@/lib/project/case-tree'
import type { CaseImpact } from '@/lib/project/case-impact'

export interface NodeDetailsCardProps {
  selectedTreeNode: DemoTreeNode
  caseTree: DemoTreeNode | null
  caseImpact: CaseImpact | null
  activeCase: any | null
  projectId: string
  onDismiss: () => void
}

export function NodeDetailsCard({
  selectedTreeNode,
  caseTree,
  caseImpact,
  activeCase,
  projectId,
  onDismiss,
}: NodeDetailsCardProps) {
  const tone = pastelFor(selectedTreeNode.type)
  // Walk the subtree and sum impact / cost / flow count from every
  // descendant. Leaves carry the real numbers; ancestors aggregate.
  const { co2, cost, flows, childCount, co2Pct } = nodeDetailsMetrics(selectedTreeNode, caseImpact)
  return (
    <div
      key={selectedTreeNode.id}
      className="card fade-slide-up"
      style={{
        marginTop: 16,
        padding: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header band — clean, no loud color slab */}
      <div
        style={{
          padding: '16px 22px 14px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 16,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                padding: '4px 10px 4px 8px',
                borderRadius: 999,
                background: 'var(--surface-overlay)',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: tone.bg,
                  flexShrink: 0,
                }}
              />
              {tone.label}
            </span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              #{selectedTreeNode.id}
            </span>
          </div>
          <div
            className="title"
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 2,
              letterSpacing: '-0.01em',
            }}
          >
            {selectedTreeNode.label}
          </div>
          <div
            className="mono"
            style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
          >
            {/* Don't show the synthetic '__root__' container in the
                path — top-level nodes read as roots themselves. */}
            Path:{' '}
            {nodePathLabel(caseTree, selectedTreeNode)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {activeCase && (
            <Link href={`/project/${projectId}/case/${activeCase.id}`}>
              <button type="button" className="btn btn-secondary btn-sm press-active">
                <Icon name="external" size={12} /> Edit
              </button>
            </Link>
          )}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss details"
            className="press-active"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              padding: 6,
              borderRadius: 6,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      </div>

      {/* Metric cells */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 0,
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        {/* CO2 contribution */}
        <div style={{ padding: '14px 18px', borderRight: '1px solid var(--border-subtle)' }}>
          <div className="label-sm" style={{ marginBottom: 6, fontSize: 10 }}>
            CO₂ contribution
          </div>
          {co2 === null ? (
            <>
              <div
                className="mono"
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--text-tertiary)',
                  marginBottom: 6,
                }}
              >
                Not assessed
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                Run an assessment to see this value
              </div>
            </>
          ) : (
            <>
              <div
                className="mono"
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: 6,
                }}
              >
                {co2.toFixed(2)}{' '}
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400 }}>
                  kg CO₂-eq
                </span>
              </div>
              <div
                style={{
                  height: 4,
                  background: 'var(--surface-overlay)',
                  borderRadius: 999,
                  overflow: 'hidden',
                }}
              >
                <div
                  className="bar-fill"
                  style={{
                    width: `${co2Pct}%`,
                    height: '100%',
                    background: tone.bg,
                    borderRadius: 999,
                  }}
                />
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>
                {co2Pct}% of total
              </div>
            </>
          )}
        </div>

        {/* Cost */}
        <div style={{ padding: '14px 18px', borderRight: '1px solid var(--border-subtle)' }}>
          <div className="label-sm" style={{ marginBottom: 6, fontSize: 10 }}>
            Cost
          </div>
          <div
            className="mono"
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--brand-primary)',
              marginBottom: 6,
            }}
          >
            ${cost.toLocaleString()}
          </div>
          <div
            style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
            title="Labour, energy, material, transport, equipment and overhead where a case carries them; otherwise the operational and capital figures entered on the component."
          >
            activity-based, rolled up
          </div>
        </div>

        {/* Flows */}
        <div style={{ padding: '14px 18px', borderRight: '1px solid var(--border-subtle)' }}>
          <div className="label-sm" style={{ marginBottom: 6, fontSize: 10 }}>
            Flows
          </div>
          <div
            className="mono"
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 6,
            }}
          >
            {flows}
          </div>
          <div
            style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
            title="Inputs and outputs attached to this node and everything below it"
          >
            inputs and outputs
          </div>
        </div>

        {/* Children */}
        <div style={{ padding: '14px 18px' }}>
          <div className="label-sm" style={{ marginBottom: 6, fontSize: 10 }}>
            Children
          </div>
          <div
            className="mono"
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 6,
            }}
          >
            {childCount}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            sub-components
          </div>
        </div>
      </div>
    </div>
  )
}
