'use client'

// Names a case. Used when duplicating, so the copy is named for its one change
// before it exists (a comparison should never read "Touring bike" against
// "Touring bike (Copy)"), and when renaming a case. Nothing changes on Cancel.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { HelpTip } from '@/components/lcapix/help-tip'

export function CaseNameDialog({
  open,
  title,
  initialName,
  confirmLabel,
  help,
  busy = false,
  error,
  onSubmit,
  onCancel,
}: {
  open: boolean
  title: string
  initialName: string
  confirmLabel: string
  /** Why the name matters, shown on hover next to the field. */
  help?: ReactNode
  busy?: boolean
  /** Server message shown under the field, e.g. the name is already taken. */
  error?: string | null
  onSubmit: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initialName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setName(initialName)
    // Select the suggested name so typing replaces it.
    const t = setTimeout(() => inputRef.current?.select(), 0)
    return () => clearTimeout(t)
  }, [open, initialName])

  if (!open) return null
  const trimmed = name.trim()

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="case-name-dialog-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onCancel}
    >
      <form
        className="card"
        style={{ maxWidth: 460, width: '100%', padding: '20px 22px' }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (trimmed && !busy) onSubmit(trimmed)
        }}
      >
        <div id="case-name-dialog-title" style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
          {title}
        </div>
        <label className="label" htmlFor="case-name-input" style={{ fontSize: 11 }}>
          Case name
          {help && <HelpTip label="What should I call it?">{help}</HelpTip>}
        </label>
        <input
          id="case-name-input"
          ref={inputRef}
          className="input"
          value={name}
          maxLength={255}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel()
          }}
          style={{ width: '100%', marginTop: 4 }}
        />
        {error && (
          <div role="alert" style={{ fontSize: 12, color: '#b45309', marginTop: 6, lineHeight: 1.45 }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!trimmed || busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
