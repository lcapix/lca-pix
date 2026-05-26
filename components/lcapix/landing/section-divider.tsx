// SectionDivider — hairline divider carrying the LCAPIX 3-tile glyph in
// the middle. Used between marketing-page sections to give a quiet,
// repeating brand signal that ties the page together.

interface SectionDividerProps {
  /** Extra margin top/bottom in px. Default 0 (relies on adjacent section padding). */
  spacing?: number
  /** Glyph variant: tiles (default), nodes (process-flow), or pure rule (no glyph). */
  variant?: 'tiles' | 'nodes' | 'rule'
}

export function SectionDivider({ spacing = 0, variant = 'tiles' }: SectionDividerProps) {
  return (
    <div
      aria-hidden
      style={{
        margin: `${spacing}px auto`,
        maxWidth: 1280,
        padding: '0 64px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <div
        style={{
          flex: 1,
          height: 1,
          background:
            'linear-gradient(90deg, transparent 0%, var(--border-subtle) 50%, var(--border-subtle) 100%)',
        }}
      />
      {variant === 'tiles' && (
        <svg width="28" height="22" viewBox="0 0 28 22" style={{ color: 'var(--brand-primary)', opacity: 0.55 }}>
          <rect x="0" y="0" width="9" height="9" rx="1" fill="currentColor" opacity="0.95" />
          <rect x="11" y="2" width="9" height="9" rx="1" fill="currentColor" opacity="0.65" />
          <rect x="5" y="12" width="9" height="9" rx="1" fill="currentColor" opacity="0.4" />
        </svg>
      )}
      {variant === 'nodes' && (
        <svg width="56" height="14" viewBox="0 0 56 14" style={{ color: 'var(--brand-primary)', opacity: 0.55 }}>
          <line x1="8" y1="7" x2="24" y2="7" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="32" y1="7" x2="48" y2="7" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
          <rect x="2" y="2" width="10" height="10" rx="1.5" fill="currentColor" opacity="0.95" />
          <circle cx="28" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <rect x="46" y="2" width="10" height="10" rx="1.5" fill="currentColor" opacity="0.5" />
        </svg>
      )}
      <div
        style={{
          flex: 1,
          height: 1,
          background:
            'linear-gradient(90deg, var(--border-subtle) 0%, var(--border-subtle) 50%, transparent 100%)',
        }}
      />
    </div>
  )
}

// DataFlowDiagram — full-width Sankey-ish visualization showing how
// external data sources fan into the LCAPIX factor index and out to
// the three ISO methodologies. Renders as a substantial section feature
// (not an ornament).
export function DataFlowDiagram() {
  const sources = [
    { id: 'openlca',  label: 'openLCA',         count: '3,420 factors',  y: 50 },
    { id: 'pubchem',  label: 'PubChem',         count: '1,842 substances', y: 130 },
    { id: 'elmap',    label: 'Electricity Maps', count: '38 grid regions', y: 210 },
    { id: 'eia',      label: 'EIA · BLS',       count: 'live cost data',  y: 290 },
  ]
  const methods = [
    { id: 'cml',    label: 'CML 2001 v4',       y: 90 },
    { id: 'recipe', label: 'ReCiPe Midpoint (H)', y: 170 },
    { id: 'traci',  label: 'TRACI 2.1',         y: 250 },
  ]
  // Centre node: factor index
  const cx = 480
  const cy = 170
  const cw = 180
  const ch = 120
  return (
    <svg
      width="100%"
      viewBox="0 0 960 360"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', color: 'var(--brand-primary)' }}
      aria-hidden
    >
      <defs>
        <linearGradient id="flowFade" x1="0" x2="1">
          <stop offset="0%"  stopColor="currentColor" stopOpacity="0" />
          <stop offset="40%" stopColor="currentColor" stopOpacity="0.45" />
          <stop offset="60%" stopColor="currentColor" stopOpacity="0.45" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="flowOut" x1="0" x2="1">
          <stop offset="0%"   stopColor="currentColor" stopOpacity="0.45" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Inbound flows */}
      {sources.map((s) => (
        <path
          key={`in-${s.id}`}
          d={`M 200 ${s.y} C 320 ${s.y}, 360 ${cy}, ${cx} ${cy}`}
          fill="none"
          stroke="url(#flowFade)"
          strokeWidth="14"
          strokeLinecap="round"
        />
      ))}

      {/* Outbound flows */}
      {methods.map((m) => (
        <path
          key={`out-${m.id}`}
          d={`M ${cx + cw} ${cy} C ${cx + cw + 80} ${cy}, ${cx + cw + 100} ${m.y}, ${cx + cw + 220} ${m.y}`}
          fill="none"
          stroke="url(#flowOut)"
          strokeWidth="10"
          strokeLinecap="round"
        />
      ))}

      {/* Source nodes */}
      {sources.map((s) => (
        <g key={s.id}>
          <rect
            x="40"
            y={s.y - 22}
            width="160"
            height="44"
            rx="6"
            fill="var(--surface-raised)"
            stroke="currentColor"
            strokeOpacity="0.4"
            strokeWidth="1"
          />
          <text
            x="56"
            y={s.y - 4}
            fontSize="13"
            fontWeight="600"
            fill="var(--text-primary)"
            fontFamily="var(--font-ui)"
          >
            {s.label}
          </text>
          <text
            x="56"
            y={s.y + 12}
            fontSize="10.5"
            fill="var(--text-tertiary)"
            fontFamily="ui-monospace, monospace"
            letterSpacing="0.04em"
          >
            {s.count}
          </text>
        </g>
      ))}

      {/* Central factor index node */}
      <rect
        x={cx}
        y={cy - ch / 2}
        width={cw}
        height={ch}
        rx="10"
        fill="color-mix(in oklab, currentColor 10%, var(--surface-raised))"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <text
        x={cx + cw / 2}
        y={cy - 24}
        fontSize="11"
        fontWeight="600"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="ui-monospace, monospace"
        letterSpacing="0.14em"
      >
        FACTOR INDEX
      </text>
      <text
        x={cx + cw / 2}
        y={cy + 8}
        fontSize="34"
        fontWeight="700"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="ui-monospace, monospace"
        letterSpacing="-0.02em"
      >
        5,234
      </text>
      <text
        x={cx + cw / 2}
        y={cy + 32}
        fontSize="11"
        textAnchor="middle"
        fill="var(--text-tertiary)"
        fontFamily="var(--font-ui)"
      >
        characterization factors
      </text>
      <text
        x={cx + cw / 2}
        y={cy + 50}
        fontSize="9"
        textAnchor="middle"
        fill="var(--text-tertiary)"
        fontFamily="ui-monospace, monospace"
        letterSpacing="0.06em"
        opacity="0.7"
      >
        CAS-mapped · versioned · cached
      </text>

      {/* Method output nodes */}
      {methods.map((m) => (
        <g key={m.id}>
          <rect
            x="780"
            y={m.y - 18}
            width="160"
            height="36"
            rx="6"
            fill="var(--surface-raised)"
            stroke="currentColor"
            strokeOpacity="0.4"
            strokeWidth="1"
          />
          <text
            x="796"
            y={m.y + 5}
            fontSize="12.5"
            fontWeight="600"
            fill="var(--text-primary)"
            fontFamily="var(--font-ui)"
          >
            {m.label}
          </text>
        </g>
      ))}

      {/* Section captions */}
      <text
        x="40"
        y="24"
        fontSize="10"
        fill="var(--text-tertiary)"
        fontFamily="ui-monospace, monospace"
        letterSpacing="0.14em"
        fontWeight="600"
      >
        INPUTS
      </text>
      <text
        x={cx}
        y="24"
        fontSize="10"
        fill="var(--text-tertiary)"
        fontFamily="ui-monospace, monospace"
        letterSpacing="0.14em"
        fontWeight="600"
      >
        INDEX
      </text>
      <text
        x="780"
        y="24"
        fontSize="10"
        fill="var(--text-tertiary)"
        fontFamily="ui-monospace, monospace"
        letterSpacing="0.14em"
        fontWeight="600"
      >
        ISO METHODS
      </text>
    </svg>
  )
}

// HeroOrnament — abstract "many sources → one model" diagram anchored top-
// left of the hero, in the negative space above the headline. No text
// labels — the right column already prints "5,234 / openLCA · PubChem · EIA"
// so we only carry the visual structure here.
export function HeroOrnament() {
  return (
    <svg
      aria-hidden
      width="180"
      height="80"
      viewBox="0 0 180 80"
      style={{
        position: 'absolute',
        top: -56,
        right: 0,
        color: 'var(--brand-primary)',
        opacity: 0.32,
        pointerEvents: 'none',
      }}
    >
      {/* Three small source tiles on the left converging into a single sink */}
      <rect x="2" y="6" width="14" height="10" rx="1.5" fill="currentColor" opacity="0.85" />
      <rect x="2" y="35" width="14" height="10" rx="1.5" fill="currentColor" opacity="0.85" />
      <rect x="2" y="64" width="14" height="10" rx="1.5" fill="currentColor" opacity="0.85" />
      {/* Curved feeds */}
      <path d="M 16 11 C 60 11, 60 40, 92 40" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
      <path d="M 16 40 L 92 40" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
      <path d="M 16 69 C 60 69, 60 40, 92 40" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
      {/* Sink — model node */}
      <circle cx="100" cy="40" r="8" fill="currentColor" opacity="0.18" />
      <circle cx="100" cy="40" r="8" fill="none" stroke="currentColor" strokeWidth="1" />
      {/* Output trace — small sparkline tailing off to the right */}
      <path
        d="M 112 40 L 124 36 L 132 42 L 142 32 L 152 38 L 164 28 L 176 34"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </svg>
  )
}

// StepGlyph — full mini product-illustration for each numbered step in
// "How it works." Renders inside its own bordered card with a faint dot
// grid background so each step reads like a real product detail-shot.
export function StepGlyph({ kind }: { kind: 'tree' | 'methods' | 'export' }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '5 / 3',
        marginBottom: 24,
        borderRadius: 10,
        border: '1px solid var(--border-subtle)',
        background:
          'linear-gradient(180deg, var(--surface-raised) 0%, color-mix(in oklab, var(--brand-primary) 2%, var(--surface-raised)) 100%)',
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
      }}
    >
      {/* faint dot grid backdrop */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at center, color-mix(in oklab, var(--brand-primary) 22%, transparent) 1px, transparent 1.2px)',
          backgroundSize: '14px 14px',
          opacity: 0.35,
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', height: '100%', padding: 18 }}>
        {kind === 'tree' && <StepTreeIllustration />}
        {kind === 'methods' && <StepMethodsIllustration />}
        {kind === 'export' && <StepExportIllustration />}
      </div>
    </div>
  )
}

// ─── Step 01 — Build tree ──────────────────────────────────────────────
function StepTreeIllustration() {
  // 5-tier LCAPIX hierarchy — Product → Machine → Subprocess → Operation → Task.
  // Each row a different tonal step of brand-primary.
  const rows: Array<{ tier: string; label: string; indent: number; tint: number }> = [
    { tier: 'PRODUCT', label: 'EV Battery Pack', indent: 0, tint: 0.95 },
    { tier: 'MACHINE', label: 'Cell production line', indent: 18, tint: 0.7 },
    { tier: 'SUBPROC', label: 'Cathode coating', indent: 36, tint: 0.55 },
    { tier: 'OPERATION', label: 'Slurry mixing', indent: 54, tint: 0.4 },
    { tier: 'TASK', label: 'NMP solvent recovery', indent: 72, tint: 0.3 },
  ]
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        height: '100%',
        fontFamily: 'var(--font-ui)',
      }}
    >
      {rows.map((r) => (
        <div
          key={r.tier}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            paddingLeft: r.indent,
            fontSize: 10,
            color: 'var(--text-secondary)',
          }}
        >
          {/* tier swatch */}
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              flexShrink: 0,
              background: `color-mix(in oklab, var(--brand-primary) ${r.tint * 100}%, transparent)`,
            }}
          />
          <span
            className="mono"
            style={{
              fontSize: 8,
              letterSpacing: '0.08em',
              color: 'var(--text-tertiary)',
              minWidth: 56,
            }}
          >
            {r.tier}
          </span>
          <span
            style={{
              color: 'var(--text-primary)',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flex: 1,
            }}
          >
            {r.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Step 02 — Pick method + region ────────────────────────────────────
function StepMethodsIllustration() {
  const methods = ['CML 2001', 'ReCiPe (H)', 'TRACI 2.1']
  const regions: Array<{ id: string; gci: number }> = [
    { id: 'US-CA', gci: 0.21 },
    { id: 'US-NY', gci: 0.27 },
    { id: 'US-TX', gci: 0.48 },
    { id: 'DE',    gci: 0.39 },
    { id: 'FR',    gci: 0.08 },
  ]
  const maxGci = Math.max(...regions.map((r) => r.gci))
  return (
    <div
      style={{
        height: '100%',
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        gap: 10,
        fontFamily: 'var(--font-ui)',
      }}
    >
      {/* Methodology tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: 4,
        }}
      >
        {methods.map((m, i) => (
          <span
            key={m}
            className="mono"
            style={{
              fontSize: 9,
              padding: '3px 8px',
              borderRadius: 4,
              letterSpacing: '0.06em',
              background: i === 1
                ? 'color-mix(in oklab, var(--brand-primary) 14%, transparent)'
                : 'transparent',
              color: i === 1 ? 'var(--brand-primary)' : 'var(--text-tertiary)',
              fontWeight: i === 1 ? 600 : 500,
              border: i === 1
                ? '1px solid color-mix(in oklab, var(--brand-primary) 35%, transparent)'
                : '1px solid transparent',
            }}
          >
            {m}
          </span>
        ))}
      </div>
      {/* Region intensity bars */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          justifyContent: 'center',
        }}
      >
        {regions.map((r) => {
          const width = (r.gci / maxGci) * 100
          const active = r.id === 'US-NY'
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                className="mono"
                style={{
                  fontSize: 9,
                  width: 38,
                  color: active ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  fontWeight: active ? 600 : 500,
                }}
              >
                {r.id}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 7,
                  borderRadius: 2,
                  background: 'var(--surface-overlay)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${width}%`,
                    height: '100%',
                    background: active
                      ? 'var(--brand-primary)'
                      : 'color-mix(in oklab, var(--brand-primary) 55%, var(--surface-raised))',
                    opacity: active ? 1 : 0.7,
                  }}
                />
              </div>
              <span
                className="mono"
                style={{
                  fontSize: 8.5,
                  width: 44,
                  textAlign: 'right',
                  color: 'var(--text-tertiary)',
                }}
              >
                {r.gci.toFixed(2)} kg
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Step 03 — Run, compare, export ────────────────────────────────────
function StepExportIllustration() {
  const bars = [
    { label: 'GWP', pct: 92 },
    { label: 'AP',  pct: 64 },
    { label: 'EP',  pct: 48 },
    { label: 'ODP', pct: 22 },
  ]
  return (
    <div
      style={{
        height: '100%',
        display: 'grid',
        gridTemplateColumns: '1.4fr 1fr',
        gap: 14,
        fontFamily: 'var(--font-ui)',
      }}
    >
      {/* PDF preview */}
      <div
        style={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 4,
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
          boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 7,
            letterSpacing: '0.1em',
            color: 'var(--brand-primary)',
            fontWeight: 600,
          }}
        >
          GOAL & SCOPE
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--text-primary)',
            lineHeight: 1.2,
          }}
        >
          EV-pack baseline 2025
        </div>
        {/* impact bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2 }}>
          {bars.map((b, i) => (
            <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span
                className="mono"
                style={{
                  fontSize: 7,
                  width: 22,
                  color: 'var(--text-tertiary)',
                }}
              >
                {b.label}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 4,
                  background: 'var(--surface-overlay)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${b.pct}%`,
                    height: '100%',
                    background: 'var(--brand-primary)',
                    opacity: 1 - i * 0.18,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        {/* citation strip */}
        <div
          style={{
            marginTop: 'auto',
            paddingTop: 5,
            borderTop: '1px dashed var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 7,
            color: 'var(--text-tertiary)',
          }}
        >
          <span className="mono">openLCA · PubChem</span>
          <span className="mono">p. 1 / 14</span>
        </div>
      </div>
      {/* Side: ISO seal + download CTA */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div
          style={{
            border: '1px solid color-mix(in oklab, var(--brand-primary) 45%, transparent)',
            background: 'color-mix(in oklab, var(--brand-primary) 8%, var(--surface-raised))',
            borderRadius: 6,
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 7,
              letterSpacing: '0.1em',
              color: 'var(--brand-primary)',
              fontWeight: 700,
            }}
          >
            ISO 14040/14044
          </div>
          <div
            style={{ fontSize: 8, color: 'var(--text-secondary)', lineHeight: 1.3 }}
          >
            Compliant ·<br />Source-attributed
          </div>
        </div>
        <div
          style={{
            border: '1px solid var(--border-subtle)',
            background: 'var(--surface-raised)',
            borderRadius: 6,
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" style={{ color: 'var(--brand-primary)' }}>
            <line x1="6" y1="2" x2="6" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 3 6 L 6 9 L 9 6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="2" y1="11" x2="10" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-primary)' }}>
            Export PDF
          </span>
        </div>
      </div>
    </div>
  )
}
