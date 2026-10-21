'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Button } from './button'

/**
 * A one-field dialog (Rename): label, the current value, Save and Cancel.
 * Same focus rules as the confirm; Enter saves.
 */
export function TextDialog({
  open,
  title,
  label,
  initial,
  confirmLabel = 'Save',
  maxLength = 200,
  onSubmit,
  onCancel,
  busy,
  error,
}: {
  open: boolean
  title: string
  label: string
  initial: string
  confirmLabel?: string
  maxLength?: number
  onSubmit: (value: string) => void
  onCancel: () => void
  busy?: boolean
  error?: string | null
}) {
  const [value, setValue] = useState(initial)
  const inputId = useId()
  useEffect(() => {
    if (open) setValue(initial)
  }, [open, initial])
  return (
    <ConfirmDialog
      open={open}
      title={title}
      consequence={error ?? ''}
      confirmLabel={confirmLabel}
      danger={false}
      role="dialog"
      busy={busy}
      onConfirm={() => value.trim() && onSubmit(value.trim())}
      onCancel={onCancel}
    >
      <label htmlFor={inputId} className="ds-label" style={{ marginBottom: 0 }}>
        {label}
      </label>
      <input
        id={inputId}
        className="ds-input"
        value={value}
        maxLength={maxLength}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) {
            e.preventDefault()
            onSubmit(value.trim())
          }
        }}
      />
    </ConfirmDialog>
  )
}

/**
 * The small confirm for a destructive action (rules.md): the consequence in
 * one line, a danger button, Cancel. Focus moves into the dialog, stays inside
 * it (Tab wraps), Esc cancels, and focus returns to what opened it.
 */
export function ConfirmDialog({
  open,
  title,
  consequence,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
  danger = true,
  role = 'alertdialog',
  children,
}: {
  open: boolean
  title: string
  consequence: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
  danger?: boolean
  /** 'alertdialog' for a confirm that interrupts; 'dialog' for a small form (a name to type). */
  role?: 'alertdialog' | 'dialog'
  /** Extra content (a typed-name field, D4). */
  children?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  // The latest onCancel, so the effect runs once per opening (an inline
  // handler from the parent must not re-focus Cancel on every render).
  const cancelRef = useRef(onCancel)
  cancelRef.current = onCancel
  const titleId = useId()
  const bodyId = useId()

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const node = ref.current
    const focusables = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [],
      ).filter((el) => !el.hasAttribute('disabled'))
    // Cancel first: the safe default for a destructive confirm.
    focusables()[0]?.focus()
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cancelRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const list = focusables()
      if (!list.length) return
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
  }, [open])

  if (!open) return null
  return (
    <div className="ds-scrim" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div ref={ref} className="ds-dialog" role={role} aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId}>
        <h2 id={titleId} className="ds-dialog-title">
          {title}
        </h2>
        <p id={bodyId} className="ds-dialog-body">
          {consequence}
        </p>
        {children}
        <div className="ds-dialog-actions">
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} busy={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
