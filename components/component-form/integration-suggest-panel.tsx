'use client';

// Integration-suggest panel — pulls live defaults from BLS / EIA / Metals-API
// into the cost fields. Without this the editor would be 100% manual and the
// Integrations page would be a graveyard of unused pipelines. The requests
// and the arithmetic are in lib/case-editor/integration-suggest.

import {
  useIntegrationSuggest,
  type IntegrationSuggestion as SuggestPayload,
} from '@/lib/case-editor/integration-suggest';

export function IntegrationSuggestPanel({
  componentType,
  nodeName,
  quantity,
  region,
  onApply,
}: {
  componentType: string;
  nodeName?: string;
  quantity: number;
  region: string;
  onApply: (s: SuggestPayload) => void;
}) {
  const { wants, loading, error, result, suggest, dismiss } = useIntegrationSuggest({
    componentType,
    nodeName,
    quantity,
    region,
  });

  const hasAnything = wants.labor || wants.energy || wants.material;
  if (!hasAnything) return null;

  return (
    <div
      style={{
        padding: 14,
        background:
          'color-mix(in oklab, var(--brand-primary) 5%, var(--surface-raised))',
        border:
          '1px solid color-mix(in oklab, var(--brand-primary) 18%, var(--border-subtle))',
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background:
              'color-mix(in oklab, var(--brand-primary) 20%, transparent)',
            color: 'var(--brand-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          ✦
        </span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            Suggest from integrations
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--text-tertiary)',
              marginTop: 2,
              lineHeight: 1.5,
            }}
          >
            Rough estimate from
            {wants.labor && ' BLS labor wages,'}
            {wants.energy && ' EIA energy prices,'}
            {wants.material && ' Metals-API / USGS material prices,'}
            {' '}for region <code className="mono">{region}</code>. Add the step&apos;s
            flows, then the flow-based costing gives an exact figure.
          </div>
        </div>
        <button
          type="button"
          onClick={suggest}
          disabled={loading}
          className="btn btn-secondary btn-sm"
          style={{ flexShrink: 0 }}
        >
          {loading ? 'Fetching…' : result ? 'Refetch' : 'Fetch defaults'}
        </button>
      </div>
      {error && (
        <div style={{ fontSize: 12, color: 'var(--signal-error)' }}>
          {error}
        </div>
      )}
      {result && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: '10px 12px',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
              fontSize: 12.5,
            }}
          >
            {result.payload.labor != null && (
              <span>
                <span style={{ color: 'var(--text-tertiary)' }}>Labor</span>{' '}
                <span className="mono" style={{ fontWeight: 600 }}>
                  ${result.payload.labor.toFixed(2)}
                </span>
              </span>
            )}
            {result.payload.energy != null && (
              <span>
                <span style={{ color: 'var(--text-tertiary)' }}>Energy</span>{' '}
                <span className="mono" style={{ fontWeight: 600 }}>
                  ${result.payload.energy.toFixed(2)}
                </span>
              </span>
            )}
            {result.payload.material != null && (
              <span>
                <span style={{ color: 'var(--text-tertiary)' }}>Material</span>{' '}
                <span className="mono" style={{ fontWeight: 600 }}>
                  ${result.payload.material.toFixed(2)}
                </span>
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-mono)',
              lineHeight: 1.5,
            }}
          >
            {result.sources.join(' · ')}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onApply(result.payload)}
            >
              Apply to fields
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={dismiss}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
