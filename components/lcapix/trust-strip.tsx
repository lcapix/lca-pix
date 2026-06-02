import type { ReactNode } from "react"

/**
 * TrustStrip
 * ----------
 * In-product adaptation of enfos's grayscale Fortune-500 logo wall. Since
 * LCAPIX has no customer logos to flex (yet), we use the same posture for
 * methodology / standards LCAPIX speaks: ISO 14040, ISO 14044, GHG Protocol,
 * EPD. Authority by association — quiet, monochrome, lined up.
 *
 * Use in:
 *   - Empty /home hero (the "you have 0 projects" state)
 *   - Marketing landing pages (later)
 *   - Bottom of /project/new to reassure the user that the methodology is
 *     real, not invented
 */

export interface TrustItem {
  /** Short label, e.g. "ISO 14040". */
  label: string
  /** One-line description for the title attribute / tooltip. */
  hint?: string
}

export interface TrustStripProps {
  /** Override the default LCA standards if you want a different set. */
  items?: TrustItem[]
  /** Optional eyebrow above the strip. */
  eyebrow?: string
  /** Optional one-line caption under the strip. */
  caption?: ReactNode
  className?: string
  style?: React.CSSProperties
}

const DEFAULT_ITEMS: TrustItem[] = [
  { label: "ISO 14040", hint: "Life cycle assessment — principles and framework" },
  { label: "ISO 14044", hint: "Life cycle assessment — requirements and guidelines" },
  { label: "GHG Protocol", hint: "Greenhouse Gas Protocol corporate standard" },
  { label: "EPD", hint: "Environmental Product Declaration framework" },
  { label: "PEF", hint: "EU Product Environmental Footprint" },
]

export function TrustStrip({
  items = DEFAULT_ITEMS,
  eyebrow = "BUILT ON STANDARDS YOU CAN DEFEND",
  caption,
  className,
  style,
}: TrustStripProps) {
  return (
    <div className={className} style={style}>
      {eyebrow && (
        <div
          className="eyebrow"
          style={{
            color: "var(--text-tertiary)",
            fontSize: 11,
            letterSpacing: "0.16em",
            fontWeight: 600,
            textTransform: "uppercase",
            marginBottom: 14,
            textAlign: "center",
          }}
        >
          {eyebrow}
        </div>
      )}
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: 0,
          border: "1px solid var(--border-subtle)",
          borderRadius: 12,
          background: "var(--surface-raised, #fff)",
          overflow: "hidden",
        }}
      >
        {items.map((it, i) => {
          const isLast = i === items.length - 1
          return (
            <li
              key={it.label}
              title={it.hint}
              style={{
                flex: "1 1 0",
                minWidth: 110,
                textAlign: "center",
                padding: "16px 18px",
                borderRight: isLast
                  ? undefined
                  : "1px solid var(--border-subtle)",
                fontFamily: "var(--font-mono)",
                fontSize: 12.5,
                letterSpacing: "0.05em",
                color: "var(--text-tertiary)",
                fontWeight: 500,
                userSelect: "none",
              }}
            >
              {it.label}
            </li>
          )
        })}
      </ul>
      {caption && (
        <div
          style={{
            fontSize: 12,
            color: "var(--text-tertiary)",
            marginTop: 10,
            textAlign: "center",
          }}
        >
          {caption}
        </div>
      )}
    </div>
  )
}
