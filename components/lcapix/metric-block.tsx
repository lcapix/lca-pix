"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "./icon"
import type { IconName } from "./icon"
import { useCountUp } from "@/lib/hooks/use-count-up"

/**
 * MetricBlock — calm, neutral KPI tile (replaces KpiTile for the enfos pass).
 *
 * Design intent:
 *   - No per-tile accent colors. Green is the only accent across the app.
 *   - No gradient backgrounds, no radial spotlights, no sparkline noise.
 *   - Hairline border, generous padding, mono number, eyebrow label.
 *   - Optional href turns the whole block into a click-through with a clear
 *     underline-on-hover CTA in the brand color.
 *
 * If you want decoration, you're in the wrong component — use a chart or
 * KpiTile instead.
 */

export interface MetricBlockProps {
  /** Uppercase tracked label, e.g. "PROJECTS". */
  label: string
  /** The raw number — animated with count-up. */
  value: number
  /** Override the rendered string (e.g. for pre-formatted ranges). */
  display?: string
  /** One-line context shown under the value, e.g. "across all cases". */
  sub?: string
  /** Optional unit suffix shown next to value in tertiary text. */
  unit?: string
  /** Optional decimal places for animated value. */
  decimals?: number
  /** Small monochrome icon — for orientation only, not decoration. */
  icon?: IconName
  /** Optional click-through. Adds a "View →" CTA on hover. */
  href?: string
  /** CTA copy when href is set. */
  hrefHint?: string
  /** Stagger delay for fade-in. */
  delayMs?: number
}

export function MetricBlock({
  label,
  value,
  display,
  sub,
  unit,
  decimals = 0,
  icon,
  href,
  hrefHint,
  delayMs = 0,
}: MetricBlockProps) {
  const router = useRouter()
  const animated = useCountUp(value, 900, decimals)
  const formatted =
    display ??
    animated.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })

  const interactive = Boolean(href)
  const handleClick = () => {
    if (href) router.push(href)
  }
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!href) return
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      router.push(href)
    }
  }

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? handleClick : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      aria-label={
        interactive
          ? `${label}: ${formatted}${unit ? ` ${unit}` : ""}. ${sub ?? ""}. ${hrefHint ?? "Open"}`
          : undefined
      }
      className="metric-block fade-slide-up"
      style={{
        animationDelay: `${delayMs}ms`,
        background: "var(--surface-raised, #fff)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 14,
        padding: "22px 22px 20px",
        cursor: interactive ? "pointer" : "default",
        transition:
          "border-color 160ms ease, transform 160ms ease, box-shadow 200ms ease",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        minHeight: 132,
      }}
      onMouseEnter={(e) => {
        if (!interactive) return
        const el = e.currentTarget
        el.style.borderColor = "var(--brand-primary)"
        el.style.transform = "translateY(-1px)"
        el.style.boxShadow = "0 14px 30px -22px rgba(0,0,0,0.15)"
      }}
      onMouseLeave={(e) => {
        if (!interactive) return
        const el = e.currentTarget
        el.style.borderColor = "var(--border-subtle)"
        el.style.transform = "translateY(0)"
        el.style.boxShadow = "none"
      }}
    >
      {/* Top row: icon + label */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 18,
        }}
      >
        {icon && (
          <Icon
            name={icon}
            size={13}
            style={{ color: "var(--text-tertiary)" }}
          />
        )}
        <div
          className="eyebrow"
          style={{
            color: "var(--text-tertiary)",
            letterSpacing: "0.14em",
            fontSize: 10.5,
            fontWeight: 600,
          }}
        >
          {label}
        </div>
      </div>

      {/* Value */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          className="mono"
          style={{
            fontSize: 36,
            fontWeight: 600,
            color: "var(--text-primary)",
            letterSpacing: "-0.025em",
            lineHeight: 1,
          }}
        >
          {formatted}
        </span>
        {unit && (
          <span
            className="mono"
            style={{
              fontSize: 13,
              color: "var(--text-tertiary)",
              fontWeight: 500,
            }}
          >
            {unit}
          </span>
        )}
      </div>

      {/* Sub-context */}
      {sub && (
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text-tertiary)",
            marginTop: 10,
            lineHeight: 1.4,
          }}
        >
          {sub}
        </div>
      )}

      {/* CTA — appears only when interactive */}
      {interactive && hrefHint && (
        <div
          style={{
            marginTop: "auto",
            paddingTop: 14,
            fontSize: 12,
            color: "var(--brand-primary)",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {hrefHint}
          <Icon
            name="arrow-up-right"
            size={11}
            style={{ color: "currentColor" }}
          />
        </div>
      )}
    </div>
  )
}
