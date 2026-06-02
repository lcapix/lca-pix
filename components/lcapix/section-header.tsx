import type { ReactNode } from "react"

/**
 * SectionHeader
 * --------------
 * Universal page/section header in the enfos posture:
 *   - Uppercase tracked eyebrow (single source of truth — no ad-hoc divs)
 *   - Display-md title (large, tight tracking, sans-serif)
 *   - One-line subtitle (text-secondary)
 *
 * Use at the top of every page and at the top of every major content block
 * inside a page. Keeps rhythm consistent across /home, /profile,
 * /library/*, /project/*.
 *
 * The optional `rule` prop draws a hairline under the header. Use sparingly —
 * only when the section sits inside a busy layout and needs visual separation
 * without a card.
 */

export interface SectionHeaderProps {
  /** Short uppercase context label, e.g. "FACTOR LIBRARY", "STEP 02". */
  eyebrow?: string
  /** Main heading. Renders as the visual h-level you specify (defaults to h2). */
  title: ReactNode
  /** Single sentence under the title. Keep under ~120 chars. */
  sub?: ReactNode
  /** Heading level for semantics — h1 for page headers, h2 for sections. */
  as?: "h1" | "h2" | "h3"
  /** Optional trailing element rendered on the right (e.g. a CTA button). */
  actions?: ReactNode
  /** Draw a hairline rule under the header block. */
  rule?: boolean
  /** Centered layout — use for hero / empty states only. */
  align?: "left" | "center"
  className?: string
  style?: React.CSSProperties
}

export function SectionHeader({
  eyebrow,
  title,
  sub,
  as = "h2",
  actions,
  rule = false,
  align = "left",
  className,
  style,
}: SectionHeaderProps) {
  const Tag = as

  // Match the existing .display / .display-md sizing scale so this composes
  // with the rest of the design system without introducing a new typography
  // ladder.
  const titleClass = as === "h1" ? "display display-md" : "display"
  const titleSize =
    as === "h1" ? 32 : as === "h2" ? 22 : 17
  const titleWeight = as === "h1" ? 600 : 600

  const isCentered = align === "center"

  return (
    <header
      className={className}
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 16,
        flexWrap: "wrap",
        textAlign: isCentered ? "center" : "left",
        justifyContent: isCentered ? "center" : "flex-start",
        paddingBottom: rule ? 16 : 0,
        borderBottom: rule ? "1px solid var(--border-subtle)" : undefined,
        ...style,
      }}
    >
      <div
        style={{
          flex: actions ? 1 : undefined,
          minWidth: 0,
          width: isCentered ? "100%" : undefined,
        }}
      >
        {eyebrow && (
          <div
            className="eyebrow"
            style={{
              color: "var(--text-tertiary)",
              fontSize: 11,
              letterSpacing: "0.16em",
              fontWeight: 600,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            {eyebrow}
          </div>
        )}
        <Tag
          className={titleClass}
          style={{
            fontSize: titleSize,
            fontWeight: titleWeight,
            margin: 0,
            letterSpacing: "-0.015em",
            lineHeight: 1.15,
            color: "var(--text-primary)",
          }}
        >
          {title}
        </Tag>
        {sub && (
          <p
            style={{
              fontSize: 13.5,
              color: "var(--text-secondary)",
              margin: 0,
              marginTop: 6,
              lineHeight: 1.5,
              maxWidth: isCentered ? 560 : 640,
              marginLeft: isCentered ? "auto" : undefined,
              marginRight: isCentered ? "auto" : undefined,
            }}
          >
            {sub}
          </p>
        )}
      </div>
      {actions && !isCentered && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {actions}
        </div>
      )}
    </header>
  )
}
