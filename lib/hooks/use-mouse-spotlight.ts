'use client'

import { useEffect, useRef } from 'react'

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Returns a ref that, when attached to an element, sets `--mouse-x` / `--mouse-y` CSS variables on mousemove. */
export function useMouseSpotlight<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (prefersReducedMotion()) return
    const onMove = (e: MouseEvent) => {
      const r = node.getBoundingClientRect()
      const x = ((e.clientX - r.left) / r.width) * 100
      const y = ((e.clientY - r.top) / r.height) * 100
      node.style.setProperty('--mouse-x', `${x}%`)
      node.style.setProperty('--mouse-y', `${y}%`)
    }
    node.addEventListener('mousemove', onMove)
    return () => node.removeEventListener('mousemove', onMove)
  }, [])

  return ref
}
