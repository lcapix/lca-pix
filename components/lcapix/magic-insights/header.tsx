'use client'

import { Icon } from '@/components/lcapix'

export interface MagicInsightsHeaderProps {
  caseName: string
  method: string
  aiMode: boolean
  onAiModeChange: (on: boolean) => void
  onClose: () => void
  categoryOptions: Array<{ key: string; label: string }>
  selectedCategory: string
  onCategoryChange: (key: string) => void
}

/** Icon, title, Computed/AI toggle, close button and the category selector. */
export function MagicInsightsHeader({
  caseName,
  method,
  aiMode,
  onAiModeChange,
  onClose,
  categoryOptions,
  selectedCategory,
  onCategoryChange,
}: MagicInsightsHeaderProps) {
  return (
    <div
      style={{
        padding: '20px 24px 14px',
        background:
          'linear-gradient(135deg, oklch(from var(--brand-primary) l c h / 0.08), oklch(from var(--brand-primary) l c h / 0.02))',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'var(--brand-gradient)',
            color: 'var(--on-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="sparkle" size={18} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
            Magic Insights
          </div>
          <div
            className="mono"
            style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}
          >
            {caseName} · {method}
          </div>
        </div>
        {/* Computed ↔ AI toggle. Computed is the deterministic baseline;
            AI narrates the same figures via an open model. */}
        <InsightModeToggle aiMode={aiMode} onChange={onAiModeChange} />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="press-active"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-tertiary)',
            padding: 6,
            borderRadius: 6,
            display: 'inline-flex',
          }}
        >
          <Icon name="x" size={16} />
        </button>
      </div>

      {/* Category selector — operate across ALL impact categories. */}
      {categoryOptions.length > 1 && (
        <CategorySelect
          options={categoryOptions}
          value={selectedCategory}
          onChange={onCategoryChange}
        />
      )}
    </div>
  )
}

/** Computed ↔ AI segmented toggle. */
export function InsightModeToggle({ aiMode, onChange }: { aiMode: boolean; onChange: (on: boolean) => void }) {
  return (
    <div
      role="group"
      aria-label="Insight mode"
      style={{
        display: 'inline-flex',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {([
        { id: false, label: 'Computed' },
        { id: true, label: 'AI' },
      ] as const).map((opt) => {
        const on = aiMode === opt.id
        return (
          <button
            key={String(opt.id)}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={on}
            style={{
              padding: '5px 12px',
              fontSize: 11.5,
              fontWeight: on ? 600 : 500,
              border: 'none',
              cursor: 'pointer',
              background: on ? 'var(--brand-primary)' : 'transparent',
              color: on ? 'var(--on-primary)' : 'var(--text-secondary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {opt.id === true && <Icon name="sparkle" size={11} />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/** "Impact category" label and select (overall + every category). */
export function CategorySelect({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: string; label: string }>
  value: string
  onChange: (key: string) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 14,
        flexWrap: 'wrap',
      }}
    >
      <span
        className="eyebrow"
        style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
      >
        Impact category
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          fontSize: 12,
          padding: '4px 8px',
          borderRadius: 6,
          border: '1px solid var(--border-subtle)',
          background: 'var(--surface-base)',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-ui)',
          cursor: 'pointer',
        }}
      >
        {options.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  )
}
