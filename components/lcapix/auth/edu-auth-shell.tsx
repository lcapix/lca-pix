'use client'

// The auth layout (F1.2, F1.2b, F1.3): a dark blueprint pane with the five
// tiers of a study, a headline and three numbered lines; the form on the light
// pane. The figure names tiers, not a study, and every line says what the
// product does today. Below 960px the dark pane folds away and the logo sits
// above the form.

import type { ReactNode } from 'react'

const INK = '#C9D1CC'
const DIM = '#6F7A75'
const MINT = '#86D3A6'
const MONO = 'var(--ds-mono)'

function Logo() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 14 }}>
      <span aria-hidden style={{ width: 40, height: 40, borderRadius: 10, background: '#1E2422', display: 'grid', placeItems: 'center' }}>
        <svg width="24" height="24" viewBox="0 0 24 24">
          <rect x="10" y="3" width="4" height="4" rx="1" fill="#fff" />
          <rect x="5" y="10" width="4" height="4" rx="1" fill="#fff" />
          <rect x="15" y="10" width="4" height="4" rx="1" fill="#fff" />
          <rect x="2" y="17" width="4" height="4" rx="1" fill="#fff" />
          <rect x="10" y="17" width="4" height="4" rx="1" fill="#fff" />
          <rect x="18" y="17" width="4" height="4" rx="1" fill={MINT} />
        </svg>
      </span>
      <span style={{ fontWeight: 700, fontSize: 20, letterSpacing: '0.04em' }}>LCAPIX</span>
    </span>
  )
}

/** FIG. 01: the five tiers, product down to task, with cost beside impact. */
function FigureTiers() {
  const t = { fontFamily: MONO, fontSize: 11, fill: INK, letterSpacing: '0.08em' } as const
  const rows: Array<[string, string, string]> = [
    ['PRODUCT', 'WHAT YOU MAKE', '#A7D3B8'],
    ['MACHINE / LINE', 'WHERE IT IS MADE', '#F0A68A'],
    ['SUBPROCESS', 'A STAGE OF THE LINE', '#F5C971'],
    ['OPERATION', 'ONE ROUTING STEP', '#7BB5E8'],
    ['ELEMENTAL TASK', 'ENERGY, MATERIAL, WASTE', '#C8B5E8'],
  ]
  return (
    <svg viewBox="0 0 640 430" width="100%" role="img" aria-label="Five tiers from the product down to a task; each step carries its cost beside its impact.">
      <rect x="1" y="1" width="638" height="428" fill="none" stroke="#3A413E" strokeWidth="2" />
      <rect x="8" y="8" width="624" height="414" fill="none" stroke="#2C3330" />
      {rows.map(([tier, name, colour], i) => {
        const y = 50 + i * 64
        return (
          <g key={tier}>
            {i > 0 && <path d={`M260 ${y - 26} V${y}`} stroke="#4B534F" />}
            <path d={`M30 ${y + 46} H600`} stroke="#252B29" strokeDasharray="3 5" />
            <text x="30" y={y + 26} style={t}>{tier}</text>
            <rect x="140" y={y} width="240" height="38" rx="6" fill="none" stroke={colour} strokeWidth="1.6" />
            <text x="260" y={y + 23} style={t} textAnchor="middle">{name}</text>
            {i === 3 && (
              <>
                <path d={`M380 ${y + 19} H440`} stroke={MINT} />
                <circle cx="380" cy={y + 19} r="3" fill={MINT} />
                <rect x="440" y={y + 6} width="150" height="26" rx="13" fill="none" stroke={MINT} />
                <text x="515" y={y + 23} style={{ ...t, fill: MINT }} textAnchor="middle">COST + IMPACT</text>
              </>
            )}
          </g>
        )
      })}
      <text x="30" y="404" style={t}>PRODUCT DOWN TO TASK</text>
      <rect x="420" y="372" width="190" height="46" fill="none" stroke="#3A413E" />
      <text x="430" y="390" style={t}>FIVE TIERS</text>
      <text x="430" y="410" style={{ ...t, fill: DIM }}>SHEET 01/01</text>
    </svg>
  )
}

const PANES = {
  account: {
    figure: <FigureTiers />,
    caption: 'FIG. 01 · HOW A STUDY IS BUILT, PRODUCT DOWN TO TASK',
    headline: 'Cost and carbon for each thing your plant makes.',
    lines: [
      'Read your plant\'s documents into a study instead of typing it in.',
      'Every step carries its cost beside its impact.',
      'Compare a change against your base case before you make it.',
    ],
  },
  setup: {
    figure: <FigureTiers />,
    caption: 'FIG. 01 · HOW A STUDY IS BUILT, PRODUCT DOWN TO TASK',
    headline: 'One step, then your first project.',
    lines: [
      'Your name and company. Change them any time in your profile.',
      'Start from a file you already have, or from an empty project.',
      'Add the people who work on it when you are ready.',
    ],
  },
} as const

export function EduAuthShell({ pane, children }: { pane: keyof typeof PANES; children: ReactNode }) {
  const p = PANES[pane]
  return (
    <div className="edu-auth">
      <aside className="edu-auth-dark" aria-label="About LCAPIX">
        <Logo />
        <div style={{ margin: '48px 0 0', maxWidth: 640 }}>{p.figure}</div>
        <p className="edu-auth-caption">{p.caption}</p>
        <h2 className="edu-auth-headline">{p.headline}</h2>
        <ol className="edu-auth-lines">
          {p.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ol>
      </aside>
      <main className="edu-auth-light" id="main">
        <div className="edu-auth-mobile-logo">
          <Logo />
        </div>
        <div className="edu-auth-form">{children}</div>
      </main>
    </div>
  )
}

/** Google's mark, in its four colours (the brand's own; not a design token). */
export function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

/** The password eye: open shows the text, crossed hides it. */
export function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M4 20 20 4" />}
    </svg>
  )
}

/** An error on the line it belongs to, with its icon (never colour alone). */
export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <span id={id} className="edu-error" role="alert">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden style={{ flex: "none", marginTop: 1 }}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16.5v.5" strokeLinecap="round" />
      </svg>
      <span>{children}</span>
    </span>
  )
}
