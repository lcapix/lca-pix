'use client'

// Inline "Suggest" in the inspector's Costs: cost this step's flows from
// reference rates (BLS / EIA / USGS), then Apply & save.

import type { InspectorFlow } from '@/lib/case-editor/types'
import {
  hasSuggestedCost,
  useCostSuggestion,
  type SuggestedCosts,
} from '@/lib/case-editor/use-cost-suggestion'

export function InlineSuggestStrip({
  componentType,
  nodeName,
  flows,
  laborHours,
  onApply,
}: {
  componentType: string
  nodeName?: string
  flows: InspectorFlow[]
  /** Hours worked on this step: the only way labor gets costed. */
  laborHours?: number
  onApply: (s: SuggestedCosts) => void
}) {
  const { result, applied, suggest, apply, dismiss } = useCostSuggestion({
    flows,
    componentType,
    nodeName,
    laborHours,
    onApply,
  })

  return (
    <div
      style={{
        marginBottom: 10,
        padding: 10,
        background:
          'color-mix(in oklab, var(--brand-primary) 5%, var(--surface-raised))',
        border:
          '1px solid color-mix(in oklab, var(--brand-primary) 18%, var(--border-subtle))',
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background:
              'color-mix(in oklab, var(--brand-primary) 20%, transparent)',
            color: 'var(--brand-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          ✦
        </span>
        <span
          style={{
            flex: 1,
            fontSize: 11.5,
            color: 'var(--text-secondary)',
            lineHeight: 1.4,
          }}
        >
          Cost this step&apos;s flows from reference rates
          {' '}(BLS / EIA / USGS). Uses the real flow quantities.
        </span>
        <button
          type="button"
          onClick={suggest}
          className="btn btn-ghost btn-sm"
          style={{
            fontSize: 11,
            padding: '4px 10px',
            flexShrink: 0,
          }}
        >
          {result ? 'Refresh' : applied ? 'Suggest again' : 'Suggest'}
        </button>
      </div>
      {applied && !result && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11.5,
            color: 'var(--signal-success, #0f7b3a)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          ✓ Applied &amp; saved to costs.
        </div>
      )}
      {applied && !result && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: 'var(--signal-success, #0F7B3A)',
            fontWeight: 600,
          }}
        >
          ✓ Applied &amp; saved to costs
        </div>
      )}
      {result && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: '1px dashed var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              fontSize: 11,
            }}
          >
            {result.payload.labor != null && (
              <span>
                <span style={{ color: 'var(--text-tertiary)' }}>L</span>{' '}
                <span className="mono" style={{ fontWeight: 600 }}>
                  ${result.payload.labor.toFixed(2)}
                </span>
              </span>
            )}
            {result.payload.energy != null && (
              <span>
                <span style={{ color: 'var(--text-tertiary)' }}>E</span>{' '}
                <span className="mono" style={{ fontWeight: 600 }}>
                  ${result.payload.energy.toFixed(2)}
                </span>
              </span>
            )}
            {result.payload.material != null && (
              <span>
                <span style={{ color: 'var(--text-tertiary)' }}>M</span>{' '}
                <span className="mono" style={{ fontWeight: 600 }}>
                  ${result.payload.material.toFixed(2)}
                </span>
              </span>
            )}
            {result.payload.transportation != null && (
              <span>
                <span style={{ color: 'var(--text-tertiary)' }}>T</span>{' '}
                <span className="mono" style={{ fontWeight: 600 }}>
                  ${result.payload.transportation.toFixed(2)}
                </span>
              </span>
            )}
          </div>
          {result.lines.length > 0 && (
            <div
              style={{
                fontSize: 10,
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              {result.lines.map((ln, i) => (
                <div key={i}>{ln}</div>
              ))}
            </div>
          )}
          {result.notes.length > 0 && (
            <div
              style={{
                fontSize: 10,
                color: 'var(--text-tertiary)',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                marginTop: 2,
              }}
            >
              {result.notes.map((n, i) => (
                <div key={i}>· {n}</div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {hasSuggestedCost(result.payload) && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={apply}
              >
                Apply &amp; save
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={dismiss}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
