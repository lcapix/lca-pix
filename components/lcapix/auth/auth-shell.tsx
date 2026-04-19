'use client'

// AuthShell — two-pane layout for login/signup, mirrored from
// LCAPIX/pages-landing.jsx `AuthPage` (lines 367-462).
//
// Left pane (44%): Logo top-left + vertically-centred `children` (the form).
// Right pane (56%): editorial testimonial + 3 DEMO_METHODS rows + brand strip.

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/lcapix/logo'
import { fmtNum } from '@/components/lcapix/formatters'
import { DEMO_METHODS } from '@/lib/lcapix-demo'

export interface AuthShellProps {
  children: ReactNode
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: 'var(--surface-base)',
      }}
    >
      {/* Left pane — form */}
      <div
        style={{
          flex: '0 0 44%',
          display: 'flex',
          flexDirection: 'column',
          padding: '48px 56px',
          minHeight: '100vh',
        }}
      >
        <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex' }}>
          <Logo size={20} />
        </Link>
        <div style={{ margin: 'auto 0', maxWidth: 400, width: '100%' }}>{children}</div>
      </div>

      {/* Right pane — editorial + methods card */}
      <div
        style={{
          flex: 1,
          background: 'var(--surface-sunken)',
          borderLeft: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          padding: '80px 72px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ margin: 'auto 0', maxWidth: 520 }}>
          <div
            className="eyebrow"
            style={{ marginBottom: 28, color: 'var(--brand-primary)' }}
          >
            ·  ·  ·
          </div>
          <blockquote
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 22,
              lineHeight: 1.45,
              color: 'var(--text-secondary)',
              margin: 0,
              marginBottom: 40,
            }}
          >
            &ldquo;Three methods, same battery, three different answers. That&apos;s
            science.&rdquo;
          </blockquote>

          <div
            style={{
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            {DEMO_METHODS.map((m, i) => (
              <div
                key={m.id}
                style={{
                  padding: '16px 20px',
                  borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 16,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {m.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {m.note}
                  </div>
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 22,
                    fontWeight: 500,
                    color: 'var(--brand-primary)',
                  }}
                >
                  {fmtNum(m.value, 2)}{' '}
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    kg CO₂-eq
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 4,
            background: 'var(--brand-primary)',
            opacity: 0.6,
          }}
        />
      </div>
    </div>
  )
}
