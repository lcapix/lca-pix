import type { ReactNode } from "react"

/**
 * NumberedRail
 * --------------
 * Borrowed directly from enfos's 01-02-03 step rail. In LCAPIX, it serves to
 * explain a multi-step methodology in plain language — e.g. ISO 14040 phases
 * on /project/new, or the "how to start" rail on an empty /home.
 *
 * Layout intent:
 *   - Each step is its own block with a giant mono "0N" marker.
 *   - Hairline separators between steps (no card chrome).
 *   - Calm, content-led — no per-step accents.
 *
 * Use `orientation="horizontal"` for hero strips (3-5 steps), `"vertical"`
 * for dense documentation-style rails (any count).
 */

export interface NumberedRailStep {
  title: string
  description?: ReactNode
  /** Optional supporting text shown under the description in mono. */
  detail?: string
}

export interface NumberedRailProps {
  steps: NumberedRailStep[]
  orientation?: "horizontal" | "vertical"
  /** Optional eyebrow above the rail. */
  eyebrow?: string
  className?: string
  style?: React.CSSProperties
}

export function NumberedRail({
  steps,
  orientation = "horizontal",
  eyebrow,
  className,
  style,
}: NumberedRailProps) {
  const horizontal = orientation === "horizontal"

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
            marginBottom: 16,
          }}
        >
          {eyebrow}
        </div>
      )}
      <ol
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gridTemplateColumns: horizontal
            ? `repeat(${steps.length}, minmax(0, 1fr))`
            : "1fr",
          gap: 0,
          border: "1px solid var(--border-subtle)",
          borderRadius: 14,
          overflow: "hidden",
          background: "var(--surface-raised, #fff)",
        }}
      >
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1
          return (
            <li
              key={i}
              style={{
                padding: "22px 22px 24px",
                borderRight:
                  horizontal && !isLast
                    ? "1px solid var(--border-subtle)"
                    : undefined,
                borderBottom:
                  !horizontal && !isLast
                    ? "1px solid var(--border-subtle)"
                    : undefined,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 13,
                  letterSpacing: "0.08em",
                  fontWeight: 500,
                  color: "var(--brand-primary)",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.3,
                }}
              >
                {step.title}
              </div>
              {step.description && (
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    lineHeight: 1.55,
                  }}
                >
                  {step.description}
                </div>
              )}
              {step.detail && (
                <div
                  className="mono"
                  style={{
                    fontSize: 11.5,
                    color: "var(--text-tertiary)",
                    letterSpacing: "0.04em",
                    marginTop: 4,
                  }}
                >
                  {step.detail}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
