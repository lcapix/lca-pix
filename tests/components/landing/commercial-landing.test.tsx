// @vitest-environment jsdom
/**
 * The landing (F1.1), commercial version: it renders, every link goes to a
 * page that exists or to a section on the page, the lines with no code
 * behind them (D10) stay off it, and nothing on it is the classroom's.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readdirSync, existsSync } from 'node:fs'
import path from 'node:path'

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }))

import { CommercialLanding } from '@/components/lcapix/landing/commercial-landing'

const APP = path.join(process.cwd(), 'app')
const pageExists = (href: string) => existsSync(path.join(APP, href, 'page.tsx')) || (href === '/' && readdirSync(APP).includes('page.tsx'))

describe('landing', () => {
  it('renders the hero and links only to real pages and sections', () => {
    const { container } = render(<CommercialLanding />)
    expect(screen.getByRole('heading', { level: 1, name: 'Know what each thing you make costs and emits.' })).toBeTruthy()
    const hrefs = [...new Set([...container.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')!))]
    for (const h of hrefs) {
      if (h.startsWith('#')) expect(container.querySelector(h), h).not.toBeNull()
      else expect(pageExists(h), h).toBe(true)
    }
  })

  it('makes no claim the code does not back (D10)', () => {
    const { container } = render(<CommercialLanding />)
    const text = (container.textContent ?? '').toLowerCase()
    for (const claim of ['Book a demo', 'templates', 'approval', 'Published v', 'Portfolio', 'organisation library', 'ledger', 'forecast', 'utility bill', 'invoice']) {
      expect(text.includes(claim.toLowerCase()), claim).toBe(false)
    }
  })

  it('says nothing of the classroom or the sample study', () => {
    const { container } = render(<CommercialLanding />)
    const text = container.textContent ?? ''
    // "canvas" alone is the tree canvas; the course system is named as "in/from Canvas".
    // Words start at a boundary: textContent runs headings into lines ("impactEach").
    expect(text).not.toMatch(/\b(student|teach|class\b|classroom|instructor|professor|course|(in|from) Canvas|LMS\b|grades|Guided mode|exercise|hand-in|sample|worked example|bracket)/i)
  })
})
