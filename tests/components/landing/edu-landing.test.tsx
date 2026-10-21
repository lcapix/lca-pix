// @vitest-environment jsdom
/**
 * The landing (F1.1): it renders, every link goes to a page that exists or
 * to a section on the page, and the lines with no code behind them (D10)
 * stay off it.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readdirSync, existsSync } from 'node:fs'
import path from 'node:path'

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }))

import { EduLanding } from '@/components/lcapix/landing/edu-landing'

const APP = path.join(process.cwd(), 'app')
const pageExists = (href: string) => existsSync(path.join(APP, href, 'page.tsx')) || (href === '/' && readdirSync(APP).includes('page.tsx'))

describe('landing', () => {
  it('renders the hero and links only to real pages and sections', () => {
    const { container } = render(<EduLanding />)
    expect(screen.getByRole('heading', { level: 1, name: 'Know the footprint of anything you make.' })).toBeTruthy()
    const hrefs = [...new Set([...container.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')!))]
    for (const h of hrefs) {
      if (h.startsWith('#')) expect(container.querySelector(h), h).not.toBeNull()
      else expect(pageExists(h), h).toBe(true)
    }
  })

  it('makes no claim the code does not back (D10)', () => {
    const { container } = render(<EduLanding />)
    const text = container.textContent ?? ''
    for (const claim of ['Book a demo', 'templates', 'Free for students', 'approval', 'Published v', 'Portfolio', 'organisation library', 'never see edit controls', 'snapshot time']) {
      expect(text.includes(claim), claim).toBe(false)
    }
    // The sample study's own run: the numbers on the page are its numbers.
    expect(text).toContain('1.72')
    expect(text).toContain('89.4%')
  })
})
