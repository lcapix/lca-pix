'use client'

// Left pane of the workspace: the active case's tree on the MiniCanvas (or
// its empty states), with the node-details card under it.

import Link from 'next/link'
import { Icon, MiniCanvas } from '@/components/lcapix'
import type { DemoTreeNode } from '@/lib/lcapix-demo'
import type { CaseImpact } from '@/lib/project/case-impact'
import { EmptyCaseOverlay } from './empty-case-overlay'
import { NodeDetailsCard } from './node-details-card'

export interface CaseTreePanelProps {
  project: any
  projectId: string
  activeCase: any | null
  caseTree: DemoTreeNode | null
  selectedTreeNode: DemoTreeNode | null
  setSelectedTreeNode: (node: DemoTreeNode | null) => void
  isLoadingCaseTree: boolean
  caseImpact: CaseImpact | null
  router: { push: (href: string) => void }
  openTreeModal: (caseId: string) => void
  onCloneFromBase: (activeCase: any) => void
}

export function CaseTreePanel({
  project,
  projectId,
  activeCase,
  caseTree,
  selectedTreeNode,
  setSelectedTreeNode,
  isLoadingCaseTree,
  caseImpact,
  router,
  openTreeModal,
  onCloneFromBase,
}: CaseTreePanelProps) {
  return (
    <div
      className="card"
      style={{
        padding: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600 }}>Case Tree</span>
        {activeCase && (
          <span
            style={{
              fontSize: 12,
              color: 'var(--text-tertiary)',
            }}
          >
            · {activeCase.name}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button
          data-tour="project-open-editor"
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() =>
            activeCase
              ? router.push(`/project/${projectId}/case/${activeCase.id}`)
              : router.push(`/project/${projectId}/case/base/new`)
          }
        >
          <Icon name="external" size={14} /> Open editor
        </button>
        {activeCase && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => openTreeModal(activeCase.id)}
          >
            <Icon name="layers" size={14} /> View Full Hierarchy
          </button>
        )}
      </div>
      <div
        style={{
          position: 'relative',
          height: 440,
          background: 'var(--surface-sunken)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(var(--border-subtle) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            opacity: 0.5,
            pointerEvents: 'none',
          }}
        />
        {activeCase ? (
          caseTree ? (
            <>
              <MiniCanvas
                key={activeCase.id}
                tree={caseTree}
                selectedId={selectedTreeNode?.id ?? null}
                onSelect={setSelectedTreeNode}
              />
              <span
                className="mono"
                style={{
                  position: 'absolute',
                  left: 12,
                  bottom: 10,
                  fontSize: 10,
                  color: 'var(--text-tertiary)',
                  background: 'oklch(from var(--surface-raised) l c h / 0.85)',
                  padding: '3px 8px',
                  borderRadius: 4,
                  pointerEvents: 'none',
                  letterSpacing: '0.04em',
                }}
              >
                drag · scroll to zoom
              </span>
              {isLoadingCaseTree && (
                <span
                  className="mono"
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: 10,
                    fontSize: 10,
                    color: 'var(--text-tertiary)',
                  }}
                >
                  Loading…
                </span>
              )}
            </>
          ) : isLoadingCaseTree ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-tertiary)',
                fontSize: 12,
              }}
            >
              Loading case…
            </div>
          ) : (
            <EmptyCaseOverlay
              isComp={activeCase.type === 'comparative'}
              hasBase={!!project?.cases?.find((c: any) => c.type === 'base')}
              baseName={
                project?.cases?.find((c: any) => c.type === 'base')?.name
              }
              onOpenEditor={() =>
                router.push(`/project/${projectId}/case/${activeCase.id}`)
              }
              onCloneFromBase={() => onCloneFromBase(activeCase)}
            />
          )
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: 24,
              textAlign: 'center',
            }}
          >
            <div
              className="eyebrow"
              style={{ color: 'var(--text-tertiary)' }}
            >
              No case yet
            </div>
            <div
              className="body"
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                maxWidth: 320,
              }}
            >
              Open the editor to build your first hierarchy.
            </div>
            <Link href={`/project/${projectId}/case/base/new`}>
              <button type="button" className="btn btn-primary btn-sm">
                <Icon name="plus" size={14} /> Open editor
              </button>
            </Link>
          </div>
        )}
      </div>

      {/* Node details — shown when a node in the MiniCanvas is selected */}
      {selectedTreeNode && (
        <NodeDetailsCard
          selectedTreeNode={selectedTreeNode}
          caseTree={caseTree}
          caseImpact={caseImpact}
          activeCase={activeCase}
          projectId={projectId}
          onDismiss={() => setSelectedTreeNode(null)}
        />
      )}
    </div>
  )
}
