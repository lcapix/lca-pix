'use client'

import type { ReactNode } from 'react'

export interface MagicInsightsShellProps {
  onClose: () => void
  children: ReactNode
}

/** The blurred overlay (click closes) and the card (clicks stay inside). */
export function MagicInsightsShell({ onClose, children }: MagicInsightsShellProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        animation: 'fadeIn 240ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card bloom-in"
        style={{
          width: 680,
          maxWidth: '92vw',
          maxHeight: '88vh',
          overflow: 'auto',
          padding: 0,
          background: 'var(--surface-raised)',
          boxShadow:
            '0 20px 60px -20px rgba(15,23,42,0.35), 0 0 0 1px rgba(15,23,42,0.06)',
        }}
      >
        {children}
      </div>
    </div>
  )
}
