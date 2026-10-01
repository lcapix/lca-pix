'use client'

// Case tabs — the base case card (fixed) plus one COMP card that switches
// between comparative cases, then "Add case".

import { useEffect, useState } from 'react'
import { Icon } from '@/components/lcapix'

export function CaseTabs({
  baseCases,
  comparativeCases,
  activeCaseId,
  onSelect,
  onAdd,
}: {
  baseCases: any[]
  comparativeCases: any[]
  activeCaseId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
}) {
  const baseCase = baseCases[0]
  // Index of the currently displayed comp case in the comparativeCases array.
  // When the active case is a comp, sync the index to it.
  const initialCompIdx = (() => {
    const idx = comparativeCases.findIndex((c) => c.id === activeCaseId)
    return idx === -1 ? 0 : idx
  })()
  const [compIdx, setCompIdx] = useState(initialCompIdx)
  useEffect(() => {
    const idx = comparativeCases.findIndex((c) => c.id === activeCaseId)
    if (idx >= 0) setCompIdx(idx)
  }, [activeCaseId, comparativeCases])
  // Clamp on list change.
  useEffect(() => {
    if (compIdx >= comparativeCases.length) setCompIdx(0)
  }, [comparativeCases.length, compIdx])

  const compCase = comparativeCases[compIdx] ?? null
  const hasMultipleComps = comparativeCases.length > 1
  const compActive = compCase && activeCaseId === compCase.id

  return (
    <div
      style={{
        marginTop: 24,
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        paddingBottom: 8,
      }}
    >
      {baseCases.map((bc) => (
        <button
          key={bc.id}
          type="button"
          onClick={() => onSelect(bc.id)}
          className="case-tab"
          data-active={activeCaseId === bc.id ? 'true' : 'false'}
          data-kind="base"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {bc.name}
            </span>
            <span
              className="label-sm"
              style={{
                fontSize: 9,
                color: activeCaseId === bc.id
                  ? 'var(--brand-primary)'
                  : 'var(--text-tertiary)',
              }}
            >
              BASE
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              display: 'flex',
              gap: 8,
            }}
          >
            <span>
              <span className="mono">
                {bc.componentCount ?? bc.components?.length ?? 0}
              </span>{' '}
              steps
            </span>
            <span>·</span>
            <span>
              <span className="mono">{bc.driverCount ?? 0}</span> flows
            </span>
          </div>
        </button>
      ))}

      {compCase ? (
        <div
          className="case-tab"
          data-active={compActive ? 'true' : 'false'}
          data-kind="comp"
          onClick={() => onSelect(compCase.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onSelect(compCase.id)
          }}
          style={{
            // override <button>-only flex if any — this is a div now
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
            }}
          >
            {hasMultipleComps ? (
              <label
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'relative',
                  flex: 1,
                  minWidth: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 32px 4px 10px',
                  borderRadius: 8,
                  background:
                    'color-mix(in oklab, var(--brand-primary) 8%, transparent)',
                  border:
                    '1px solid color-mix(in oklab, var(--brand-primary) 35%, transparent)',
                  cursor: 'pointer',
                  transition: 'background 160ms ease, border-color 160ms ease',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background =
                    'color-mix(in oklab, var(--brand-primary) 14%, transparent)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background =
                    'color-mix(in oklab, var(--brand-primary) 8%, transparent)'
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flex: 1,
                    minWidth: 0,
                    pointerEvents: 'none',
                  }}
                  title={compCase.name}
                >
                  {compCase.name}
                </span>
                {/* Big prominent chevron */}
                <svg
                  aria-hidden
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: 'var(--brand-primary)',
                  }}
                >
                  <path
                    d="M6 9l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <select
                  value={compCase.id}
                  onChange={(e) => {
                    e.stopPropagation()
                    const next = comparativeCases.find(
                      (c) => c.id === e.target.value,
                    )
                    if (next) onSelect(next.id)
                  }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer',
                    border: 'none',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                  }}
                >
                  {comparativeCases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  flex: 1,
                  minWidth: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={compCase.name}
              >
                {compCase.name}
              </span>
            )}
            <span
              className="label-sm"
              style={{
                fontSize: 9,
                color: compActive
                  ? 'var(--brand-primary)'
                  : 'var(--text-tertiary)',
              }}
            >
              COMP
            </span>
            {hasMultipleComps && (
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  color: 'var(--text-tertiary)',
                }}
                aria-label={`Comparative ${compIdx + 1} of ${comparativeCases.length}`}
              >
                {compIdx + 1}/{comparativeCases.length}
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              display: 'flex',
              gap: 8,
            }}
          >
            <span>
              <span className="mono">
                {compCase.componentCount ?? compCase.components?.length ?? 0}
              </span>{' '}
              steps
            </span>
            <span>·</span>
            <span>
              <span className="mono">{compCase.driverCount ?? 0}</span>{' '}
              flows
            </span>
          </div>
        </div>
      ) : (
        baseCase && (
          <button
            type="button"
            onClick={onAdd}
            className="case-tab"
            data-kind="comp"
            style={{
              borderStyle: 'dashed',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
              <Icon name="plus" size={12} /> Add comparative
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-disabled)',
                marginTop: 6,
              }}
            >
              Compare alternatives side-by-side
            </div>
          </button>
        )
      )}

      <button
        type="button"
        onClick={onAdd}
        style={{
          padding: '12px 18px',
          border: '1px dashed var(--border-subtle)',
          borderRadius: 12,
          background: 'transparent',
          color: 'var(--text-tertiary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontFamily: 'var(--font-ui)',
        }}
      >
        <Icon name="plus" size={12} /> Add case
      </button>
    </div>
  )
}
