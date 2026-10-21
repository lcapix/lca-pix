'use client'

// The education auth layout (F1.2, F1.2b, F1.3, F1.4): a dark blueprint pane
// with the sample taken apart (FIG. 01) or its five tiers (FIG. 02), a
// headline and three numbered lines; the form on the light pane. Every number
// in a figure is the sample study's own (rules.md "Facts": 1.72 kg CO₂-eq,
// 10. Cut blank 89.4%, 30. Powder coat 8.1%, 20. Weld tab 2.4%, 17 steps).
// Below 960px the dark pane folds away and the logo sits above the form.

import type { ReactNode } from 'react'
import { LMS_NAME } from '@/lib/ui-flags'

const INK = '#C9D1CC'
const DIM = '#6F7A75'
const SALMON = '#F0A68A'
const MINT = '#86D3A6'
const MONO = 'var(--ds-mono)'

function Logo({ onLight = false }: { onLight?: boolean }) {
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
      <span style={{ color: onLight ? 'var(--ds-text-2)' : '#A9B3AE', fontSize: 15 }}>for teaching and research</span>
    </span>
  )
}

/** FIG. 01: the bracket taken apart, its three largest steps and the result. */
function FigureBracket() {
  const t = { fontFamily: MONO, fontSize: 11, fill: INK, letterSpacing: '0.08em' } as const
  return (
    <svg
      viewBox="0 0 640 430"
      width="100%"
      role="img"
      aria-label="The sample bracket taken apart: 10. Cut blank 89.4%, 30. Powder coat 8.1%, 20. Weld tab 2.4%. Result 1.72 kg CO2-eq, TRACI 2.1."
    >
      <rect x="1" y="1" width="638" height="428" fill="none" stroke="#3A413E" strokeWidth="2" />
      <rect x="8" y="8" width="624" height="414" fill="none" stroke="#2C3330" />
      {['A', 'B', 'C', 'D'].map((l, i) => (
        <text key={l} x={120 + i * 120} y="26" style={t} textAnchor="middle" fill={DIM}>
          {l}
        </text>
      ))}
      {/* the bracket */}
      <g fill="none" stroke={INK} strokeWidth="1.4">
        <path d="M140 110 L260 70 L360 100 L240 140 Z" />
        <path d="M140 110 L140 270 L240 300 L240 140" />
        <path d="M240 300 L360 260 L360 100" />
        <ellipse cx="180" cy="118" rx="9" ry="4" />
        <ellipse cx="160" cy="128" rx="9" ry="4" />
        <ellipse cx="262" cy="98" rx="9" ry="4" />
        <ellipse cx="292" cy="90" rx="9" ry="4" />
        <path d="M256 40 v26 M268 40 v26 M252 40 h20" />
        <path d="M290 34 v24 M300 34 v24 M286 34 h18" />
      </g>
      <g stroke="#3A413E">
        {Array.from({ length: 14 }, (_, i) => (
          <path key={i} d={`M${244 + i * 8} ${140 + i * 2} L${244 + i * 8} ${296 - i * 2.6}`} />
        ))}
      </g>
      {/* the weld tab */}
      <g fill="none" stroke={INK} strokeWidth="1.4">
        <path d="M400 180 L450 162 L490 175 L440 193 Z" />
        <path d="M400 180 L400 224 L440 237 L440 193 M440 237 L490 220 L490 175" />
      </g>
      {/* dimensions */}
      <g stroke={MINT} strokeWidth="1.2" fill="none">
        <path d="M140 330 v12 M140 336 H240 M240 330 v12 M240 336 H360 M360 330 v12" />
        <path d="M380 100 h12 M386 100 V260 M380 260 h12" />
      </g>
      <text x="190" y="332" style={{ ...t, fill: MINT }} textAnchor="middle">120</text>
      <text x="300" y="332" style={{ ...t, fill: MINT }} textAnchor="middle">80</text>
      <text x="398" y="185" style={{ ...t, fill: MINT }}>60</text>
      {/* callouts */}
      <g stroke={SALMON} strokeWidth="1.2" fill="none">
        <path d="M190 206 L100 228" />
        <path d="M300 220 L470 250" />
        <path d="M445 210 L520 150" />
        <circle cx="86" cy="232" r="12" />
        <circle cx="484" cy="252" r="12" />
        <circle cx="530" cy="140" r="12" />
      </g>
      <circle cx="190" cy="206" r="3" fill={SALMON} />
      <circle cx="300" cy="220" r="3" fill={SALMON} />
      <circle cx="445" cy="210" r="3" fill={SALMON} />
      <text x="86" y="236" style={{ ...t, fill: SALMON }} textAnchor="middle">10</text>
      <text x="484" y="256" style={{ ...t, fill: SALMON }} textAnchor="middle">30</text>
      <text x="530" y="144" style={{ ...t, fill: SALMON }} textAnchor="middle">20</text>
      <text x="58" y="260" style={t}>CUT BLANK</text>
      <text x="456" y="282" style={t}>POWDER COAT</text>
      <text x="510" y="170" style={t}>WELD TAB</text>
      {/* steps and shares */}
      <g style={t}>
        <rect x="30" y="350" width="250" height="68" fill="none" stroke="#3A413E" />
        <text x="40" y="366" fill={DIM}>NO.</text>
        <text x="80" y="366" fill={DIM}>STEP</text>
        <text x="270" y="366" fill={DIM} textAnchor="end">SHARE</text>
        {[
          ['10', 'CUT BLANK', '89.4%'],
          ['30', 'POWDER COAT', '8.1%'],
          ['20', 'WELD TAB', '2.4%'],
        ].map(([n, s, v], i) => (
          <g key={n}>
            <text x="40" y={384 + i * 15} style={{ ...t, fill: SALMON }}>{n}</text>
            <text x="80" y={384 + i * 15}>{s}</text>
            <text x="270" y={384 + i * 15} textAnchor="end" style={{ ...t, fill: MINT }}>{v}</text>
          </g>
        ))}
        <rect x="370" y="350" width="240" height="68" fill="none" stroke="#3A413E" />
        <text x="380" y="368">PAINTED STEEL BRACKET</text>
        <text x="380" y="388" fill={DIM}>RESULT</text>
        <text x="600" y="388" textAnchor="end" style={{ ...t, fill: MINT }}>1.72 kg CO₂-eq</text>
        <text x="380" y="408" fill={DIM}>SHEET 01/02</text>
        <text x="600" y="408" textAnchor="end">TRACI 2.1</text>
      </g>
    </svg>
  )
}

/** FIG. 02: the five tiers, one path through the 17 steps. */
function FigureTiers() {
  const t = { fontFamily: MONO, fontSize: 11, fill: INK, letterSpacing: '0.08em' } as const
  const rows: Array<[string, string, string, string | null]> = [
    ['PRODUCT', 'PAINTED STEEL BRACKET', '#A7D3B8', null],
    ['MACHINE / LINE', 'FABRICATION LINE', '#F0A68A', '+2 MORE'],
    ['SUBPROCESS', 'CUTTING', '#F5C971', '+3 MORE'],
    ['OPERATION', '10. CUT BLANK', '#7BB5E8', null],
    ['ELEMENTAL TASK', 'SHEAR BLANK', '#C8B5E8', '+4 MORE'],
  ]
  return (
    <svg viewBox="0 0 640 430" width="100%" role="img" aria-label="Five tiers from the product down to a task: one path through the sample's 17 steps; 10. Cut blank is 89.4% of 1.72.">
      <rect x="1" y="1" width="638" height="428" fill="none" stroke="#3A413E" strokeWidth="2" />
      <rect x="8" y="8" width="624" height="414" fill="none" stroke="#2C3330" />
      {rows.map(([tier, name, colour, more], i) => {
        const y = 50 + i * 64
        return (
          <g key={tier}>
            {i > 0 && <path d={`M260 ${y - 26} V${y}`} stroke="#4B534F" />}
            <path d={`M30 ${y + 46} H600`} stroke="#252B29" strokeDasharray="3 5" />
            <text x="30" y={y + 26} style={t}>{tier}</text>
            <rect x="160" y={y} width="200" height="38" rx="6" fill="none" stroke={colour} strokeWidth="1.6" />
            <text x="260" y={y + 23} style={t} textAnchor="middle">{name}</text>
            {more && (
              <>
                <path d={`M362 ${y + 19} H390`} stroke={DIM} strokeDasharray="3 3" />
                <text x="396" y={y + 23} style={{ ...t, fill: DIM }}>{more}</text>
              </>
            )}
            {i === 3 && (
              <>
                <path d={`M360 ${y + 19} H440`} stroke={MINT} />
                <circle cx="360" cy={y + 19} r="3" fill={MINT} />
                <rect x="440" y={y + 6} width="114" height="26" rx="13" fill="none" stroke={MINT} />
                <text x="497" y={y + 23} style={{ ...t, fill: MINT }} textAnchor="middle">89.4% OF 1.72</text>
              </>
            )}
          </g>
        )
      })}
      <text x="30" y="404" style={t}>ONE PATH THROUGH 17 STEPS</text>
      <rect x="420" y="372" width="190" height="46" fill="none" stroke="#3A413E" />
      <text x="430" y="390" style={t}>FIVE TIERS</text>
      <text x="430" y="410" style={{ ...t, fill: DIM }}>SHEET 02/02</text>
      <text x="600" y="410" style={t} textAnchor="end">TRACI 2.1</text>
    </svg>
  )
}

const PANES = {
  account: {
    figure: <FigureBracket />,
    caption: 'FIG. 01 · THE SAMPLE YOU START ON, TAKEN APART',
    headline: 'A research tool for your class and your lab.',
    lines: [
      'Start on a sample tree and reach a first result in one sitting.',
      'Guided mode, in beta, walks you through the four phases when you turn it on.',
      LMS_NAME
        ? `${LMS_NAME} keeps your class list and grades. LCAPIX sits beside it.`
        : 'Your course system keeps the class list and grades. LCAPIX sits beside it.',
    ],
  },
  setup: {
    figure: <FigureTiers />,
    caption: 'FIG. 02 · HOW A STUDY IS BUILT, PRODUCT DOWN TO TASK',
    headline: 'One step, then a finished study to read.',
    lines: [
      'A few answers. Change them any time in your profile.',
      'Read it in order: the question, the tree, what goes in, the answer.',
      'Then make your own copy and change one thing.',
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
          <Logo onLight />
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
