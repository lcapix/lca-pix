'use client'

import { useId, useRef, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react'

/** A switch: a real checkbox with role="switch", labelled, 24px tall. */
export function Switch({
  checked,
  onChange,
  label,
  hideLabel,
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  hideLabel?: boolean
  disabled?: boolean
}) {
  const id = useId()
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <label htmlFor={id} className={hideLabel ? 'ds-sr-only' : undefined} style={hideLabel ? undefined : { fontSize: 13 }}>
        {label}
      </label>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="ds-switch"
        checked={checked}
        aria-checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </span>
  )
}

/** A segmented control (Impact / Cost, Pipeline / Table): a radio group. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: ReactNode }>
  value: T
  onChange: (next: T) => void
  label: string
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const move = (e: KeyboardEvent, i: number) => {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const next = (i + delta + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }
  return (
    <div className="ds-seg" role="radiogroup" aria-label={label}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => move(e, i)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** A search field with its icon and an accessible label. */
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  autoFocus,
  onKeyDown,
  inputRef,
  hint,
  inputProps,
}: {
  value: string
  onChange: (next: string) => void
  placeholder: string
  label?: string
  autoFocus?: boolean
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
  inputRef?: (el: HTMLInputElement | null) => void
  /** A small mono hint at the right end (a count, "⌘K"). */
  hint?: ReactNode
  /** Extra attributes for the input (a combobox's aria-* attributes). */
  inputProps?: InputHTMLAttributes<HTMLInputElement>
}) {
  return (
    <div className="ds-search">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        ref={inputRef}
        className="ds-input"
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        {...inputProps}
      />
      {hint != null && (
        <span className="ds-mono" style={{ position: 'absolute', right: 12, fontSize: 12, color: 'var(--ds-text-3)' }}>
          {hint}
        </span>
      )}
    </div>
  )
}

/** Tabs with arrow keys (the case's Tree, Inventory, Results, Write-up). */
export function Tabs<T extends string>({
  tabs,
  selected,
  onSelect,
  label,
  end,
  gap = 24,
}: {
  tabs: Array<{ id: T; label: ReactNode; badge?: ReactNode; controls?: string }>
  selected: T
  onSelect: (id: T) => void
  label: string
  /** Content at the right end of the row (Compare). */
  end?: ReactNode
  /** Space between tabs; the phone case's row is narrower (390 px). */
  gap?: number
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const move = (e: KeyboardEvent, i: number) => {
    const last = tabs.length - 1
    const next =
      e.key === 'ArrowRight' ? (i === last ? 0 : i + 1)
      : e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : -1
    if (next < 0) return
    e.preventDefault()
    onSelect(tabs[next].id)
    refs.current[next]?.focus()
  }
  return (
    <div className="ds-tabs" style={{ alignItems: 'center' }}>
      <div role="tablist" aria-label={label} style={{ display: 'flex', gap }}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={t.id === selected}
            aria-controls={t.controls}
            tabIndex={t.id === selected ? 0 : -1}
            onClick={() => onSelect(t.id)}
            onKeyDown={(e) => move(e, i)}
          >
            {t.label}
            {t.badge}
          </button>
        ))}
      </div>
      {end && <div style={{ marginLeft: 'auto' }}>{end}</div>}
    </div>
  )
}
