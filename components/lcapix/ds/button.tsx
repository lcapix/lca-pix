'use client'

import { forwardRef, useId, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'dark' | 'danger' | 'danger-quiet'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'default' | 'small'
  icon?: ReactNode
  /** Busy: a spinner, "Working…", disabled (rules.md, Busy). */
  busy?: boolean
  /** A short visible reason when disabled ("Run this case first"). */
  disabledReason?: string
}

/** One primary per screen; everything else secondary. */
export function Button({
  variant = 'secondary',
  size = 'default',
  icon,
  busy,
  disabledReason,
  disabled,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const cls = ['ds-btn', variant !== 'secondary' && `ds-btn--${variant}`, size === 'small' && 'ds-btn--small', className]
    .filter(Boolean)
    .join(' ')
  const isDisabled = disabled || busy
  const id = useId()
  const reasonId = disabledReason && isDisabled ? `${id}-reason` : undefined
  const button = (
    <button
      type={type}
      className={cls}
      disabled={isDisabled}
      aria-busy={busy || undefined}
      aria-describedby={reasonId}
      {...rest}
    >
      {busy ? <span className="ds-spinner" aria-hidden /> : icon}
      {busy ? 'Working…' : children}
    </button>
  )
  if (!reasonId) return button
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      {button}
      <span id={reasonId} className="ds-btn-reason">
        {disabledReason}
      </span>
    </span>
  )
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: an icon-only button always has an accessible name. */
  label: string
  children: ReactNode
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, children, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={['ds-icon-btn', className].filter(Boolean).join(' ')}
      aria-label={label}
      title={label}
      {...rest}
    >
      {children}
    </button>
  )
})
