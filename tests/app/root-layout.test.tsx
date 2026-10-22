// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import type React from 'react'

vi.mock('next/font/google', () => ({
  Inter_Tight: () => ({ variable: 'font-sans' }),
  IBM_Plex_Mono: () => ({ variable: 'font-mono' }),
}))
vi.mock('@/components/global/command-palette', () => ({ GlobalCommandPalette: () => null }))
vi.mock('@/components/global/shortcut-help', () => ({ ShortcutHelp: () => null }))
vi.mock('@/components/global/route-progress', () => ({ RouteProgress: () => null }))
vi.mock('@/components/global/scroll-progress', () => ({ ScrollProgress: () => null }))

import RootLayout from '@/app/layout'
import { Toaster } from '@/components/ui/sonner'

function findAll(node: unknown, match: (el: React.ReactElement) => boolean): React.ReactElement[] {
  const out: React.ReactElement[] = []
  const walk = (n: unknown) => {
    if (Array.isArray(n)) return n.forEach(walk)
    if (!n || typeof n !== 'object' || !('props' in (n as any))) return
    const el = n as React.ReactElement<any>
    if (match(el)) out.push(el)
    walk(el.props?.children)
  }
  walk(node)
  return out
}

describe('RootLayout', () => {
  // X-UI-1: 30 files call toast(); without a mounted container none of them render.
  it('mounts exactly one sonner Toaster, bottom-right with a close button', () => {
    const tree = RootLayout({ children: <div /> })
    const toasters = findAll(tree, (el) => el.type === Toaster)
    expect(toasters).toHaveLength(1)
    expect((toasters[0].props as any).position).toBe('bottom-right')
    expect((toasters[0].props as any).closeButton).toBe(true)
  })
})
