'use client'

// HelpTip — hover-to-read explanation. Every definition / teaching string in
// the app goes through this, so the screen stays clean and the understanding
// is one hover away. Rule (Shreya, 2026-09-15): explanations are hover;
// visible text is reserved for status and actions.

import type { ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export interface HelpTipProps {
  /** The explanation shown on hover. */
  children: ReactNode
  /** Accessible name for the trigger (screen readers). */
  label?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Max width of the bubble in px. */
  width?: number
}

export function HelpTip({ children, label = 'What is this?', side = 'top', width = 300 }: HelpTipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => e.preventDefault()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            // Visible enough to invite the hover: a faint grey dot was being
            // missed entirely (Shreya, 2026-09-16).
            width: 16,
            height: 16,
            marginLeft: 5,
            borderRadius: '50%',
            border: '1px solid color-mix(in oklab, var(--brand-primary) 40%, transparent)',
            background: 'color-mix(in oklab, var(--brand-primary) 12%, transparent)',
            color: 'var(--brand-primary)',
            fontSize: 10.5,
            fontWeight: 700,
            lineHeight: 1,
            cursor: 'help',
            verticalAlign: 'middle',
            padding: 0,
          }}
        >
          ?
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={4}
        style={{ maxWidth: width, textAlign: 'left', lineHeight: 1.45, fontSize: 12 }}
      >
        {children}
      </TooltipContent>
    </Tooltip>
  )
}
