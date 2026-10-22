'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { citedContributor, splitCitations } from '@/lib/insights/citations'
import type { Contributor } from '@/lib/insights/magic-insights'

/**
 * Replaces {{token}} markers in streamed text with subtle chips.
 * If the token matches a contributor name, the chip links to its source.
 */
export function renderWithCitations(
  text: string,
  contributors: Contributor[],
  ctx: { projectId: string; caseId: string },
): ReactNode {
  return splitCitations(text).map((part, i) => {
    if (part.kind === 'text') return <span key={i}>{part.text}</span>
    const value = part.value
    const match = citedContributor(value, contributors)
    const content = (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          padding: '1px 6px',
          borderRadius: 4,
          background: 'oklch(from var(--brand-primary) l c h / 0.10)',
          color: 'var(--brand-primary)',
          fontWeight: 600,
          fontSize: 13.5,
          marginInline: 1,
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    )
    if (match) {
      return (
        <Link
          key={i}
          href={`/project/${ctx.projectId}/case/${ctx.caseId}`}
          style={{ textDecoration: 'none' }}
        >
          {content}
        </Link>
      )
    }
    return <span key={i}>{content}</span>
  })
}
